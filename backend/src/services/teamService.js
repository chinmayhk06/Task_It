const Team = require("../models/Team");
const User = require("../models/User");
const Project = require("../models/Project");
const Task = require("../models/Task");
const { ROLE, MANAGERS, teamQuery, getActor, getAccountCapabilities, requireTeamAccess, toId } = require("../utils/rbac");
const { TEAM_ROLES } = require("../utils/roles");
const { createNotification } = require("./notificationService");
const { withRbacWrite } = require("../utils/rbacWrite");
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const populate = (team) => team.populate([{ path: "manager", select: "fullName email" }, { path: "members.user", select: "fullName email jobTitle" }]);
const requireNoAssignments = async (teamId, userId) => {
  const projects = await Project.find({ team: teamId }).select("_id");
  if (await Task.exists({ project: { $in: projects.map(p => p._id) }, assignee: userId })) fail("Reassign this member's team tasks before removing them", 409);
};
const createTeam = async (userId, { teamName, description }) => withRbacWrite(async (session) => {
  const actor = await getActor(userId);
  if (!(await getAccountCapabilities(actor)).canCreateTeams) fail("Only Team Leads and Admins can create teams", 403);
  const [team] = await Team.create([{ teamName, description, manager: actor._id, members: [{ user: actor._id, role: ROLE.TEAM_LEAD }] }], { session });
  return team;
});
const getMyTeams = async (userId) => Team.find(teamQuery(await getActor(userId)))
  .populate("manager", "fullName email").populate("members.user", "fullName email jobTitle");
const getTeamById = async (id, userId) => {
  const { team } = await requireTeamAccess(id, userId);
  await populate(team);
  const projects = await Project.find({ team: id }).populate("owner", "fullName email").sort({ createdAt: -1 });
  return { ...team.toObject(), projects };
};
const updateTeam = async (id, userId, { teamName, description }) => {
  const { team } = await requireTeamAccess(id, userId, MANAGERS);
  if (teamName !== undefined) team.teamName = teamName;
  if (description !== undefined) team.description = description;
  await team.save(); return populate(team);
};
const deleteTeam = async (id, userId) => {
  const { team } = await requireTeamAccess(id, userId, MANAGERS);
  if (await Project.exists({ team: id })) fail("Cannot delete team while projects exist.", 409);
  const result = await Team.deleteOne({ _id: id, __v: team.__v });
  if (!result.deletedCount) fail("Team changed; refresh and retry", 409);
};
const removeMember = async (id, userId, targetId) => {
  const { team } = await requireTeamAccess(id, userId, MANAGERS);
  if (toId(team.manager) === targetId) fail("Ask an Admin to reassign the designated manager first", 409);
  if (!team.members.some((m) => toId(m.user) === targetId)) fail("Member not found", 404);
  await requireNoAssignments(id, targetId);
  team.members = team.members.filter((m) => toId(m.user) !== targetId);
  await team.save();
  await createNotification(targetId, "team_removed", `You were removed from the team "${team.teamName}".`, team._id, { email: false });
};
const updateMemberRole = async (id, userId, targetId, role) => {
  if (!TEAM_ROLES.includes(role)) fail("Role must be Team Lead or Member");
  const { team } = await requireTeamAccess(id, userId, MANAGERS);
  if (toId(team.manager) === targetId && role !== ROLE.TEAM_LEAD) fail("Ask an Admin to reassign the designated manager first", 409);
  const member = team.members.find((m) => toId(m.user) === targetId);
  if (!member) fail("Member not found", 404);
  member.role = role; await team.save();
  await createNotification(targetId, "team_role_changed", `Your role in "${team.teamName}" was changed to ${role}.`, team._id, { path: `/teams/${id}` });
  return populate(team);
};
const leaveTeam = async (id, userId) => {
  const { team } = await requireTeamAccess(id, userId);
  if (toId(team.manager) === toId(userId)) fail("Ask an Admin to reassign the designated manager before leaving", 409);
  if (!team.members.some((m) => toId(m.user) === toId(userId))) fail("You are not a member of this team", 404);
  await requireNoAssignments(id, userId);
  team.members = team.members.filter((m) => toId(m.user) !== toId(userId)); await team.save();
};
const reassignManager = async (id, userId, targetId) => withRbacWrite(async (session) => {
  const { team, actor } = await requireTeamAccess(id, userId);
  if (actor.role !== ROLE.ADMIN) fail("Only Admin can reassign team managers", 403);
  const target = await User.findById(targetId);
  if (!target || !target.isActive) fail("Choose an active Team Lead", 400);
  const member = team.members.find((m) => toId(m.user) === toId(targetId));
  if (!MANAGERS.includes(target.role) && member?.role !== ROLE.TEAM_LEAD) fail("Choose an account or team Team Lead", 400);
  // Former manager keeps team access as a Member, avoiding implicit retained management.
  const previous = team.members.find((m) => toId(m.user) === toId(team.manager));
  if (previous && toId(team.manager) !== toId(targetId)) previous.role = ROLE.MEMBER;
  if (member) member.role = ROLE.TEAM_LEAD;
  else team.members.push({ user: target._id, role: ROLE.TEAM_LEAD });
  team.manager = target._id; await team.save({ session }); return populate(team);
});
module.exports = { createTeam, getMyTeams, getTeamById, updateTeam, deleteTeam, removeMember, updateMemberRole, leaveTeam, reassignManager };
