const authService = require("../services/authService");

class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      if (result.token) {
        res.cookie("token", result.token, {
          httpOnly: true,
          sameSite: "lax",
          maxAge: 8 * 60 * 60 * 1000
        });
        return res.json({
          message: "Đăng nhập thành công",
          user: result.user
        });
      }
      return res.status(result.unverified ? 403 : 200).json(result);
    } catch (error) {
      if (error.message === "Sai tài khoản hoặc mật khẩu") {
        return res.status(401).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
  }

  async verifyOTP(req, res, next) {
    try {
      const result = await authService.verifyOTP(req.body);
      res.cookie("token", result.token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000
      });
      return res.json({
        message: "Xác thực tài khoản thành công",
        user: result.user
      });
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({ message: error.message });
    }
  }

  async resendOTP(req, res, next) {
    try {
      const result = await authService.resendOTP(req.body);
      return res.json(result);
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({ message: error.message });
    }
  }

  logout(req, res) {
    res.clearCookie("token");
    return res.json({ message: "Đã đăng xuất" });
  }

  getMe(req, res) {
    return res.json({ user: req.user });
  }
}

module.exports = new AuthController();
