const { getContext } = require('../helpers/requestContext');
const { ApiError } = require('../services/ApiError');
const { ApiResponse } = require('../services/ApiResponse');
const { asyncHandler } = require('../services/asyncHandler');
const {
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
} = require('../models/product.model');

/**
 * Get all products (with pagination, search, filters)
 */
const getAllProducts = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const products = await fetchAllProducts(firmId, req.query);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: products,
            message: 'Products fetched successfully.'
        })
    );
});

/**
 * Get product pagination metadata
 */
const getProductsMeta = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const pagination = await fetchProductsMeta(firmId, req.query);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { pagination },
            message: 'Product pagination metadata fetched successfully.'
        })
    );
});

/**
 * Fast autocomplete search for Invoice/PO line items
 */
const searchProductsList = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const results = await searchProducts(firmId, req.query);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: results,
            message: 'Products search completed successfully.'
        })
    );
});

/**
 * Get single product by ID
 */
const getProductById = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const { id } = req.params;

    const product = await fetchProductById(id, firmId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: product,
            message: 'Product details fetched successfully.'
        })
    );
});

/**
 * Create new product
 */
const createProduct = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const userId = req.user?.id || 1;

    const newProduct = await insertProduct(firmId, userId, req.body);

    return res.status(201).json(
        new ApiResponse({
            statusCode: 201,
            data: newProduct,
            message: 'Product created successfully.'
        })
    );
});

/**
 * Update existing product
 */
const updateProduct = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const userId = req.user?.id || 1;
    const { id } = req.params;

    const updatedProduct = await updateProductById(id, firmId, userId, req.body);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: updatedProduct,
            message: 'Product updated successfully.'
        })
    );
});

/**
 * Delete product (Soft delete or permanent delete)
 */
const deleteProduct = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const userId = req.user?.id || 1;
    const { id } = req.params;
    const { isPermanentDelete = false } = req.query;

    const isPermanent = isPermanentDelete === true || isPermanentDelete === 'true';
    await deleteProductById(id, firmId, userId, isPermanent);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: null,
            message: isPermanent ? 'Product permanently deleted successfully.' : 'Product moved to trash successfully.'
        })
    );
});

/**
 * Restore product from trash
 */
const restoreProduct = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const userId = req.user?.id || 1;
    const { id } = req.params;

    await restoreProductById(id, firmId, userId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: null,
            message: 'Product restored successfully.'
        })
    );
});

/**
 * Bulk delete products
 */
const bulkDeleteProductsHandler = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const userId = req.user?.id || 1;
    const { ids, isPermanentDelete = false } = req.body;

    const isPermanent = isPermanentDelete === true || isPermanentDelete === 'true';
    const deletedCount = await bulkDeleteProducts(ids, firmId, userId, isPermanent);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { count: deletedCount },
            message: `${deletedCount} product(s) ${isPermanent ? 'permanently deleted' : 'moved to trash'} successfully.`
        })
    );
});

/**
 * Bulk restore products
 */
const bulkRestoreProductsHandler = asyncHandler(async (req, res) => {
    const { firmId = 0 } = getContext();
    const userId = req.user?.id || 1;
    const { ids } = req.body;

    const restoredCount = await bulkRestoreProducts(ids, firmId, userId);

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: { count: restoredCount },
            message: `${restoredCount} product(s) restored successfully.`
        })
    );
});

module.exports = {
    getAllProducts,
    getProductsMeta,
    searchProductsList,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    restoreProduct,
    bulkDeleteProductsHandler,
    bulkRestoreProductsHandler
};
