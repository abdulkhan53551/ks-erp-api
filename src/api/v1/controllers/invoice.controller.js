const { projectPaths, errorCodes } = require("../../../config/constants");
const { sampleInvoiceData } = require("./sampleInvoiceData");
const path = require('path')
const ejs = require('ejs')
const { ApiError } = require('./../services/ApiError');
const { asyncHandler } = require("../services/asyncHandler");
const { ApiResponse } = require("../services/ApiResponse");
const { fetchAllInvoice, fetchInvoiceMeta, fetchInvoiceById, insertInvoice, updateInvoiceById, deleteInvoiceById } = require("../models/invoice.model");
const { ERROR_CODES } = require("../../../config/constants/statusCodeMap");
const { default: Decimal } = require("decimal.js");
const { fetchGSTSlabs, fetchStates, fetchAllCities } = require("../models/masters.model");
const { formatAmount, amountToWords } = require("../services/conversion");
const { getContext } = require("../helpers/requestContext");
const TOLERANCE = 0.01; // ₹0.01 = 1 paise

// Fetch all invoice
const getAllInvoice = asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, search = '' } = req.query;

    const result = await fetchAllInvoice({ page, pageSize, search });

    console.log('result => ', result);


    if (!result.length) {
        throw new ApiError({ statusCode: 404, message: 'No invoice found.' });
    }

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

    if (!result) {
        throw new ApiError({ statusCode: 404, message: 'No invoice found.' });
    }

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
        firm_id: firmId
    };

    // Prepare invoice items
    const invoiceItems = items.map(item => ({
        description: item.description,
        hsn_sac_code: item.hsnSacCode,
        qty: item.qty,
        item_unit_id: item.itemUnitId,
        rate: new Decimal(item.rate).toDecimalPlaces(2).toNumber(),
        discount_percent: new Decimal(item.discountPercent).toDecimalPlaces(2).toNumber(),
        discount_amount: new Decimal(item.discountAmount).toDecimalPlaces(2).toNumber(),
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
        email: shippingAddress.email,
        phone_number: shippingAddress.phoneNumber,
        website: shippingAddress.website,
        address_line1: shippingAddress.addressLine1,
        city_id: shippingAddress.cityId,
        state_id: shippingAddress.stateId,
        pincode: shippingAddress.pincode,
    };

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
        firm_id: firmId
    };

    const invoiceItems = items.map(item => ({
        id: item.id,
        description: item.description,
        hsn_sac_code: item.hsnSacCode,
        qty: item.qty,
        item_unit_id: item.itemUnitId,
        rate: new Decimal(item.rate).toDecimalPlaces(2).toNumber(),
        discount_percent: new Decimal(item.discountPercent).toDecimalPlaces(2).toNumber(),
        discount_amount: new Decimal(item.discountAmount).toDecimalPlaces(2).toNumber(),
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
        email: shippingAddress.email,
        phone_number: shippingAddress.phoneNumber,
        website: shippingAddress.website,
        address_line1: shippingAddress.addressLine1,
        city_id: shippingAddress.cityId,
        state_id: shippingAddress.stateId,
        pincode: shippingAddress.pincode,
    };


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
    return Math.abs(value1 - value2) <= TOLERANCE;
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
    let taxableTotal = new Decimal(0);
    let gstTotal = new Decimal(0);
    let discountTotal = new Decimal(0);
    const otherAmount = new Decimal(invoice.other)
    const roundOff = new Decimal(invoice.roundOff)

    items.forEach(item => {
        const quantity = new Decimal(item.quantity);
        const rate = new Decimal(item.rate);
        const amount = quantity.times(rate);
        const discount = new Decimal(item.discount || 0);
        const total = amount.minus(discount);

        discountTotal = discountTotal.plus(discount);
        taxableTotal = taxableTotal.plus(total);

        if (hasGst && item.gstRate) {
            const gstAmt = total.times(new Decimal(item.gstRate).dividedBy(100));
            gstTotal = gstTotal.plus(gstAmt);
        }
    });

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

// Prepare invoice PDF JSON data
const prepareInvoicePdfJsonData = async (invoice) => {
    if (!invoice || !invoice.items) {
        throw new ApiError({ statusCode: 400, message: 'Invalid invoice data while generating pdf' });
    }

    // const invoiceData = {
    //     id: 1,
    //     customerName: 'John Doe',
    //     company: {
    //         logo: 'https://www.unilever.com/Images/unilever-logo_tcm244-500123_w600.png',
    //         name: 'Hindustan Uniliver Test',
    //         gstNo: '27ABCDE1234F1Z5',
    //         address: '64, Whilefield Main Rd, Palm Meadows, White field <br> Bengaluru KARNATAKA, 560066',
    //         mobile: '+91 99800 12345',
    //         email: 'info@unilever.com'
    //     },
    //     customer: {
    //         name: 'Hein Schumacher',
    //         gstNo: '27ABCDE1234F1Z5',
    //         billingAddress: 'Marathahalli - Sarjapur Outer Ring Road, Kadabeesanahalli, <br> Bengaluru, Karnataka, 560087',
    //         shippingAddress: 'Marathahalli - Sarjapur Outer Ring Road, Kadabeesanahalli test, <br> Bengaluru, Karnataka, 560087',
    //         mobile: '9890241776',
    //         email: 'hein.schumacher@unilever.com'
    //     },
    //     invoiceDetails: {
    //         invoiceNo: "INV-11",
    //         invoiceDate: "15 JUN 2023",
    //         placeOfSupply: "29-KARNATAKA",
    //         dueDate: "15 JUN 2023",
    //         challanNo: "01, 02, 03, 04, 05",
    //         challanDate: "15 JUN 2023",
    //         poNumber: "PO123456",
    //         poDate: "20 JUN 2023",
    //         ewayBillNo: "PO123456",
    //         modeOfPayment: "CASH / ONLINE"
    //     },
    //     items: [
    //         {
    //             id: 1,
    //             name: 'Colgate 200 gm',
    //             hsnAndSacCode: '33061020',
    //             taxPercentage: '18',
    //             qty: '5 NOS',
    //             unit: 'NOS',
    //             price: '64.41',
    //             totalAmount: '322.03'
    //         },
    //         {
    //             id: 2,
    //             name: 'Surf Excel Easy Wash Detergent Powder 1kg',
    //             hsnAndSacCode: '340119',
    //             taxPercentage: '18',
    //             qty: '2',
    //             unit: 'NOS',
    //             price: '126.27',
    //             totalAmount: '252.54'
    //         },
    //         {
    //             id: 3,
    //             name: 'Dove Soap',
    //             hsnAndSacCode: '34011919',
    //             taxPercentage: '18',
    //             qty: '10',
    //             unit: 'NOS',
    //             price: '33.05',
    //             totalAmount: '330.51'
    //         },
    //         {
    //             id: 4,
    //             name: 'Head & Shoulders Shampoo',
    //             hsnAndSacCode: '3304',
    //             taxPercentage: '18',
    //             qty: '5',
    //             unit: 'NOS',
    //             price: '253.39',
    //             totalAmount: '1266.95'
    //         },
    //     ],
    //     subTotal: [
    //         { name: 'Discount 2.0%', totalAmount: '2172.03' },
    //         { name: 'Taxable Amount', totalAmount: '2172.03' },
    //         { name: 'CGST', totalAmount: '195.49' },
    //         { name: 'SGST', totalAmount: '195.49' },
    //     ],
    //     total: {
    //         qty: '22.000',
    //         totalAmount: '₹2,563.00',
    //         totalAmountInWords: 'Two Thousand, Five Hundred and Sixty Three Rupees Only.'
    //     },
    //     taxDetail: {
    //         items: [
    //             {
    //                 taxableValue: '322.03',
    //                 centralTaxPercentage: '9%',
    //                 centralTaxAmount: '28.98',
    //                 stateTaxPercentage: '9%',
    //                 stateTaxAmount: '28.98',
    //                 totalTaxAmount: '57.97'
    //             },
    //             {
    //                 taxableValue: '252.54',
    //                 centralTaxPercentage: '9%',
    //                 centralTaxAmount: '22.73',
    //                 stateTaxPercentage: '9%',
    //                 stateTaxAmount: '22.73',
    //                 totalTaxAmount: '45.46'
    //             },
    //             {
    //                 taxableValue: '330.51',
    //                 centralTaxPercentage: '9%',
    //                 centralTaxAmount: '29.75',
    //                 stateTaxPercentage: '9%',
    //                 stateTaxAmount: '29.75',
    //                 totalTaxAmount: '59.49'
    //             },
    //             {
    //                 taxableValue: '1266.95',
    //                 centralTaxPercentage: '9%',
    //                 centralTaxAmount: '114.03',
    //                 stateTaxPercentage: '9%',
    //                 stateTaxAmount: '114.03',
    //                 totalTaxAmount: '228.05'
    //             },
    //         ],
    //         total: {
    //             taxableValue: '2172.03',
    //             centralTaxAmount: '195.49',
    //             stateTaxAmount: '195.49',
    //             totalTaxAmount: '390.97'
    //         }
    //     },
    //     bank: {
    //         bankName: 'YES BANK',
    //         accountNumber: '66789999222445',
    //         ifscCode: 'YESBBIN4567',
    //         branch: 'Kodihalli'
    //     },
    //     termsAndConditions: [
    //         '1. Goolds once sold cannot be taken back or exchanged.',
    //         '2. We are not the manufacturers, company will stand for warranty as per their terms and conditions.',
    //         '3. Interest @24% p.a. will be charged for uncleared bill beyond 15 days.',
    //         '4. Subject to local jurisdiction.'
    //     ],
    // };

    const { stateMap, cityMap } = await getCityAndStateMapping() || {}
    const { taxDetailItems = [], taxDetailTotal = {} } = getUniqueTaxDetails(invoice.items) || {}
    const customerBillingAddress = `${invoice.billing_address || ''} <br> ${cityMap[invoice.billing_city_id]?.name || ''}, ${stateMap[invoice.billing_state_id]?.name || ''}, ${invoice.billing_pincode || ''}`;
    const customerShippingAddress = `${invoice.shipping_address || ''} <br> ${cityMap[invoice.shipping_city_id]?.name || ''}, ${stateMap[invoice.shipping_state_id]?.name || ''}, ${invoice.shipping_pincode || ''}`;
    const placeOfSupply = stateMap[invoice.billing_state_id]?.gst_place_of_supply || '';
    const dueDate = invoice.due_date ? moment(invoice.due_date).format("DD MMM YYYY").toUpperCase() : ''
    const invoiceDate = invoice.invoice_date ? moment(invoice.invoice_date).format("DD MMM YYYY").toUpperCase() : '';
    // const challanDate = invoice.challan_date ? moment(invoice.challan_date).format("DD MMM YYYY").toUpperCase() : '';
    const invoiceSubtotal = [
        { name: 'Taxable Amount', totalAmount: formatAmount(invoice.taxable_amount, { showSymbol: true }) },
        { name: 'CGST', totalAmount: formatAmount(invoice.cgst, { showSymbol: true }) },
        { name: 'SGST', totalAmount: formatAmount(invoice.sgst, { showSymbol: true }) },
    ]

    if (invoice.discount_percent > 0) {
        invoiceSubtotal.unshift({  // use unshift() if you want it at the top
            name: `Discount ${invoice.discount_percent}%`,
            totalAmount: formatAmount(invoice.discount_amount, { showSymbol: true })
        })
    }

    // Invoice total row
    const invoiceTotalRow = {
        qty: formatAmount(invoice.items?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0),
        totalAmount: formatAmount(invoice.total, { showSymbol: true }),
        totalAmountInWords: amountToWords(invoice.total || 0)
    }

    const invoiceData = {
        id: invoice.id,
        customerName: invoice.customerName,
        company: {
            logo: invoice.company_logo,
            name: invoice.company_name,
            gstNo: invoice.gst_number,
            address: invoice.company_address,
            mobile: invoice.company_phone_number,
            email: invoice.company_email
        },
        customer: {
            name: invoice.customer_name,
            gstNo: invoice.gst_number,
            billingAddress: customerBillingAddress,
            shippingAddress: customerShippingAddress,
            mobile: invoice.billing_phone_number,
            email: invoice.billing_email,
        },
        invoiceDetails: {
            invoiceNo: invoice.invoice_no,
            invoiceDate: invoiceDate,
            placeOfSupply: placeOfSupply,
            dueDate: dueDate,
            challanNo: invoice.challan || '',
            challanDate: 'NA',
            poNumber: invoice.po || '',
            poDate: 'NA',
            ewayBillNo: invoice.ewaybill || '',
            modeOfPayment: invoice.payment_label || ''
        },
        items: invoice.items?.map(item => ({
            id: item.id,
            name: item.description || '',
            hsnAndSacCode: item.hsn_sac_code || '',
            taxPercentage: `${item.gst_rate || 0}%`,
            qty: item.quantity || '',
            unit: item.uqc || '',
            price: formatAmount(item.rate) || '',
            totalAmount: formatAmount(item.amount) || ''
        })) ?? [],
        subTotal: invoiceSubtotal,
        total: invoiceTotalRow,
        taxDetail: {
            items: taxDetailItems.map(item => ({
                taxableValue: formatAmount(item.taxableValue),
                centralTaxPercentage: `${item.centralTaxPercentage}%`,
                centralTaxAmount: formatAmount(item.centralTaxAmount),
                stateTaxPercentage: `${item.stateTaxPercentage}%`,
                stateTaxAmount: formatAmount(item.stateTaxAmount),
                totalTaxAmount: formatAmount(item.totalTaxAmount)
            })),
            total: {
                taxableValue: formatAmount(taxDetailTotal.taxableValue),
                centralTaxAmount: formatAmount(taxDetailTotal.centralTaxAmount),
                stateTaxAmount: formatAmount(taxDetailTotal.stateTaxAmount),
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
}

// Get unique tax details
const getUniqueTaxDetails = (invoiceItems = []) => {
    const taxMap = {};

    invoiceItems.forEach(item => {
        const taxPercent = Number(item.gst_rate || 0);
        const taxableValue = Number(item.amount || 0);

        if (!taxMap[taxPercent]) {
            taxMap[taxPercent] = {
                taxableValue: 0,
                centralTaxPercentage: taxPercent.div(2).toNumber(), // keep % as plain number
                centralTaxAmount: 0,
                stateTaxPercentage: taxPercent.div(2).toNumber(),
                stateTaxAmount: 0,
                totalTaxAmount: 0
            };
        }

        // Accumulate values
        taxMap[taxPercent].taxableValue = taxMap[taxPercent].taxableValue.plus(taxableValue);
    });

    // Calculate tax amounts
    let totalTaxable = 0, totalCentral = 0, totalState = 0, totalTax = 0;


    // Calculate tax amounts
    Object.values(taxMap).forEach(tax => {
        const taxableValue = new Decimal(tax.taxableValue);
        const centralPercent = new Decimal(tax.centralTaxPercentage || 0);
        const statePercent = new Decimal(tax.stateTaxPercentage || 0);

        tax.centralTaxAmount = taxableValue.mul(centralPercent).div(100).toDecimalPlaces(2).toNumber();
        tax.stateTaxAmount = taxableValue.mul(statePercent).div(100).toDecimalPlaces(2).toNumber();
        tax.totalTaxAmount = new Decimal(tax.centralTaxAmount).plus(tax.stateTaxAmount).toDecimalPlaces(2).toNumber();
    });

    // Add grand total row
    const grandTotal = {
        taxableValue: new Decimal(totalTaxable).toDecimalPlaces(2),
        centralTaxPercentage: null,
        centralTaxAmount: new Decimal(totalCentral).toDecimalPlaces(2),
        stateTaxPercentage: null,
        stateTaxAmount: new Decimal(totalState).toDecimalPlaces(2),
        totalTaxAmount: new Decimal(totalTax).toDecimalPlaces(2)
    };

    return {
        taxDetailItems: Object.values(taxMap),
        taxDetailTotal: grandTotal
    };
}

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
const generateInvoicePDF = async (invoiceData, puppeteer) => {
    try {
        /* 
            =========================================
            Pass 1: render with estimated filler rows
            =========================================
        */

        const sampleInvoiceData = invoiceData

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
    generateInvoicePDF,
    prepareInvoicePdfJsonData
};