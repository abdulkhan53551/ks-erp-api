const { fetchPageData, buildPagination } = require("../../../utils/pagination");
const { db } = require("../database");
const { ApiError } = require("../services/ApiError");

/**
 * Fetch all products with pagination, search & filters
 */
const fetchAllProducts = async (firmId, query = {}) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            search = '',
            itemType,
            status,
            trash = false,
            sortBy = 'created_at',
            sortOrder = 'desc'
        } = query;

        const isTrash = trash === true || trash === 'true';

        const baseQuery = db('products as p')
            .select(
                'p.id',
                'p.firm_id as firmId',
                'p.item_code as itemCode',
                'p.name',
                'p.item_type as itemType',
                'p.hsn_sac_code as hsnSacCode',
                'p.gst_slab_id as gstSlabId',
                'gs.gst_rate as gstRate',
                'p.item_unit_id as itemUnitId',
                'iu.uqc as unitName',
                'iu.description as unitDescription',
                'p.selling_price as sellingPrice',
                'p.purchase_price as purchasePrice',
                'p.image_url as imageUrl',
                'p.image_public_id as imagePublicId',
                'p.drawing_number as drawingNumber',
                'p.material_grade as materialGrade',
                'p.dimensions',
                'p.unit_weight_kg as unitWeightKg',
                'p.description',
                'p.notes',
                'p.status',
                'p.is_active as isActive',
                'p.created_at as createdAt',
                'p.updated_at as updatedAt',
                'p.deleted_at as deletedAt',
                db.raw(`CONCAT(cu.first_name, ' ', cu.last_name) AS created_by_name`),
                db.raw(`CONCAT(uu.first_name, ' ', uu.last_name) AS updated_by_name`),
                db.raw(`CONCAT(du.first_name, ' ', du.last_name) AS deleted_by_name`)
            )
            .leftJoin('gst_slabs as gs', 'p.gst_slab_id', 'gs.id')
            .leftJoin('item_units as iu', 'p.item_unit_id', 'iu.id')
            .leftJoin('users as cu', 'p.created_by', 'cu.id')
            .leftJoin('users as uu', 'p.updated_by', 'uu.id')
            .leftJoin('users as du', 'p.deleted_by', 'du.id')
            .where({
                'p.firm_id': firmId,
                'p.is_active': !isTrash
            });

        // Filter by itemType (single or comma-separated, e.g. "FINISHED_GOODS,SERVICE")
        if (itemType) {
            const types = itemType.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
            if (types.length > 0) {
                baseQuery.whereIn('p.item_type', types);
            }
        }

        // Filter by status (ACTIVE / INACTIVE)
        if (status) {
            baseQuery.where('p.status', status);
        }

        // Multi-attribute search
        if (search) {
            const term = search.trim();
            baseQuery.where(function () {
                this.where('p.name', 'ILIKE', `%${term}%`)
                    .orWhere('p.item_code', 'ILIKE', `%${term}%`)
                    .orWhere('p.drawing_number', 'ILIKE', `%${term}%`)
                    .orWhere('p.material_grade', 'ILIKE', `%${term}%`)
                    .orWhere('p.hsn_sac_code', 'ILIKE', `%${term}%`);
            });
        }

        // Sorting
        const validSortColumns = {
            id: 'p.id',
            name: 'p.name',
            itemCode: 'p.item_code',
            itemType: 'p.item_type',
            sellingPrice: 'p.selling_price',
            purchasePrice: 'p.purchase_price',
            drawingNumber: 'p.drawing_number',
            materialGrade: 'p.material_grade',
            createdAt: 'p.created_at',
            updatedAt: 'p.updated_at',
            deletedAt: 'p.deleted_at'
        };

        const sortColumn = validSortColumns[sortBy] || (isTrash ? 'p.deleted_at' : 'p.created_at');
        const direction = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

        baseQuery.orderBy(sortColumn, direction);

        const products = await fetchPageData({ baseQuery, page, pageSize });
        return products;
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching products.'
        });
    }
};

/**
 * Fetch product pagination metadata
 */
