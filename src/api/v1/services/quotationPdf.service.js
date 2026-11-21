const path = require('path');
const ejs = require('ejs');
const moment = require('moment');
const puppeteer = require('puppeteer');
const { projectPaths } = require('../../../config/constants');
const { formatAmount, amountToWords } = require('./conversion');
const { getBrowser } = require('../controllers/invoice.controller');
const { ApiError } = require('./ApiError');

// Default 5 configurable specification columns for Matrix Template
const DEFAULT_MATRIX_COLUMNS = [
    { id: 'materialGrade', header: 'MATERIAL GRADE & STANDARD', width: '15%', enabled: true },
    { id: 'weight', header: 'INPUT & NET WEIGHT', width: '13%', enabled: true },
    { id: 'baseMetal', header: 'BASE METAL & ESCALATION', width: '14%', enabled: true },
    { id: 'machining', header: 'MACHINING & HEAT TREATMENT', width: '16%', enabled: true },
    { id: 'surface', header: 'SURFACE & TESTING NORMS', width: '14%', enabled: true }
];

// Fallback dynamic cards if annexure_data is empty - only populate from real product master fields if available
const generateFallbackCards = (item) => {
    const fields = [];
    if (item.product_material_grade || item.productMaterialGrade) {
        fields.push({ key: 'grade', label: 'Material Grade', value: item.product_material_grade || item.productMaterialGrade, highlight: true });
    }
    if (item.product_dimensions || item.productDimensions) {
        fields.push({ key: 'size', label: 'Dimensions', value: item.product_dimensions || item.productDimensions, highlight: false });
    }
    if (item.product_unit_weight_kg || item.productUnitWeightKg) {
        fields.push({ key: 'unit_wt', label: 'Unit Weight', value: `${item.product_unit_weight_kg || item.productUnitWeightKg} Kg`, highlight: false });
    }
    if (fields.length > 0) {
        return [{
            id: 'specifications',
            title: 'Product Specifications',
            icon: '🛡',
            fields
        }];
    }
    return [];
};

// Default engineering / manufacturing terms and conditions
const DEFAULT_QUOTATION_TNC = [
    'Rates quoted are valid for applicable validity period as mentioned in the quotation.',
    'Delivery schedule commences from the date of confirmed PO and approved drawings.',
    'All disputes and transactions are subject to Nashik (Maharashtra) jurisdiction only.'
];

// Default engineering technical clauses
const DEFAULT_QUOTATION_SPECIAL_NOTES = [
    'Components will be manufactured strictly adhering to customer-approved drawings and technical specifications.',
    'Standard pre-dispatch inspection report (PDIR) and manufacturer test certificate will accompany the dispatch lot.',
    'Any alteration or design revision requested post-PO placement will be subject to revised price and delivery schedule.'
];

// Helper to parse multiline string or bullet points into clean line array
const parseTncLines = (rawText, fallbackList) => {
    if (rawText && typeof rawText === 'string' && rawText.trim().length > 0) {
        const lines = rawText
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean)
            .map(l => l.replace(/^[-•*]\s*/, '').replace(/^\d+[\.)]\s*/, '').trim())
            .filter(Boolean);
        if (lines.length > 0) return lines;
    }
    return fallbackList;
};

/**
 * Generate PDF buffer for Quotation
 */
