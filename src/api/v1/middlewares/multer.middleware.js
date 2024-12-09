const multer = require("multer");
const fs = require('fs');
const path = require('path');
const { projectPaths } = require("../../../config/constants");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Define the folder path under the public directory
        // const folderPath = path.join(__dirname, 'public', 'temp');
        const folderPath = path.join(projectPaths.ROOT_DIR, 'public', 'temp');

        // check and create folder if it doesn't exist
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        cb(null, folderPath)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix)
    }
})
  
const upload = multer({ storage: storage })
module.exports = upload