// Offline, explicit migration. Never run automatically during startup/deployment.
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const { planMigration, readSnapshot } = require("../src/services/rbacMigration");
const { withRbacWrite } = require("../src/utils/rbacWrite");
const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
(async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  const session = await mongoose.startSession();
  let snapshot;
  try {
    // A read-only snapshot transaction also verifies replica-set/Atlas transaction support.
    await session.withTransaction(async () => { snapshot = await readSnapshot(db, session); }, { readConcern: { level: "snapshot" } });
  } finally { await session.endSession(); }
  const plan = planMigration(snapshot);
  const transitions = (pairs) => pairs.reduce((counts, [from, to]) => {
    if (from !== to) { const key = `${from ?? '(missing)'} -> ${to}`; counts[key] = (counts[key] || 0) + 1; }
    return counts;
  }, {});
  const users = new Map(snapshot.users.map(u => [String(u._id), u]));
  const teams = new Map(snapshot.teams.map(t => [String(t._id), t]));
  const countRoles = entries => entries.reduce((counts, entry) => { const role = entry.role ?? '(missing)'; counts[role] = (counts[role] || 0) + 1; return counts; }, {});
  console.log(JSON.stringify({ database: db.databaseName, dryRun: !args.includes("--apply"), readOnlySnapshotTransaction: "passed",
    records: Object.fromEntries(Object.entries(snapshot).map(([key, value]) => [key, value.length])),
    existingRoles: { accounts: countRoles(snapshot.users), memberships: countRoles(snapshot.teams.flatMap(t => t.members || [])), invitations: countRoles(snapshot.teams.flatMap(t => t.invitations || [])) },
    usersToUpdate: plan.userUpdates.length, teamsToUpdate: plan.teamUpdates.length,
    accountRoleChanges: transitions(plan.userUpdates.map(u => [users.get(String(u._id)).role, u.role])),
    membershipRoleChanges: transitions(plan.teamUpdates.flatMap(t => t.members.map(m => [teams.get(String(t._id)).members?.find(old => String(old.user) === String(m.user))?.role, m.role]))),
    invitationRoleChanges: transitions(plan.teamUpdates.flatMap(t => t.invitations.map((i, n) => [teams.get(String(t._id)).invitations[n].role, i.role]))),
    jobTitlesToUpdate: plan.userUpdates.filter(u => users.get(String(u._id)).jobTitle !== u.jobTitle).length,
    managerReferencesToUpdate: plan.teamUpdates.filter(t => String(teams.get(String(t._id)).manager || '') !== String(t.manager)).length,
    errors: plan.errors }, null, 2));
  if (plan.errors.length) throw new Error("Resolve every reported inconsistency before migration; no data was written");
  if (!args.includes("--apply")) return;
  if (!args.includes("--confirm-database") || option("--confirm-database") !== db.databaseName || !args.includes("--backup")) throw new Error("Apply requires --confirm-database <exact-name> and --backup <new-backup-file>");
  const { EJSON } = mongoose.mongo.BSON;
  const serialized = EJSON.stringify(snapshot, { relaxed: false });
  fs.writeFileSync(path.resolve(option("--backup")), serialized, { flag: "wx", mode: 0o600 });
  await withRbacWrite(async (session) => {
    const current = await readSnapshot(db, session);
    if (EJSON.stringify(current, { relaxed: false }) !== serialized) throw new Error("Database changed after backup. Stop application writes, take a new backup, and retry");
    for (const u of plan.userUpdates) await db.collection("users").updateOne({ _id: u._id }, { $set: { role: u.role, jobTitle: u.jobTitle } }, { session });
    for (const t of plan.teamUpdates) await db.collection("teams").updateOne({ _id: t._id }, { $set: { manager: t.manager, members: t.members, invitations: t.invitations }, $unset: { owner: "" }, $inc: { __v: 1 } }, { session });
  });
  console.log("RBAC migration committed. Retain the protected backup for rollback.");
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
