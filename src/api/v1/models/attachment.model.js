const { db } = require('../database');
const { ApiError } = require('../services/ApiError');

/**
 * Fetch attachments for a given entity (e.g. PARTY, INVOICE)
 */
const fetchAttachmentsByEntity = async ({ entityType, entityId, docType, firmId }) => {
    try {
        const query = db('attachments as a')
            .select(
                'a.id',
                'a.entity_type as entityType',
                'a.entity_id as entityId',
                'a.doc_type as docType',
                'a.title',
                'a.original_name as originalName',
                'a.file_size_bytes as fileSizeBytes',
                'a.mime_type as mimeType',
                'a.public_id as publicId',
                'a.secure_url as secureUrl',
                'a.resource_type as resourceType',
                'a.created_at as createdAt',
                'a.updated_at as updatedAt',
                db.raw(`CONCAT(u.first_name, ' ', u.last_name) AS "createdBy"`)
            )
            .leftJoin('users as u', 'a.created_by', 'u.id')
            .where('a.entity_type', entityType.toUpperCase())
            .andWhere('a.entity_id', entityId);

        if (docType) {
            query.andWhere('a.doc_type', docType.toUpperCase());
        }

        if (firmId) {
            query.andWhere(function () {
                this.where('a.firm_id', firmId).orWhereNull('a.firm_id');
            });
        }

        query.orderBy('a.created_at', 'desc');

        return await query;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching attachments.'
        });
    }
};

/**
 * Fetch a single attachment by ID
 */
const fetchAttachmentById = async (id) => {
    try {
        const attachment = await db('attachments as a')
            .select(
                'a.id',
                'a.firm_id',
                'a.entity_type as entityType',
                'a.entity_id as entityId',
                'a.doc_type as docType',
                'a.title',
                'a.original_name as originalName',
                'a.file_size_bytes as fileSizeBytes',
                'a.mime_type as mimeType',
                'a.public_id as publicId',
                'a.secure_url as secureUrl',
                'a.resource_type as resourceType',
                'a.is_active as isActive',
                'a.created_at as createdAt',
                'a.updated_at as updatedAt',
                'a.deleted_at as deletedAt'
            )
            .where('a.id', id)
            .first();

        return attachment || null;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching attachment.'
        });
    }
};

/**
 * Insert a new attachment
 */
const insertAttachment = async (data) => {
    try {
        const [inserted] = await db('attachments')
            .insert({
                firm_id: data.firmId || null,
                entity_type: data.entityType.toUpperCase(),
                entity_id: data.entityId,
                doc_type: data.docType.toUpperCase(),
                title: data.title || null,
                original_name: data.originalName,
                file_size_bytes: data.fileSizeBytes,
                mime_type: data.mimeType,
                public_id: data.publicId,
                secure_url: data.secureUrl,
                resource_type: data.resourceType || 'auto'
            })
            .returning([
                'id',
                'entity_type as entityType',
                'entity_id as entityId',
                'doc_type as docType',
                'title',
                'original_name as originalName',
                'file_size_bytes as fileSizeBytes',
                'mime_type as mimeType',
                'public_id as publicId',
                'secure_url as secureUrl',
                'resource_type as resourceType',
                'created_at as createdAt'
            ]);

        return inserted;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating attachment.'
        });
    }
};

/**
 * Delete attachment by ID (permanently removes record from database)
 */
const deleteAttachmentById = async (id) => {
    try {
        return await db('attachments')
            .where({ id })
            .del();
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting attachment.'
        });
    }
};

module.exports = {
    fetchAttachmentsByEntity,
    fetchAttachmentById,
    insertAttachment,
    deleteAttachmentById
};
