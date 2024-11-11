require("dotenv").config({path: '.env'});
const express = require('express');
const app = express();

const { PORT } = require('./config');

// Middleware


const useMiddleWare = require('./api/v1/middlewares/index');
const connectDB = require("./api/v1/database");
// const connectDB = require('./api/v1/database/index');
useMiddleWare(app)


// ;(async () => {
//     try {

//         // Listen on error
//         app.on('error', (error) => {
//             console.log('ERR: ', error);
//             throw error
//         })

//         // Listen server with port
//         app.listen(PORT, () => console.log('Server listing on port ' + PORT));
//     } catch (error) {
//         // Throw error when something went wrong
//         console.log('PostgreSql connection error: ', error);
//         throw error
//     }
// })()

connectDB()
.then(() => {
    app.listen(PORT, () => console.log('Server listing on port ' + PORT));
})
.catch((err) => {
    console.log('POSTGRESQL connection FAILED!!!', err);
})


// app.listen(PORT, () => console.log('Server listing on port ' + PORT));