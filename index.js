const express = require('express');
const server = express();
const PORT = 3000;
// const productRouter = require('./routes/product');
const routes = require('./routes/index');

// Middleware
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use('/products', routes.products);
server.use('/users', routes.users);
server.use('/persons', routes.persons);
server.use('/customers', routes.customers);


server.listen(PORT, () => console.log('Server listing on port ' + PORT));