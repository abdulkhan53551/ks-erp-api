const { CLOUDINARY } = require('../../../config/config');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: CLOUDINARY.CLOUD_NAME,
    api_key: CLOUDINARY.API_KEY,
    api_secret: CLOUDINARY.API_SECRET
});

// const generateUploadSignature = ({ folder = 'ks-erp/attachments', timestamp }) => {
const generateUploadSignature = ({ folder = 'ks-erp/attachments', timestamp, tags = 'ks-erp' }) => {
    const ts = timestamp || Math.round(new Date().getTime() / 1000);
    const paramsToSign = {
        timestamp: ts,
        folder,
        tags
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, CLOUDINARY.API_SECRET);

    return {
        signature,
        timestamp: ts,
        apiKey: CLOUDINARY.API_KEY,
        cloudName: CLOUDINARY.CLOUD_NAME,
        folder
    };
};

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        if (!publicId) return null;
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType || 'image'
        });
        return result;
    } catch (error) {
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