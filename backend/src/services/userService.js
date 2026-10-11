const bcrypt = require("bcrypt");
const User = require("../models/User");
const Team = require("../models/Team");
const { ROLE, ACCOUNT_ROLES } = require("../utils/roles");
const { withRbacWrite } = require("../utils/rbacWrite");
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const requireAdmin = async (id, session) => {
  const actor = await User.findById(id).session(session);
  if (!actor?.isActive || actor.role !== ROLE.ADMIN) fail("Only Admin can manage users", 403);
};
const mutateUser = (actorId, userId, action, data = {}) => withRbacWrite(async (session) => {
  await requireAdmin(actorId, session);
  const user = await User.findById(userId).session(session);
  if (!user) fail("User not found", 404);
  const nextRole = data.role ?? user.role;
  if (!ACCOUNT_ROLES.includes(nextRole)) fail("Role must be Admin, Team Lead or Member");
  const losingAccess = action === "delete" || (action === "toggle" && user.isActive) || (user.role === ROLE.ADMIN && nextRole !== ROLE.ADMIN);
  if (losingAccess && String(actorId) === String(userId)) fail("Cannot remove your own administrative access", 409);
  if (losingAccess && user.role === ROLE.ADMIN && user.isActive && await User.countDocuments({ role: ROLE.ADMIN, isActive: true }).session(session) <= 1) fail("The last active Admin must be retained", 409);
  if ((action === "delete" || (action === "toggle" && user.isActive) || nextRole === ROLE.MEMBER) && await Team.exists({ manager: user._id }).session(session)) fail("Reassign this user's managed teams first", 409);
  if (action === "delete") {
    // Do not leave dangling membership, assignment, creator, or document references.
    const linked = await Team.exists({ "members.user": user._id }).session(session);
    const mongoose = require("mongoose");
    const refs = [
      await require("../models/Project").exists({ owner: user._id }).session(session),
      await require("../models/Task").exists({ $or: [{ assignee: user._id }, { createdBy: user._id }, { "comments.user": user._id }] }).session(session),
      await mongoose.connection.collection("documents").findOne({ uploadedBy: user._id }, { session, projection: { _id: 1 } }),
    ];
    if (linked || refs.some(Boolean)) fail("User has team or work references; deactivate the account instead", 409);
    await user.deleteOne({ session }); return null;
  }
  if (action === "toggle") user.isActive = !user.isActive;
  else {
    for (const key of ["fullName", "email", "department", "phone", "jobTitle"]) if (data[key] !== undefined) user[key] = data[key];
    user.role = nextRole;
  }
  await user.save({ session });
  const result = user.toObject(); delete result.password; return result;
});
const createUser = async (actorId, data) => {
  const { fullName, email, password, role = ROLE.MEMBER, jobTitle = "", department = "", phone = "" } = data;
  if (!fullName || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || password.length < 8 || !ACCOUNT_ROLES.includes(role)) fail("Valid name, email, role and password (8+ characters) are required");
  const hashed = await bcrypt.hash(password, 12);
  return withRbacWrite(async (session) => {
    await requireAdmin(actorId, session);
    const [user] = await User.create([{ fullName, email, password: hashed, role, jobTitle, department, phone }], { session });
    const result = user.toObject(); delete result.password; return result;
  });
};
module.exports = { createUser, mutateUser };
