const Joi = require('joi');

const proformaInvoiceItemSchema = Joi.object({
    id: Joi.number().integer().positive().optional(),
    productId: Joi.number().integer().positive().allow(null).optional(),
    itemName: Joi.string().allow(null, '').optional(),
    description: Joi.string().allow(null, '').optional(),
    drawingNumber: Joi.string().allow(null, '').optional(),
    hsnSacCode: Joi.string().allow(null, '').optional(),
    qty: Joi.number().positive().required(),
    unit: Joi.string().default('Nos'),
    rate: Joi.number().min(0).required(),
    discountPercent: Joi.number().min(0).max(100).allow(null).optional(),
    discountAmount: Joi.number().min(0).allow(null).optional(),
    subTotal: Joi.number().min(0).allow(null).optional(),
    taxableAmount: Joi.number().min(0).allow(null).optional(),
    gstSlabId: Joi.number().integer().positive().allow(null).optional(),
    taxRate: Joi.number().min(0).allow(null).optional(),
    cgst: Joi.number().min(0).allow(null).optional(),
    sgst: Joi.number().min(0).allow(null).optional(),
    igst: Joi.number().min(0).allow(null).optional(),
    total: Joi.number().min(0).allow(null).optional(),
    sortOrder: Joi.number().integer().optional()
}).unknown(true);

const getProformaInvoiceByIdSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required()
    })
};

const queryProformaInvoicesSchema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(100).default(10),
        search: Joi.string().allow('', null).optional(),
        status: Joi.string().allow('', null).optional(),
        startDate: Joi.string().allow('', null).optional(),
        endDate: Joi.string().allow('', null).optional(),
        trash: Joi.alternatives().try(Joi.boolean(), Joi.string()).default(false)
    }).unknown(true)
};

