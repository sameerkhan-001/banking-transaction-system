const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken');
const emailService = require('../services/email.service')
const tokenBlackListModel = require('../models/blackList.model')


/**
 * User register Controller
 * POST API -> /api.auth/register
 */
async function userRegisterController(req, res) {
    //destructuring
    const {email, password, name} = req.body

    //find email in database
    isExists = await userModel.findOne({
        email : email,
    })

    //if email already exists instantly return from here 
    if(isExists) {
        return res.status(422).json({
            message: "User already exists",
            status: "false"
        })
    }

    //if email does not exist in db
    //Create new user account
    const user = await userModel.create({
        email, password, name
    })

    // Generate a JWT token with user ID and 3-day expiry.
    const token = jwt.sign({
        userId : user._id
    }, process.env.JWT_SECRET , { expiresIn : "3d"})

    res.cookie("token", token)

    res.status(201).json({
        user: {
            _id : user._id,
            email : user.email,
            name : user.name
        },
        token
    })

    await emailService.sendingRegistrationEmail(user.email, user.name);

}

/**
 * 
 * User Login Controller 
 * POST API -> /api/auth/login
 */
async function userLoginController(req, res) {
    const {email, password} = req.body;

    //find email in db
    const user = await userModel.findOne({ email }).select("+password");

    if(!user) {
        return res.status(401).json({
            message: "Email or Password is INVALID"
        })
    }

    const isValidPassword = await user.comparePassword(password);

    if(!isValidPassword) {
        return res.status(401).json({
            message: "Email or Password is INVALID"
        })
    }

    const token = jwt.sign({
        userId : user._id
    }, process.env.JWT_SECRET , { expiresIn : "3d"})

    res.cookie("token", token)

    res.status(200).json({
        user: {
            _id : user._id,
            email : user.email,
            name : user.name
        },
        token
    })


}

/**
 * User Logout controller
 * POST API -> /api/auth/logout
 */

async function userLogoutController(req, res) {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

    //if token is not exist it means(user is already logout)
    if(!token) {
        return res.status(200).json({
            message: "User is already logout"
        })
    }

    res.cookie("token", "");    //clear cookie delete(token)

    //blacklist curr token
    await tokenBlackListModel.create({
        token : token
    })

    return res.status(200).json({
        message: "User logout successfully"
    })
}

module.exports = { userRegisterController, userLoginController, userLogoutController }