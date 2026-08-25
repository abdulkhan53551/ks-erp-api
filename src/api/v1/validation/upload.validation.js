const Joi = require('joi');

const destroyCloudinaryAssetSchema = {
    body: Joi.object({
        publicId: Joi.string()
            .trim()
            .required()
            .messages({
                'string.empty': 'Cloudinary publicId is required.',
                'any.required': 'Cloudinary publicId is required.'
            }),
        resourceType: Joi.string()
            .valid('image', 'raw', 'video', 'auto')
            .default('image')
            .optional()
    })
};

module.exports = {
    destroyCloudinaryAssetSchema
};
