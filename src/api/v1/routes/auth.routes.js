const { Router } = require('express')
const { refreshUserToken, registerUser, loginUser, checkVerifyAccessToken } = require('../controllers/auth.controller.js')
const verifyAccessToken = require('../middlewares/auth.middleware.js')

const router = Router()


router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/refresh-token', refreshUserToken)
router.post('/verify-access-token',verifyAccessToken, checkVerifyAccessToken)

module.exports = router