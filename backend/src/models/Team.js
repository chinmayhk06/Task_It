const mongoose = require("mongoose");
const { TEAM_ROLES, ROLE } = require("../utils/roles");

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      enum: TEAM_ROLES,
      default: ROLE.MEMBER,
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

    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    members: [memberSchema],
    invitations: {
      type: [new mongoose.Schema({
        email: { type: String, required: true, lowercase: true, trim: true },
        role: { type: String, enum: TEAM_ROLES, required: true },
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

teamSchema.pre("validate", function validateManager() {
  const ids = this.members.map((m) => String(m.user));
  if (new Set(ids).size !== ids.length) this.invalidate("members", "Duplicate team member");
  const manager = this.members.find((m) => String(m.user) === String(this.manager));
  if (!manager || manager.role !== ROLE.TEAM_LEAD) this.invalidate("manager", "Designated manager must be a Team Lead member");
});
module.exports = mongoose.model("Team", teamSchema);
