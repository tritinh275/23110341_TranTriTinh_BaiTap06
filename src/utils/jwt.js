const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "bt04_jwt_secret_key";
const JWT_EXPIRES = "8h";

function signMemberToken(user) {
  const subject = String(user.id || user._id);
  return jwt.sign(
    {
      sub: subject,
      username: user.username,
      role: user.role,
      fullName: user.fullName
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signMemberToken, verifyToken };
