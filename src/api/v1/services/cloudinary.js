const { CLOUDINARY } = require('../../../config/config')
const fs = require('fs')
const cloudinary = require('cloudinary').v2

cloudinary.config({
    cloud_name: CLOUDINARY.CLOUD_NAME,
    api_key: CLOUDINARY.API_KEY,
    api_secret: CLOUDINARY.API_SECRET
})

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null

        // Upload file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        })

        // File is uploaded successfully
        fs.unlinkSync(localFilePath) // delete the file if file uploaded successfully to cloudinary
        
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath) // delete the file if upload fails
        console.error('Error uploading file on cloudinary: ', error);
        return null
    }
}

module.exports = { uploadOnCloudinary }