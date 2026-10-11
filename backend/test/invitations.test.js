const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
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
const invite = async (email = "new@example.com", role = "Member", manager = lead) => {
  const result = await request(`/team/${team.id}/invite`, manager, "POST", { email, role });
  assert.equal(result.status, 200, JSON.stringify(result));
  return { invitation: result.data, token: sent.at(-1).text.match(/\/invitations\/([a-f0-9]{64})/)[1] };
};
before(async () => {
  process.env.JWT_SECRET = "test-only-secret";
  process.env.FRONTEND_URL = "http://localhost:5173";
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  const app = express(); app.use(express.json());
  app.use("/users", require("../src/routes/userRoutes"));
  app.use("/settings", require("../src/routes/settingsRoutes"));
  app.use("/documents", require("../src/routes/documentRoutes"));
  app.use("/tasks", require("../src/routes/taskRoutes"));
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
  await Promise.all([Team.deleteMany({}), User.deleteMany({}), Project.deleteMany({}), Task.deleteMany({}), require('../src/models/Document').deleteMany({})]);
  sent.length = 0; deliveryFails = false;
  owner = await makeUser("owner@example.com", { role: "Team Lead" }); lead = await makeUser("lead@example.com", { role: "Team Lead" }); intern = await makeUser("intern@example.com");
  team = await Team.create({ teamName: "Test Team", manager: owner._id, members: [
    { user: owner._id, role: "Team Lead" }, { user: lead._id, role: "Team Lead" }, { user: intern._id, role: "Member" },
  ] });
});

