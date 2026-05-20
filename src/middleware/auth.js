const { verifyToken } = require("../utils/jwt");

function requireMember(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.redirect("/login");
  }

  try {
    const payload = verifyToken(token);
    if (payload.role !== "member") {
      return res.redirect("/login");
    }
    req.user = payload;
    return next();
  } catch (error) {
    return res.redirect("/login");
  }
}

function requireMemberApi(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }

  try {
    const payload = verifyToken(token);
    if (payload.role !== "member") {
      return res.status(403).json({ message: "Không có quyền truy cập" });
    }
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
}

module.exports = { requireMember, requireMemberApi };
