const { Router } = require('express');
const validate = require('../middlewares/validate');
const { getUploadSignature, destroyCloudinaryAsset } = require('../controllers/upload.controller');
const { destroyCloudinaryAssetSchema } = require('../validation/upload.validation');

const router = Router();

// GET /uploads/signature
router.get('/signature', getUploadSignature);

// DELETE /uploads/cloudinary-asset
router.delete('/cloudinary-asset', validate(destroyCloudinaryAssetSchema), destroyCloudinaryAsset);

module.exports = router;
