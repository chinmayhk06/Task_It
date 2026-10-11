const service = require("../services/invitationService");
const action = (fn) => async (req, res) => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (error) {
    const status = error.statusCode || (["CastError", "ValidationError"].includes(error.name) ? 400 : 500);
    res.status(status).json({ success: false, message: status === 500 ? "Server Error" : error.message });
  }
};
module.exports = {
  list: action((req) => service.list(req.params.id, req.user._id)),
  invite: action((req) => service.invite(req.params.id, req.user._id, req.body.email, req.body.role)),
  resend: action((req) => service.manage(req.params.id, req.user._id, req.params.invitationId, true)),
  revoke: action((req) => service.manage(req.params.id, req.user._id, req.params.invitationId, false)),
  preview: action((req) => service.preview(req.body?.token, req.user)),
  accept: action((req) => service.accept(req.body?.token, req.user)),
  sendVerification: action((req) => service.sendVerification(req.user)),
  verifyEmail: action((req) => service.verifyEmail(req.user, req.body?.token)),
};
