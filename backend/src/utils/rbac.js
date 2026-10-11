const Team = require("../models/Team");
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const { ROLE, ACCOUNT_ROLES, MANAGERS } = require("./roles");
const toId = (value) => value?._id?.toString?.() || value?.toString?.();
const forbidden = (message, statusCode = 403) => Object.assign(new Error(message), { statusCode });
const normalizeRole = (role) => ACCOUNT_ROLES.includes(role) ? role : null;
const getActor = async (userId) => {
  const user = await User.findById(toId(userId)).select("role isActive");
  if (!user || user.isActive === false || !normalizeRole(user.role)) throw forbidden("Account is inactive or requires RBAC migration");
  return user;
};
const getTeamMembership = (team, actor) => {
  if (actor?.role === ROLE.ADMIN) return { role: ROLE.ADMIN, member: null };
  const id = toId(actor);
  if (!team?.manager) return null;
  if (toId(team.manager) === id) return { role: ROLE.TEAM_LEAD, member: null };
  const member = (team.members || []).find((entry) => toId(entry.user) === id);
  if (!member || ![ROLE.TEAM_LEAD, ROLE.INTERN].includes(member.role)) return null;
  return { role: member.role, member };
};
// Assignment requires actual membership, even for an Admin.
const isTeamMember = (team, userId) => Boolean(getTeamMembership(team, toId(userId)));
const assertRole = (role, allowedRoles) => {
  if (!role || (allowedRoles.length && !allowedRoles.includes(role))) throw forbidden("Insufficient team permissions");
};
const teamQuery = (actor, managed = false) => actor.role === ROLE.ADMIN ? {} : { $or: [
  { manager: actor._id },
  managed ? { members: { $elemMatch: { user: actor._id, role: ROLE.TEAM_LEAD } } } : { "members.user": actor._id },
] };
const getAccountCapabilities = async (actor) => {
  const canManage = MANAGERS.includes(actor.role) || Boolean(await Team.exists(teamQuery(actor, true)));
  return { canCreateTeams: canManage, canViewReports: canManage };
};
const requireTeamAccess = async (teamId, userId, allowedRoles = []) => {
  const actor = await getActor(userId);
  const team = await Team.findById(teamId);
  if (!team) throw forbidden("Team not found", 404);
  const role = getTeamMembership(team, actor)?.role;
  assertRole(role, allowedRoles);
  return { team, role, actor };
};
const getTeamRole = async (userId, teamId) => (await requireTeamAccess(teamId, userId)).role;
const requireTeamRole = (roles = [], resolveTeamId) => async (req, res, next) => {
  try {
    const access = await requireTeamAccess(typeof resolveTeamId === "function" ? resolveTeamId(req) : req.params.id, req.user._id, roles);
    req.team = access.team; req.teamRole = access.role; next();
  } catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); }
};
const requireTeamMember = (resolveTeamId) => requireTeamRole([], resolveTeamId);
const requireProjectAccess = async (projectId, userId, allowedRoles = []) => {
  const project = await Project.findById(projectId).populate("team", "teamName manager members");
  if (!project) throw forbidden("Project not found", 404);
  if (!project.team) throw forbidden("Project must be linked to a team; migrate legacy data", 409);
  const actor = await getActor(userId);
  const role = getTeamMembership(project.team, actor)?.role;
  assertRole(role, allowedRoles);
  return { project, team: project.team, role };
};
const requireTaskAccess = async (taskId, userId, allowedRoles = []) => {
  const task = await Task.findById(taskId).populate("project", "projectName team owner")
    .populate("assignee", "fullName email").populate("createdBy", "fullName email").populate("comments.user", "fullName email");
  if (!task) throw forbidden("Task not found", 404);
  if (!task.project) throw forbidden("Task must be linked to a project; migrate legacy data", 409);
  const access = await requireProjectAccess(task.project._id, userId, allowedRoles);
  if (access.role === ROLE.INTERN && toId(task.assignee) !== toId(userId)) throw forbidden("Interns can only access their assigned tasks");
  return { task, ...access };
};
const getAccessibleTeamIds = async (userId) => (await Team.find(teamQuery(await getActor(userId))).select("_id")).map((t) => t._id);
const getManagedTeamIds = async (userId) => (await Team.find(teamQuery(await getActor(userId), true)).select("_id")).map((t) => t._id);
const getAccessibleProjectIds = async (userId) => (await Project.find({ team: { $in: await getAccessibleTeamIds(userId) } }).select("_id")).map((p) => p._id);
const getManagedProjectIds = async (userId) => (await Project.find({ team: { $in: await getManagedTeamIds(userId) } }).select("_id")).map((p) => p._id);
const getAccessibleProjectsByRole = async (userId) => {
  const actor = await getActor(userId);
  const projects = await Project.find({ team: { $in: await getAccessibleTeamIds(userId) } }).populate("team", "manager members");
  const managerProjectIds = [], memberProjectIds = [];
  projects.forEach((project) => {
    const role = getTeamMembership(project.team, actor)?.role;
    if (MANAGERS.includes(role)) managerProjectIds.push(project._id);
    else if (role === ROLE.INTERN) memberProjectIds.push(project._id);
  });
  return { managerProjectIds, memberProjectIds };
};
module.exports = { ROLE, MANAGERS, normalizeRole, toId, getActor, teamQuery, getAccountCapabilities, getTeamMembership,
  isTeamMember, requireTeamAccess, getTeamRole, requireTeamRole, requireTeamMember, requireProjectAccess, requireTaskAccess,
  getAccessibleTeamIds, getManagedTeamIds, getAccessibleProjectIds, getManagedProjectIds, getAccessibleProjectsByRole };
