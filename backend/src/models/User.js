const mongoose = require("mongoose");
const { ACCOUNT_ROLES, ROLE } = require("../utils/roles");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    verifiedEmail: { type: String, default: "" },
    emailVerification: {
      type: new mongoose.Schema({ hash: String, email: String, expiresAt: Date, sentAt: Date }, { _id: false }),
      select: false,
    },
    password: {
      type: String,
      required: false,
    },

    firebaseUid: {
    type: String,
    unique: true,
    sparse: true,
    },

    role: {
      type: String,
      enum: ACCOUNT_ROLES,
      default: ROLE.MEMBER,
    },
    jobTitle: { type: String, trim: true, maxlength: 100, default: "" },

    department: {
      type: String,
      trim: true,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    profileImage: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    notificationPrefs: {
      taskAssigned:     { type: Boolean, default: true },
      taskCompleted:    { type: Boolean, default: true },
      deadlineReminder: { type: Boolean, default: true },
      projectUpdates:   { type: Boolean, default: true },
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
