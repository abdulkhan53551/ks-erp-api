const Joi = require('joi');

// Validation schema for fetching attachments by entity
const getAttachmentsSchema = {
    query: Joi.object({
        entityType: Joi.string()
            .valid('FIRM', 'PARTY', 'INVOICE', 'PURCHASE_ORDER', 'CHALLAN', 'EWAY_BILL')
            .insensitive()
            .required()
            .messages({
                'any.required': 'Entity type is required.',
                'any.only': 'Invalid entity type.'
            }),
        entityId: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'any.required': 'Entity ID is required.',
                'number.base': 'Entity ID must be a valid number.'
            }),
        docType: Joi.string()
            .max(50)
            .allow('', null)
            .optional()
    })
};

// Validation schema for creating an attachment record
const createAttachmentSchema = {
    body: Joi.object({
        entityType: Joi.string()
            .valid('FIRM', 'PARTY', 'INVOICE', 'PURCHASE_ORDER', 'CHALLAN', 'EWAY_BILL')
            .insensitive()
            .required()
            .messages({
                'any.required': 'Entity type is required.',
                'any.only': 'Invalid entity type.'
            }),
        entityId: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'any.required': 'Entity ID is required.',
                'number.base': 'Entity ID must be a valid number.'
            }),
        docType: Joi.string()
            .max(50)
            .required()
            .messages({
                'any.required': 'Document type is required.'
            }),
        title: Joi.string()
            .max(255)
            .allow('', null)
            .optional(),
        originalName: Joi.string()
            .max(255)
            .required()
            .messages({
                'any.required': 'Original file name is required.'
            }),
        fileSizeBytes: Joi.number()
            .integer()
            .min(0)
            .required()
            .messages({
                'any.required': 'File size is required.'
            }),
        mimeType: Joi.string()
            .max(100)
            .required()
            .messages({
                'any.required': 'MIME type is required.'
            }),
        publicId: Joi.string()
            .max(255)
            .required()
            .messages({
                'any.required': 'Cloudinary public ID is required.'
            }),
        secureUrl: Joi.string()
            .uri()
            .max(500)
            .required()
            .messages({
                'any.required': 'Secure URL is required.',
                'string.uri': 'Invalid secure URL format.'
            }),
        resourceType: Joi.string()
            .valid('image', 'raw', 'auto', 'video')
            .default('auto')
            .optional()
    })
};

// Validation schema for deleting an attachment
const deleteAttachmentSchema = {
    params: Joi.object({
        id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'any.required': 'Attachment ID is required.',
                'number.base': 'Invalid attachment ID.'
            })
    })
};

module.exports = {
    getAttachmentsSchema,
    createAttachmentSchema,
    deleteAttachmentSchema
};
