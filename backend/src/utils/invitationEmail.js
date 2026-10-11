const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

const buildInvitationUrl = (frontendUrl, token) => {
  let base;
  try { base = new URL(frontendUrl); } catch {
    throw Object.assign(new Error("FRONTEND_URL must be a valid frontend origin"), { statusCode: 503 });
  }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password ||
      base.search || base.hash || !/^\/*$/.test(base.pathname)) {
    throw Object.assign(new Error("FRONTEND_URL must be an HTTP(S) origin without a path, query, or credentials"), { statusCode: 503 });
  }
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid invitation token");
  return `${base.origin}/invitations/${token}`;
};

const renderInvitationEmail = ({ email, teamName, role, token,
  frontendUrl = process.env.FRONTEND_URL, disclaimer = process.env.EMAIL_DISCLAIMER || "",
}) => {
  const url = buildInvitationUrl(frontendUrl, token);
  const safe = { email: escapeHtml(email), team: escapeHtml(teamName), role: escapeHtml(role), url: escapeHtml(url) };
  const footer = disclaimer ? `<p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#666666;">${escapeHtml(disclaimer).replace(/\r?\n/g, "<br>")}</p>` : "";
  const text = [
    "Task_It", "", `You're invited to join ${teamName}`, `Invited role: ${role}`, "",
    `Register or log in using ${email}. Verify that email address, then accept your invitation to join the team.`, "",
    "Accept Invitation:", url, "", "This invitation expires in seven days and can only be accepted once.",
    "If you weren't expecting this invitation, you can ignore this email.",
    ...(disclaimer ? ["", disclaimer] : []),
  ].join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Task_It team invitation</title>
  <style>@media only screen and (max-width:600px){.email-padding{padding:28px 20px!important}.email-shell{padding:16px 8px!important}.email-heading{font-size:26px!important;line-height:34px!important}}</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f3f3f3;color:#171717;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Join ${safe.team} on Task_It. Your invitation expires in seven days.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f3f3;">
    <tr><td align="center" class="email-shell" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #dedede;border-radius:12px;">
        <tr><td style="padding:24px 32px;background-color:#111111;border-radius:12px 12px 0 0;">
          <span style="font-size:24px;font-weight:700;letter-spacing:-1px;color:#ffffff;">Task_It<span style="color:#a3a3a3;">.</span></span>
        </td></tr>
        <tr><td class="email-padding" style="padding:40px 32px;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:2px;color:#737373;">TEAM INVITATION</p>
          <h1 class="email-heading" style="margin:0 0 20px;font-size:32px;line-height:40px;letter-spacing:-1px;font-weight:700;">Great work starts<br>with a team.</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:26px;color:#525252;">You've been invited to join <strong style="color:#171717;overflow-wrap:anywhere;word-break:break-word;">${safe.team}</strong> on Task_It.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f5f5;border:1px solid #e5e5e5;border-radius:8px;">
            <tr><td style="padding:18px 20px;font-size:14px;line-height:24px;word-break:break-word;">
              <span style="color:#737373;">TEAM</span><br><strong>${safe.team}</strong><br>
              <span style="color:#737373;">YOUR ROLE</span><br><strong>${safe.role}</strong>
            </td></tr>
          </table>
          <p style="margin:24px 0;font-size:15px;line-height:25px;color:#525252;">Register or log in using <strong style="color:#171717;overflow-wrap:anywhere;word-break:break-word;">${safe.email}</strong>. After signing in, verify your email address and accept the invitation to join the team.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td align="center" bgcolor="#111111" style="border-radius:6px;mso-padding-alt:16px 24px;">
              <a href="${safe.url}" style="display:block;padding:16px 24px;border:1px solid #111111;border-radius:6px;background-color:#111111;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-align:center;text-decoration:none;">Accept Invitation</a>
            </td></tr>
          </table>
          <p style="margin:16px 0 28px;font-size:13px;line-height:20px;color:#737373;text-align:center;">This invitation expires in <strong>seven days</strong><br>and can only be accepted once.</p>
          <div style="border-top:1px solid #e5e5e5;padding-top:24px;">
            <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#737373;">Button not working? Copy and paste this link into your browser:</p>
            <a href="${safe.url}" style="font-size:12px;line-height:20px;color:#525252;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${safe.url}</a>
          </div>
        </td></tr>
        <tr><td class="email-padding" style="padding:24px 32px;border-top:1px solid #e5e5e5;">
          <p style="margin:0;font-size:12px;line-height:20px;color:#737373;">If you weren't expecting this invitation, you can ignore this email.</p>
          <p style="margin:12px 0 0;font-size:12px;font-weight:700;color:#525252;">Task_It &mdash; Work together. Make progress.</p>
          ${footer}
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
  return { subject: `Task_It invitation to ${String(teamName).replace(/[\r\n]/g, " ")}`, html, text };
};

module.exports = { buildInvitationUrl, renderInvitationEmail };
