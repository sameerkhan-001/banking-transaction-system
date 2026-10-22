const transactionModel = require('../models/transaction.model')
const ledgerModel = require('../models/ledger.model');
const accountModel = require('../models/account.model')
const emailService = require('../services/email.service')
const mongoose = require('mongoose');

/**
 * * - Create a new Transaction:-
 * THE 10-STEPS TRANSFER RULE:
    * 1. Validate request
    * 2. validate idempotency key
    * 3. Check account status
    * 4. Derive sender balance from ledger
    * 5. Create transaction (PENDING)
    * 6. Create DEBIT ledger entry
    * 7. Create CREDIT ledger entry
    * 8. Mark transaction COMPLETED
    * 9. COMMIT MongoDB session
    * 10. Send email notification 
 */

async function createTransaction(req, res) {

    /**
     * 1. Validate request
     */

    //destructure 
    const {fromAccount, toAccount, amount, idempotencyKey} = req.body;

    //check all required things are coming or not from the front end 
    if(!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "fromAccount, ToAccount, amount and idempotencyKey are required"
        })
    }

    //check that fromUser's account exists or not
    const fromUserAccount = await accountModel.findOne({
        _id: fromAccount
    })

    //check that toUser's account exists or not
    const toUserAccount = await accountModel.findOne({
        _id : toAccount
    })

    //if not exist return invalid
    if(!fromUserAccount || !toUserAccount) {
        return res.status(400).json({
            message: "Invalid fromAccount or toAccount"
        })
    }

    /**
     * 2. validate idempotency key
     */

    const isTransactionAlreadyExists = await transactionModel.findOne({
        idempotencyKey: idempotencyKey
    })

    if(isTransactionAlreadyExists) {

        //Transaction is completted
        if(isTransactionAlreadyExists.status === 'COMPLETED') {
            return res.status(200).json({
                message: "Trasaction already processed",
                transaction: isTransactionAlreadyExists
            })
        }

        //Transaction is Processing
        if(isTransactionAlreadyExists.status === 'PENDING') {
            return res.status(200).json({
                message: "Transaction is still in processing"
            })
        }

        //Transaction is Failed
        if(isTransactionAlreadyExists.status === 'FAILED') {
            return res.status(500).json({
                message: "Transaction processing is failed, please try again"
            })
        }

        //Transaction is Reversed
        if(isTransactionAlreadyExists.status === 'REVERSED') {
            return res.status(500).json({
                message: "Transaction was reversed, please try again"
            })
        }

        /**
         * 3. Check account status
         */

        if(fromUserAccount.status !== 'ACTIVE' || toUserAccount.status !== 'ACTIVE') {
            return res.status(400).json({
                message: "Both fromAccount and toAccount must be ACTIVE to process transaction"
            })
        }
    }

    /**
     * 4. Derive sender balance from ledger
     */

    const balance = await fromUserAccount.getBalance();

    //if sending amount is lesser then total balance in sender account
    if(balance < amount) {
        return res.status(400).json({
            message: `Insufficiente balance, Current balance is ${balance}. Requested amount is ${amount}`
        })
    }

    /**
     * 5. Create transaction (PENDING)
     */

    // Starts a database transaction so multiple operations
    // can be committed together or rolled back if something fails.

    let transaction;
    try {

        const session = await mongoose.startSession()
        session.startTransaction();

        //create a transaction
        transaction = (await transactionModel.create ([{
            fromAccount, 
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        }], {session}))[0]

        /**
         * 6. Create DEBIT ledger entry
         */
            const debitLedgerEntry = await ledgerModel.create([{
                account: fromAccount,
                amount: amount,
                transaction: transaction._id,
                type: "DEBIT"

            }], { session })

            //its a check
            // await (() => {
            //     return new Promise((resolve) => setTimeout(resolve, 15 * 1000))
            // })()

        /**
         * 7. Create CREDIT ledger entry
         */
        const creditLedgerEntry = await ledgerModel.create([{
            account: toAccount,
            amount: amount,
            transaction: transaction._id,
            type: "CREDIT"

        }], { session })

        //if all goes completted upper things like transaction, debitLedgerEntry, creditLedgerEntry
        /**
         * 8. Mark transaction COMPLETED
         */
        await transactionModel.findOneAndUpdate(
            {_id: transaction._id},
            {status: "COMPLETED"},
            {session}
        )

        /**
         * 9. COMMIT MongoDB session
         */
        await session.commitTransaction()   //commit all the changes 
        session.endSession();   //end the session 

    }catch(error){
        return res.status(400).json({
            message: "Transaction is Pending due to some issue, please retry after some time"
        })
    }

    /**
     * 10. Send email notification 
     */

    await emailService.sendTransactionEmail(req.user.email, req.user.name, amount, toAccount);

    return res.status(201).json({
        message: "Transaction completted successfully",
        transaction : transaction
    })

}

async function createInitialFundsTransaction(req, res) {

    //destructuring
    const { toAccount, amount, idempotencyKey} = req.body;

    //all are req if someone is not return 
    if(!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "toAccount, amount and idempotencyKey are required"
        })
    }

    //find receiver acount's in db
    const toUserAccount = await accountModel.findOne({
        _id: toAccount
    })

    //if account does not exist
    if(!toUserAccount) {
        return res.status(400).json({
            message: "Invalid toAccount"
        })
    }

    //find sender (System's) account in db
    const fromUserAccount = await accountModel.findOne({
        // systemUser : true,
        user : req.user._id
    })

    //if account does not exist
    if(!fromUserAccount) {
        return res.status(400).json({
            message: "System user account not found"
        })
    }

    //start a session (session se ya to saare changes/create successfull honge ya rollback)
    //if we use session so data goes in array
    const session = await mongoose.startSession();
    session.startTransaction();

    //create first transaction -> kisne pesa bheja kiske account me bheja amount kitna tha 
    const transaction = new transactionModel({
        fromAccount : fromUserAccount._id,
        toAccount : toUserAccount,
        amount : amount,
        idempotencyKey : idempotencyKey,
        status : "PENDING"
    
    })

    //save entry in sender account kitna pesa bheja or kisko 
    const debitLedgerEntry = await ledgerModel.create([{
        account : fromUserAccount.id,
        amount: amount,
        transaction: transaction._id,
        type: "DEBIT"
    
    }], { session })    //<- use session here so data goes in array

    //save entry in reciever account kitna pesa aya and kisne bheja tha
    const creditLedgerEntry = await ledgerModel.create([{
        account : toUserAccount.id,
        amount : amount,
        transaction: transaction._id,
        type: "CREDIT"
    
    }], { session })    //<- use session here so data goes in array

    //if all things goes well then set transaction.status to completed
    transaction.status = "COMPLETED"
    await transaction.save({ session })
    
    //comit all changes
    await session.commitTransaction()
    session.endSession()    //end the session

    //send res to frontend
    return res.status(201).json({
        message: "Initial funds transaction completed successfully",
        transaction: transaction
    })


}

module.exports = { createTransaction, createInitialFundsTransaction }