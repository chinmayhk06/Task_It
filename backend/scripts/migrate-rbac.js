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
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const snapshot = await readSnapshot(db);
  const plan = planMigration(snapshot);
  console.log(JSON.stringify({ database: db.databaseName, dryRun: !args.includes("--apply"), usersToUpdate: plan.userUpdates.length, teamsToUpdate: plan.teamUpdates.length, errors: plan.errors }, null, 2));
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
