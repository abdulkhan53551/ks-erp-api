const express = require('express');
const server = express();
// const productRouter = require('./routes/product');
const routes = require('./routes/index');

// Middleware
server.use('/products', routes.products);
server.use('/users', routes.users);


server.listen(8080, () => {
    console.log('Server started.')
})