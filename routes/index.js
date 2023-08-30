const { productRoutes } = require('./product');
const { userRoutes } = require('./user');

exports.products = productRoutes;
exports.users = userRoutes;