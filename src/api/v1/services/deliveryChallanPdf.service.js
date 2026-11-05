const path = require('path');
const ejs = require('ejs');
const moment = require('moment');
const puppeteer = require('puppeteer');
const { projectPaths } = require('../../../config/constants');
const { formatAmount } = require('./conversion');
const { getBrowser } = require('../controllers/invoice.controller');
const { ApiError } = require('./ApiError');
const { db } = require('../database');
const { fetchInvoiceChallanById } = require('../models/invoiceChallan.model');

/**
 * Generate PDF buffer for a Delivery Challan under Rule 55 of CGST Rules
 * 
 * @param {number|string} challanId 
 * @returns {Promise<Buffer>}
 */
const generateDeliveryChallanPdf = async (challanId) => {
    if (!challanId) {
        throw new ApiError({ statusCode: 400, message: 'Challan ID is required for PDF generation.' });
    }

    const challanData = await fetchInvoiceChallanById(challanId);
    if (!challanData) {
        throw new ApiError({ statusCode: 404, message: 'Delivery Challan not found.' });
    }

    const items = Array.isArray(challanData.items) ? challanData.items : [];
    let approxTotal = 0;
    const formattedItems = items.map(it => {
        const itemQty = parseFloat(it.qty || 1);
        const itemRate = parseFloat(it.rate || 0);
        const itemTotal = parseFloat(it.total || (itemQty * itemRate));
        approxTotal += itemTotal;

        return {
            ...it,
            item_name: it.item_name || it.itemName || 'Material Item',
            description: it.description || '',
            hsn_sac_code: it.hsn_sac_code || it.hsnSacCode || '',
            qty: itemQty,
            unit: it.unit || 'Nos',
            rate: itemRate,
            formatted_rate: formatAmount(itemRate),
            total: itemTotal,
            formatted_total: formatAmount(itemTotal)
        };
    });

    const challanDate = challanData.challanDate || challanData.challan_date;

    const challanViewModel = {
        ...challanData,
        challan_no: challanData.challanNo || challanData.challan_no,
        formatted_date: challanDate ? moment(challanDate).format('DD/MM/YYYY') : moment().format('DD/MM/YYYY'),
        customer_name: challanData.customerName || challanData.partyLegalName || challanData.partyDisplayName || challanData.customer_name || 'Customer / Consignee',
        party_gstin: challanData.partyGstin || challanData.party_gstin || '',
        delivery_address: challanData.deliveryAddress || challanData.delivery_address || '',
        transport_mode: challanData.transportMode || challanData.transport_mode || 'Road',
        vehicle_no: challanData.vehicleNo || challanData.vehicle_no || '',
        transporter_name: challanData.transporterName || challanData.transporter_name || '',
        lr_no: challanData.lrNo || challanData.lr_no || '',
        dispatch_reason: challanData.dispatchReason || challanData.dispatch_reason || 'Supply on Delivery',
        status: challanData.status || ((challanData.invoiceId || challanData.invoice_id) ? 'BILLED' : 'DISPATCHED'),
        notes: challanData.notes || '',
        total_quantity: challanData.totalQuantity || challanData.total_quantity || items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0) || 1,
        approx_total: approxTotal,
        formatted_approx_total: formatAmount(approxTotal),
        items: formattedItems
    };

    // Load firm information from DB
    const effectiveFirmId = challanData.firmId || challanData.firm_id || 1;
    let firmViewModel = {
        name: challanData.firmName || challanData.firm_name || 'K.S. ENGINEERING WORKS',
        subtitle: 'PRECISION MACHINING & FABRICATION',
        address: 'Plot No. W-124, MIDC Ambad, Nashik - 422010, Maharashtra, India',
        gstin: '27AABCK1234F1Z5',
        phone: '+91 98220 00000',
        email: 'info@ksengineering.com'
    };

    try {
        const dbFirm = await db('firms AS F')
            .select(
                'F.firm_name',
                'F.firm_type',
                'F.gstin',
                'UC.email',
                'UC.phone_number',
                'UC.address_line1'
            )
            .leftJoin('user_contacts AS UC', function () {
                this.on('F.id', '=', 'UC.entity_id')
                    .andOn('UC.entity_type', '=', db.raw('?', ['firm']));
            })
            .where('F.id', effectiveFirmId)
            .first();

        if (dbFirm) {
            firmViewModel = {
                name: dbFirm.firm_name || firmViewModel.name,
                subtitle: dbFirm.firm_type || firmViewModel.subtitle,
                address: dbFirm.address_line1 || firmViewModel.address,
                gstin: dbFirm.gstin || firmViewModel.gstin,
                phone: dbFirm.phone_number || firmViewModel.phone,
                email: dbFirm.email || firmViewModel.email
            };
        }
    } catch (err) {
        console.error('Failed to load firm details for challan PDF fallback:', err.message);
    }

    const templatePath = path.join(projectPaths.ROOT_DIR, 'templates', 'challan', 'delivery-challan.ejs');

    const htmlContent = await ejs.renderFile(templatePath, {
        challan: challanViewModel,
        firm: firmViewModel
    });

    const browser = await getBrowser(puppeteer);
    const page = await browser.newPage();

    try {
        await page.setContent(htmlContent, { waitUntil: 'load', timeout: 30000 });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            preferCSSPageSize: true
        });

        return pdfBuffer;
    } finally {
        await page.close();
    }
};

module.exports = {
    generateDeliveryChallanPdf
};

