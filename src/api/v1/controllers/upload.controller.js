const { asyncHandler } = require('../services/asyncHandler');
const { ApiResponse } = require('../services/ApiResponse');
const { ApiError } = require('../services/ApiError');
const { generateUploadSignature, deleteFromCloudinary } = require('../services/cloudinary');

/**
 * Generate pre-signed upload signature for Cloudinary direct uploads
 */
const getUploadSignature = asyncHandler(async (req, res) => {
    const { folder = 'ks-erp/attachments', tags } = req.query;

    const signatureData = generateUploadSignature({ folder, tags });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: signatureData,
            message: 'Upload signature generated successfully.'
        })
    );
});

/**
 * Destroy asset from Cloudinary
 */
const destroyCloudinaryAsset = asyncHandler(async (req, res) => {
    const { publicId, resourceType = 'image' } = req.body;

    if (!publicId) {
        throw new ApiError({
            statusCode: 400,
            message: 'publicId is required.'
        });
    }

    const result = await deleteFromCloudinary(publicId, resourceType);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: result,
            message: 'Asset destroyed from Cloudinary successfully.'
        })
    );
});

module.exports = {
    getUploadSignature,
    destroyCloudinaryAsset
};
