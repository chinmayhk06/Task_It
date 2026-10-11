const path = require("node:path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const { bootstrapAdmin } = require("../src/services/adminBootstrap");
const args = process.argv.slice(2);
(async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI);
  const confirmation = args.indexOf("--confirm-database");
  if (confirmation < 0 || args[confirmation + 1] !== mongoose.connection.db.databaseName) throw new Error("Provide --confirm-database <exact-database-name>; no Admin was created");
  await UserIndexes();
  await bootstrapAdmin({ fullName: process.env.BOOTSTRAP_ADMIN_NAME, email: process.env.BOOTSTRAP_ADMIN_EMAIL, password: process.env.BOOTSTRAP_ADMIN_PASSWORD });
  console.log("First Admin created. Remove BOOTSTRAP_ADMIN_* from your environment now.");
})().catch((error) => { console.error(error.code === 11000 ? "Email already exists; bootstrap never promotes or overwrites an existing user" : error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
async function UserIndexes() { await require("../src/models/User").init(); }
