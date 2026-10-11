export const TEAM_ROLES = {
  OWNER: "Owner",
  TEAM_LEAD: "TeamLead",
  INTERN: "Intern",
};

export const normalizeRole = (role) => (role === "Member" ? TEAM_ROLES.INTERN : role);

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
  if (getId(team.owner) === userId) return TEAM_ROLES.OWNER;

  const member = team.members?.find((entry) => getId(entry.user) === userId);
  return member ? normalizeRole(member.role) : null;
};

export const canManageProjects = (role) =>
  [TEAM_ROLES.OWNER, TEAM_ROLES.TEAM_LEAD].includes(role);

export const canManageTasks = canManageProjects;

export const canDeleteProject = canManageProjects;

export const canEditTeam = canManageProjects;

export const canDeleteTeam = (role) => role === TEAM_ROLES.OWNER;

export const canManageMembers = canEditTeam;

export const canCreateProject = canManageProjects;

export const canEditProject = canManageProjects;

export const canCreateTask = canManageTasks;

export const canAssignTask = canManageTasks;

export const canDeleteTask = canManageTasks;

export const isSuperAdmin = (user) => user?.role === "Super Admin";
