const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./user-data.json', 'utf-8'));
const users = data.users;

exports.getAllUsers = (req, res) => {
    res.json(users);
}

exports.getUser = (req, res) => {
    const id = +req.params.id;
    const user = users.find(obj => obj.id === id);
    res.json(user);
}
