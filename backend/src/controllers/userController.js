const User = require("../models/User");
const service = require("../services/userService");
const action = (fn, status = 200) => async (req,res) => {
  try { const data = await fn(req); res.status(status).json({success:true,data,message:"User operation completed"}); }
  catch(error) { res.status(error.statusCode || (error.code === 11000 ? 409 : ["ValidationError","CastError"].includes(error.name) ? 400 : 500)).json({success:false,message:error.code === 11000 ? "Email already in use" : error.message}); }
};
module.exports = {
  getUsers: action(() => User.find({}).select("-password").sort({createdAt:-1})),
  getUser: action(async r => { const user=await User.findById(r.params.id).select("-password"); if(!user) throw Object.assign(new Error("User not found"),{statusCode:404}); return user; }),
  createUser: action(r => service.createUser(r.user._id,r.body),201),
  updateUser: action(r => service.mutateUser(r.user._id,r.params.id,"update",r.body)),
  deleteUser: action(r => service.mutateUser(r.user._id,r.params.id,"delete")),
  assignRole: action(r => service.mutateUser(r.user._id,r.params.id,"update",{role:r.body.role})),
  toggleActivate: action(r => service.mutateUser(r.user._id,r.params.id,"toggle")),
};
