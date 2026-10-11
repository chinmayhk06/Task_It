const bcrypt = require("bcrypt");
const User = require("../models/User");

// GET /api/settings/profile
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-password");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/settings/profile
const updateProfile = async (req, res) => {
    try {
        const { fullName, email, phone, department, profileImage, jobTitle } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (fullName)       user.fullName = fullName;
        if (email)          user.email = email.toLowerCase().trim();
        if (phone !== undefined)      user.phone = phone;
        if (department !== undefined) user.department = department;
        if (profileImage !== undefined) user.profileImage = profileImage;
        if (jobTitle !== undefined) user.jobTitle = jobTitle;

        await user.save();
        const updated = user.toObject();
        delete updated.password;
        res.json({ success: true, message: "Profile updated successfully", data: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/settings/change-password
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "currentPassword and newPassword are required" });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
        }

        const user = await User.findById(req.user._id);
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Current password is incorrect" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ success: true, message: "Password changed successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/settings/notifications
const getNotificationPrefs = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("notificationPrefs");
        const prefs = user?.notificationPrefs || {
            taskAssigned: true, taskCompleted: true, deadlineReminder: true, projectUpdates: true,
        };
        res.json({ success: true, data: prefs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/settings/notifications
const updateNotificationPrefs = async (req, res) => {
    try {
        const { taskAssigned, taskCompleted, deadlineReminder, projectUpdates } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.notificationPrefs = {
            taskAssigned:     taskAssigned     ?? user.notificationPrefs?.taskAssigned     ?? true,
            taskCompleted:    taskCompleted    ?? user.notificationPrefs?.taskCompleted    ?? true,
            deadlineReminder: deadlineReminder ?? user.notificationPrefs?.deadlineReminder ?? true,
            projectUpdates:   projectUpdates   ?? user.notificationPrefs?.projectUpdates   ?? true,
        };
        await user.save();
        res.json({ success: true, message: "Notification preferences saved", data: user.notificationPrefs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { getProfile, updateProfile, changePassword, getNotificationPrefs, updateNotificationPrefs };
