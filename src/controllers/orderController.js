const orderService = require("../services/orderService");

function getUserId(req) {
  return req.user?.sub || req.user?.id || req.user?._id || "";
}

class OrderController {
  async createOrder(req, res, next) {
    try {
      const userId = getUserId(req);
      const { recipientName, phone, address, note } = req.body;
      const order = await orderService.createOrder({
        userId,
        recipientName,
        phone,
        address,
        note
      });
      return res.status(201).json({ data: order });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  async getOrders(req, res, next) {
    try {
      const userId = getUserId(req);
      const orders = await orderService.getOrders(userId);
      return res.json({ data: orders });
    } catch (error) {
      return next(error);
    }
  }

  async getOrderById(req, res, next) {
    try {
      const userId = getUserId(req);
      const orderId = req.params.id;
      const order = await orderService.getOrderById({ userId, orderId });
      return res.json({ data: order });
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({ message: error.message });
    }
  }

  async cancelOrder(req, res, next) {
    try {
      const userId = getUserId(req);
      const orderId = req.params.id;
      const order = await orderService.cancelOrder({ userId, orderId });
      return res.json({ data: order });
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({ message: error.message });
    }
  }

  async progressOrderStatus(req, res, next) {
    try {
      const userId = getUserId(req);
      const orderId = req.params.id;
      const order = await orderService.progressOrderStatus({ userId, orderId });
      return res.json({ data: order });
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({ message: error.message });
    }
  }
}

module.exports = new OrderController();