test("TeamLead invites an unregistered email; secrets stay out of team/list responses", async () => {
  const { token, invitation } = await invite(" NEW@example.com ", "Team Lead");
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
  const { token } = await invite("new@example.com", "Team Lead");
  const user = await makeUser("new@example.com", { role: "Member" });
  const results = await Promise.all(Array.from({ length: 8 }, () => request("/team/invitations/accept", user, "POST", { token })));
  assert.ok(results.every((r) => r.status === 200), JSON.stringify(results));
  const saved = await Team.findById(team.id).select("+invitations");
  assert.equal(saved.members.filter((m) => m.user.equals(user._id)).length, 1);
  assert.equal(saved.members.find((m) => m.user.equals(user._id)).role, "Team Lead");
  assert.equal(saved.invitations[0].status, "accepted");
  assert.equal((await User.findById(user._id)).role, "Member");
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
  await Team.updateOne({ _id: team.id }, { $push: { members: { user: user._id, role: "Team Lead" } }, $inc: { __v: 1 } });
  assert.equal((await request("/team/invitations/accept", user, "POST", { token })).status, 200);
  assert.equal((await Team.findById(team.id)).members.find((m) => m.user.equals(user._id)).role, "Team Lead");
});
test("SMTP failure is reported and leaves a manageable pending invitation", async () => {
  deliveryFails = true;
  assert.equal((await request(`/team/${team.id}/invite`, lead, "POST", { email: "new@example.com" })).status, 503);
  assert.equal((await request(`/team/${team.id}/invitations`, lead)).data.length, 1);
});
test("Members and unrelated Team Leads cannot manage invitations", async () => {
  const { invitation } = await invite();
  const admin = await makeUser("outsider@example.com", { role: "Team Lead" });
  for (const user of [intern, admin]) {
    assert.equal((await request(`/team/${team.id}/invite`, user, "POST", { email: "other@example.com" })).status, 403);
    assert.equal((await request(`/team/${team.id}/invitations`, user)).status, 403);
    assert.equal((await request(`/team/${team.id}/invitations/${invitation._id}/resend`, user, "POST")).status, 403);
    assert.equal((await request(`/team/${team.id}/invitations/${invitation._id}`, user, "DELETE")).status, 403);
  }
});
test("TeamLead manages details and member roles but cannot alter Owner or ownership", async () => {
  assert.equal((await request(`/team/${team.id}`, lead, "PUT", { teamName: "Updated Team" })).status, 200);
  assert.equal((await request(`/team/${team.id}/member/${intern.id}/role`, lead, "PATCH", { role: "Team Lead" })).status, 200);
  for (const [path, method, body, expected] of [
    [`/member/${owner.id}`, "DELETE", undefined, 409],
    [`/member/${owner.id}/role`, "PATCH", { role: "Member" }, 409],
    [`/member/${lead.id}/role`, "PATCH", { role: "Owner" }, 400],
    ["/manager", "POST", { userId: lead.id }, 403],
    ["/invite", "POST", { email: "other@example.com", role: "Owner" }, 400],
  ]) assert.equal((await request(`/team/${team.id}${path}`, lead, method, body)).status, expected);
  assert.equal((await request(`/team/${team.id}/member/${intern.id}`, lead, "DELETE")).status, 200);
});
test("only Admin reassigns the manager, retaining one designated manager", async () => {
  const admin = await makeUser("admin@example.com", { role: "Admin" });
  assert.equal((await request(`/team/${team.id}/manager`, owner, "POST", { userId: lead.id })).status, 403);
  assert.equal((await request(`/team/${team.id}/manager`, admin, "POST", { userId: lead.id })).status, 200);
  const saved = await Team.findById(team.id);
  assert.equal(String(saved.manager), lead.id);
  assert.equal(saved.members.find(m => m.user.equals(owner._id)).role, "Member");
  assert.equal(saved.members.find(m => m.user.equals(lead._id)).role, "Team Lead");
});
test("Team Lead creates a team and becomes manager; Member cannot create", async () => {
  assert.equal((await request("/team", intern, "POST", { teamName: "Forbidden Team" })).status, 403);
  const result = await request("/team", lead, "POST", { teamName: "Lead Team" });
  assert.equal(result.status, 201); assert.equal(result.data.manager, lead.id);
  assert.equal(result.data.members[0].role, "Team Lead");
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
  assert.equal((await request("/auth/register", null, "POST", { fullName: "New User", email: "password@example.com", password: "Password123!", role: "Member" })).status, 201);
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

test("Admin has all-team oversight; unrelated Team Leads and Members remain isolated", async () => {
  const admin = await makeUser("admin@example.com", { role: "Admin" });
  const outsider = await makeUser("outsider@example.com", { role: "Team Lead" });
  const project = await projectService.createProject({ projectName: "Private", description: "Private project", team: team.id }, lead.id);
  const task = await taskService.createTask({ title: "Private task", project: project.id, assignee: intern.id }, lead.id);
  for (const actor of [outsider]) {
    assert.equal((await request(`/team/${team.id}`, actor)).status, 403);
    await assert.rejects(projectService.getProjectById(project.id, actor.id), { statusCode: 403 });
    await assert.rejects(taskService.getTaskById(task.id, actor.id), { statusCode: 403 });
    assert.equal((await request(`/team/${team.id}`, actor, "DELETE")).status, 403);
    assert.equal((await request("/team", actor)).data.length, 0);
  }
  assert.equal((await request("/team", admin)).data.length, 1);
  assert.equal((await request(`/team/${team.id}`, admin)).status, 200);
  await taskService.updateTask(task.id, admin.id, { title: "Admin updated" });
  assert.equal((await request("/reports/projects", admin)).data.length, 1);
  assert.equal((await request("/reports/teams", admin)).data[0].manager, owner.fullName);
  assert.equal((await request("/reports/members", intern)).status, 403);
  assert.equal((await request("/dashboard/stats", admin)).status, 200);
  assert.equal((await request(`/github/projects/${project.id}/repo`, admin, "PUT", { githubRepo: "https://github.com/example/admin" })).status, 200);
  await assert.rejects(taskService.updateTask(task.id, admin.id, { assignee: admin.id }), { statusCode: 403 });
  await assert.rejects(projectService.deleteProject(project.id, admin.id));
  assert.equal((await request(`/team/${team.id}`, admin, "DELETE")).status, 409);
  await taskService.deleteTask(task.id, admin.id); await projectService.deleteProject(project.id, admin.id);
  assert.equal((await request(`/team/${team.id}`, lead, "DELETE")).status, 200);
});

test("Member writes are limited to own task status and progress, including mixed update rejection", async () => {
  const project = await projectService.createProject({ projectName: "Work", description: "Work", team: team.id }, lead.id);
  const task = await taskService.createTask({ title: "Work", project: project.id, assignee: intern.id }, lead.id);
  await taskService.updateTask(task.id, intern.id, { status: "In Progress", progress: 45 });
  assert.equal((await Task.findById(task.id)).progress, 45);
  assert.equal((await request(`/tasks/${task.id}`,intern,"PUT",{progress:101})).status,400);
  for (const data of [{status:"Completed",title:"bad"},{assignee:lead.id},{project:null},{progress:101}]) await assert.rejects(taskService.updateTask(task.id, intern.id, data));
  for (const operation of [() => taskService.addComment(task.id, intern.id, "No"), () => taskService.addSubtask(task.id, intern.id, "No"), () => projectService.updateProject(project.id, intern.id, {description:"No"})]) await assert.rejects(operation);
  assert.equal((await request(`/team/${team.id}`, intern, "PUT", {teamName:"Denied"})).status,403);
  assert.equal((await request(`/team/${team.id}`, intern, "DELETE")).status,403);
  assert.equal((await request(`/team/${team.id}/member/${intern.id}/role`, intern, "PATCH", {role:"Team Lead"})).status,403);
  assert.equal((await request(`/team/${team.id}/member/${intern.id}`, lead, "DELETE")).status,409);
});

test("account Team Lead does not override Member membership; invitations never grant Admin", async () => {
  team.members.find(m=>m.user.equals(lead._id)).role="Member"; await team.save();
  assert.equal((await request(`/team/${team.id}`, lead, "PUT", {teamName:"Denied"})).status,403);
  assert.equal((await request(`/team/${team.id}/invite`, owner, "POST", {email:"new@example.com",role:"Admin"})).status,400);
  const {token}=await invite("new@example.com","Team Lead",owner);
  const user=await makeUser("new@example.com");
  assert.equal((await request("/team/invitations/accept",user,"POST",{token})).status,200);
  assert.equal((await User.findById(user.id)).role,"Member");
  assert.equal((await request(`/team/${team.id}`,user,"PUT",{teamName:"Scoped Lead"})).status,200);
  assert.equal((await request("/auth/profile",user)).user.capabilities.canCreateTeams,true);
  assert.equal((await request("/users",user)).status,403);
});

test("only protected Admin operations grant Admin; public registration, Google and settings cannot", async () => {
  assert.equal((await request("/auth/register",null,"POST",{fullName:"Unsafe",email:"unsafe@example.com",password:"Password123!",role:"Admin"})).status,400);
  const google=await request("/auth/google",null,"POST",{idToken:"test",role:"Admin"});
  assert.equal(google.status,200); assert.equal((await User.findOne({email:"google@example.com"})).role,"Member");
  assert.equal((await request("/settings/profile",intern,"PUT",{role:"Admin",jobTitle:"Admin"})).status,200);
  assert.equal((await User.findById(intern.id)).role,"Member");
  const admin=await makeUser("admin@example.com",{role:"Admin"});
  assert.equal((await request(`/users/${intern.id}/role`,lead,"PUT",{role:"Admin"})).status,403);
  assert.equal((await request(`/users/${intern.id}/role`,admin,"PUT",{role:"Admin"})).status,200);
  assert.equal((await request("/users",intern)).status,200);
  assert.equal((await request(`/users/${admin.id}/role`,admin,"PUT",{role:"Member"})).status,409);
  assert.equal((await request(`/users/${owner.id}/deactivate`,admin,"PUT")).status,409);
  const created=await request("/users",admin,"POST",{fullName:"New Admin",email:"newadmin@example.com",password:"Password123!",role:"Admin"});
  assert.equal(created.status,201,JSON.stringify(created)); assert.equal(created.data.password,undefined);
});

test("Admin can appoint an external Team Lead but cannot appoint an inactive or unqualified Member", async () => {
  const admin=await makeUser("admin@example.com",{role:"Admin"});
  const external=await makeUser("external@example.com",{role:"Team Lead"});
  assert.equal((await request(`/team/${team.id}/manager`,admin,"POST",{userId:intern.id})).status,400);
  assert.equal((await request(`/team/${team.id}/manager`,admin,"POST",{userId:external.id})).status,200);
  const saved=await Team.findById(team.id);
  assert.equal(String(saved.manager),external.id); assert.equal(saved.members.find(m=>m.user.equals(external._id)).role,"Team Lead");
  assert.equal((await request(`/team/${team.id}/leave`,external,"DELETE")).status,409);
  assert.equal((await request(`/users/${owner.id}/deactivate`,admin,"PUT")).status,200);
  assert.equal((await request(`/team/${team.id}`,owner)).status,403);
});

test("first Admin bootstrap is private, single-use, and hashes its password", async () => {
  const {bootstrapAdmin}=require("../src/services/adminBootstrap");
  const input={fullName:"First Admin",email:"first@example.com",password:"test-only-long-password"};
  const results=await Promise.allSettled([bootstrapAdmin(input),bootstrapAdmin({...input,email:"second@example.com"})]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(await User.countDocuments({role:"Admin"}),1);
  const admin=await User.findOne({role:"Admin"}); assert.notEqual(admin.password,input.password);
  await assert.rejects(bootstrapAdmin(input),/Admin already exists/);
});

test("documents retain authorized viewing and manager-only upload/delete", async () => {
  const admin=await makeUser("admin@example.com",{role:"Admin"});
  const outsider=await makeUser("outsider@example.com",{role:"Team Lead"});
  const project=await projectService.createProject({projectName:"Docs",description:"Docs",team:team.id},lead.id);
  const upload=async actor=>{
    const body=new FormData(); body.set("file",new Blob(["test document"],{type:"text/plain"}),"test.txt"); body.set("fileType","Meeting Notes"); body.set("project",project.id);
    const res=await fetch(base+"/documents",{method:"POST",headers:{Authorization:`Bearer ${jwt.sign({id:actor.id},process.env.JWT_SECRET)}`},body});
    return {status:res.status,...await res.json()};
  };
  assert.equal((await upload(intern)).status,403); assert.equal((await upload(outsider)).status,403);
  const result=await upload(lead); assert.equal(result.status,201,JSON.stringify(result));
  const id=result.data._id;
  assert.equal((await request(`/documents/${id}`,intern)).status,200);
  assert.equal((await request(`/documents/${id}`,outsider)).status,403);
  assert.equal((await request(`/documents/${id}`,intern,"DELETE")).status,403);
  await assert.rejects(projectService.deleteProject(project.id,lead.id),{statusCode:409});
  assert.equal((await request(`/documents/${id}`,admin,"DELETE")).status,200);
  assert.equal((await upload(admin)).status,201);
});

test("explicit migration CLI is dry-run by default, requires confirmation and backup, and commits safely", async () => {
  const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
  const execFile=require('node:util').promisify(require('node:child_process').execFile);
  const {assertCurrentRbac}=require('../src/services/rbacMigration');
  await assertCurrentRbac(mongoose.connection.db);
  const legacyId=new mongoose.Types.ObjectId();
  await User.collection.insertOne({_id:legacyId,fullName:"Legacy",email:"legacy@example.com",role:"Developer",isActive:true});
  await assert.rejects(assertCurrentRbac(mongoose.connection.db),/migrate:rbac/);
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'taskit-migration-test-'));
  const backup=path.join(dir,'backup.json');
  const run=(args=[])=>execFile(process.execPath,[path.join(__dirname,'../scripts/migrate-rbac.js'),...args],{env:{...process.env,MONGO_URI:mongo.getUri(mongoose.connection.name)},timeout:30000});
  try {
    assert.match((await run()).stdout,/"dryRun": true/);
    assert.equal((await User.collection.findOne({_id:legacyId})).role,'Developer');
    await assert.rejects(run(['--apply','--confirm-database','wrong','--backup',backup]));
    await assert.rejects(fs.access(backup));
    const args=['--apply','--confirm-database',mongoose.connection.name,'--backup',backup];
    assert.match((await run(args)).stdout,/committed/);
    const saved=await User.findById(legacyId); assert.equal(saved.role,'Member'); assert.equal(saved.jobTitle,'Developer');
    assert.match(await fs.readFile(backup,'utf8'),/Developer/);
    await assertCurrentRbac(mongoose.connection.db);
    await assert.rejects(run(args)); // Never overwrite an existing backup.
  } finally { await fs.unlink(backup).catch(()=>{}); await fs.rmdir(dir); }
});

test("concurrent Admin demotions cannot remove all active administrators", async () => {
  const a=await makeUser("a@example.com",{role:"Admin"}), b=await makeUser("b@example.com",{role:"Admin"});
  const results=await Promise.all([request(`/users/${b.id}/role`,a,"PUT",{role:"Member"}),request(`/users/${a.id}/role`,b,"PUT",{role:"Member"})]);
  assert.equal(results.filter(r=>r.status===200).length,1);
  assert.equal(await User.countDocuments({role:"Admin",isActive:true}),1);
});

test("moving work validates destination access and retained assignees", async () => {
  const second=await require('../src/services/teamService').createTeam(lead.id,{teamName:"Second Team"});
  const firstProject=await projectService.createProject({projectName:"First",description:"First",team:team.id},lead.id);
  const secondProject=await projectService.createProject({projectName:"Second",description:"Second",team:second.id},lead.id);
  const task=await taskService.createTask({title:"Assigned",project:firstProject.id,assignee:intern.id},lead.id);
  await assert.rejects(taskService.updateTask(task.id,lead.id,{project:secondProject.id}),{statusCode:403});
  await assert.rejects(projectService.updateProject(firstProject.id,lead.id,{team:second.id}),{statusCode:409});
  await taskService.updateTask(task.id,lead.id,{project:secondProject.id,assignee:lead.id});
  assert.equal(String((await Task.findById(task.id)).project),secondProject.id);
});
