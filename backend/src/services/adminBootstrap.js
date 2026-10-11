const bcrypt = require("bcrypt");
const User = require("../models/User");
const { withRbacWrite } = require("../utils/rbacWrite");
const bootstrapAdmin = async ({ fullName, email, password }) => {
  if (!fullName || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || password.length < 16) throw new Error("Bootstrap requires a name, valid email and a password of at least 16 characters");
  const hashed = await bcrypt.hash(password, 12);
  return withRbacWrite(async (session) => {
    if (await User.collection.findOne({ role: { $in: ["Admin", "Super Admin"] } }, { session })) throw new Error("An Admin already exists; use protected Admin user management");
    const [user] = await User.create([{ fullName, email: email.toLowerCase().trim(), password: hashed, role: "Admin", jobTitle: "" }], { session });
    return user._id;
  });
};
module.exports = { bootstrapAdmin };
