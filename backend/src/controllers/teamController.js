const service = require("../services/teamService");
const action = (fn, message, status = 200) => async (req, res) => {
  try { const data = await fn(req); res.status(status).json({ success: true, message, data, ...(Array.isArray(data) ? { count: data.length } : {}) }); }
  catch (error) {
    const status = error.statusCode || (error.name === "VersionError" ? 409 : ["ValidationError", "CastError"].includes(error.name) ? 400 : 500);
    res.status(status).json({ success: false, message: error.name === "VersionError" ? "Team changed; refresh and retry" : status === 500 ? "Server Error" : error.message });
  }
};
module.exports = {
  createTeam: action(r => service.createTeam(r.user._id, r.body), "Team created successfully", 201),
  getMyTeams: action(r => service.getMyTeams(r.user._id)),
  getTeamById: action(r => service.getTeamById(r.params.id, r.user._id)),
  updateTeam: action(r => service.updateTeam(r.params.id, r.user._id, r.body), "Team updated successfully"),
  deleteTeam: action(r => service.deleteTeam(r.params.id, r.user._id), "Team deleted successfully"),
  removeMember: action(r => service.removeMember(r.params.id, r.user._id, r.params.userId), "Member removed successfully"),
  updateMemberRole: action(r => service.updateMemberRole(r.params.id, r.user._id, r.params.userId, r.body?.role), "Member role updated"),
  leaveTeam: action(r => service.leaveTeam(r.params.id, r.user._id), "You left the team"),
  reassignManager: action(r => service.reassignManager(r.params.id, r.user._id, r.body?.userId), "Team manager reassigned"),
};
