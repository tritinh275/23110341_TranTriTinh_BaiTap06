const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, trim: true },
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    role: { type: String, required: true, enum: ["member", "admin"], default: "member" }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = { User };
