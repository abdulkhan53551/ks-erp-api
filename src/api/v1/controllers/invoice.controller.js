const { projectPaths, errorCodes } = require("../../../config/constants");
const { sampleInvoiceData } = require("./sampleInvoiceData");
const path = require('path')
const ejs = require('ejs')
const puppeteer = require('puppeteer');
const fs = require('fs')
const moment = require("moment");
const { ApiError } = require('./../services/ApiError');
const { asyncHandler } = require("../services/asyncHandler");
const { ApiResponse } = require("../services/ApiResponse");
const { fetchAllInvoice, fetchInvoiceMeta, fetchInvoiceById, insertInvoice, updateInvoiceById, deleteInvoiceById, bulkDeleteInvoices: bulkDeleteInvoicesModel, restoreInvoiceById, bulkRestoreInvoices: bulkRestoreInvoicesModel, fetchChallanPOEwayBillsForInvoice, fetchLastInvoiceNumber, fetchInvoiceSettings } = require("../models/invoice.model");
const { ERROR_CODES } = require("../../../config/constants/statusCodeMap");
const Decimal = require('decimal.js');
const { fetchGSTSlabs, fetchStates, fetchAllCities } = require("../models/masters.model");
const { formatAmount, amountToWords, toTitleCase } = require("../services/conversion");
const { getContext } = require("../helpers/requestContext");
const TOLERANCE = 0.01; // ₹0.01 = 1 paise

// Fetch all invoice
const getAllInvoice = asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, search = '', trash = false } = req.query;

    const result = await fetchAllInvoice({ page, pageSize, search, trash });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: result.length ? 'Invoice fetched successfully.' : 'No invoice found.',
            data: result,
        })
    );
});

// Fetch invoice meta
const getInvoiceMeta = asyncHandler(async (req, res) => {
    const result = await fetchInvoiceMeta(req.query);

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: result, message: 'Invoice pagination fetch successfully.' }));
});

// Fetch invoice by ID
const getInvoiceById = asyncHandler(async (req, res) => {
    const invoiceId = req.params.id;

    const result = await fetchInvoiceById(invoiceId);

    if (!result) {
        throw new ApiError({ statusCode: 404, message: 'Invoice not found.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Invoice fetched successfully.',
        })
    );
});

// Create a new invoice
const createInvoice = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const invoice = req.body;
    const { items, billingAddress, shippingAddress } = invoice;

    // 2. Compare with frontend values
    const mismatches = await validateInvoiceTotals({ items, invoice })

    // 3. If mismatch exceeds tolerance, throw error
    if (mismatches.length > 0) {
        throw new ApiError({
            statusCode: 400,
            errors: mismatches,
            errorCode: ERROR_CODES.BAD_REQUEST,
            message: 'Invoice totals mismatch beyond acceptable tolerance'
        })
    }

    // Create invoice
    const invoiceMaster = {
        invoice_no: invoice.invoiceNo,
        invoice_date: invoice.invoiceDate,
        due_days: invoice.dueDays,
        due_date: invoice.dueDate,
        customer_name: invoice.customerName,
        party_id: invoice.partyId ? Number(invoice.partyId) : null,
        branch_id: invoice.branchId ? Number(invoice.branchId) : null,
        has_gst: invoice.hasGst,
        gst_number: invoice.gstNumber,
        has_challan: invoice.hasChallan,
        has_po: invoice.hasPo,
        has_eway_bill: invoice.hasEwayBill,
        sub_total: new Decimal(invoice.subTotal).toDecimalPlaces(2).toNumber(),
        discount_percent: new Decimal(invoice.discountPercent).toDecimalPlaces(2).toNumber(),
        discount_amount: new Decimal(invoice.discountAmount).toDecimalPlaces(2).toNumber(),
        taxable_amount: new Decimal(invoice.taxableAmount).toDecimalPlaces(2).toNumber(),
        cgst: new Decimal(invoice.cgst).toDecimalPlaces(2).toNumber(),
        sgst: new Decimal(invoice.sgst).toDecimalPlaces(2).toNumber(),
        igst: new Decimal(invoice.igst).toDecimalPlaces(2).toNumber(),
        total: new Decimal(invoice.total).toDecimalPlaces(2).toNumber(),
        round_off: new Decimal(invoice.roundOff).toDecimalPlaces(2).toNumber(),
        other: new Decimal(invoice.other).toDecimalPlaces(2).toNumber(),
        payment_status_id: invoice.paymentStatusId,
        payment_mode_id: invoice.paymentModeId,
        status: 'Final',
        firm_id: firmId
    };

    // Prepare invoice items
    const invoiceItems = items.map(item => ({
        product_id: item.productId ? Number(item.productId) : null,
        description: item.description,
        hsn_sac_code: item.hsnSacCode,
        qty: item.qty,
        item_unit_id: item.itemUnitId,
        rate: new Decimal(item.rate).toDecimalPlaces(2).toNumber(),
        discount_percent: new Decimal(item.discountPercent).toDecimalPlaces(2).toNumber(),
        discount_amount: new Decimal(item.discountAmount).toDecimalPlaces(2).toNumber(),
        sub_total: new Decimal(item.subTotal).toDecimalPlaces(2).toNumber(),
        taxable_amount: new Decimal(item.taxableAmount).toDecimalPlaces(2).toNumber(),
        gst_slab_id: item.gstSlabId,
        cgst: new Decimal(item.cgst).toDecimalPlaces(2).toNumber(),
        sgst: new Decimal(item.sgst).toDecimalPlaces(2).toNumber(),
        igst: new Decimal(item.igst).toDecimalPlaces(2).toNumber(),
        total: new Decimal(item.total).toDecimalPlaces(2).toNumber()
    }));

    // Prepare billing address
    const billing = {
        contact_type: 'BILLING',
        branch_name: billingAddress.branchName || null,
        gstin: billingAddress.gstin || null,
        email: billingAddress.email,
        phone_number: billingAddress.phoneNumber,
        website: billingAddress.website,
        address_line1: billingAddress.addressLine1,
        city_id: billingAddress.cityId,
        state_id: billingAddress.stateId,
        pincode: billingAddress.pincode,
    };

    // Prepare shipping address
    const shipping = {
        contact_type: 'SHIPPING',
        branch_name: shippingAddress.branchName || null,
        gstin: shippingAddress.gstin || null,
        email: shippingAddress.email,
        phone_number: shippingAddress.phoneNumber,
        website: shippingAddress.website,
        address_line1: shippingAddress.addressLine1,
        city_id: shippingAddress.cityId,
        state_id: shippingAddress.stateId,
        pincode: shippingAddress.pincode,
    };

    // Invoice Document
    const invoiceDocument = {
        challanIds: invoice.challanIds,
        purchaseOrderIds: invoice.poIds,
        ewayBillIds: invoice.ewayBillIds
    };

    // Insert invoice
    const invoiceId = await insertInvoice({
        masterData: invoiceMaster,
        items: invoiceItems,
        billing,
        shipping,
        document: invoiceDocument
    });

    // If invoiceId is not returned, throw an error
    if (!invoiceId) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while creating invoice' })
    }

    const response = {
        id: invoiceId,
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: response, message: 'Invoice created successfully.' })
    )
})

