const {Router}=  require('express')
const { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetail } = require('../controllers/user.controller.js')
const upload = require('./../middlewares/multer.middleware.js')
// const verifyJWT = require('../middlewares/auth.middleware.js')
const validate = require('../middlewares/validate.js')
const { userValidationSchema } = require('../validation/userValidation.js')
const { verifyJWT } = require('../middlewares/auth.middleware.js')

const router = Router()

router.post('/register', upload.fields([
    {name: 'avatar', maxCount: 1},
    {name: 'coverImage', maxCount: 1}
]), validate(userValidationSchema), registerUser)

router.post('/login', loginUser)

// Secured route
router.post('/logout', verifyJWT, logoutUser)
router.post('/refresh-token', refreshAccessToken)
router.patch('/change-password', verifyJWT, changeCurrentPassword)
router.get('/current-user', verifyJWT, getCurrentUser)
router.patch('/update-account-detail', verifyJWT, updateAccountDetail)
router.patch('/update-avatar', verifyJWT, updateAccountDetail)

module.exports = router