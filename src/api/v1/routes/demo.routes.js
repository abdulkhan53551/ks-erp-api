const { Router } = require('express')
const { demoLoginUser, demoRegisterUser, demoUpdateUser } = require('../controllers/demoUser.controller.js')

const router = Router()


router.post('/loginUser', demoLoginUser)
router.post('/registerUser', demoRegisterUser)
router.post('/updateUser', demoUpdateUser)

module.exports = router