const Joi = require("joi");

const userValidationSchema = Joi.object({
    fullName: Joi.string().required().label('Full Name'),
    email: Joi.string().email().required().label('Email'),
    username: Joi.string().min(3).max(30).required().label('Username'),
    password: Joi.string().min(8).required().label('Password'),
}).unknown(true);

module.exports = { userValidationSchema };