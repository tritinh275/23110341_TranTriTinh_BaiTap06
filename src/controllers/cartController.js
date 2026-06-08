const cartService = require("../services/cartService");

function getUserId(req) {
  return req.user?.sub || req.user?.id || req.user?._id || "";
}

class CartController {
  async getCart(req, res, next) {
    try {
      const userId = getUserId(req);
      const payload = await cartService.getCart(userId);
      return res.json(payload);
    } catch (error) {
      return next(error);
    }
  }

  async addToCart(req, res, next) {
    try {
      const userId = getUserId(req);
      const productId = Number(req.body.productId);
      const quantity = Number(req.body.quantity) || 1;
      const payload = await cartService.addToCart({ userId, productId, quantity });
      return res.json(payload);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  async updateCartItem(req, res, next) {
    try {
      const userId = getUserId(req);
      const productId = Number(req.params.productId);
      const quantity = Number(req.body.quantity);
      const payload = await cartService.updateCartItem({ userId, productId, quantity });
      return res.json(payload);
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({ message: error.message });
    }
  }

  async deleteCartItem(req, res, next) {
    try {
      const userId = getUserId(req);
      const productId = Number(req.params.productId);
      const payload = await cartService.deleteCartItem({ userId, productId });
      return res.json(payload);
    } catch (error) {
      return next(error);
    }
  }

  async clearCart(req, res, next) {
    try {
      const userId = getUserId(req);
      const payload = await cartService.clearCart(userId);
      return res.json(payload);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new CartController();
