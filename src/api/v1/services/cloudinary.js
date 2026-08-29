const { CLOUDINARY, APP_ENV } = require('../../../config/config');
const { ApiError } = require('./ApiError');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: CLOUDINARY.CLOUD_NAME,
    api_key: CLOUDINARY.API_KEY,
    api_secret: CLOUDINARY.API_SECRET
});

const generateUploadSignature = ({ folder = 'attachments', timestamp, tags = '' }) => {
    // 1. Determine environment from centralized config
    const env = APP_ENV;

    // 2. Normalize requested subfolder (e.g. 'parties/documents', 'parties/logos')
    let subFolder = (folder || 'attachments')
        .replace(/^ks-erp\/?/i, '')
        .replace(/^\/+|\/+$/g, '');

    if (!subFolder) subFolder = 'attachments';

    // 3. Build isolated folder path: ks-erp/{env}/{subFolder}
    const fullFolder = `ks-erp/${env}/${subFolder}`;

    // 4. Build environment tags
    const envTag = `env_${env}`;
    const userTags = tags ? (Array.isArray(tags) ? tags : tags.split(',')) : [];
    const allTags = Array.from(new Set([envTag, 'ks-erp', ...userTags.map(t => t.trim()).filter(Boolean)])).join(',');

    const ts = timestamp || Math.round(new Date().getTime() / 1000);

    const paramsToSign = {
        timestamp: ts,
        folder: fullFolder,
        tags: allTags
    };

    // 5. Generate Cloudinary signature
    const signature = cloudinary.utils.api_sign_request(paramsToSign, CLOUDINARY.API_SECRET);

    return {
        signature,
        timestamp: ts,
        apiKey: CLOUDINARY.API_KEY,
        cloudName: CLOUDINARY.CLOUD_NAME,
        folder: fullFolder,
        tags: allTags
    };
};

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        if (!publicId) return null;

        const env = APP_ENV;

        // 🛡️ Safety Guard: Disallow deleting production assets from Dev or UAT
        if (env !== 'production' && publicId.startsWith('ks-erp/production/')) {
            throw new ApiError({
                statusCode: 403,
                message: 'Forbidden: Cannot delete production assets from a non-production environment.'
            });
        }

        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType || 'image',
            invalidate: true
        });
        return result;
    } catch (error) {
        if (error instanceof ApiError || error.statusCode === 403) {
            throw error;
        }
        console.error('Error deleting file from cloudinary: ', error);
        return null;
    }
};

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        // Upload file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        });

        // File is uploaded successfully
        fs.unlinkSync(localFilePath); // delete the file if file uploaded successfully to cloudinary

        return response;
    } catch (error) {
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath); // delete the file if upload fails
        }
        console.error('Error uploading file on cloudinary: ', error);
        return null;
    }
};

module.exports = {
    cloudinary,
    generateUploadSignature,
    deleteFromCloudinary,
    uploadOnCloudinary
};