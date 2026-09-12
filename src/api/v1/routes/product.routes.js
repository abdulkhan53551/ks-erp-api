const { Router } = require('express');
const validate = require('../middlewares/validate');
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
router.get('/pagination', validate(queryProductsSchema), getProductsMeta);
router.get('/search', validate(searchProductsSchema), searchProductsList);

// Bulk Operations
router.post('/bulk-delete', validate(bulkDeleteProductsSchema), bulkDeleteProductsHandler);
router.patch('/bulk-restore', validate(bulkRestoreProductsSchema), bulkRestoreProductsHandler);
router.post('/bulk-restore', validate(bulkRestoreProductsSchema), bulkRestoreProductsHandler);

// CRUD
router.get('/', validate(queryProductsSchema), getAllProducts);
router.post('/', validate(createProductSchema), createProduct);
router.get('/:id', validate(productIdParamSchema), getProductById);
router.patch('/:id', validate(updateProductSchema), updateProduct);
router.patch('/:id/restore', validate(productIdParamSchema), restoreProduct);
router.delete('/:id', validate(productIdParamSchema), deleteProduct);

module.exports = router;
