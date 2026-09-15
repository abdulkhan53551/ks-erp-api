const { Router } = require('express');
const validate = require('../middlewares/validate');
const { checkPermission } = require('../middlewares/authorize.middleware');
const {
    createProductSchema,
    updateProductSchema,
    productIdParamSchema,
    queryProductsSchema,
    searchProductsSchema,
    bulkDeleteProductsSchema,
    bulkRestoreProductsSchema
} = require('../validation/product.validation');
const {
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
} = require('../controllers/product.controller');

const router = Router();

// Pagination metadata & Autocomplete Search
router.get('/pagination', checkPermission('products', 'read'), validate(queryProductsSchema), getProductsMeta);
router.get('/search', checkPermission('products', 'read'), validate(searchProductsSchema), searchProductsList);

// Bulk Operations
router.post('/bulk-delete', checkPermission('products', 'delete'), validate(bulkDeleteProductsSchema), bulkDeleteProductsHandler);
router.patch('/bulk-restore', checkPermission('products', 'update'), validate(bulkRestoreProductsSchema), bulkRestoreProductsHandler);
router.post('/bulk-restore', checkPermission('products', 'update'), validate(bulkRestoreProductsSchema), bulkRestoreProductsHandler);

// CRUD
router.get('/', checkPermission('products', 'read'), validate(queryProductsSchema), getAllProducts);
router.post('/', checkPermission('products', 'create'), validate(createProductSchema), createProduct);
router.get('/:id', checkPermission('products', 'read'), validate(productIdParamSchema), getProductById);
router.patch('/:id', checkPermission('products', 'update'), validate(updateProductSchema), updateProduct);
router.patch('/:id/restore', checkPermission('products', 'update'), validate(productIdParamSchema), restoreProduct);
router.delete('/:id', checkPermission('products', 'delete'), validate(productIdParamSchema), deleteProduct);

module.exports = router;
