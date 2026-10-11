const { body } = require("express-validator");

// Create Team Validator
const createTeamValidator = [
    body("teamName")
        .trim()
        .notEmpty()
        .withMessage("Team name is required")
        .isLength({ min: 3, max: 50 })
        .withMessage("Team name must be between 3 and 50 characters"),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage("Description cannot exceed 200 characters"),
];

// Update Team Validator
const updateTeamValidator = [
    body("teamName")
        .optional()
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage("Team name must be between 3 and 50 characters"),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage("Description cannot exceed 200 characters"),
];

// Invite Member Validator
const inviteMemberValidator = [
    body("role").optional().isIn(["TeamLead", "Intern"]).withMessage("Role must be TeamLead or Intern"),
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Please enter a valid email"),
];

module.exports = {
    createTeamValidator,
    updateTeamValidator,
    inviteMemberValidator,
};
