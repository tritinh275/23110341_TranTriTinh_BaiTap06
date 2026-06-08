const express = require("express");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const { requireMemberApi, requireAdminApi } = require("../middleware/auth");

const authController = require("../controllers/authController");
const productController = require("../controllers/productController");
const cartController = require("../controllers/cartController");
const orderController = require("../controllers/orderController");

const apiRouter = express.Router();

// Lớp 2: Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Tối đa 5 yêu cầu từ một IP
  message: { message: "Quá nhiều yêu cầu đăng nhập/đăng ký từ IP này, vui lòng thử lại sau 15 phút" },
  standardHeaders: true,
  legacyHeaders: false
});

// Lớp 1: Input Validation
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

const registerValidation = [
  body("fullName")
    .trim()
    .notEmpty().withMessage("Họ và tên không được để trống")
    .isLength({ min: 2, max: 50 }).withMessage("Họ và tên phải từ 2 đến 50 ký tự"),
  body("email")
    .trim()
    .notEmpty().withMessage("Email không được để trống")
    .isEmail().withMessage("Định dạng email không hợp lệ"),
  body("username")
    .trim()
    .notEmpty().withMessage("Tên đăng nhập không được để trống")
    .isLength({ min: 3, max: 20 }).withMessage("Tên đăng nhập phải từ 3 đến 20 ký tự")
    .matches(/^[a-zA-Z0-9_]+$/).withMessage("Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới"),
  body("password")
    .notEmpty().withMessage("Mật khẩu không được để trống")
    .isLength({ min: 6 }).withMessage("Mật khẩu phải chứa ít nhất 6 ký tự"),
  body("confirmPassword")
    .notEmpty().withMessage("Mật khẩu xác nhận không được để trống")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Mật khẩu xác nhận không khớp");
      }
      return true;
    }),
  validate
];

const loginValidation = [
  body("username").trim().notEmpty().withMessage("Vui lòng nhập tên đăng nhập"),
  body("password").notEmpty().withMessage("Vui lòng nhập mật khẩu"),
  validate
];

const verifyOtpValidation = [
  body("username").trim().notEmpty().withMessage("Vui lòng nhập tên đăng nhập"),
  body("otp").trim().notEmpty().withMessage("Vui lòng nhập mã OTP"),
  validate
];

const resendOtpValidation = [
  body("username").trim().notEmpty().withMessage("Vui lòng cung cấp tên đăng nhập"),
  validate
];

const orderValidation = [
  body("recipientName").trim().notEmpty().withMessage("Vui lòng nhập đầy đủ thông tin nhận hàng"),
  body("phone").trim().notEmpty().withMessage("Vui lòng nhập số điện thoại nhận hàng"),
  body("address").trim().notEmpty().withMessage("Vui lòng nhập địa chỉ nhận hàng"),
  body("paymentMethod")
    .optional()
    .custom((value) => {
      if (value && value !== "COD") {
        throw new Error("Hiện chỉ hỗ trợ thanh toán COD");
      }
      return true;
    }),
  validate
];

const cartItemValidation = [
  body("productId").isNumeric().withMessage("Sản phẩm không hợp lệ"),
  body("quantity")
    .optional()
    .isInt({ min: 1 }).withMessage("Số lượng không hợp lệ"),
  validate
];

// --- Authentications ---
apiRouter.post("/auth/register", authLimiter, registerValidation, authController.register);
apiRouter.post("/auth/login", authLimiter, loginValidation, authController.login);
apiRouter.post("/auth/verify-otp", authLimiter, verifyOtpValidation, authController.verifyOTP);
apiRouter.post("/auth/resend-otp", authLimiter, resendOtpValidation, authController.resendOTP);
apiRouter.post("/auth/logout", authController.logout);
apiRouter.get("/auth/me", requireMemberApi, authController.getMe);

// --- Products ---
apiRouter.get("/categories", productController.getCategories);
apiRouter.get("/products", productController.getProducts);
apiRouter.get("/categories/:category/products", productController.getProductsByCategory);
apiRouter.get("/products/top", productController.getTopProducts);
apiRouter.get("/products/:id", productController.getProductById);
apiRouter.delete("/products/:id", requireAdminApi, productController.deleteProduct);

// --- Cart ---
apiRouter.get("/cart", requireMemberApi, cartController.getCart);
apiRouter.post("/cart/items", requireMemberApi, cartItemValidation, cartController.addToCart);
apiRouter.patch("/cart/items/:productId", requireMemberApi, cartController.updateCartItem);
apiRouter.delete("/cart/items/:productId", requireMemberApi, cartController.deleteCartItem);
apiRouter.delete("/cart", requireMemberApi, cartController.clearCart);

// --- Orders ---
apiRouter.post("/orders", requireMemberApi, orderValidation, orderController.createOrder);
apiRouter.get("/orders", requireMemberApi, orderController.getOrders);
apiRouter.get("/orders/:id", requireMemberApi, orderController.getOrderById);
apiRouter.post("/orders/:id/cancel", requireMemberApi, orderController.cancelOrder);
apiRouter.patch("/orders/:id/status", requireMemberApi, orderController.progressOrderStatus);

module.exports = { apiRouter };
