const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));
const products = data.products;

exports.getAllProducts = (req, res) => {
    res.json(products);
}

exports.getProduct = (req, res) => {
    const id = +req.params.id;
    const product = products.find(obj => obj.id === id);
    res.json(product);
}