// Update invoice by ID
const updateInvoice = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const { id: invoiceId } = req.params;
    const invoice = req.body;
    const { items, billingAddress, shippingAddress } = invoice;

    const mismatches = await validateInvoiceTotals({ items, invoice })

    // 3. If mismatch exceeds tolerance, throw error
    if (mismatches.length > 0) {
        throw new ApiError({
            statusCode: 400,
            errors: mismatches,
            errorCode: ERROR_CODES.BAD_REQUEST,
            message: 'Invoice totals mismatch beyond acceptable tolerance'
        })
    }

    // Update invoice
    const invoiceMaster = {
        invoice_no: invoice.invoiceNo,
        invoice_date: invoice.invoiceDate,
        due_days: invoice.dueDays,
        due_date: invoice.dueDate,
        customer_name: invoice.customerName,
        party_id: invoice.partyId !== undefined ? (invoice.partyId ? Number(invoice.partyId) : null) : undefined,
        branch_id: invoice.branchId !== undefined ? (invoice.branchId ? Number(invoice.branchId) : null) : undefined,
        has_gst: invoice.hasGst,
        gst_number: invoice.gstNumber,
        has_challan: invoice.hasChallan,
        has_po: invoice.hasPo,
        has_eway_bill: invoice.hasEwayBill,
        sub_total: new Decimal(invoice.subTotal).toDecimalPlaces(2).toNumber(),
        discount_percent: new Decimal(invoice.discountPercent).toDecimalPlaces(2).toNumber(),
        discount_amount: new Decimal(invoice.discountAmount).toDecimalPlaces(2).toNumber(),
        taxable_amount: new Decimal(invoice.taxableAmount).toDecimalPlaces(2).toNumber(),
        cgst: new Decimal(invoice.cgst).toDecimalPlaces(2).toNumber(),
        sgst: new Decimal(invoice.sgst).toDecimalPlaces(2).toNumber(),
        igst: new Decimal(invoice.igst).toDecimalPlaces(2).toNumber(),
        total: new Decimal(invoice.total).toDecimalPlaces(2).toNumber(),
        round_off: new Decimal(invoice.roundOff).toDecimalPlaces(2).toNumber(),
        other: new Decimal(invoice.other).toDecimalPlaces(2).toNumber(),
        payment_status_id: invoice.paymentStatusId,
        payment_mode_id: invoice.paymentModeId,
        status: 'Final',
        firm_id: firmId
    };

    const invoiceItems = items.map(item => ({
        id: item.id,
        product_id: item.productId ? Number(item.productId) : null,
        description: item.description,
        hsn_sac_code: item.hsnSacCode,
        qty: item.qty,
        item_unit_id: item.itemUnitId,
        rate: new Decimal(item.rate).toDecimalPlaces(2).toNumber(),
        discount_percent: new Decimal(item.discountPercent).toDecimalPlaces(2).toNumber(),
        discount_amount: new Decimal(item.discountAmount).toDecimalPlaces(2).toNumber(),
        sub_total: new Decimal(item.subTotal).toDecimalPlaces(2).toNumber(),
        taxable_amount: new Decimal(item.taxableAmount).toDecimalPlaces(2).toNumber(),
        gst_slab_id: item.gstSlabId,
        cgst: new Decimal(item.cgst).toDecimalPlaces(2).toNumber(),
        sgst: new Decimal(item.sgst).toDecimalPlaces(2).toNumber(),
        igst: new Decimal(item.igst).toDecimalPlaces(2).toNumber(),
        total: new Decimal(item.total).toDecimalPlaces(2).toNumber()
    }));

    // Prepare billing address
    const billing = {
        id: billingAddress.id,
        contact_type: 'BILLING',
        branch_name: billingAddress.branchName !== undefined ? billingAddress.branchName : undefined,
        gstin: billingAddress.gstin !== undefined ? billingAddress.gstin : undefined,
        email: billingAddress.email,
        phone_number: billingAddress.phoneNumber,
        website: billingAddress.website,
        address_line1: billingAddress.addressLine1,
        city_id: billingAddress.cityId,
        state_id: billingAddress.stateId,
        pincode: billingAddress.pincode,
    };

    // Prepare shipping address
    const shipping = {
        id: shippingAddress.id,
        contact_type: 'SHIPPING',
        branch_name: shippingAddress.branchName !== undefined ? shippingAddress.branchName : undefined,
        gstin: shippingAddress.gstin !== undefined ? shippingAddress.gstin : undefined,
        email: shippingAddress.email,
        phone_number: shippingAddress.phoneNumber,
        website: shippingAddress.website,
        address_line1: shippingAddress.addressLine1,
        city_id: shippingAddress.cityId,
        state_id: shippingAddress.stateId,
        pincode: shippingAddress.pincode,
    };

    // Invoice Document
    const invoiceDocument = {
        challanIds: invoice.challanIds,
        purchaseOrderIds: invoice.poIds,
        ewayBillIds: invoice.ewayBillIds
    };

    // Update invoice
    const affectedRows = await updateInvoiceById({
        invoiceId,
        masterData: invoiceMaster,
        items: invoiceItems,
        billing,
        shipping,
        document: invoiceDocument
    });

    // If no rows were affected, it means the invoice was not found or update failed
    if (!affectedRows) {
        throw new ApiError({ statusCode: 404, message: 'Invoice not found or update failed' });
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Invoice updated successfully.' })
    );
});