const fetchProductsMeta = async (firmId, query = {}) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            search = '',
            itemType,
            status,
            trash = false
        } = query;

        const isTrash = trash === true || trash === 'true';

        const baseQuery = db('products as p')
            .where({
                'p.firm_id': firmId,
                'p.is_active': !isTrash
            });

        if (itemType) {
            const types = itemType.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
            if (types.length > 0) {
                baseQuery.whereIn('p.item_type', types);
            }
        }

        if (status) {
            baseQuery.where('p.status', status);
        }

        if (search) {
            const term = search.trim();
            baseQuery.where(function () {
                this.where('p.name', 'ILIKE', `%${term}%`)
                    .orWhere('p.item_code', 'ILIKE', `%${term}%`)
                    .orWhere('p.drawing_number', 'ILIKE', `%${term}%`)
                    .orWhere('p.material_grade', 'ILIKE', `%${term}%`)
                    .orWhere('p.hsn_sac_code', 'ILIKE', `%${term}%`);
            });
        }

        const pagination = await buildPagination({ baseQuery, page, pageSize });
        return pagination;
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching product pagination meta.'
        });
    }
};

/**
 * Lightweight multi-attribute search for invoice & PO autocomplete dropdowns
 */
const searchProducts = async (firmId, query = {}) => {
    try {
        const { q = '', itemType, limit = 15 } = query;
        const searchTerm = q ? q.trim() : '';

        const dbQuery = db('products as p')
            .select(
                'p.id',
                'p.name',
                'p.item_code as itemCode',
                'p.item_type as itemType',
                'p.hsn_sac_code as hsnSacCode',
                'p.gst_slab_id as gstSlabId',
                'gs.gst_rate as gstRate',
                'p.item_unit_id as itemUnitId',
                'iu.uqc as unitName',
                'p.selling_price as sellingPrice',
                'p.purchase_price as purchasePrice',
                'p.drawing_number as drawingNumber',
                'p.material_grade as materialGrade',
                'p.dimensions',
                'p.unit_weight_kg as unitWeightKg',
                'p.image_url as imageUrl'
            )
            .leftJoin('gst_slabs as gs', 'p.gst_slab_id', 'gs.id')
            .leftJoin('item_units as iu', 'p.item_unit_id', 'iu.id')
            .where({
                'p.firm_id': firmId,
                'p.is_active': true,
                'p.status': 'ACTIVE'
            });

        // Comma-separated itemType filter (e.g. "FINISHED_GOODS,SERVICE")
        if (itemType) {
            const types = itemType.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
            if (types.length > 0) {
                dbQuery.whereIn('p.item_type', types);
            }
        }

        // Multi-attribute search
        if (searchTerm) {
            dbQuery.where(function () {
                this.where('p.name', 'ILIKE', `%${searchTerm}%`)
                    .orWhere('p.item_code', 'ILIKE', `%${searchTerm}%`)
                    .orWhere('p.drawing_number', 'ILIKE', `%${searchTerm}%`)
                    .orWhere('p.material_grade', 'ILIKE', `%${searchTerm}%`)
                    .orWhere('p.hsn_sac_code', 'ILIKE', `%${searchTerm}%`);
            });
        }

        const results = await dbQuery
            .orderBy('p.name', 'asc')
            .limit(Number(limit) || 15);

        return results;
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError({
            statusCode: 500,
            message: 'Something went wrong while searching products.'
        });
    }
};

/**
 * Fetch single product by ID with attached blueprints/files
 */
