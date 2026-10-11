const bcrypt = require("bcrypt");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { SELF_REGISTRATION_ROLES } = require("../validators/authValidator");
const { auth } = require("../config/firebaseAdmin");

const authError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

// Register
const registerUser = async (userData) => {
    const { fullName, email, password, role } = userData;

    if (!SELF_REGISTRATION_ROLES.includes(role)) {
        throw authError("Invalid registration role", 400);
    }

    const existingUser = await User.findOne({ email: email?.toLowerCase()?.trim() });

    if (existingUser) {
        throw authError("An account with this email already exists", 409);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
        fullName,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role,
    });

    return user;
};

// Login
const loginUser = async (userData) => {
    const { email, password } = userData;

    // Find user
    const user = await User.findOne({ email: email?.toLowerCase()?.trim() });

    if (!user) {
        throw authError("Invalid email or password", 401);
    }

    if (user.isActive === false) {
        throw authError("This account is inactive", 403);
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        throw authError("Invalid email or password", 401);
    }

    // Generate JWT
    const token = generateToken(user._id);

    return {
        token,
        user,
    };
};

// Firebase Google Login
const firebaseLogin = async (idToken) => {
    try {
        const decodedToken = await auth.verifyIdToken(idToken);

        const { uid, email, name, picture, email_verified } = decodedToken;

        if (!email || !email_verified) {
            throw authError("Google account email is not verified", 401);
        }

        let user = await User.findOne({
            email: email.toLowerCase().trim(),
        });

        if (!user) {
            user = await User.create({
                fullName: name || email.split("@")[0],
                email: email.toLowerCase().trim(),
                password: undefined,
                role: "Intern",
                profileImage: picture || "",
                firebaseUid: uid,
                verifiedEmail: email.toLowerCase().trim(),
            });
        } else {
            if (user.isActive === false) {
                throw authError("This account is inactive", 403);
            }

            user.firebaseUid = uid;
            user.verifiedEmail = email.toLowerCase().trim();

            if (picture && !user.profileImage) {
                user.profileImage = picture;
            }

            await user.save();
        }

        const token = generateToken(user._id);

        return {
            token,
            user,
        };
    } catch (error) {
        if (error.statusCode) {
            throw error;
        }

        throw authError("Invalid Firebase authentication", 401);
    }
};

const getAllUsers = async () => {
    return await User.find({}, "fullName email role profileImage");
};

module.exports = {
    registerUser,
    loginUser,
    getAllUsers,
    firebaseLogin,
};
