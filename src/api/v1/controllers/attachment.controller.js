const { asyncHandler } = require('../services/asyncHandler');
const { ApiResponse } = require('../services/ApiResponse');
const { ApiError } = require('../services/ApiError');
const { getContext } = require('../helpers/requestContext');
const {
    fetchAttachmentsByEntity,
    fetchAttachmentById,
    insertAttachment,
    deleteAttachmentById
} = require('../models/attachment.model');
const { deleteFromCloudinary } = require('../services/cloudinary');

/**
 * Get attachments for an entity (e.g. PARTY, INVOICE)
 */
const getAttachments = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const { entityType, entityId, docType } = req.query;

    const attachments = await fetchAttachmentsByEntity({
        entityType,
        entityId: Number(entityId),
        docType,
        firmId
    });

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: attachments,
            message: 'Attachments fetched successfully.'
        })
    );
});

/**
 * Create / link a new attachment record
 */
const createAttachment = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const {
        entityType,
        entityId,
        docType,
        title,
        originalName,
        fileSizeBytes,
        mimeType,
        publicId,
        secureUrl,
        resourceType
    } = req.body;

    const isFirmEntity = entityType.toUpperCase() === 'FIRM';
    const effectiveFirmId = isFirmEntity ? Number(entityId) : (firmId || null);

    const attachmentData = {
        firmId: effectiveFirmId,
        entityType,
        entityId: Number(entityId),
        docType,
        title,
        originalName,
        fileSizeBytes: Number(fileSizeBytes),
        mimeType,
        publicId,
        secureUrl,
        resourceType: resourceType || 'auto'
    };

    const created = await insertAttachment(attachmentData);

    return res.status(201).json(
        new ApiResponse({
            statusCode: 201,
            data: created,
            message: 'Attachment linked successfully.'
        })
    );
});

/**
 * Delete an attachment (permanently removes from database and Cloudinary storage)
 */
const deleteAttachment = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const attachment = await fetchAttachmentById(id);

    if (!attachment) {
        throw new ApiError({
            statusCode: 404,
            message: 'Attachment not found.'
        });
    }

    // 1. Delete document record from database
    const affectedRows = await deleteAttachmentById(id);

    if (!affectedRows) {
        throw new ApiError({
            statusCode: 500,
            message: 'Failed to delete attachment from database.'
        });
    }

    // 2. Permanently destroy asset from Cloudinary storage
    if (attachment.publicId) {
        await deleteFromCloudinary(attachment.publicId, attachment.resourceType || 'image');
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { id: Number(id) },
            message: 'Document deleted successfully from database and Cloudinary storage.'
        })
    );
});

module.exports = {
    getAttachments,
    createAttachment,
    deleteAttachment
};
