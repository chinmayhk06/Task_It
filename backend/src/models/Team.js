const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      enum: ["Owner", "TeamLead", "Intern", "Member"],
      default: "Intern",
    },
  },
  {
    _id: false,
  }
);

const teamSchema = new mongoose.Schema(
  {
    teamName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    members: [memberSchema],
    invitations: {
      type: [new mongoose.Schema({
        email: { type: String, required: true, lowercase: true, trim: true },
        role: { type: String, enum: ["TeamLead", "Intern"], required: true },
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        sentAt: { type: Date, required: true },
        status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending" },
        acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        acceptedAt: Date,
      })],
      select: false,
      default: [],
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

teamSchema.index({ "invitations.tokenHash": 1 });

teamSchema.pre("validate", function normalizeTeamRoles() {
  if (Array.isArray(this.members)) {
    this.members.forEach((member) => {
      if (member.role === "Member") {
        member.role = "Intern";
      }
    });
  }
});
module.exports = mongoose.model("Team", teamSchema);
