const { personRoutes } = require('./person');
const { productRoutes } = require('./product');
const { userRoutes } = require('./user');

exports.products = productRoutes;
exports.users = userRoutes;
exports.persons = personRoutes;