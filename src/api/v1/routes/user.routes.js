const {Router}=  require('express')
const { registerUser, loginUser, logoutUser, refreshAccessToken } = require('../controllers/user.controller.js')
const upload = require('./../middlewares/multer.middleware.js')
const verifyJWT = require('../middlewares/auth.middleware.js')

const router = Router()

router.post('/register', upload.fields([
    {name: 'avatar', maxCount: 1},
    {name: 'coverImage', maxCount: 1}
]), registerUser)

router.post('/login', loginUser)

// Secured route
router.post('/logout', verifyJWT, logoutUser)
router.post('/refresh-token', refreshAccessToken)

module.exports = router