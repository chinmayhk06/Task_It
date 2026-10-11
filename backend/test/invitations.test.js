const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Team = require("../src/models/Team");
const User = require("../src/models/User");
const Project = require("../src/models/Project");
const Task = require("../src/models/Task");
const email = require("../src/utils/emailService");
const sent = [];
let deliveryFails = false;
mock.method(email, "sendEmail", async (message) => {
  if (deliveryFails) throw new Error("SMTP unavailable");
  sent.push(message);
});
mock.method(require("../src/services/notificationService"), "createNotification", async () => {});
const firebasePath = require.resolve("../src/config/firebaseAdmin");
require.cache[firebasePath] = { id: firebasePath, filename: firebasePath, loaded: true,
  exports: { auth: { verifyIdToken: async () => ({ uid: "test-google-user", email: "google@example.com", email_verified: true, name: "Google User" }) } } };
const service = require("../src/services/invitationService");
const projectService = require("../src/services/projectService");
const taskService = require("../src/services/taskService");
let mongo, server, base, owner, lead, intern, team;
const makeUser = (email, extra = {}) => User.create({ fullName: email, email, verifiedEmail: email, ...extra });
const request = async (path, user, method = "GET", body) => {
  const response = await fetch(base + path, { method, headers: {
    "Content-Type": "application/json",
    ...(user ? { Authorization: `Bearer ${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}` } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...(await response.json()) };
};
const invite = async (email = "new@example.com", role = "Intern", manager = lead) => {
  const result = await request(`/team/${team.id}/invite`, manager, "POST", { email, role });
  assert.equal(result.status, 200, JSON.stringify(result));
  return { invitation: result.data, token: sent.at(-1).text.match(/\/invitations\/([a-f0-9]{64})/)[1] };
};
before(async () => {
  process.env.JWT_SECRET = "test-only-secret";
  process.env.FRONTEND_URL = "http://localhost:5173";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = express(); app.use(express.json());
  app.use("/team", require("../src/routes/teamRoutes"));
  app.use("/auth", require("../src/routes/authRoutes"));
  app.use("/github", require("../src/routes/githubRoutes"));
  app.use("/reports", require("../src/routes/reportRoutes"));
  app.use("/dashboard", require("../src/routes/dashboardRoutes"));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect(); if (mongo) await mongo.stop(); mock.restoreAll();
});
beforeEach(async () => {
  await Promise.all([Team.deleteMany({}), User.deleteMany({}), Project.deleteMany({}), Task.deleteMany({})]);
  sent.length = 0; deliveryFails = false;
  owner = await makeUser("owner@example.com"); lead = await makeUser("lead@example.com"); intern = await makeUser("intern@example.com");
  team = await Team.create({ teamName: "Test Team", owner: owner._id, members: [
    { user: owner._id, role: "Owner" }, { user: lead._id, role: "TeamLead" }, { user: intern._id, role: "Intern" },
  ] });
});

test("TeamLead invites an unregistered email; secrets stay out of team/list responses", async () => {
  const { token, invitation } = await invite(" NEW@example.com ", "TeamLead");
  assert.ok(sent.at(-1).html.includes("Accept Invitation"));
  assert.ok(sent.at(-1).html.includes(`/invitations/${token}`));
  assert.ok(sent.at(-1).text.includes("new@example.com"));
  assert.equal(await User.countDocuments({ email: "new@example.com" }), 0);
  assert.equal(invitation.email, "new@example.com"); assert.equal(invitation.tokenHash, undefined);
  const stored = await Team.findById(team.id).select("+invitations");
  assert.notEqual(stored.invitations[0].tokenHash, token);
  assert.equal((await request(`/team/${team.id}`, lead)).data.invitations, undefined);
  const listed = await request(`/team/${team.id}/invitations`, lead);
  assert.equal(listed.data.length, 1); assert.equal(listed.data[0].tokenHash, undefined);
});
test("duplicate concurrent invitations produce only one pending record", async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () => request(`/team/${team.id}/invite`, lead, "POST", { email: "new@example.com" })));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 4);
});
test("acceptance is atomic, concurrent and idempotent, without changing global role", async () => {
  const { token } = await invite("new@example.com", "TeamLead");
  const user = await makeUser("new@example.com", { role: "Developer" });
  const results = await Promise.all(Array.from({ length: 8 }, () => request("/team/invitations/accept", user, "POST", { token })));
  assert.ok(results.every((r) => r.status === 200), JSON.stringify(results));
  const saved = await Team.findById(team.id).select("+invitations");
  assert.equal(saved.members.filter((m) => m.user.equals(user._id)).length, 1);
  assert.equal(saved.members.find((m) => m.user.equals(user._id)).role, "TeamLead");
  assert.equal(saved.invitations[0].status, "accepted");
  assert.equal((await User.findById(user._id)).role, "Developer");
  await Team.updateOne({ _id: team.id }, { $pull: { members: { user: user._id } } });
  assert.equal((await request("/team/invitations/accept", user, "POST", { token })).status, 200);
  assert.equal((await Team.findById(team.id)).members.some((m) => m.user.equals(user._id)), false);
});
test("authentication, exact email match and verification are mandatory", async () => {
  const { token } = await invite();
  assert.equal((await request("/team/invitations/accept", null, "POST", { token })).status, 401);
  assert.equal((await request("/team/invitations/accept", intern, "POST", { token })).status, 403);
  const user = await makeUser("new@example.com", { verifiedEmail: "" });
  assert.equal((await request("/team/invitations/accept", user, "POST", { token })).status, 403);
  assert.equal((await Team.findById(team.id)).members.length, 3);
});
test("email verification is single-use, bound to current email, and throttled", async () => {
  const user = await makeUser("new@example.com", { verifiedEmail: "" });
  assert.equal((await request("/auth/email-verification/send", user, "POST")).status, 200);
  const token = sent.at(-1).text.match(/[a-f0-9]{64}/)[0];
  assert.equal((await request("/auth/email-verification/send", user, "POST")).status, 429);
  assert.equal((await request("/auth/email-verification/confirm", user, "POST", { token })).status, 200);
  assert.equal((await request("/auth/email-verification/confirm", user, "POST", { token })).status, 400);
  const saved = await User.findById(user.id); assert.equal(saved.verifiedEmail, user.email);
  saved.email = "changed@example.com"; await saved.save();
  const { token: invitationToken } = await invite("changed@example.com");
  assert.equal((await request("/team/invitations/accept", saved, "POST", { token: invitationToken })).status, 403);
});
test("resend rotates token, renews expired invitation; revoke prevents acceptance", async () => {
  const { token, invitation } = await invite();
  const user = await makeUser("new@example.com");
  await Team.updateOne({ _id: team.id }, { $set: { "invitations.0.expiresAt": new Date(0), "invitations.0.sentAt": new Date(0) } });
  assert.equal((await request("/team/invitations/accept", user, "POST", { token })).status, 410);
  assert.equal((await request(`/team/${team.id}/invitations`, lead)).data[0].status, "expired");
  assert.equal((await request(`/team/${team.id}/invitations/${invitation._id}/resend`, owner, "POST")).status, 200);
  const newToken = sent.at(-1).text.match(/\/invitations\/([a-f0-9]{64})/)[1];
  assert.notEqual(newToken, token);
  assert.ok(sent.at(-1).html.includes(`/invitations/${newToken}`));
  assert.ok(!sent.at(-1).html.includes(`/invitations/${token}`));
  assert.equal((await request("/team/invitations/accept", user, "POST", { token })).status, 404);
  assert.equal((await request(`/team/${team.id}/invitations/${invitation._id}`, lead, "DELETE")).status, 200);
  assert.equal((await request("/team/invitations/accept", user, "POST", { token: newToken })).status, 410);
  assert.equal((await request(`/team/${team.id}/invitations/${invitation._id}/resend`, lead, "POST")).status, 409);
});
test("existing members cannot be invited or have roles overwritten by acceptance", async () => {
  assert.equal((await request(`/team/${team.id}/invite`, lead, "POST", { email: intern.email })).status, 409);
  const { token } = await invite(); const user = await makeUser("new@example.com");
  await Team.updateOne({ _id: team.id }, { $push: { members: { user: user._id, role: "TeamLead" } }, $inc: { __v: 1 } });
  assert.equal((await request("/team/invitations/accept", user, "POST", { token })).status, 200);
  assert.equal((await Team.findById(team.id)).members.find((m) => m.user.equals(user._id)).role, "TeamLead");
});
test("SMTP failure is reported and leaves a manageable pending invitation", async () => {
  deliveryFails = true;
  assert.equal((await request(`/team/${team.id}/invite`, lead, "POST", { email: "new@example.com" })).status, 503);
  assert.equal((await request(`/team/${team.id}/invitations`, lead)).data.length, 1);
});
test("Interns and global admins without team management cannot manage invitations", async () => {
  const { invitation } = await invite();
  const admin = await makeUser("admin@example.com", { role: "Super Admin" });
  for (const user of [intern, admin]) {
    assert.equal((await request(`/team/${team.id}/invite`, user, "POST", { email: "other@example.com" })).status, 403);
    assert.equal((await request(`/team/${team.id}/invitations`, user)).status, 403);
    assert.equal((await request(`/team/${team.id}/invitations/${invitation._id}/resend`, user, "POST")).status, 403);
    assert.equal((await request(`/team/${team.id}/invitations/${invitation._id}`, user, "DELETE")).status, 403);
  }
});
test("TeamLead manages details and member roles but cannot alter Owner or ownership", async () => {
  assert.equal((await request(`/team/${team.id}`, lead, "PUT", { teamName: "Updated Team" })).status, 200);
  assert.equal((await request(`/team/${team.id}/member/${intern.id}/role`, lead, "PATCH", { role: "TeamLead" })).status, 200);
  for (const [path, method, body, expected] of [
    [`/member/${owner.id}`, "DELETE", undefined, 400],
    [`/member/${owner.id}/role`, "PATCH", { role: "Intern" }, 400],
    [`/member/${lead.id}/role`, "PATCH", { role: "Owner" }, 400],
    ["/transfer-ownership", "POST", { userId: lead.id }, 403],
    ["", "DELETE", undefined, 403],
    ["/invite", "POST", { email: "other@example.com", role: "Owner" }, 400],
  ]) assert.equal((await request(`/team/${team.id}${path}`, lead, method, body)).status, expected);
  assert.equal((await request(`/team/${team.id}/member/${intern.id}`, lead, "DELETE")).status, 200);
});
test("only Owner transfers ownership atomically with exactly one Owner", async () => {
  assert.equal((await request(`/team/${team.id}/transfer-ownership`, owner, "POST", { userId: lead.id })).status, 200);
  const saved = await Team.findById(team.id);
  assert.equal(String(saved.owner), lead.id);
  assert.equal(saved.members.filter((m) => m.role === "Owner").length, 1);
  assert.equal(saved.members.find((m) => m.user.equals(owner._id)).role, "TeamLead");
});
test("any authenticated global role creates a team and becomes Owner", async () => {
  const result = await request("/team", intern, "POST", { teamName: "Intern's Team" });
  assert.equal(result.status, 201); assert.equal(result.data.owner, intern.id);
  assert.equal(result.data.members[0].role, "Owner");
});
test("TeamLead creates, edits, assigns, deletes tasks and projects; Intern stays restricted", async () => {
  const project = await projectService.createProject({ projectName: "Test project", description: "Test description", team: team.id }, lead._id);
  await projectService.updateProject(project.id, lead._id, { description: "Updated" });
  const task = await taskService.createTask({ title: "Test task", project: project.id, assignee: intern.id }, lead._id);
  await taskService.updateTask(task.id, intern._id, { status: "Completed" });
  await assert.rejects(taskService.updateTask(task.id, intern._id, { title: "Forbidden" }), { statusCode: 403 });
  await assert.rejects(taskService.deleteTask(task.id, intern._id), { statusCode: 403 });
  await assert.rejects(projectService.deleteProject(project.id, intern._id), { statusCode: 403 });
  await taskService.updateTask(task.id, lead._id, { assignee: owner.id, title: "Reassigned" });
  await assert.rejects(taskService.updateTask(task.id, intern._id, { status: "Completed" }), { statusCode: 403 });
  await taskService.deleteTask(task.id, lead._id);
  await projectService.deleteProject(project.id, lead._id);
});
test("password registration/login and verified Google login keep authentication working", async () => {
  assert.equal((await request("/auth/register", null, "POST", { fullName: "New User", email: "password@example.com", password: "Password123!", role: "Developer" })).status, 201);
  const login = await request("/auth/login", null, "POST", { email: "password@example.com", password: "Password123!" });
  assert.equal(login.status, 200); assert.ok(login.token);
  assert.equal((await User.findOne({ email: "password@example.com" })).verifiedEmail, "");
  const google = await request("/auth/google", null, "POST", { idToken: "test-provider-token" });
  assert.equal(google.status, 200); assert.ok(google.token);
  assert.equal((await User.findOne({ email: "google@example.com" })).verifiedEmail, "google@example.com");
});
test("stale team writes cannot erase concurrent accepted memberships", async () => {
  const { token } = await invite(); const user = await makeUser("new@example.com");
  const stale = await Team.findById(team.id);
  await service.accept(token, user);
  stale.members = stale.members.filter((m) => !m.user.equals(intern._id));
  await assert.rejects(stale.save(), { name: "VersionError" });
  assert.equal((await Team.findById(team.id)).members.some((m) => m.user.equals(user._id)), true);
});

