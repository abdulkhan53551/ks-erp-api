const multer = require("multer");
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { projectPaths } = require("../../../config/constants");
const { ApiError } = require("../services/ApiError");

// Whitelist of safe image & document MIME types and file extensions
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
]);

const ALLOWED_EXTENSIONS = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.pdf'
]);

// 5 MB maximum file size
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const folderPath = path.join(projectPaths.ROOT_DIR, 'public', 'temp');

        // Check and create folder recursively if it doesn't exist
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        cb(null, folderPath);
    },
    filename: function (req, file, cb) {
        // Strip path traversal and dangerous characters from fieldname and extension
        const rawExt = path.extname(file.originalname || '').toLowerCase();
        const safeExt = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : '.bin';
        const safeFieldName = (file.fieldname || 'file').replace(/[^a-zA-Z0-9_-]/g, '');
        const randomHex = crypto.randomBytes(8).toString('hex');
        const uniqueSuffix = `${Date.now()}-${randomHex}`;

        cb(null, `${safeFieldName}-${uniqueSuffix}${safeExt}`);
    }
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    // Block executable extensions, scripts, SVGs (XSS risk in SVG XML)
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(mime)) {
        return cb(new ApiError({
            statusCode: 400,
            message: 'Invalid file format. Only JPEG, PNG, WEBP, and PDF files are allowed.'
        }), false);
    }

    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 2
    },
    fileFilter: fileFilter
});

module.exports = upload;
