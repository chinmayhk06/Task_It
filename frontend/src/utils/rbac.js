export const TEAM_ROLES = {
  ADMIN: "Admin",
  TEAM_LEAD: "Team Lead",
  INTERN: "Intern",
};

export const normalizeRole = role => Object.values(TEAM_ROLES).includes(role) ? role : null;
export const getCurrentUser = () => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } };
export const canCreateTeam = (user = getCurrentUser()) => ["Admin", "Team Lead"].includes(user?.role) || user?.capabilities?.canCreateTeams === true;
export const canViewReports = (user = getCurrentUser()) => ["Admin", "Team Lead"].includes(user?.role) || user?.capabilities?.canViewReports === true;

export const getCurrentUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.id || user?._id) return user.id || user._id;
  } catch {
    // Token fallback below handles missing or stale saved user data.
  }

  try {
    const token = localStorage.getItem("token");
    const payload = token?.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return decoded.id || decoded._id || null;
  } catch {
    return null;
  }
};

export const getId = (value) => value?._id || value?.id || value || null;

export const getTeamRole = (team, userId) => {
  if (!team || !userId) return null;
  const actor = getCurrentUser();
  if (getId(actor) === userId && actor.role === "Admin") return TEAM_ROLES.ADMIN;
  if (getId(team.manager) === userId) return TEAM_ROLES.TEAM_LEAD;

  const member = team.members?.find((entry) => getId(entry.user) === userId);
  return member ? normalizeRole(member.role) : null;
};

export const canManageProjects = (role) =>
  [TEAM_ROLES.ADMIN, TEAM_ROLES.TEAM_LEAD].includes(role);

export const canManageTasks = canManageProjects;

export const canDeleteProject = canManageProjects;

export const canEditTeam = canManageProjects;

export const canDeleteTeam = canManageProjects;

export const canManageMembers = canEditTeam;

export const canCreateProject = canManageProjects;

export const canEditProject = canManageProjects;

export const canCreateTask = canManageTasks;

export const canAssignTask = canManageTasks;

export const canDeleteTask = canManageTasks;

export const isAdmin = (user) => user?.role === "Admin";