test("acceptance racing revocation never leaves a revoked invite with a new membership", async () => {
  const { token, invitation } = await invite(); const user = await makeUser("new@example.com");
  await Promise.all([
    request("/team/invitations/accept", user, "POST", { token }),
    request(`/team/${team.id}/invitations/${invitation._id}`, lead, "DELETE"),
  ]);
  const saved = await Team.findById(team.id).select("+invitations");
  assert.equal(saved.members.some((m) => m.user.equals(user._id)), saved.invitations[0].status === "accepted");
});

test("expired verification codes and malformed invitation tokens fail", async () => {
  const user = await makeUser("new@example.com", { verifiedEmail: "" });
  await service.sendVerification(user);
  const token = sent.at(-1).text.match(/[a-f0-9]{64}/)[0];
  await User.updateOne({ _id: user._id }, { $set: { "emailVerification.expiresAt": new Date(0) } });
  assert.equal((await request("/auth/email-verification/confirm", user, "POST", { token })).status, 400);
  assert.equal((await request("/team/invitations/accept", user, "POST", { token: { $ne: null } })).status, 400);
  assert.equal((await request("/team/invitations/accept", user, "POST")).status, 400);
});

test("TeamLead can link repositories and access team reports/dashboard", async () => {
  const project = await projectService.createProject({ projectName: "Repo project", description: "Test", team: team.id }, owner._id);
  assert.equal((await request(`/github/projects/${project.id}/repo`, lead, "PUT", { githubRepo: "https://github.com/example/repo" })).status, 200);
  assert.equal((await request(`/github/projects/${project.id}/repo`, intern, "PUT", { githubRepo: "https://github.com/example/other" })).status, 403);
  assert.equal((await request("/github/all-projects", lead)).data.length, 1);
  assert.equal((await request("/github/all-projects", intern)).data.length, 0);
  assert.equal((await request("/reports/projects", lead)).status, 200);
  assert.equal((await request("/reports/teams", lead)).status, 200);
  assert.equal((await request("/dashboard/stats", lead)).status, 200);
});
