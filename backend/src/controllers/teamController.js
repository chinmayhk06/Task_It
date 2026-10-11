const Team = require("../models/Team");
const { validationResult } = require("express-validator");
const Project = require("../models/Project");
const { ROLE, normalizeRole, getTeamMembership } = require("../utils/rbac");
const { createNotification } = require("../services/notificationService");

const TEAM_ROLES = [ROLE.OWNER, ROLE.TEAM_LEAD, ROLE.INTERN];

const handleTeamError = (res, error) => {
  if (error.name === "VersionError") return res.status(409).json({ success: false, message: "Team changed; refresh and retry" });
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : "Server Error",
  });
};

const ensureValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      errors: errors.array(),
    });
    return false;
  }
  return true;
};

const isOwner = (team, userId) => team.owner.toString() === userId.toString();
const isManager = (team, userId) => [ROLE.OWNER, ROLE.TEAM_LEAD].includes(getTeamMembership(team, userId)?.role);

const createTeam = async (req, res) => {
  try {
    if (!ensureValidation(req, res)) return;

    const { teamName, description } = req.body;
    const team = await Team.create({
      teamName,
      description,
      owner: req.user._id,
      members: [{ user: req.user._id, role: ROLE.OWNER }],
    });

    res.status(201).json({
      success: true,
      message: "Team created successfully",
      data: team,
    });
  } catch (error) {
    console.error(error);
    return handleTeamError(res, error);
  }
};

const getMyTeams = async (req, res) => {
  try {
    const teams = await Team.find({ "members.user": req.user._id })
      .populate("owner", "fullName email")
      .populate("members.user", "fullName email");

    res.status(200).json({
      success: true,
      count: teams.length,
      data: teams,
    });
  } catch (error) {
    console.error(error);
    return handleTeamError(res, error);
  }
};

const getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate("owner", "fullName email")
      .populate("members.user", "fullName email");

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    if (!getTeamMembership(team, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const projects = await Project.find({ team: team._id })
      .populate("owner", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        ...team.toObject(),
        projects,
      },
    });
  } catch (error) {
    console.error(error);
    return handleTeamError(res, error);
  }
};

const updateTeam = async (req, res) => {
  try {
    if (!ensureValidation(req, res)) return;

    const { teamName, description } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    if (!isManager(team, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Only Owners and TeamLeads can update the team",
      });
    }

    if (teamName !== undefined) team.teamName = teamName.trim();
    if (description !== undefined) team.description = description;

    await team.save();
    await team.populate("owner", "fullName email");
    await team.populate("members.user", "fullName email");

    res.status(200).json({
      success: true,
      message: "Team updated successfully",
      data: team,
    });
  } catch (error) {
    console.error(error);
    return handleTeamError(res, error);
  }
};

const deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    if (!isOwner(team, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Only the owner can delete the team",
      });
    }

    const projectCount = await Project.countDocuments({ team: team._id });
    if (projectCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete team while projects exist.",
      });
    }

    const deleted = await Team.deleteOne({ _id: team._id, owner: req.user._id, __v: team.__v });
    if (!deleted.deletedCount) return res.status(409).json({ success: false, message: "Team changed; refresh and retry" });

    res.status(200).json({
      success: true,
      message: "Team deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return handleTeamError(res, error);
  }
};

const removeMember = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    if (!isManager(team, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Only Owners and TeamLeads can remove members",
      });
    }

    if (req.params.userId === team.owner.toString()) {
      return res.status(400).json({
        success: false,
        message: "Owner cannot be removed",
      });
    }

    const memberExists = team.members.some(
      (member) => member.user.toString() === req.params.userId
    );

    if (!memberExists) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    const removedUserId = req.params.userId;

    team.members = team.members.filter(
      (member) => member.user.toString() !== req.params.userId
    );

    await team.save();
    await createNotification(
      removedUserId,
      "team_removed",
      `You were removed from the team "${team.teamName}".`,
      team._id,
      { email: false }
    );

    res.status(200).json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (error) {
    console.error(error);
    return handleTeamError(res, error);
  }
};

const updateMemberRole = async (req, res) => {
  try {
    const normalizedRole = normalizeRole(req.body.role);

    if (!TEAM_ROLES.includes(normalizedRole) || normalizedRole === ROLE.OWNER) {
      return res.status(400).json({
        success: false,
        message: "Role must be TeamLead or Intern",
      });
    }

    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    const requester = getTeamMembership(team, req.user._id);

    if (!requester || ![ROLE.OWNER, ROLE.TEAM_LEAD].includes(requester.role)) {
      return res.status(403).json({
        success: false,
        message: "Only Owners and TeamLeads can change member roles",
      });
    }

    if (team.owner.toString() === req.params.userId) {
      return res.status(400).json({
        success: false,
        message: "Owner role cannot be changed here",
      });
    }

    const member = team.members.find(
      (entry) => entry.user.toString() === req.params.userId
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (normalizeRole(member.role) === normalizedRole) {
      await team.populate("owner", "fullName email");
      await team.populate("members.user", "fullName email");
      return res.status(200).json({
        success: true,
        message: "Member role unchanged",
        data: team,
      });
    }

    member.role = normalizedRole;
    await team.save();
    await team.populate("owner", "fullName email");
    await team.populate("members.user", "fullName email");
    await createNotification(
      req.params.userId,
      "team_role_changed",
      `Your role in "${team.teamName}" was changed to ${normalizedRole}.`,
      team._id,
      { path: `/teams/${team._id}` }
    );

    res.status(200).json({
      success: true,
      message: "Member role updated successfully",
      data: team,
    });
  } catch (error) {
    console.error(error);
    return handleTeamError(res, error);
  }
};

const leaveTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    if (isOwner(team, req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "Owner cannot leave the team. Delete the team or transfer ownership.",
      });
    }

    const memberExists = team.members.some(
      (member) => member.user.toString() === req.user._id.toString()
    );

    if (!memberExists) {
      return res.status(404).json({
        success: false,
        message: "You are not a member of this team",
      });
    }

    team.members = team.members.filter(
      (member) => member.user.toString() !== req.user._id.toString()
    );

    await team.save();

    res.status(200).json({
      success: true,
      message: "You left the team successfully",
    });
  } catch (error) {
    console.error(error);
    return handleTeamError(res, error);
  }
};

const transferOwnership = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: "Team not found" });
    if (!isOwner(team, req.user._id)) return res.status(403).json({ success: false, message: "Only the owner can transfer ownership" });
    const target = team.members.find((m) => m.user.toString() === req.body.userId);
    if (!target || req.body.userId === team.owner.toString()) return res.status(400).json({ success: false, message: "Choose another existing team member" });
    team.members.forEach((m) => { if (m.role === ROLE.OWNER) m.role = ROLE.TEAM_LEAD; });
    target.role = ROLE.OWNER;
    team.owner = target.user;
    await team.save();
    res.json({ success: true, message: "Ownership transferred" });
  } catch (error) { return handleTeamError(res, error); }
};

module.exports = {
  transferOwnership,
  createTeam,
  getMyTeams,
  getTeamById,
  updateTeam,
  removeMember,
  updateMemberRole,
  leaveTeam,
  deleteTeam,
};
