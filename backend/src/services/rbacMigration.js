const { ROLE, ACCOUNT_ROLES, TEAM_ROLES } = require("../utils/roles");
const id = (value) => String(value || "");
const jobRoles = ["Developer", "Frontend Developer", "Backend Developer", "ML Engineer", "Intern", "Project Manager"];
const mapAccountRole = (role) => {
  if (ACCOUNT_ROLES.includes(role)) return role;
  if (role === "Super Admin") return ROLE.ADMIN;
  if (["Project Manager", "Owner", "TeamLead"].includes(role)) return ROLE.TEAM_LEAD;
  if (jobRoles.includes(role)) return ROLE.MEMBER;
  return null;
};
const mapTeamRole = (role) => ["Owner", "TeamLead", ROLE.TEAM_LEAD].includes(role) ? ROLE.TEAM_LEAD : ["Intern", ROLE.MEMBER].includes(role) ? ROLE.MEMBER : null;
const planMigration = ({ users, teams, projects = [], tasks = [], documents = [] }) => {
  const errors = [], userUpdates = [], teamUpdates = [];
  const userMap = new Map(users.map((u) => [id(u._id), u]));
  const teamIds = new Set(teams.map((t) => id(t._id)));
  const projectIds = new Set(projects.map((p) => id(p._id)));
  for (const user of users) {
    const role = mapAccountRole(user.role);
    if (!role) { errors.push(`Unknown account role for user ${user._id}`); continue; }
    const jobTitle = user.jobTitle || (jobRoles.includes(user.role) ? user.role : "");
    if (role !== user.role || user.jobTitle === undefined) userUpdates.push({ _id: user._id, role, jobTitle });
  }
  for (const team of teams) {
    const manager = team.manager || team.owner;
    if (!manager || !userMap.has(id(manager)) || userMap.get(id(manager)).isActive === false) { errors.push(`Team ${team._id} needs an active designated manager`); continue; }
    const members = (team.members || []).map((m) => ({ user: m.user, role: mapTeamRole(m.role) }));
    if (members.some((m) => !m.role || !userMap.has(id(m.user))) || new Set(members.map((m) => id(m.user))).size !== members.length) {
      errors.push(`Team ${team._id} has unknown roles, missing users, or duplicate members`); continue;
    }
    const designated = members.find((m) => id(m.user) === id(manager));
    if (designated) designated.role = ROLE.TEAM_LEAD;
    else members.push({ user: manager, role: ROLE.TEAM_LEAD });
    const invitations = (team.invitations || []).map((i) => ({ ...i, role: mapTeamRole(i.role) }));
    if (invitations.some((i) => !TEAM_ROLES.includes(i.role))) { errors.push(`Team ${team._id} contains an invalid invitation role`); continue; }
    const changed = Boolean(team.owner) || !team.manager || members.length !== (team.members || []).length || members.some((m, n) => m.role !== team.members[n]?.role) || invitations.some((i, n) => i.role !== team.invitations[n]?.role);
    if (changed) teamUpdates.push({ _id: team._id, manager, members, invitations });
  }
  for (const p of projects) if (!teamIds.has(id(p.team))) errors.push(`Project ${p._id} needs an explicit valid team relationship`);
  for (const t of tasks) {
    const p = projects.find((entry) => id(entry._id) === id(t.project));
    if (!p) { errors.push(`Task ${t._id} needs an explicit valid project relationship`); continue; }
    const team = teams.find((entry) => id(entry._id) === id(p.team));
    if (t.assignee && team && id(team.manager || team.owner) !== id(t.assignee) && !team.members?.some((m) => id(m.user) === id(t.assignee))) errors.push(`Task ${t._id} has an assignee outside its project team`);
  }
  for (const d of documents) if (!projectIds.has(id(d.project))) errors.push(`Document ${d._id} needs an explicit valid project relationship`);
  return { errors, userUpdates, teamUpdates };
};
const readSnapshot = async (db, session) => {
  const result = {};
  for (const name of ["users", "teams", "projects", "tasks", "documents"]) result[name] = await db.collection(name).find({}, { session }).sort({ _id: 1 }).toArray();
  return result;
};
const assertCurrentRbac = async (db) => {
  const plan = planMigration(await readSnapshot(db));
  if (plan.errors.length || plan.userUpdates.length || plan.teamUpdates.length) throw new Error("Legacy or inconsistent RBAC data detected. Server will not start. Back up the database and run npm run migrate:rbac (dry run); see RBAC.md. " + plan.errors.slice(0, 3).join("; "));
};
module.exports = { planMigration, readSnapshot, assertCurrentRbac };