const createProformaInvoiceSchema = {
    body: Joi.object({
        proformaNo: Joi.string().max(100).allow(null, '').optional(),
        proformaDate: Joi.date().allow(null, '').optional(),
        dueDays: Joi.number().integer().min(1).default(15),
        dueDate: Joi.date().allow(null, '').optional(),
        orderRefNo: Joi.string().max(100).allow(null, '').optional(),
        orderRefDate: Joi.date().allow(null, '').optional(),
        quotationId: Joi.number().integer().positive().allow(null).optional(),
        firmBranchId: Joi.number().integer().positive().allow(null).optional(),
        partyId: Joi.number().integer().positive().allow(null).optional(),
        partyBranchId: Joi.number().integer().positive().allow(null).optional(),
        customerName: Joi.string().max(255).allow(null, '').optional(),
        hasGst: Joi.boolean().allow(null).optional(),
        gstNumber: Joi.string().max(30).allow(null, '').optional(),
        contactPerson: Joi.string().max(150).allow(null, '').optional(),
        contactEmail: Joi.string().email().allow(null, '').optional(),
        contactPhone: Joi.string().max(50).allow(null, '').optional(),
        billingAddress: Joi.string().allow(null, '').optional(),
        shippingAddress: Joi.string().allow(null, '').optional(),
        placeOfSupply: Joi.string().max(100).allow(null, '').optional(),
        dispatchThrough: Joi.string().max(150).allow(null, '').optional(),
        destination: Joi.string().max(150).allow(null, '').optional(),
        paymentTerms: Joi.string().allow(null, '').optional(),
        deliveryPeriod: Joi.string().allow(null, '').optional(),
        freightBasis: Joi.string().allow(null, '').optional(),
        warrantyTerms: Joi.string().allow(null, '').optional(),
        specialNotes: Joi.string().allow(null, '').optional(),
        termsAndConditions: Joi.string().allow(null, '').optional(),
        subTotal: Joi.number().min(0).allow(null).optional(),
        discountPercent: Joi.number().min(0).max(100).allow(null).optional(),
        discountAmount: Joi.number().min(0).allow(null).optional(),
        taxableAmount: Joi.number().min(0).allow(null).optional(),
        cgst: Joi.number().min(0).allow(null).optional(),
        sgst: Joi.number().min(0).allow(null).optional(),
        igst: Joi.number().min(0).allow(null).optional(),
        total: Joi.number().min(0).allow(null).optional(),
        roundOff: Joi.number().allow(null).optional(),
        other: Joi.number().allow(null).optional(),
        advanceAmountRequested: Joi.number().min(0).allow(null).optional(),
        advanceReceived: Joi.number().min(0).allow(null).optional(),
        status: Joi.string().valid('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'CONVERTED', 'CANCELLED').optional(),
        notes: Joi.string().allow(null, '').optional(),
        items: Joi.array().items(proformaInvoiceItemSchema).min(1).required()
    }).unknown(true)
};

const updateProformaInvoiceSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required()
    }),
    body: Joi.object({
        proformaNo: Joi.string().max(100).allow(null, '').optional(),
        proformaDate: Joi.date().allow(null, '').optional(),
        dueDays: Joi.number().integer().min(1).optional(),
        dueDate: Joi.date().allow(null, '').optional(),
        orderRefNo: Joi.string().max(100).allow(null, '').optional(),
        orderRefDate: Joi.date().allow(null, '').optional(),
        quotationId: Joi.number().integer().positive().allow(null).optional(),
        firmBranchId: Joi.number().integer().positive().allow(null).optional(),
        partyId: Joi.number().integer().positive().allow(null).optional(),
        partyBranchId: Joi.number().integer().positive().allow(null).optional(),
        customerName: Joi.string().max(255).allow(null, '').optional(),
        hasGst: Joi.boolean().allow(null).optional(),
        gstNumber: Joi.string().max(30).allow(null, '').optional(),
        contactPerson: Joi.string().max(150).allow(null, '').optional(),
        contactEmail: Joi.string().email().allow(null, '').optional(),
        contactPhone: Joi.string().max(50).allow(null, '').optional(),
        billingAddress: Joi.string().allow(null, '').optional(),
        shippingAddress: Joi.string().allow(null, '').optional(),
        placeOfSupply: Joi.string().max(100).allow(null, '').optional(),
        dispatchThrough: Joi.string().max(150).allow(null, '').optional(),
        destination: Joi.string().max(150).allow(null, '').optional(),
        paymentTerms: Joi.string().allow(null, '').optional(),
        deliveryPeriod: Joi.string().allow(null, '').optional(),
        freightBasis: Joi.string().allow(null, '').optional(),
        warrantyTerms: Joi.string().allow(null, '').optional(),
        specialNotes: Joi.string().allow(null, '').optional(),
        termsAndConditions: Joi.string().allow(null, '').optional(),
        subTotal: Joi.number().min(0).allow(null).optional(),
        discountPercent: Joi.number().min(0).max(100).allow(null).optional(),
        discountAmount: Joi.number().min(0).allow(null).optional(),
        taxableAmount: Joi.number().min(0).allow(null).optional(),
        cgst: Joi.number().min(0).allow(null).optional(),
        sgst: Joi.number().min(0).allow(null).optional(),
        igst: Joi.number().min(0).allow(null).optional(),
        total: Joi.number().min(0).allow(null).optional(),
        roundOff: Joi.number().allow(null).optional(),
        other: Joi.number().allow(null).optional(),
        advanceAmountRequested: Joi.number().min(0).allow(null).optional(),
        advanceReceived: Joi.number().min(0).allow(null).optional(),
        status: Joi.string().valid('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'CONVERTED', 'CANCELLED').optional(),
        cancelReason: Joi.string().allow(null, '').optional(),
        notes: Joi.string().allow(null, '').optional(),
        items: Joi.array().items(proformaInvoiceItemSchema).min(1).optional()
    }).unknown(true)
};

module.exports = {
    proformaInvoiceItemSchema,
    getProformaInvoiceByIdSchema,
    queryProformaInvoicesSchema,
    createProformaInvoiceSchema,
    updateProformaInvoiceSchema
};