/**
 * Validate invoice totals by comparing frontend vs backend calculation
 * @param {Array} items - Invoice line items
 * @param {Object} invoice - Invoice header data (discount, gst, total, etc.)
 */
const validateInvoiceTotals = async ({
    items,
    invoice,
}) => {
    // 1. Get all GST slabs
    const gstSlabResult = await fetchGSTSlabs() ?? [];

    // 2. Convert gst slabs to key-value pairs for easy access
    const gstSlabs = gstSlabResult.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
    }, {});

    // 3. Prepare backend calculation from items
    const invoiceItemsCalculation = items.map(item => {
        const qty = new Decimal(item.qty || 0);
        const rate = new Decimal(item.rate || 0);
        const amount = qty.times(rate);
        const gstRate = new Decimal(gstSlabs[item.gstSlabId]?.gst_rate || 0);
        const discountPercent = new Decimal(item.discountPercent || 0);
        const discountAmount = new Decimal(item.discountAmount || 0);
        const discount = calculateDiscount(amount, discountAmount, discountPercent);

        return { quantity: qty, rate, gstRate, discount };
    });

    // 4. Backend totals
    const backendTotals = calculateInvoiceTotals(invoiceItemsCalculation, invoice);

    // 5. Frontend totals
    const frontendTotals = {
        discountTotal: invoice.discountAmount,
        taxableTotal: invoice.taxableAmount,
        gstTotal: new Decimal(invoice.cgst || 0)
            .plus(invoice.sgst || 0)
            .plus(invoice.igst || 0)
            .toDecimalPlaces(2),
        grandTotal: invoice.total
    };

    // 6. Compare frontend vs backend
    const mismatches = compareWithFrontendValues(frontendTotals, backendTotals);

    return mismatches;
}

// Utility: compare with tolerance
const isWithinTolerance = (value1, value2) => {
    return new Decimal(value1)
        .minus(value2)
        .abs()
        .lte(TOLERANCE);
}

// Utility: compare frontend vs backend values
const compareWithFrontendValues = (frontendTotals, backendTotals) => {
    // 2. Compare with frontend values
    const mismatches = [];
    for (const key of Object.keys(frontendTotals)) {
        if (!isWithinTolerance(frontendTotals[key], backendTotals[key])) {
            mismatches.push({ field: key, frontend: frontendTotals[key], backend: backendTotals[key] });
        }
    }

    return mismatches;
}