const fetchProductById = async (id, firmId) => {
    try {
        const product = await db('products as p')
            .select(
                'p.id',
                'p.firm_id as firmId',
                'p.item_code as itemCode',
                'p.name',
                'p.item_type as itemType',
                'p.hsn_sac_code as hsnSacCode',
                'p.gst_slab_id as gstSlabId',
                'gs.gst_rate as gstRate',
                'p.item_unit_id as itemUnitId',
                'iu.uqc as unitName',
                'iu.description as unitDescription',
                'p.selling_price as sellingPrice',
                'p.purchase_price as purchasePrice',
                'p.image_url as imageUrl',
                'p.image_public_id as imagePublicId',
                'p.drawing_number as drawingNumber',
                'p.material_grade as materialGrade',
                'p.dimensions',
                'p.unit_weight_kg as unitWeightKg',
                'p.description',
                'p.notes',
                'p.status',
                'p.is_active as isActive',
                'p.created_at as createdAt',
                'p.updated_at as updatedAt',
                'p.deleted_at as deletedAt',
                db.raw(`CONCAT(cu.first_name, ' ', cu.last_name) AS created_by_name`),
                db.raw(`CONCAT(uu.first_name, ' ', uu.last_name) AS updated_by_name`),
                db.raw(`CONCAT(du.first_name, ' ', du.last_name) AS deleted_by_name`)
            )
            .leftJoin('gst_slabs as gs', 'p.gst_slab_id', 'gs.id')
            .leftJoin('item_units as iu', 'p.item_unit_id', 'iu.id')
            .leftJoin('users as cu', 'p.created_by', 'cu.id')
            .leftJoin('users as uu', 'p.updated_by', 'uu.id')
            .leftJoin('users as du', 'p.deleted_by', 'du.id')
            .where({
                'p.id': id,
                'p.firm_id': firmId
            })
            .first();

        if (!product) {
            throw new ApiError({
                statusCode: 404,
                message: 'Product not found.'
            });
        }

        // Fetch attached files (blueprints, CAD models, test certs) from attachments table
        const attachments = await db('attachments')
            .select(
                'id',
                'doc_type as docType',
                'title',
                'original_name as originalName',
                'file_size_bytes as fileSizeBytes',
                'mime_type as mimeType',
                'public_id as publicId',
                'secure_url as secureUrl',
                'resource_type as resourceType',
                'created_at as createdAt'
            )
            .where({
                entity_type: 'PRODUCT',
                entity_id: id,
                is_active: true
            })
            .orderBy('id', 'desc');

        product.attachments = attachments || [];

        return product;
    } catch (error) {
        console.error('DEBUG fetchProductById error:', error);
        throw error instanceof ApiError ? error : new ApiError({
            statusCode: 500,
            message: 'Something went wrong while fetching product details.'
        });
    }
};

/**
 * Insert new product
 */
const insertProduct = async (firmId, userId, data) => {
    try {
        const payload = {
            firm_id: firmId,
            name: data.name,
            item_code: data.itemCode ? data.itemCode.trim() : null,
            item_type: data.itemType || 'FINISHED_GOODS',
            hsn_sac_code: data.hsnSacCode ? data.hsnSacCode.trim() : null,
            gst_slab_id: data.gstSlabId || null,
            item_unit_id: data.itemUnitId || null,
            selling_price: data.sellingPrice !== undefined && data.sellingPrice !== null ? data.sellingPrice : 0,
            purchase_price: data.purchasePrice !== undefined && data.purchasePrice !== null ? data.purchasePrice : 0,
            image_url: data.imageUrl || null,
            image_public_id: data.imagePublicId || null,
            drawing_number: data.drawingNumber ? data.drawingNumber.trim() : null,
            material_grade: data.materialGrade ? data.materialGrade.trim() : null,
            dimensions: data.dimensions ? data.dimensions.trim() : null,
            unit_weight_kg: data.unitWeightKg !== undefined && data.unitWeightKg !== null ? data.unitWeightKg : null,
            description: data.description || null,
            notes: data.notes || null,
            status: data.status || 'ACTIVE',
            created_by: (userId && Number(userId) > 0) ? Number(userId) : null,
            updated_by: (userId && Number(userId) > 0) ? Number(userId) : null
        };

        const [product] = await db('products').insert(payload).returning('*');
        return product;
    } catch (error) {
        if (error.code === '23505') {
            throw new ApiError({
                statusCode: 409,
                message: 'A product with this Item Code already exists in this firm.'
            });
        }
        throw error instanceof ApiError ? error : new ApiError({
            statusCode: 500,
            message: 'Something went wrong while creating product.'
        });
    }
};

/**
 * Update existing product by ID
 */
