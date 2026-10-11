const { body } = require("express-validator");

const SELF_REGISTRATION_ROLES = [
    "Team Lead",
    "Intern",
];

const registerValidator = [
    body("fullName")
        .trim()
        .notEmpty()
        .withMessage("Full name is required"),

    body("email")
        .isEmail()
        .withMessage("Enter a valid email"),

    body("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters"),

    body("role")
        .optional()
        .isIn(SELF_REGISTRATION_ROLES)
        .withMessage("Invalid registration role"),
    body("jobTitle").optional().isString().trim().isLength({ max: 100 }),
];

const loginValidator = [
    body("email")
        .isEmail()
        .withMessage("Enter a valid email"),

    body("password")
        .notEmpty()
        .withMessage("Password is required"),
];

module.exports = {
    registerValidator,
    loginValidator,
    SELF_REGISTRATION_ROLES,
};
