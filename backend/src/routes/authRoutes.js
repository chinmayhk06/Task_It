const express = require("express");
const router = express.Router();
const invitations = require("../controllers/invitationController");
const { protect, requireGlobalRole } = require("../middleware/authMiddleware");
const validate = require("../middleware/validationMiddleware");
const {
    registerUser,
    loginUser,
    firebaseLogin,
    getUsers,
} = require("../controllers/authController");

const {
    registerValidator,
    loginValidator,
} = require("../validators/authValidator");

router.post(
    "/register",
    registerValidator,
    validate,
    registerUser
);

router.post(
    "/login",
    loginValidator,
    validate,
    loginUser
);

router.post("/google", firebaseLogin);
router.post("/email-verification/send", protect, invitations.sendVerification);
router.post("/email-verification/confirm", protect, invitations.verifyEmail);

router.get("/users", protect, requireGlobalRole(["Super Admin"]), getUsers);
module.exports = router;

router.get("/profile", protect, (req, res) => {
    res.json({
        success: true,
        user: req.user,
    });
});
