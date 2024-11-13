require("dotenv").config({path: `${process.cwd()}/.env`});
const { app } = require('./app')
const { PORT } = require('./config');
const connectDB = require("./api/v1/database");
// Middleware


// const useMiddleWare = require('./api/v1/middlewares/index');
// useMiddleWare(app)


connectDB()
.then(() => {
    app.listen(PORT, () => console.log('Server listing on port ' + PORT));
})
.catch((err) => {
    console.log('POSTGRESQL connection FAILED!!!', err);
})