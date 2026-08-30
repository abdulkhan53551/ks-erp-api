const Joi = require('joi');

const VALID_ITEM_TYPES = ['RAW_MATERIAL', 'FINISHED_GOODS', 'SERVICE', 'CONSUMABLE'];
const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];

// Create product schema
const createProductSchema = {
    body: Joi.object({
        name: Joi.string().trim().max(255).required().messages({
            'string.empty': 'Product name is required',
            'any.required': 'Product name is required'
        }),
        itemCode: Joi.string().trim().max(50).allow('', null).optional(),
        itemType: Joi.string().valid(...VALID_ITEM_TYPES).default('FINISHED_GOODS'),
        hsnSacCode: Joi.string().trim().max(20).allow('', null).optional(),
        gstSlabId: Joi.number().integer().positive().allow(null).optional(),
        itemUnitId: Joi.number().integer().positive().allow(null).optional(),
        sellingPrice: Joi.number().min(0).default(0).allow(null),
        purchasePrice: Joi.number().min(0).default(0).allow(null),
        drawingNumber: Joi.string().trim().max(150).allow('', null).optional(),
        materialGrade: Joi.string().trim().max(100).allow('', null).optional(),
        dimensions: Joi.string().trim().max(200).allow('', null).optional(),
        unitWeightKg: Joi.number().min(0).precision(3).allow(null).optional(),
        description: Joi.string().trim().allow('', null).optional(),
        notes: Joi.string().trim().allow('', null).optional(),
        status: Joi.string().valid(...VALID_STATUSES).default('ACTIVE')
    })
};

// Update product schema
const updateProductSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required()
    }),
    body: Joi.object({
        name: Joi.string().trim().max(255).optional(),
        itemCode: Joi.string().trim().max(50).allow('', null).optional(),
        itemType: Joi.string().valid(...VALID_ITEM_TYPES).optional(),
        hsnSacCode: Joi.string().trim().max(20).allow('', null).optional(),
        gstSlabId: Joi.number().integer().positive().allow(null).optional(),
        itemUnitId: Joi.number().integer().positive().allow(null).optional(),
        sellingPrice: Joi.number().min(0).allow(null).optional(),
        purchasePrice: Joi.number().min(0).allow(null).optional(),
        drawingNumber: Joi.string().trim().max(150).allow('', null).optional(),
        materialGrade: Joi.string().trim().max(100).allow('', null).optional(),
        dimensions: Joi.string().trim().max(200).allow('', null).optional(),
        unitWeightKg: Joi.number().min(0).precision(3).allow(null).optional(),
        description: Joi.string().trim().allow('', null).optional(),
        notes: Joi.string().trim().allow('', null).optional(),
        status: Joi.string().valid(...VALID_STATUSES).optional()
    }).min(1).messages({
        'object.min': 'At least one field is required to update'
    })
};

// Get / Delete / Restore single product schema
const productIdParamSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required()
    }),
    query: Joi.object({
        isPermanentDelete: Joi.boolean().default(false)
    })
};

// Query / list products schema
const queryProductsSchema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(100).default(10),
        search: Joi.string().trim().allow('', null).optional(),
        itemType: Joi.string().trim().allow('', null).optional(), // Can be single or comma-separated
        status: Joi.string().valid(...VALID_STATUSES, '', null).optional(),
        trash: Joi.boolean().default(false),
        sortBy: Joi.string().trim().default('created_at'),
        sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').default('desc')
    })
};

// Autocomplete search schema
const searchProductsSchema = {
    query: Joi.object({
        q: Joi.string().trim().allow('', null).default(''),
        itemType: Joi.string().trim().allow('', null).optional(), // e.g. "FINISHED_GOODS,SERVICE"
        limit: Joi.number().integer().min(1).max(50).default(15)
    })
};

// Bulk delete schema
const bulkDeleteProductsSchema = {
    body: Joi.object({
        ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
        isPermanentDelete: Joi.boolean().default(false)
    })
};

// Bulk restore schema
const bulkRestoreProductsSchema = {
    body: Joi.object({
        ids: Joi.array().items(Joi.number().integer().positive()).min(1).required()
    })
};

module.exports = {
    createProductSchema,
    updateProductSchema,
    productIdParamSchema,
    queryProductsSchema,
    searchProductsSchema,
    bulkDeleteProductsSchema,
    bulkRestoreProductsSchema
};
