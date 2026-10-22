const express = require('express');
const authController = require("../controllers/auth.controller")

const router = express.Router();

//POST API :-> PATH LOOK LIKE api/auth/register
router.post("/register", authController.userRegisterController);    //register api pe ane wali req pe authController call hota hai
router.post("/login", authController.userLoginController)

//POST /api/auth/logout

router.post("/logout", authController.userLogoutController)

module.exports = router