const updateProductById = async (id, firmId, userId, data) => {
    try {
        const payload = {
            updated_at: new Date()
        };

        if (userId && Number(userId) > 0) {
            payload.updated_by = Number(userId);
        }

        if (data.name !== undefined) payload.name = data.name;
        if (data.itemCode !== undefined) payload.item_code = data.itemCode ? data.itemCode.trim() : null;
        if (data.itemType !== undefined) payload.item_type = data.itemType;
        if (data.hsnSacCode !== undefined) payload.hsn_sac_code = data.hsnSacCode ? data.hsnSacCode.trim() : null;
        if (data.gstSlabId !== undefined) payload.gst_slab_id = data.gstSlabId || null;
        if (data.itemUnitId !== undefined) payload.item_unit_id = data.itemUnitId || null;
        if (data.sellingPrice !== undefined) payload.selling_price = data.sellingPrice;
        if (data.purchasePrice !== undefined) payload.purchase_price = data.purchasePrice;
        if (data.imageUrl !== undefined) payload.image_url = data.imageUrl || null;
        if (data.imagePublicId !== undefined) payload.image_public_id = data.imagePublicId || null;
        if (data.drawingNumber !== undefined) payload.drawing_number = data.drawingNumber ? data.drawingNumber.trim() : null;
        if (data.materialGrade !== undefined) payload.material_grade = data.materialGrade ? data.materialGrade.trim() : null;
        if (data.dimensions !== undefined) payload.dimensions = data.dimensions ? data.dimensions.trim() : null;
        if (data.unitWeightKg !== undefined) payload.unit_weight_kg = data.unitWeightKg;
        if (data.description !== undefined) payload.description = data.description;
        if (data.notes !== undefined) payload.notes = data.notes;
        if (data.status !== undefined) payload.status = data.status;

        const updatedCount = await db('products')
            .where({ id, firm_id: firmId })
            .update(payload);

        if (!updatedCount) {
            throw new ApiError({
                statusCode: 404,
                message: 'Product not found or update failed.'
            });
        }

        return await fetchProductById(id, firmId);
    } catch (error) {
        if (error.code === '23505') {
            throw new ApiError({
                statusCode: 409,
                message: 'A product with this Item Code already exists in this firm.'
            });
        }
        throw error instanceof ApiError ? error : new ApiError({
            statusCode: 500,
            message: 'Something went wrong while updating product.'
        });
    }
};

/**
 * Delete product by ID (Soft delete or permanent delete)
 */
const deleteProductById = async (id, firmId, userId, isPermanentDelete = false) => {
    try {
        const product = await db('products').where({ id, firm_id: firmId }).first();
        if (!product) {
            throw new ApiError({
                statusCode: 404,
                message: 'Product not found.'
            });
        }

        if (isPermanentDelete) {
            // Permanent delete from database
            await db('products').where({ id, firm_id: firmId }).del();
        } else {
            // Soft delete
            const auditUserId = (userId && Number(userId) > 0) ? Number(userId) : null;
            await db('products')
                .where({ id, firm_id: firmId })
                .update({
                    is_active: false,
                    deleted_at: new Date(),
                    deleted_by: auditUserId
                });
        }

        return true;
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError({
            statusCode: 500,
            message: 'Something went wrong while deleting product.'
        });
    }
};

/**
 * Restore product from trash
 */
const restoreProductById = async (id, firmId, userId) => {
    try {
        const product = await db('products')
            .where({ id, firm_id: firmId, is_active: false })
            .first();

        if (!product) {
            throw new ApiError({
                statusCode: 404,
                message: 'Product not found in Trash or already active.'
            });
        }

        await db('products')
            .where({ id, firm_id: firmId })
            .update({
                is_active: true,
                deleted_at: null,
                deleted_by: null,
                updated_by: userId,
                updated_at: new Date()
            });

        return true;
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError({
            statusCode: 500,
            message: 'Something went wrong while restoring product.'
        });
    }
};

/**
 * Bulk delete products
 */
const bulkDeleteProducts = async (ids, firmId, userId, isPermanentDelete = false) => {
    try {
        if (!ids || ids.length === 0) return 0;

        if (isPermanentDelete) {
            const count = await db('products')
                .whereIn('id', ids)
                .andWhere({ firm_id: firmId })
                .del();
            return count;
        } else {
            const count = await db('products')
                .whereIn('id', ids)
                .andWhere({ firm_id: firmId, is_active: true })
                .update({
                    is_active: false,
                    deleted_at: new Date(),
                    deleted_by: userId
                });
            return count;
        }
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError({
            statusCode: 500,
            message: 'Something went wrong while bulk deleting products.'
        });
    }
};

/**
 * Bulk restore products
 */
const bulkRestoreProducts = async (ids, firmId, userId) => {
    try {
        if (!ids || ids.length === 0) return 0;

        const count = await db('products')
            .whereIn('id', ids)
            .andWhere({ firm_id: firmId, is_active: false })
            .update({
                is_active: true,
                deleted_at: null,
                deleted_by: null,
                updated_by: userId,
                updated_at: new Date()
            });

        return count;
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError({
            statusCode: 500,
            message: 'Something went wrong while bulk restoring products.'
        });
    }
};

module.exports = {
    fetchAllProducts,
    fetchProductsMeta,
    searchProducts,
    fetchProductById,
    insertProduct,
    updateProductById,
    deleteProductById,
    restoreProductById,
    bulkDeleteProducts,
    bulkRestoreProducts
};
