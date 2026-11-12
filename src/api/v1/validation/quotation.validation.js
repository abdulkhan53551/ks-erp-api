const Joi = require('joi');

const quotationItemSchema = Joi.object({
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
    annexureData: Joi.alternatives().try(Joi.array(), Joi.object(), Joi.string()).allow(null).optional(),
    sortOrder: Joi.number().integer().optional()
}).unknown(true);

const quotationItemUpdateSchema = quotationItemSchema.fork(['qty', 'rate'], (schema) => schema.optional());

const getQuotationByIdSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required()
    }),
    query: Joi.object({
        includeAnnexure: Joi.alternatives().try(Joi.boolean(), Joi.string()).optional()
    }).unknown(true)
};

const queryQuotationsSchema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(100).default(10),
        search: Joi.string().allow('', null).optional(),
        status: Joi.string().allow('', null).optional(),
        approvalStatus: Joi.string().allow('', null).optional(),
        startDate: Joi.string().allow('', null).optional(),
        endDate: Joi.string().allow('', null).optional(),
        trash: Joi.alternatives().try(Joi.boolean(), Joi.string()).default(false)
    })
};

const createQuotationSchema = {
    body: Joi.object({
        quotationNo: Joi.string().max(100).allow(null, '').optional(),
        quotationDate: Joi.date().allow(null, '').optional(),
        validityDays: Joi.number().integer().min(1).default(30),
        clientRfqRef: Joi.string().max(150).allow(null, '').optional(),
        templateType: Joi.string().valid('CARDS', 'MATRIX').default('CARDS'),
        includeAnnexure: Joi.boolean().allow(null).optional(),
        tableSpecConfig: Joi.array().items(Joi.object().unknown(true)).allow(null).optional(),
        firmBranchId: Joi.number().integer().positive().allow(null).optional(),
        partyId: Joi.number().integer().positive().allow(null).optional(),
        partyBranchId: Joi.number().integer().positive().allow(null).optional(),
        customerName: Joi.string().max(255).allow(null, '').optional(),
        gstNumber: Joi.string().max(30).allow(null, '').optional(),
        contactPerson: Joi.string().max(150).allow(null, '').optional(),
        contactEmail: Joi.string().email().allow(null, '').optional(),
        contactPhone: Joi.string().max(50).allow(null, '').optional(),
        billingAddress: Joi.string().allow(null, '').optional(),
        shippingAddress: Joi.string().allow(null, '').optional(),
        placeOfSupply: Joi.string().max(100).allow(null, '').optional(),
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
        roundOffManual: Joi.boolean().allow(null).optional(),
        other: Joi.number().allow(null).optional(),
        otherCharges: Joi.number().allow(null).optional(),
        status: Joi.string().valid('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PO_CONVERTED', 'REJECTED', 'CANCELLED').optional(),
        approvalStatus: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED').optional(),
        notes: Joi.string().allow(null, '').optional(),
        items: Joi.array().items(quotationItemSchema).min(1).required()
    }).unknown(true)
};

const createQuotationRevisionSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required()
    }),
    body: Joi.object({
        quotationNo: Joi.string().max(100).allow(null, '').optional(),
        quotationDate: Joi.date().allow(null, '').optional(),
        validityDays: Joi.number().integer().min(1).optional(),
        templateType: Joi.string().valid('CARDS', 'MATRIX').optional(),
        includeAnnexure: Joi.boolean().allow(null).optional(),
        clientRfqRef: Joi.string().max(150).allow(null, '').optional(),
        tableSpecConfig: Joi.array().items(Joi.object().unknown(true)).allow(null).optional(),
        firmBranchId: Joi.number().integer().positive().allow(null).optional(),
        partyId: Joi.number().integer().positive().allow(null).optional(),
        partyBranchId: Joi.number().integer().positive().allow(null).optional(),
        customerName: Joi.string().max(255).allow(null, '').optional(),
        gstNumber: Joi.string().max(30).allow(null, '').optional(),
        contactPerson: Joi.string().max(150).allow(null, '').optional(),
        contactEmail: Joi.string().email().allow(null, '').optional(),
        contactPhone: Joi.string().max(50).allow(null, '').optional(),
        billingAddress: Joi.string().allow(null, '').optional(),
        shippingAddress: Joi.string().allow(null, '').optional(),
        placeOfSupply: Joi.string().max(100).allow(null, '').optional(),
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
        roundOffManual: Joi.boolean().allow(null).optional(),
        other: Joi.number().allow(null).optional(),
        otherCharges: Joi.number().allow(null).optional(),
        status: Joi.string().valid('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PO_CONVERTED', 'REJECTED', 'CANCELLED').optional(),
        approvalStatus: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED').optional(),
        notes: Joi.string().allow(null, '').optional(),
        items: Joi.array().items(quotationItemUpdateSchema).optional()
    }).unknown(true)
};

const updateQuotationSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required()
    }),
    body: Joi.object({
        forceUpdate: Joi.boolean().optional(),
        isRevision: Joi.boolean().optional(),
        keepApproval: Joi.boolean().optional(),
        quotationNo: Joi.string().max(100).allow(null, '').optional(),
        quotationDate: Joi.date().allow(null, '').optional(),
        validityDays: Joi.number().integer().min(1).optional(),
        clientRfqRef: Joi.string().max(150).allow(null, '').optional(),
        templateType: Joi.string().valid('CARDS', 'MATRIX').optional(),
        includeAnnexure: Joi.boolean().allow(null).optional(),
        tableSpecConfig: Joi.array().items(Joi.object().unknown(true)).allow(null).optional(),
        firmBranchId: Joi.number().integer().positive().allow(null).optional(),
        partyId: Joi.number().integer().positive().allow(null).optional(),
        partyBranchId: Joi.number().integer().positive().allow(null).optional(),
        customerName: Joi.string().max(255).allow(null, '').optional(),
        gstNumber: Joi.string().max(30).allow(null, '').optional(),
        contactPerson: Joi.string().max(150).allow(null, '').optional(),
        contactEmail: Joi.string().email().allow(null, '').optional(),
        contactPhone: Joi.string().max(50).allow(null, '').optional(),
        billingAddress: Joi.string().allow(null, '').optional(),
        shippingAddress: Joi.string().allow(null, '').optional(),
        placeOfSupply: Joi.string().max(100).allow(null, '').optional(),
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
        roundOffManual: Joi.boolean().allow(null).optional(),
        other: Joi.number().allow(null).optional(),
        otherCharges: Joi.number().allow(null).optional(),
        status: Joi.string().valid('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PO_CONVERTED', 'REJECTED', 'CANCELLED').optional(),
        approvalStatus: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED').optional(),
        notes: Joi.string().allow(null, '').optional(),
        items: Joi.array().items(quotationItemUpdateSchema).optional()
    }).unknown(true)
};

const approveQuotationSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required()
    }),
    body: Joi.object({
        approvalStatus: Joi.string().valid('APPROVED', 'REJECTED').required(),
        rejectionReason: Joi.string().allow(null, '').optional()
    })
};

const bulkDeleteQuotationsSchema = {
    body: Joi.object({
        ids: Joi.array().items(Joi.number().integer().positive().required()).min(1).required()
    })
};

module.exports = {
    getQuotationByIdSchema,
    queryQuotationsSchema,
    createQuotationSchema,
    createQuotationRevisionSchema,
    updateQuotationSchema,
    approveQuotationSchema,
    bulkDeleteQuotationsSchema
};
