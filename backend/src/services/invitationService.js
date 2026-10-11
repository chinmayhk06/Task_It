const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Team = require("../models/Team");
const User = require("../models/User");
const { requireTeamAccess, ROLE, toId, teamQuery } = require("../utils/rbac");
const { sendEmail } = require("../utils/emailService");
const { renderInvitationEmail } = require("../utils/invitationEmail");

const managers = [ROLE.ADMIN, ROLE.TEAM_LEAD];
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const tokenHash = (token) => {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) fail("Invalid invitation or verification code");
  return hash(token);
};
const publicInvitation = (invitation) => ({
  _id: invitation._id, email: invitation.email, role: invitation.role,
  expiresAt: invitation.expiresAt, sentAt: invitation.sentAt,
  status: invitation.status === "pending" && invitation.expiresAt <= new Date() ? "expired" : invitation.status,
});
const managerFilter = (actor) => teamQuery(actor, true);
const list = async (teamId, userId) => {
  await requireTeamAccess(teamId, userId, managers);
  const team = await Team.findById(teamId).select("+invitations");
  return (team?.invitations || []).filter((i) => i.status === "pending").map(publicInvitation);
};
const deliver = async (email, teamName, role, token) => {
  const message = renderInvitationEmail({ email, teamName, role, token });
  try {
    await sendEmail({ to: email, required: true, ...message });
  } catch { fail("Invitation saved, but email delivery failed. Please resend it.", 503); }
};
const invite = async (teamId, userId, email, role = ROLE.MEMBER) => {
  email = normalizeEmail(email);
  if (![ROLE.TEAM_LEAD, ROLE.MEMBER].includes(role)) fail("Role must be Team Lead or Member");
  const { team, actor } = await requireTeamAccess(teamId, userId, managers);
  const user = await User.findOne({ email });
  if (user && (toId(team.manager) === toId(user._id) || team.members.some((m) => toId(m.user) === toId(user._id)))) fail("User is already a member", 409);
  const token = crypto.randomBytes(32).toString("hex");
  const invitation = { _id: new mongoose.Types.ObjectId(), email, role, tokenHash: hash(token),
    expiresAt: new Date(Date.now() + 7 * 86400000), sentAt: new Date(), status: "pending" };
  const result = await Team.updateOne({ _id: teamId, ...managerFilter(actor),
    ...(user ? { "members.user": { $ne: user._id }, manager: { $ne: user._id } } : {}),
    invitations: { $not: { $elemMatch: { email, status: "pending" } } },
  }, { $push: { invitations: invitation }, $inc: { __v: 1 } });
  if (!result.modifiedCount) fail("A pending invitation already exists; resend or revoke it, then retry", 409);
  await deliver(email, team.teamName, role, token);
  return publicInvitation(invitation);
};
const manage = async (teamId, userId, invitationId, resend) => {
  const { actor } = await requireTeamAccess(teamId, userId, managers);
  const team = await Team.findById(teamId).select("+invitations");
  const invitation = team?.invitations.id(invitationId);
  if (!invitation || invitation.status !== "pending") fail("Invitation is no longer pending", 409);
  if (resend && Date.now() - invitation.sentAt.getTime() < 60000) fail("Wait one minute before resending", 429);
  const token = crypto.randomBytes(32).toString("hex");
  const fields = resend ? { "invitations.$[invitation].tokenHash": hash(token), "invitations.$[invitation].expiresAt": new Date(Date.now() + 7 * 86400000), "invitations.$[invitation].sentAt": new Date() } : { "invitations.$[invitation].status": "revoked" };
  const result = await Team.updateOne({ _id: teamId, ...managerFilter(actor),
    invitations: { $elemMatch: { _id: invitation._id, status: "pending", tokenHash: invitation.tokenHash } },
  }, { $set: fields, $inc: { __v: 1 } }, { arrayFilters: [{ "invitation._id": invitation._id }] });
  if (!result.modifiedCount) fail("Invitation changed; refresh and retry", 409);
  if (resend) await deliver(invitation.email, team.teamName, invitation.role, token);
};
const lookup = async (token) => {
  const digest = tokenHash(token);
  const team = await Team.findOne({ "invitations.tokenHash": digest }).select("+invitations");
  if (!team) fail("Invitation not found or replaced by a newer invitation", 404);
  return { team, invitation: team.invitations.find((i) => i.tokenHash === digest) };
};
const preview = async (token, user) => {
  const { team, invitation } = await lookup(token);
  return { ...publicInvitation(invitation), teamName: team.teamName, teamId: team._id,
    emailMatches: normalizeEmail(user.email) === invitation.email,
    emailVerified: user.verifiedEmail === normalizeEmail(user.email) };
};
const accept = async (token, user) => {
  const { team, invitation } = await lookup(token);
  if (normalizeEmail(user.email) !== invitation.email) fail("Sign in with the invited email address", 403);
  if (user.verifiedEmail !== invitation.email) fail("Verify your email before accepting", 403);
  if (invitation.status === "accepted" && toId(invitation.acceptedBy) === toId(user._id)) return { teamId: team._id, alreadyAccepted: true };
  if (invitation.status !== "pending" || invitation.expiresAt <= new Date()) fail("Invitation is expired or revoked", 410);
  // Both membership and token consumption are committed in one MongoDB document update.
  // __v also protects against concurrent legacy team.save() membership edits.
  const existingMember = toId(team.manager) === toId(user._id) || team.members.some((m) => toId(m.user) === toId(user._id));
  const result = await Team.updateOne({ _id: team._id, __v: team.__v,
    invitations: { $elemMatch: { _id: invitation._id, tokenHash: invitation.tokenHash, status: "pending", expiresAt: { $gt: new Date() } } },
  }, { $set: { "invitations.$.status": "accepted", "invitations.$.acceptedBy": user._id, "invitations.$.acceptedAt": new Date() },
    ...(!existingMember ? { $push: { members: { user: user._id, role: invitation.role } } } : {}), $inc: { __v: 1 } });
  if (!result.modifiedCount) {
    const latest = await lookup(token);
    if (latest.invitation.status === "accepted" && toId(latest.invitation.acceptedBy) === toId(user._id)) return { teamId: team._id, alreadyAccepted: true };
    fail("Invitation or team changed; refresh and retry", 409);
  }
  return { teamId: team._id, alreadyMember: existingMember };
};
const sendVerification = async (user) => {
  const token = crypto.randomBytes(32).toString("hex");
  const email = normalizeEmail(user.email);
  const result = await User.updateOne({ _id: user._id, email,
    $or: [{ "emailVerification.sentAt": { $exists: false } }, { "emailVerification.sentAt": { $lt: new Date(Date.now() - 60000) } }],
  }, { $set: { emailVerification: { hash: hash(token), email, sentAt: new Date(), expiresAt: new Date(Date.now() + 30 * 60000) } } });
  if (!result.modifiedCount) fail("Wait one minute before requesting another verification code", 429);
  try {
    await sendEmail({ to: email, subject: "Verify your Task It email", required: true,
      text: `Paste this verification code on your Task It invitation page:\n\n${token}\n\nIt expires in 30 minutes.` });
  } catch { fail("Verification email delivery failed. Please try again in one minute.", 503); }
};
const verifyEmail = async (user, token) => {
  const email = normalizeEmail(user.email);
  const result = await User.updateOne({ _id: user._id, email, "emailVerification.email": email,
    "emailVerification.hash": tokenHash(token), "emailVerification.expiresAt": { $gt: new Date() },
  }, { $set: { verifiedEmail: email }, $unset: { emailVerification: 1 } });
  if (!result.modifiedCount) fail("Invalid or expired verification code");
};
module.exports = { list, invite, manage, preview, accept, sendVerification, verifyEmail };
