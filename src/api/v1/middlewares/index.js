const routes = require('../routes/index');
// const productController = require('./../controller/product');
const productController = require('../controllers/product');

module.exports = (app) => {
    // app.use('/products', routes.products);
    app
    .get('/products/', productController.getAllProducts)
    app.use('/users', routes.users);
    app.use('/persons', routes.persons);
    app.use('/customers', routes.customers);
}

