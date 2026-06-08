const bcrypt = require("bcryptjs");
const { User } = require("../models/User");
const { generateOTP, sendOTP } = require("../utils/otp");
const { signMemberToken } = require("../utils/jwt");

class AuthService {
  async register({ fullName, email, username, password }) {
    const trimmedFullName = String(fullName).trim();
    const trimmedEmail = String(email).trim();
    const trimmedUsername = String(username).trim();

    const existingUser = await User.findOne({ 
      username: { $regex: new RegExp(`^${trimmedUsername}$`, "i") } 
    }).lean();
    if (existingUser) {
      throw new Error("Tên đăng nhập đã tồn tại");
    }

    const existingEmail = await User.findOne({ 
      email: { $regex: new RegExp(`^${trimmedEmail}$`, "i") } 
    }).lean();
    if (existingEmail) {
      throw new Error("Email này đã được sử dụng");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    const newUser = await User.create({
      username: trimmedUsername,
      password: hashedPassword,
      fullName: trimmedFullName,
      email: trimmedEmail,
      isVerified: false,
      otp,
      otpExpires,
      role: "member"
    });

    await sendOTP(trimmedEmail, otp, trimmedUsername);

    return {
      otpRequired: true,
      username: newUser.username,
      email: newUser.email,
      message: "Vui lòng xác thực mã OTP được gửi tới email của bạn."
    };
  }

  async login({ username, password }) {
    const user = await User.findOne({ username: String(username).trim() });

    if (!user || !["member", "admin"].includes(user.role)) {
      throw new Error("Sai tài khoản hoặc mật khẩu");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error("Sai tài khoản hoặc mật khẩu");
    }

    // Check if account is verified
    if (!user.isVerified) {
      const otp = generateOTP();
      const otpExpires = new Date(Date.now() + 5 * 60 * 1000);
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();

      await sendOTP(user.email, otp, user.username);

      return {
        unverified: true,
        username: user.username,
        email: user.email,
        message: "Tài khoản chưa xác thực. Mã OTP mới đã được gửi."
      };
    }

    const token = signMemberToken(user);
    return {
      token,
      user: { username: user.username, fullName: user.fullName, role: user.role }
    };
  }

  async verifyOTP({ username, otp }) {
    const user = await User.findOne({ username: String(username).trim() });
    if (!user) {
      const err = new Error("Không tìm thấy người dùng");
      err.statusCode = 404;
      throw err;
    }

    if (user.isVerified) {
      throw new Error("Tài khoản này đã được xác thực trước đó");
    }

    if (user.otp !== String(otp).trim()) {
      throw new Error("Mã OTP không chính xác");
    }

    if (new Date() > user.otpExpires) {
      throw new Error("Mã OTP đã hết hạn, vui lòng gửi lại mã mới");
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = signMemberToken(user);
    return {
      token,
      user: { username: user.username, fullName: user.fullName, role: user.role }
    };
  }

  async resendOTP({ username }) {
    const user = await User.findOne({ username: String(username).trim() });
    if (!user) {
      const err = new Error("Không tìm thấy tài khoản");
      err.statusCode = 404;
      throw err;
    }

    if (user.isVerified) {
      throw new Error("Tài khoản đã được xác thực");
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    await sendOTP(user.email, otp, user.username);

    return {
      message: "Gửi lại mã OTP thành công. Vui lòng kiểm tra email của bạn."
    };
  }
}

module.exports = new AuthService();
