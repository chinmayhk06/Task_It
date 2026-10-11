const express = require("express");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const invitations = require("../controllers/invitationController");
router.post("/invitations/preview", protect, invitations.preview);
router.post("/invitations/accept", protect, invitations.accept);
router.get("/:id/invitations", protect, invitations.list);
router.post("/:id/invitations/:invitationId/resend", protect, invitations.resend);
router.delete("/:id/invitations/:invitationId", protect, invitations.revoke);

const {
  createTeam,
  transferOwnership,
  getMyTeams,
  getTeamById,
  updateTeam,
  removeMember,
  updateMemberRole,
  leaveTeam,
  deleteTeam,
} = require("../controllers/teamController");

const {
  createTeamValidator,
  updateTeamValidator,
  inviteMemberValidator,
} = require("../validators/teamValidator");

const validate = require("../middleware/validationMiddleware");
router.post("/:id/transfer-ownership", protect, transferOwnership);

router.post(
  "/",
  protect,
  createTeamValidator,
  validate,
  createTeam
);

router.get(
  "/",
  protect,
  getMyTeams
);

router.get(
  "/:id",
  protect,
  getTeamById
);

router.put(
  "/:id",
  protect,
  updateTeamValidator,
  validate,
  updateTeam
);

router.post(
  "/:id/invite",
  protect,
  inviteMemberValidator,
  validate,
  invitations.invite
);

router.delete(
  "/:id/leave",
  protect,
  leaveTeam
);

router.delete(
  "/:id/member/:userId",
  protect,
  removeMember
);

router.patch(
  "/:id/member/:userId/role",
  protect,
  updateMemberRole
);

router.delete(
  "/:id",
  protect,
  deleteTeam
);

module.exports = router;
