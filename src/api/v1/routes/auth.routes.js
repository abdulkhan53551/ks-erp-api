const { Router } = require('express')
const { refreshUserToken, registerUser, loginUser, checkVerifyAccessToken, logout, logoutAll, logoutAllSessions } = require('../controllers/auth.controller.js')
const verifyAccessToken = require('../middlewares/auth.middleware.js')
const router = Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/refresh-token', refreshUserToken)
router.post('/verify-access-token', verifyAccessToken, checkVerifyAccessToken)
router.post('/logout', verifyAccessToken, logout)
router.post('/logout-all', verifyAccessToken, logoutAllSessions)

module.exports = router