const express = require("express");
const cookieParser = require('cookie-parser')


const app = express();

//middlewares
app.use(express.json());
app.use(cookieParser())



/**
 * - Required Routes
 */
const authRouter = require('./routes/auth.routes')
const accountRouter = require('./routes/account.routes')
const transactionRoutes = require('./routes/transaction.routes')
/**
 * - Use Routes
 */

app.get('/', (req, res)=> {
    res.send("Banking Service is up and running...")
})

app.use("/api/auth", authRouter) //"/api/auth" this is a prefix is isse start hone wale path ki req ko authRouter pe bhejdo
app.use("/api/accounts", accountRouter)
app.use("/api/transactions", transactionRoutes)

module.exports = app;