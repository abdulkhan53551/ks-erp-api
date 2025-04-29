require("dotenv").config({ path: `${process.cwd()}/.env` });
const { connectDB, db } = require("./api/v1/database");
const { app } = require('./app')
const { PORT } = require('./config');
// const connectDB = require("./api/v1/database");
// Middleware


// const useMiddleWare = require('./api/v1/middlewares/index');
// useMiddleWare(app)


process.on('SIGINT', async () => {
    console.log('Closing database connection...');
    await db.destroy();
    process.exit(0);
});

connectDB()
    .then(() => {
        app.listen(PORT, () => console.log('Server listing on port ' + PORT));
    })
    .catch((err) => {
        console.log('POSTGRESQL connection FAILED!!!', err);
    })