// Invoice calculation function
const calculateInvoiceTotals = (items, invoice) => {
    const { hasGst } = invoice
    let subTotal = new Decimal(0);
    let taxableTotal = new Decimal(0);
    let gstTotal = new Decimal(0);
    let discountTotal = new Decimal(0);
    // let discountTotal = new Decimal(invoice.discountAmount || 0);
    const otherAmount = new Decimal(invoice.other || 0)
    const roundOff = new Decimal(invoice.roundOff || 0)

    items.forEach(item => {
        const quantity = new Decimal(item.quantity);
        const rate = new Decimal(item.rate);
        const amount = quantity.times(rate);
        const discount = new Decimal(item.discount || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const taxable = amount.minus(discount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        discountTotal = discountTotal.plus(discount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        subTotal = subTotal.plus(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        taxableTotal = taxableTotal.plus(taxable).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        if (item.gstRate) {
            const halfRate = item.gstRate.div(2);
            const cgst = taxable.times(halfRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            const sgst = taxable.times(halfRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            gstTotal = gstTotal.plus(cgst).plus(sgst).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        }
    });

    // taxableTotal = subTotal.plus(discountTotal);
    const grandTotal = taxableTotal.plus(gstTotal).plus(otherAmount).plus(roundOff);

    return {
        discountTotal: discountTotal.toDecimalPlaces(2).toNumber(),
        taxableTotal: taxableTotal.toDecimalPlaces(2).toNumber(),
        gstTotal: gstTotal.toDecimalPlaces(2).toNumber(),
        grandTotal: grandTotal.toDecimalPlaces(2).toNumber(),
    };
}

// Utility: calculate discount
const calculateDiscount = (total, discountAmount, discountPercent) => {
    if (discountAmount && discountAmount > 0) {
        return discountAmount;
    } else if (discountPercent && discountPercent > 0) {
        return (total * discountPercent) / 100;
    } else {
        return 0;
    }
}

// Delete invoice by ID
const deleteInvoice = asyncHandler(async (req, res) => {
    const invoiceId = req.params.id;
    const { isPermanentDelete = false } = req.query;
    const permanent = isPermanentDelete === true || isPermanentDelete === 'true';

    // Delete invoice by ID
    const deleted = await deleteInvoiceById(invoiceId, permanent);

    // If no rows were affected, it means the invoice was not found or already deleted
    if (!deleted) {
        throw new ApiError({ statusCode: 404, message: 'Invoice not found or already deleted' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id: Number(invoiceId) },
            message: permanent
                ? 'Invoice permanently deleted successfully.'
                : 'Invoice moved to Trash successfully. Linked Challans and E-Way Bills have been unlinked.'
        })
    );
});

// Restore invoice by ID
const restoreInvoice = asyncHandler(async (req, res) => {
    const invoiceId = req.params.id;

    const restored = await restoreInvoiceById(invoiceId);

    if (!restored) {
        throw new ApiError({ statusCode: 404, message: 'Invoice not found in Trash or already active.' });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id: Number(invoiceId) },
            message: 'Invoice restored from Trash successfully.'
        })
    );
});

// Bulk delete invoices
const bulkDeleteInvoices = asyncHandler(async (req, res) => {
    const { ids = [], isPermanentDelete = false } = req.body;
    const permanent = isPermanentDelete === true || isPermanentDelete === 'true';

    const affectedRows = await bulkDeleteInvoicesModel(ids, permanent);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { affectedRows },
            message: permanent
                ? `${affectedRows} invoices permanently deleted successfully.`
                : `${affectedRows} invoices moved to Trash successfully. Linked Challans and E-Way Bills have been unlinked.`
        })
    );
});

// Bulk restore invoices
const bulkRestoreInvoices = asyncHandler(async (req, res) => {
    const { ids = [] } = req.body;

    const affectedRows = await bulkRestoreInvoicesModel(ids);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { affectedRows },
            message: `${affectedRows} invoices restored from Trash successfully.`
        })
    );
});

// Generate next invoice number
const getNextInvoiceNumber = asyncHandler(async (req, res) => {
    let invoiceNo;

    // Get last invoice number
    const lastInvoiceNo = await fetchLastInvoiceNumber();

    if (lastInvoiceNo) {
        invoiceNo = calculateNextInvoiceNumber(lastInvoiceNo);
    } else {
        // Get invoice settings
        const settings = await fetchInvoiceSettings();

        if (!settings) {
            throw new ApiError({
                statusCode: 404,
                message: 'Invoice settings not found. Unable to generate invoice number.',
            });
        }

        invoiceNo = `${settings.invoicePrefix}${settings.invoiceStartNumber}`;
    }

    if (!invoiceNo) {
        throw new ApiError({
            statusCode: 500,
            message: 'Unable to generate the next invoice number.',
        });
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { invoiceNo },
            message: 'Next invoice number generated successfully.',
        })
    );
});

// Generate next invoice number from existing invoice
const calculateNextInvoiceNumber = (invoiceNo) => {
    const numberMatch = invoiceNo.match(/\d+$/);

    if (!numberMatch) {
        return invoiceNo;
    }

    const number = numberMatch[0];
    const prefix = invoiceNo.substring(0, invoiceNo.length - number.length);
    const nextNumber = String(Number(number) + 1)
        .padStart(number.length, "0");

    return `${prefix}${nextNumber}`;
};

