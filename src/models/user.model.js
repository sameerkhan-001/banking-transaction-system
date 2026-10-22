const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

//create User schema contains email, name, password
const userSchema = new mongoose.Schema({

    email: {
        type: String,
        required: [true, "Email is required for creating an user"],
        trim: true,
        lowercase: true,
        match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid Email Address"],
        unique: [true, "Email already exists"]
    },
    name: {
        type: String,
        required: [true, "Name is required for creating an account"],
    },
    password: {
        type: String,
        required: [true, "Password is required for creating an account"],
        minlength: [6, "Password length must be more then 6 characters"],
        select: false
    },

    systemUser: {
        type: Boolean,
        default: false,
        immutable: true,
        select: false
    }
}, {
    timestamps: true
})

//pre is a middleware check password modified or not
userSchema.pre("save", async function () {
    if(!this.isModified("password")) {
        return;
    }

    const hash = await bcrypt.hash(this.password, 10);
    this.password = hash

    return;
    
})

//compare existing password with user filled password
userSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password)
}

const userModel = mongoose.model("user", userSchema);

module.exports = userModel