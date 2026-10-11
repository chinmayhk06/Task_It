const ROLE = Object.freeze({ ADMIN: "Admin", TEAM_LEAD: "Team Lead", MEMBER: "Member" });
const ACCOUNT_ROLES = Object.values(ROLE);
const TEAM_ROLES = [ROLE.TEAM_LEAD, ROLE.MEMBER];
const MANAGERS = [ROLE.ADMIN, ROLE.TEAM_LEAD];
module.exports = { ROLE, ACCOUNT_ROLES, TEAM_ROLES, MANAGERS };