// Generate and get invoice PDF
const getInvoicePdf = asyncHandler(async (req, res) => {
    const invoiceId = req.params.id;

    // Fetch invoice data by ID
    let invoiceData = await fetchInvoiceById(invoiceId);

    // If invoiceData is not found, throw an error
    if (!invoiceData) {
        throw new ApiError({ statusCode: 404, errorCode: ERROR_CODES.NOT_FOUND, message: 'Invoice not found' });
    }

    // Fetch challan, PO, ewaybill data
    const invoiceChallanPOEwaybillData = await fetchChallanPOEwayBillsForInvoice(invoiceId);
    invoiceData = {
        ...invoiceData,
        ...invoiceChallanPOEwaybillData
    }

    // Prepare data for PDF
    const invoicePdfJsonData = await prepareInvoicePdfJsonData(invoiceData);

    // Get the path to the generated PDF file
    const filePath = path.join(projectPaths.ROOT_DIR, './invoice.pdf');

    // Generate the PDF
    const pdfBuffer = await generateInvoicePDF(invoicePdfJsonData, puppeteer); // generates the PDF and saves it

    // Generate a filename for the PDF
    const fileName = `Invoice_${invoiceData.invoice_no}`.replace(/[<>:"/\\|?*]/g, '_') + '.pdf';

    // Set the headers for the response as a PDF file
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
});

// Prepare invoice PDF JSON data
const prepareInvoicePdfJsonData = async (invoice) => {
    if (!invoice || !invoice.items) {
        throw new ApiError({ statusCode: 400, message: 'Invalid invoice data while generating pdf' });
    }

    const isInterState = Number(invoice.igst || 0) > 0;
    const { stateMap, cityMap } = await getCityAndStateMapping() || {};
    const { taxDetailItems = [], taxDetailTotal = {} } = getUniqueTaxDetails(invoice.items, isInterState) || {};
    const companyAddress = `${invoice.company_address || ''} <br> ${cityMap[invoice.company_city_id]?.name || ''}, ${toTitleCase(stateMap[invoice.company_state_id]?.name) || ''}, ${invoice.company_pincode || ''}`;
    const customerBillingAddress = `${invoice.billing_address || ''} <br> ${cityMap[invoice.billing_city_id]?.name || ''}, ${toTitleCase(stateMap[invoice.billing_state_id]?.name) || ''}, ${invoice.billing_pincode || ''}`;
    const customerShippingAddress = `${invoice.shipping_address || ''} <br> ${cityMap[invoice.shipping_city_id]?.name || ''}, ${toTitleCase(stateMap[invoice.shipping_state_id]?.name) || ''}, ${invoice.shipping_pincode || ''}`;
    const placeOfSupply = stateMap[invoice.billing_state_id]?.name.toUpperCase() || '';
    const dueDate = invoice.due_date ? moment(invoice.due_date).format("DD MMM YYYY").toUpperCase() : '';
    const invoiceDate = invoice.invoice_date ? moment(invoice.invoice_date).format("DD MMM YYYY").toUpperCase() : '';
    const poDate = invoice.po_date
        ? invoice.po_date
            .split(',')
            .filter(Boolean)
            .map(d => moment(d.trim()).isValid() ? moment(d.trim()).format("DD MMM YYYY").toUpperCase() : d.trim())
            .join(', ')
        : 'NA';
    const invoiceSubtotal = [];

    // Invoice subtotal rows
    if (invoice.discount_percent > 0 || invoice.discount_amount > 0) {
        const discountLable = invoice.discount_percent > 0 ? `Discount ${invoice.discount_percent}%` : 'Discount';

        invoiceSubtotal.push(...[
            {
                name: 'Sub Total',
                totalAmount: formatAmount(invoice.sub_total, { showSymbol: true })
            },
            {
                name: discountLable,
                totalAmount: formatAmount(`-${invoice.discount_amount}`, { showSymbol: true })
            }
        ]);
    }

    // Taxable amount
    invoiceSubtotal.push({
        name: 'Taxable Amount',
        totalAmount: formatAmount(invoice.taxable_amount, { showSymbol: true })
    });

    // Conditionally show IGST for Inter-State or CGST + SGST for Intra-State
    if (isInterState) {
        invoiceSubtotal.push({
            name: 'IGST',
            totalAmount: formatAmount(invoice.igst, { showSymbol: true })
        });
    } else {
        invoiceSubtotal.push(...[
            { name: 'CGST', totalAmount: formatAmount(invoice.cgst, { showSymbol: true }) },
            { name: 'SGST', totalAmount: formatAmount(invoice.sgst, { showSymbol: true }) }
        ]);
    }

    // Other Charges
    if (Number(invoice.other || 0) > 0) {
        invoiceSubtotal.push({
            name: 'Other Charges',
            totalAmount: formatAmount(invoice.other, { showSymbol: true })
        });
    }

    // Round off
    invoiceSubtotal.push({
        name: 'Round Off',
        totalAmount: formatAmount(invoice.round_off, { showSymbol: true })
    });

    // Invoice total row
    const totalQty = invoice.items?.reduce(
        (acc, item) => acc.plus(new Decimal(item.quantity || item.qty || 0)),
        new Decimal(0)
    ) || new Decimal(0);

    const invoiceTotalRow = {
        qty: formatAmount(totalQty.toNumber()),
        totalAmount: formatAmount(invoice.total, { showSymbol: true }),
        totalAmountInWords: amountToWords(invoice.total || 0)
    };

    const invoiceData = {
        id: invoice.id,
        customerName: invoice.customerName,
        isInterState: isInterState,
        company: {
            logo: invoice.company_logo,
            name: invoice.company_name,
            gstNo: invoice.gst_number,
            address: companyAddress,
            mobile: invoice.company_phone_number,
            email: invoice.company_email
        },
        customer: {
            name: invoice.customer_name,
            gstNo: invoice.billing_gstin || invoice.gst_number,
            branchName: invoice.billing_branch_name || null,
            billingAddress: customerBillingAddress,
            shippingAddress: customerShippingAddress,
            shippingBranchName: invoice.shipping_branch_name || null,
            shippingGstin: invoice.shipping_gstin || null,
            mobile: invoice.billing_phone_number,
            email: invoice.billing_email,
        },
        invoiceDetails: {
            invoiceNo: invoice.invoice_no,
            invoiceDate: invoiceDate,
            placeOfSupply: placeOfSupply,
            dueDate: dueDate,
            challanNo: invoice.challan || 'NA',
            challanDate: 'NA',
            poNumber: invoice.po || 'NA',
            poDate: poDate,
            ewayBillNo: invoice.ewaybill || 'NA',
            modeOfPayment: invoice.payment_label || ''
        },
        items: invoice.items?.map(item => ({
            id: item.id,
            name: item.description || '',
            hsnAndSacCode: item.hsn_sac_code || '',
            taxPercentage: `${Number(item.gst_rate) || 0}%`,
            qty: Number(item.qty || item.quantity) || '',
            unit: item.uqc || '',
            price: formatAmount(item.rate) || '',
            totalAmount: formatAmount(item.sub_total) || ''
        })) ?? [],
        subTotal: invoiceSubtotal,
        total: invoiceTotalRow,
        taxDetail: {
            isInterState: isInterState,
            items: taxDetailItems.map(item => ({
                taxableValue: formatAmount(item.taxableValue),
                taxPercentage: `${item.taxPercentage}%`,
                centralTaxPercentage: `${item.centralTaxPercentage}%`,
                centralTaxAmount: formatAmount(item.centralTaxAmount),
                stateTaxPercentage: `${item.stateTaxPercentage}%`,
                stateTaxAmount: formatAmount(item.stateTaxAmount),
                integratedTaxPercentage: `${item.integratedTaxPercentage}%`,
                integratedTaxAmount: formatAmount(item.integratedTaxAmount),
                totalTaxAmount: formatAmount(item.totalTaxAmount)
            })),
            total: {
                taxableValue: formatAmount(taxDetailTotal.taxableValue),
                centralTaxAmount: formatAmount(taxDetailTotal.centralTaxAmount),
                stateTaxAmount: formatAmount(taxDetailTotal.stateTaxAmount),
                integratedTaxAmount: formatAmount(taxDetailTotal.integratedTaxAmount),
                totalTaxAmount: formatAmount(taxDetailTotal.totalTaxAmount)
            }
        },
        bank: {
            bankName: invoice.bank_name,
            accountNumber: invoice.account_number,
            ifscCode: invoice.ifsc_code,
            branch: invoice.branch_name
        },
        termsAndConditions: [
            '1. Goods once sold will not be taken back or exchanged, except for manufacturing defects under applicable warranty.',
            '2. We are the manufacturer of the goods supplied. Warranty, if any, will be as per our company’s standard terms and applicable law.',
            '3. The buyer is responsible for verifying the quantity and quality of goods at the time of delivery.',
            '4. Subject to local jurisdiction.'
        ],
        emptyRowHeightNeededInPx: 0
    };

    return invoiceData;
};

// Get unique tax details from invoice items
const getUniqueTaxDetails = (invoiceItems = [], isInterState = false) => {
    const taxMap = {};

    invoiceItems.forEach(item => {
        const taxPercent = new Decimal(item.gst_rate || 0);
        const taxableValue = new Decimal(item.taxable_amount || 0);
        const taxKey = taxPercent.toString();

        if (!taxMap[taxKey]) {
            taxMap[taxKey] = {
                taxableValue: new Decimal(0),
                taxPercentage: taxPercent.toNumber(),
                isInterState: isInterState,
                integratedTaxPercentage: isInterState ? taxPercent.toNumber() : 0,
                integratedTaxAmount: 0,
                centralTaxPercentage: !isInterState ? taxPercent.div(2).toNumber() : 0,
                centralTaxAmount: 0,
                stateTaxPercentage: !isInterState ? taxPercent.div(2).toNumber() : 0,
                stateTaxAmount: 0,
                totalTaxAmount: 0
            };
        }

        // accumulate taxable value slab-wise
        taxMap[taxKey].taxableValue = taxMap[taxKey].taxableValue.plus(taxableValue);
    });

    // grand totals
    let totalTaxable = new Decimal(0);
    let totalCentral = new Decimal(0);
    let totalState = new Decimal(0);
    let totalIntegrated = new Decimal(0);
    let totalTax = new Decimal(0);

    // Calculate slab-wise tax amounts and accumulate totals
    Object.values(taxMap).forEach(tax => {
        const taxableValue = new Decimal(tax.taxableValue);

        if (isInterState) {
            const igstPercent = new Decimal(tax.integratedTaxPercentage || 0);
            tax.integratedTaxAmount = taxableValue.mul(igstPercent).div(100).toDecimalPlaces(2).toNumber();
            tax.totalTaxAmount = tax.integratedTaxAmount;
            totalIntegrated = totalIntegrated.plus(tax.integratedTaxAmount);
        } else {
            const centralPercent = new Decimal(tax.centralTaxPercentage || 0);
            const statePercent = new Decimal(tax.stateTaxPercentage || 0);

            tax.centralTaxAmount = taxableValue.mul(centralPercent).div(100).toDecimalPlaces(2).toNumber();
            tax.stateTaxAmount = taxableValue.mul(statePercent).div(100).toDecimalPlaces(2).toNumber();
            tax.totalTaxAmount = new Decimal(tax.centralTaxAmount).plus(tax.stateTaxAmount).toDecimalPlaces(2).toNumber();

            totalCentral = totalCentral.plus(tax.centralTaxAmount);
            totalState = totalState.plus(tax.stateTaxAmount);
        }

        // accumulate totals
        totalTaxable = totalTaxable.plus(taxableValue);
        totalTax = totalTax.plus(tax.totalTaxAmount);
    });

    // Add grand total row
    const grandTotal = {
        taxableValue: totalTaxable.toDecimalPlaces(2).toNumber(),
        centralTaxPercentage: null,
        centralTaxAmount: totalCentral.toDecimalPlaces(2).toNumber(),
        stateTaxPercentage: null,
        stateTaxAmount: totalState.toDecimalPlaces(2).toNumber(),
        integratedTaxPercentage: null,
        integratedTaxAmount: totalIntegrated.toDecimalPlaces(2).toNumber(),
        totalTaxAmount: totalTax.toDecimalPlaces(2).toNumber()
    };

    return {
        taxDetailItems: Object.values(taxMap),
        taxDetailTotal: grandTotal
    };
};

// Get city and state mapping
const getCityAndStateMapping = async () => {
    const [states, cities] = await Promise.all([
        fetchStates(),
        fetchAllCities()
    ]);

    const stateMap = states.reduce((acc, state) => {
        acc[state.id] = state;
        return acc;
    }, {});

    const cityMap = cities.reduce((acc, city) => {
        acc[city.id] = city;
        return acc;
    }, {});

    return { stateMap, cityMap }
}

// Generate invoice PDF
// const generateInvoicePDF = async (invoiceData, puppeteer) => {
//     try {
//         /* 
//             =========================================
//             Pass 1: render with estimated filler rows
//             =========================================
//         */

//         const sampleInvoiceData = invoiceData

//         // Get invoice template file
//         const templatePath = path.join(`${projectPaths.ROOT_DIR}/templates/invoice/`, 'invoice-template.ejs');

//         // Fill the template with invoice data
//         const filledHtml = await ejs.renderFile(templatePath, sampleInvoiceData);

//         let browser;
//         let executablePath;
//         if (process.env.NODE_ENV === 'production') {
//              const chromeRoot = path.join(
//                 process.cwd(),
//                 ".cache",
//                 "puppeteer",
//                 "chrome"
//             );

//             const version = fs.readdirSync(chromeRoot)[0];

//             executablePath = path.join(
//                 chromeRoot,
//                 version,
//                 "chrome-linux64",
//                 "chrome"
//             );

//             browser = await puppeteer.launch({
//                 executablePath: executablePath,
//                 headless: true
//             });
//         } else {
//             // Launch the browser and open a new blank page
//             browser = await puppeteer.launch();
//         }

//         // Initialize a new page
//         const page = await browser.newPage();

//         // Set the content of the page to the filled HTML
//         await page.setContent(filledHtml, { waitUntil: 'networkidle0' });

//         // Measure rendered table height
//         const { invoiceHeight, invoiceOccupiedHeight } = await page.evaluate(evaluatePage);

//         // Check if the occupied height exceeds the allowed height
//         if (invoiceOccupiedHeight > invoiceHeight) {
//             // Throw an error if the occupied height exceeds the allowed height
//             throw new ApiError({
//                 statusCode: 422,
//                 message: 'Invoice content exceeds allowed page height',
//                 errors: [{
//                     maxHeight: invoiceHeight,
//                     actualHeight: invoiceOccupiedHeight
//                 }]
//             })

//         }

//         // Calculate the remaining height
//         const remainingHeight = invoiceHeight - invoiceOccupiedHeight;

//         // Close the browser
//         await browser.close();

//         /* 
//             =========================================
//             Pass 2: re-render with correct blank rows
//             =========================================
//         */
//         // Update the remaining height in the sample invoice data
//         sampleInvoiceData.emptyRowHeightNeededInPx = remainingHeight;

//         // Fill the template again with updated data
//         const html = await ejs.renderFile(templatePath, sampleInvoiceData);

//         let browser2;
//         if (process.env.NODE_ENV === 'production') {
//             browser2 = await puppeteer.launch({
//                 executablePath: executablePath,
//                 headless: true
//             });
//         } else {
//             // Launch the browser and open a new blank page
//             browser2 = await puppeteer.launch();
//         }

//         // Initialize a new page
//         const page2 = await browser2.newPage();

//         // Set the content of the page to the filled HTML
//         await page2.setContent(html, { waitUntil: 'networkidle0' });

//         // Save the PDF to a file
//         const pdf = await page2.pdf({
//             format: 'A4',
//             printBackground: true,
//             margin: { top: '6mm', bottom: '6mm', left: '6mm', right: '6mm' },
//         });

//         // Convert the PDF to a buffer
//         const pdfBuffer = Buffer.from(pdf);

//         // Close the browser
//         await browser2.close();

//         return pdfBuffer;
//     } catch (error) {
//         throw error instanceof ApiError ? error : new ApiError({ statusCode: 500, message: 'Error generating PDF' })
//     }
// };

let browserInstance = null;

const getBrowser = async (puppeteer) => {
    if (browserInstance && browserInstance.connected) {
        return browserInstance;
    }

    let executablePath;
    if (process.env.NODE_ENV === 'production') {
        const chromeRoot = path.join(
            process.cwd(),
            ".cache",
            "puppeteer",
            "chrome"
        );

        const version = fs.readdirSync(chromeRoot)[0];

        executablePath = path.join(
            chromeRoot,
            version,
            "chrome-linux64",
            "chrome"
        );
    }

    browserInstance = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--no-zygote",
            "--single-process"
        ]
    });

    browserInstance.on('disconnected', () => {
        browserInstance = null;
    });

    return browserInstance;
};

