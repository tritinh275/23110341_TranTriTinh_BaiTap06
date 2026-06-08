const express = require("express");
const { Product } = require("../models/Product");
const { requireMember } = require("../middleware/auth");
const { verifyToken } = require("../utils/jwt");

const pageRouter = express.Router();

pageRouter.get("/login", (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const payload = verifyToken(token);
      if (payload.role === "member") return res.redirect("/");
    } catch (error) {
      res.clearCookie("token");
    }
  }
  return res.render("login");
});

pageRouter.get("/register", (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const payload = verifyToken(token);
      if (payload.role === "member") return res.redirect("/");
    } catch (error) {
      res.clearCookie("token");
    }
  }
  return res.render("register");
});

pageRouter.get("/", requireMember, async (req, res, next) => {
  try {
    const [categories, products, promotions, newest, bestSellers] = await Promise.all([
      Product.distinct("category"),
      Product.find({}).sort({ createdAt: -1 }).lean(),
      Product.find({ $expr: { $gt: ["$originalPrice", "$price"] } }).limit(4).lean(),
      Product.find({}).sort({ createdAt: -1 }).limit(4).lean(),
      Product.find({}).sort({ soldCount: -1 }).limit(4).lean()
    ]);

    categories.sort((a, b) => a.localeCompare(b));

    return res.render("home", {
      user: req.user,
      categories,
      products,
      promotions,
      newest,
      bestSellers
    });
  } catch (error) {
    return next(error);
  }
});

pageRouter.get("/products/:idOrSlug", requireMember, async (req, res, next) => {
  try {
    const idOrSlug = req.params.idOrSlug;
    const byId = Number(idOrSlug);
    const filter = Number.isNaN(byId)
      ? { slug: idOrSlug }
      : { $or: [{ id: byId }, { slug: idOrSlug }] };
    const product = await Product.findOneAndUpdate(
      filter,
      { $inc: { viewCount: 1 } },
      { new: true, lean: true }
    );

    if (!product) {
      return res.status(404).render("not-found");
    }

    const similarProducts = await Product.find({
      id: { $ne: product.id },
      category: product.category
    })
      .limit(4)
      .lean();

    return res.render("detail", {
      user: req.user,
      product,
      similarProducts
    });
  } catch (error) {
    return next(error);
  }
});

pageRouter.get("/cart", requireMember, (req, res) => {
  return res.render("cart", { user: req.user });
});

pageRouter.get("/checkout", requireMember, (req, res) => {
  return res.render("checkout", { user: req.user });
});

pageRouter.get("/orders", requireMember, (req, res) => {
  return res.render("orders", { user: req.user });
});

module.exports = { pageRouter };
