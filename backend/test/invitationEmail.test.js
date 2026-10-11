const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { buildInvitationUrl, renderInvitationEmail } = require("../src/utils/invitationEmail");
const frontendUrl = "https://task-it-gamma-six.vercel.app";
const sample = () => ({ email: "invited@example.com", teamName: "Product Team", role: "TeamLead", token: randomBytes(32).toString("hex"), frontendUrl, disclaimer: "" });

test("HTML and plain text contain the same configured invitation link and required content", () => {
  const data = sample(); const message = renderInvitationEmail(data);
  const url = `${frontendUrl}/invitations/${data.token}`;
  assert.ok(message.html.includes(`href="${url}"`)); assert.ok(message.text.includes(url));
  for (const value of ["Task_It", data.teamName, data.role, data.email, "Accept Invitation", "seven days", "Register or log in"]) {
    assert.ok(message.html.includes(value), value); assert.ok(message.text.includes(value), value);
  }
  assert.match(message.html, /name="viewport"/);
  assert.match(message.html, /max-width:600px/);
});

test("all dynamic HTML fields and organization disclaimer are escaped", () => {
  const attack = `<img src=x onerror="alert('injected')"> & text`;
  const message = renderInvitationEmail({ ...sample(), teamName: attack, role: attack, email: attack, disclaimer: `${attack}\nRequired notice` });
  assert.ok(!message.html.includes("<img"));
  assert.ok(message.html.includes("&lt;img src=x onerror=&quot;alert(&#39;injected&#39;)&quot;&gt; &amp; text"));
  assert.ok(message.html.includes("<br>Required notice"));
  assert.ok(message.text.endsWith(`${attack}\nRequired notice`));
});

test("configured origin is used with exactly one separator and no token mutation", () => {
  const { token } = sample();
  assert.equal(buildInvitationUrl(`${frontendUrl}/`, token), `${frontendUrl}/invitations/${token}`);
  assert.equal(buildInvitationUrl("http://localhost:5173", token), `http://localhost:5173/invitations/${token}`);
  assert.equal(buildInvitationUrl("https://custom.example", token), `https://custom.example/invitations/${token}`);
});

test("unsafe configuration and malformed tokens cannot create injected links", () => {
  const { token } = sample();
  for (const url of [undefined, "", "javascript:alert(1)", "https://user:pass@example.com", `${frontendUrl}?x=1`, `${frontendUrl}#fragment`, `${frontendUrl}/wrong-path`]) {
    assert.throws(() => buildInvitationUrl(url, token), { statusCode: 503 });
  }
  assert.throws(() => buildInvitationUrl(frontendUrl, '\" onclick=\"alert(1)'), /Invalid invitation token/);
});

test("organization disclaimer defaults to configuration and keeps the exact plain-text content", () => {
  const previous = process.env.EMAIL_DISCLAIMER;
  process.env.EMAIL_DISCLAIMER = "Organization notice: private & confidential.";
  try {
    const data = sample(); delete data.disclaimer;
    const message = renderInvitationEmail(data);
    assert.ok(message.text.endsWith(process.env.EMAIL_DISCLAIMER));
    assert.ok(message.html.includes("Organization notice: private &amp; confidential."));
  } finally {
    if (previous === undefined) delete process.env.EMAIL_DISCLAIMER; else process.env.EMAIL_DISCLAIMER = previous;
  }
});
