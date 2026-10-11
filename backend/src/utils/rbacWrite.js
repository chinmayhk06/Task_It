const mongoose = require("mongoose");
// Serialize administrative role/manager changes, including concurrent last-Admin checks.
const withRbacWrite = async (work) => {
  const controls = mongoose.connection.collection("rbac_controls");
  await controls.updateOne({ _id: "administration" }, { $setOnInsert: { revision: 0 } }, { upsert: true });
  return mongoose.connection.transaction(async (session) => {
    await controls.updateOne({ _id: "administration" }, { $inc: { revision: 1 } }, { session });
    return work(session);
  });
};
module.exports = { withRbacWrite };