const generateQuotationPdf = async (quotationData) => {
    if (!quotationData) {
        throw new ApiError({ statusCode: 400, message: 'Invalid quotation data for PDF rendering.' });
    }

    const isInterState = Number(quotationData.igst || 0) > 0 || (
        quotationData.place_of_supply &&
        !quotationData.place_of_supply.toLowerCase().includes('maharashtra') &&
        !quotationData.place_of_supply.includes('27')
    ) || (
            quotationData.firm_gstin && quotationData.gst_number &&
            quotationData.firm_gstin.substring(0, 2) !== quotationData.gst_number.substring(0, 2)
        );

    const templateType = (quotationData.templateType || quotationData.template_type || 'CARDS').toUpperCase();

    // Determine matrix columns from tableSpecConfig or table_spec_config or default
    let matrixColumns = DEFAULT_MATRIX_COLUMNS;
    const rawSpecCfg = quotationData.tableSpecConfig !== undefined ? quotationData.tableSpecConfig : quotationData.table_spec_config;
    if (rawSpecCfg) {
        let parsed = rawSpecCfg;
        if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch (_) { parsed = null; }
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
            matrixColumns = parsed.filter(c => c.enabled !== false);
        }
    }

    // Pagination for Annexure Cards (3 items per page matching design standard)
    const itemsPerAnnexPage = 3;

    // Prepare items with formatted financial columns
    const rawItems = quotationData.items || [];
    const formattedItems = rawItems.map((item, idx) => {
        let annexureData = item.annexureData !== undefined ? item.annexureData : item.annexure_data;
        if (typeof annexureData === 'string') {
            try {
                annexureData = JSON.parse(annexureData);
            } catch (_) {
                annexureData = null;
            }
        }

        let sections = annexureData?.sections;
        if (!Array.isArray(sections) || sections.length === 0) {
            sections = generateFallbackCards(item);
        }

        // Prepare Matrix cell HTML dictionary dynamically for all active matrixColumns
        const matrixCellHtml = {};
        const matrixData = annexureData?.matrix || {};

        matrixColumns.forEach(col => {
            const colId = col.id;
            const val = matrixData && matrixData[colId] !== undefined && matrixData[colId] !== null
                ? String(matrixData[colId]).trim()
                : '';

            if (val) {
                const lines = val.split('\n').map(l => {
                    const line = l.trim();
                    if (line.includes(':')) {
                        const colonIdx = line.indexOf(':');
                        const k = line.substring(0, colonIdx + 1);
                        const v = line.substring(colonIdx + 1);
                        return `<span class="lbl">${k}</span> <span class="val">${v}</span>`;
                    }
                    return `<span class="val">${line}</span>`;
                });
                matrixCellHtml[colId] = lines.join('<br>');
            } else {
                matrixCellHtml[colId] = '-';
            }
        });

        const annexurePageNumber = 2 + Math.floor(idx / itemsPerAnnexPage);

        return {
            ...item,
            item_index: idx + 1,
            annexure_page: annexurePageNumber,
            formatted_rate: formatAmount(item.rate),
            formatted_taxable: formatAmount(item.taxable_amount),
            formatted_total: formatAmount(item.total),
            sections,
            matrixData,
            matrixCellHtml
        };
    });

    const includeAnnexure = quotationData.include_annexure !== false && quotationData.includeAnnexure !== false;

    const annexurePages = [];
    if (includeAnnexure) {
        for (let i = 0; i < formattedItems.length; i += itemsPerAnnexPage) {
            annexurePages.push(formattedItems.slice(i, i + itemsPerAnnexPage));
        }
    }

    const totalPages = !includeAnnexure ? 1 : (templateType === 'MATRIX' ? 2 : 1 + Math.max(1, annexurePages.length));

    // Empty filler rows removed - render only rows with actual data
    const emptyRowsCount = 0;
    const toTitleCase = (str) => {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const formatPlaceOfSupply = (pos) => {
        if (!pos) return '';
        const match = pos.match(/^([^(]+)(?:\((?:State Code:\s*)?(\d+)\))?/i);
        if (match) {
            const stateName = toTitleCase(match[1].trim());
            const code = match[2];
            return code ? `${stateName} (State Code: ${code})` : stateName;
        }
        return toTitleCase(pos);
    };

    const clientRfqRef = quotationData.client_rfq_ref || quotationData.clientRfqRef || quotationData.rfq_ref || '-';

    const firmGstin = quotationData.firm_branch_gstin || quotationData.firm_gstin || '';
    const firmPan = quotationData.firm_pan || (firmGstin && firmGstin.length >= 12 ? firmGstin.substring(2, 12) : '');

    const templateData = {
        firm: {
            name: quotationData.firm_name || '',
            subtitle: quotationData.firm_type || '',
            address: quotationData.firm_address || '',
            gstin: firmGstin,
            pan: firmPan,
            email: quotationData.firm_email || '',
            phone_number: quotationData.firm_phone_number || '',
            logo_url: quotationData.firm_logo_url || null
        },
        quotation: {
            ...quotationData,
            client_rfq_ref: clientRfqRef,
            place_of_supply: formatPlaceOfSupply(quotationData.place_of_supply || quotationData.placeOfSupply),
            formatted_date: quotationData.quotation_date ? moment(quotationData.quotation_date).format('DD-MMM-YYYY') : moment().format('DD-MMM-YYYY'),
            formatted_validity_date: quotationData.validity_date ? moment(quotationData.validity_date).format('DD-MMM-YYYY') : moment(quotationData.quotation_date || undefined).add(Number(quotationData.validity_days) || 30, 'days').format('DD-MMM-YYYY'),
            formatted_sub_total: formatAmount(quotationData.sub_total || 0),
            formatted_taxable_amount: formatAmount(quotationData.taxable_amount || 0),
            formatted_discount_amount: formatAmount(quotationData.discount_amount || 0),
            formatted_other: formatAmount(quotationData.other || 0),
            formatted_cgst: formatAmount(quotationData.cgst || 0),
            formatted_sgst: formatAmount(quotationData.sgst || 0),
            formatted_igst: formatAmount(quotationData.igst || 0),
            formatted_round_off: formatAmount(quotationData.round_off || 0),
            formatted_total: formatAmount(quotationData.total || 0),
        },
        bank: {
            bank_name: quotationData.bank_name || '',
            account_number: quotationData.account_number || '',
            ifsc_code: quotationData.ifsc_code || '',
            branch_name: quotationData.bank_branch_name || ''
        },
        items: formattedItems,
        emptyRowsCount,
        isInterState,
        includeAnnexure,
        matrixColumns,
        annexurePages,
        totalPages,
        totalAmountInWords: amountToWords(Number(quotationData.total || 0)),
        termsList: parseTncLines(
            quotationData.terms_and_conditions !== undefined ? quotationData.terms_and_conditions : quotationData.termsAndConditions,
            DEFAULT_QUOTATION_TNC
        ),
        specialNotesList: parseTncLines(
            quotationData.special_notes !== undefined ? quotationData.special_notes : quotationData.specialNotes,
            DEFAULT_QUOTATION_SPECIAL_NOTES
        )
    };

    const templateFileName = templateType === 'MATRIX' ? 'quotation-matrix.ejs' : 'quotation-cards.ejs';
    const templatePath = path.join(projectPaths.ROOT_DIR, 'templates', 'quotation', templateFileName);

    const filledHtml = await ejs.renderFile(templatePath, templateData);

    const browser = await getBrowser(puppeteer);
    let page;

    try {
        page = await browser.newPage();
        await page.setContent(filledHtml, { waitUntil: 'load' });

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0mm',
                bottom: '0mm',
                left: '0mm',
                right: '0mm'
            }
        });

        return Buffer.from(pdf);
    } finally {
        if (page) {
            await page.close().catch(() => { });
        }
    }
};

module.exports = {
    generateQuotationPdf,
    DEFAULT_MATRIX_COLUMNS
};
