const express = require("express");
const productService = require("../services/productService");
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

pageRouter.get("/verify-otp", (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const payload = verifyToken(token);
      if (payload.role === "member") return res.redirect("/");
    } catch (error) {
      res.clearCookie("token");
    }
  }
  const username = req.query.username || "";
  return res.render("verify-otp", { username });
});

pageRouter.get("/", requireMember, async (req, res, next) => {
  try {
    const limit = 8;
    const data = await productService.getHomeData(limit);

    return res.render("home", {
      user: req.user,
      categories: data.categories,
      products: data.products,
      productsCount: data.productsCount,
      productsLimit: limit,
      promotions: data.promotions,
      newest: data.newest,
      bestSellers: data.bestSellers
    });
  } catch (error) {
    return next(error);
  }
});

pageRouter.get("/products/:idOrSlug", requireMember, async (req, res, next) => {
  try {
    const idOrSlug = req.params.idOrSlug;
    const product = await productService.getProductByIdOrSlug(idOrSlug);

    if (!product) {
      return res.status(404).render("not-found");
    }

    const similarProducts = await productService.getSimilarProducts(product, 4);

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