const generateInvoicePDF = async (invoiceData, puppeteer) => {
    const templatePath = path.join(
        `${projectPaths.ROOT_DIR}/templates/invoice/`,
        'invoice-template.ejs'
    );

    const browser = await getBrowser(puppeteer);
    let page;

    try {
        const sampleInvoiceData = {
            ...invoiceData
        };

        const filledHtml = await ejs.renderFile(
            templatePath,
            sampleInvoiceData
        );

        page = await browser.newPage();

        // Pass 1: Render with load event to ensure HTML and images are downloaded
        await page.setContent(filledHtml, {
            waitUntil: 'load'
        });

        const {
            invoiceHeight,
            invoiceOccupiedHeight
        } = await page.evaluate(evaluatePage);

        if (invoiceOccupiedHeight > invoiceHeight) {
            throw new ApiError({
                statusCode: 422,
                message: 'Invoice content exceeds allowed page height'
            });
        }

        sampleInvoiceData.emptyRowHeightNeededInPx =
            invoiceHeight - invoiceOccupiedHeight;

        const html = await ejs.renderFile(
            templatePath,
            sampleInvoiceData
        );

        // Pass 2: Re-render with filler rows on the same page tab
        await page.setContent(html, {
            waitUntil: 'load'
        });

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '6mm',
                bottom: '6mm',
                left: '6mm',
                right: '6mm'
            }
        });

        return Buffer.from(pdf);

    } catch (error) {
        if (browserInstance && !browserInstance.connected) {
            browserInstance = null;
        }
        throw error;
    } finally {
        if (page) {
            await page.close().catch(() => { });
        }
    }
};

process.on("SIGTERM", async () => {
    if (browserInstance) {
        await browserInstance.close();
    }
});

// Evaluate page
const evaluatePage = async () => {
    // Wait for fonts to be loaded before measuring heights
    await document.fonts.ready;

    // Get total invoice height
    const table = document.querySelector('.table-container');
    const invoiceHeight = table ? table.getBoundingClientRect().height : 0;

    // Get invoice occupied height
    const invoiceOccupiedHeightDiv = document.querySelector('.table-invoice-wrapper');
    const invoiceOccupiedHeight = invoiceOccupiedHeightDiv ? invoiceOccupiedHeightDiv.getBoundingClientRect().height : 0;

    return {
        invoiceHeight,
        invoiceOccupiedHeight
    };
};

process.on("SIGTERM", async () => {
    if (browserInstance) {
        await browserInstance.close();
    }
});

module.exports = {
    getAllInvoice,
    getInvoiceMeta,
    getInvoiceById,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    restoreInvoice,
    bulkDeleteInvoices,
    bulkRestoreInvoices,
    getNextInvoiceNumber,
    generateInvoicePDF,
    prepareInvoicePdfJsonData,
    getInvoicePdf
};