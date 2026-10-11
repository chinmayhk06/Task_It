const mongoose = require("mongoose");

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
      enum: [
        "Super Admin",
        "Project Manager",
        "Team Lead",
        "Developer",
        "Frontend Developer",
        "Backend Developer",
        "ML Engineer",
        "Intern",
      ],
      default: "Intern",
    },

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
