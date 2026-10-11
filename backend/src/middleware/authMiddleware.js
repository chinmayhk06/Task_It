const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ACCOUNT_ROLES } = require("../utils/roles");

const protect = async (req, res, next) => {
    try {
        let token;

        // Check Authorization Header
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            token = req.headers.authorization.split(" ")[1];

            // Verify Token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get User Details (excluding password)
            req.user = await User.findById(decoded.id).select("-password");

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired token.",
                });
            }

            if (req.user.isActive === false) {
                return res.status(403).json({
                    success: false,
                    message: "This account is inactive.",
                });
            }

            if (!ACCOUNT_ROLES.includes(req.user.role)) {
                return res.status(409).json({ success: false, message: "Account requires the explicit RBAC migration" });
            }

            next();
        } else {
            res.status(401).json({
                success: false,
                message: "Not authorized. No token provided.",
            });
        }
    } catch (error) {
        res.status(401).json({
            success: false,
            message: "Invalid or expired token.",
        });
    }
};

const requireGlobalRole = (roles = []) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Not authorized.",
        });
    }

    if (!roles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: "Insufficient permissions.",
        });
    }

    next();
};

module.exports = { protect, requireGlobalRole };
