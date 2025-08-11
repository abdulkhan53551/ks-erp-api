const { projectPaths } = require("../../../config/constants");
const { sampleInvoiceData } = require("./sampleInvoiceData");
const path = require('path')
const ejs = require('ejs')
const { ApiError } = require('./../services/ApiError');
const { asyncHandler } = require("../services/asyncHandler");
const { ApiResponse } = require("../services/ApiResponse");
const { fetchAllInvoice, fetchInvoiceMeta, fetchInvoiceById, insertInvoice, updateInvoiceById, deleteInvoiceById } = require("../models/invoice.model");

// Fetch all invoice
const getAllInvoice = asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, search = '' } = req.query;

    const result = await fetchAllInvoice({ page, pageSize, search });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            message: 'Invoice fetched successfully.',
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
    const { invoice, items, billingAddress, shippingAddress } = req.body;

    // Create invoice
    const invoiceMaster = {
        invoice_no: invoice.invoiceNo,
        invoice_date: invoice.invoiceDate,
        due_days: invoice.dueDays,
        due_date: invoice.dueDate,
        customer_name: invoice.customerName,
        has_gst: invoice.hasGst,
        gst_number: invoice.gstNumber,
        has_challan: invoice.hasChallan,
        has_po: invoice.hasPo,
        has_eway_bill: invoice.hasEwayBill,
        sub_total: invoice.subTotal,
        discount_percent: invoice.discountPercent,
        discount_amount: invoice.discountAmount,
        taxable_amount: invoice.taxableAmount,
        cgst: invoice.cgst,
        sgst: invoice.sgst,
        igst: invoice.igst,
        total: invoice.total,
        round_off: invoice.roundOff,
        other: invoice.other,
        payment_status_id: invoice.paymentStatusId,
        payment_mode_id: invoice.paymentModeId,
    };

    const invoiceItems = { ...items }
    const billing = { ...billingAddress };
    const shipping = { ...shippingAddress };

    // Insert invoice
    const invoiceId = await insertInvoice({
        masterData: invoiceMaster,
        items: invoiceItems,
        billing,
        shipping
    });

    // If invoiceId is not returned, throw an error
    if (!invoiceId) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while creating invoice' })
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Invoice created successfully.' })
    )
})

// Update invoice by ID
const updateInvoice = asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;
    const { invoice, items, billingAddress, shippingAddress } = req.body;

    // Update invoice
    const invoiceMaster = {
        invoice_no: invoice.invoiceNo,
        invoice_date: invoice.invoiceDate,
        due_days: invoice.dueDays,
        due_date: invoice.dueDate,
        customer_name: invoice.customerName,
        has_gst: invoice.hasGst,
        gst_number: invoice.gstNumber,
        has_challan: invoice.hasChallan,
        has_po: invoice.hasPo,
        has_eway_bill: invoice.hasEwayBill,
        sub_total: invoice.subTotal,
        discount_percent: invoice.discountPercent,
        discount_amount: invoice.discountAmount,
        taxable_amount: invoice.taxableAmount,
        cgst: invoice.cgst,
        sgst: invoice.sgst,
        igst: invoice.igst,
        total: invoice.total,
        round_off: invoice.roundOff,
        other: invoice.other,
        payment_status_id: invoice.paymentStatusId,
        payment_mode_id: invoice.paymentModeId,
    };

    const invoiceItems = { ...items }
    const billing = { ...billingAddress };
    const shipping = { ...shippingAddress };


    // Update invoice
    const affectedRows = await updateInvoiceById({
        invoiceId,
        masterData: invoiceMaster,
        items: invoiceItems,
        billing,
        shipping
    });

    // If no rows were affected, it means the invoice was not found or update failed
    if (!affectedRows) {
        throw new ApiError({ statusCode: 404, message: 'Invoice not found or update failed' });
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Invoice updated successfully.' })
    );
});

// Delete invoice by ID
const deleteInvoice = asyncHandler(async (req, res) => {
    const invoiceId = req.params.id;
    const { isPermanentDelete = false } = req.query;

    // Delete invoice by ID
    const deleted = await deleteInvoiceById(invoiceId, isPermanentDelete);

    // If no rows were affected, it means the invoice was not found or already deleted
    if (!deleted) {
        throw new ApiError({ statusCode: 404, message: 'Invoice not found or already deleted' });
    }

    return res.status(200).json(
        new ApiResponse({ statusCode: 200, data: [], message: 'Invoice deleted successfully.' })
    );
});

// Generate invoice PDF
const generateInvoicePDF = async (invoiceData, puppeteer) => {
    try {
        /* 
            =========================================
            Pass 1: render with estimated filler rows
            =========================================
        */

        // Get invoice template file
        const templatePath = path.join(`${projectPaths.ROOT_DIR}/templates/invoice/`, 'invoice-template.ejs');

        // Fill the template with invoice data
        const filledHtml = await ejs.renderFile(templatePath, sampleInvoiceData);

        // Launch the browser and open a new blank page
        // const browser = await puppeteer.launch();
        const browser = await puppeteer.launch({
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Path to Chrome
            // headless: false,
        });

        // Initialize a new page
        const page = await browser.newPage();

        // Set the content of the page to the filled HTML
        await page.setContent(filledHtml, { waitUntil: 'networkidle0' });

        // Measure rendered table height
        const { invoiceHeight, invoiceOccupiedHeight } = await page.evaluate(evaluatePage);

        // Check if the occupied height exceeds the allowed height
        if (invoiceOccupiedHeight > invoiceHeight) {
            // Throw an error if the occupied height exceeds the allowed height
            throw new ApiError({
                statusCode: 422,
                message: 'Invoice content exceeds allowed page height',
                errors: [{
                    maxHeight: invoiceHeight,
                    actualHeight: invoiceOccupiedHeight
                }]
            })

        }

        // Calculate the remaining height
        const remainingHeight = invoiceHeight - invoiceOccupiedHeight;

        // Close the browser
        await browser.close();

        /* 
            =========================================
            Pass 2: re-render with correct blank rows
            =========================================
        */
        // Update the remaining height in the sample invoice data
        sampleInvoiceData.emptyRowHeightNeededInPx = remainingHeight;

        // Fill the template again with updated data
        const html = await ejs.renderFile(templatePath, sampleInvoiceData);

        // Launch the browser and open a new blank page
        const browser2 = await puppeteer.launch({
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Path to Chrome
            headless: false,
        });

        // Initialize a new page
        const page2 = await browser2.newPage();

        // Set the content of the page to the filled HTML
        await page2.setContent(html, { waitUntil: 'networkidle0' });

        // Save the PDF to a file
        await page2.pdf({
            format: 'A4',
            path: 'invoice.pdf', // Save to file
            printBackground: true,
            width: `210mm`,
            height: `297mm`,
            margin: { top: '3mm', bottom: '3mm', left: '3mm', right: '3mm' },
        });

        // Close the browser
        await browser2.close();
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError({ statusCode: 500, message: 'Error generating PDF' })
    }
};

// Evaluate page
const evaluatePage = () => {
    // Get total invoice height
    const table = document.querySelector('.table-container');
    const invoiceHeight = table.getBoundingClientRect().height;

    // Get invoice occupied height
    const invoiceOccupiedHeightDiv = document.querySelector('.table-invoice-wrapper');
    const invoiceOccupiedHeight = invoiceOccupiedHeightDiv.getBoundingClientRect().height;

    return {
        invoiceHeight,
        invoiceOccupiedHeight
    }
}

module.exports = {
    getAllInvoice,
    getInvoiceMeta,
    getInvoiceById,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    generateInvoicePDF
};