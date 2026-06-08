const { Order } = require("../models/Order");
const { Product } = require("../models/Product");
const cartService = require("./cartService");

const ORDER_STATUS = {
  NEW: "new",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  SHIPPING: "shipping",
  DELIVERED: "delivered",
  CANCELED: "canceled",
  CANCEL_REQUESTED: "cancel_requested"
};

const STATUS_LABELS = {
  [ORDER_STATUS.NEW]: "Đơn hàng mới",
  [ORDER_STATUS.CONFIRMED]: "Đã xác nhận đơn",
  [ORDER_STATUS.PREPARING]: "Shop đang chuẩn bị hàng",
  [ORDER_STATUS.SHIPPING]: "Đang giao hàng",
  [ORDER_STATUS.DELIVERED]: "Đã giao thành công",
  [ORDER_STATUS.CANCELED]: "Đã hủy đơn",
  [ORDER_STATUS.CANCEL_REQUESTED]: "Đã gửi yêu cầu hủy"
};

const SHIPPING_FEE = 0;
const AUTO_CONFIRM_MINUTES = 30;

class OrderService {
  _createOrderCode() {
    const now = new Date();
    const dateText = now.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);
    return `DH${dateText}-${random}`;
  }

  _buildOrderResponse(order, now = new Date()) {
    const createdAt = new Date(order.createdAt);
    const withinCancelWindow = now - createdAt <= AUTO_CONFIRM_MINUTES * 60 * 1000;
    const canCancel =
      withinCancelWindow && [ORDER_STATUS.NEW, ORDER_STATUS.CONFIRMED].includes(order.status);
    const canRequestCancel = withinCancelWindow && order.status === ORDER_STATUS.PREPARING;

    return {
      id: order._id,
      code: order.code,
      status: order.status,
      statusLabel: STATUS_LABELS[order.status] || order.status,
      createdAt: order.createdAt,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      total: order.total,
      paymentMethod: order.paymentMethod,
      recipientName: order.recipientName,
      phone: order.phone,
      address: order.address,
      note: order.note,
      items: order.items,
      statusHistory: order.statusHistory || [],
      canCancel,
      canRequestCancel
    };
  }

  async autoConfirmOrders(userId) {
    const cutoff = new Date(Date.now() - AUTO_CONFIRM_MINUTES * 60 * 1000);
    const now = new Date();
    await Order.updateMany(
      { userId, status: ORDER_STATUS.NEW, createdAt: { $lte: cutoff } },
      {
        $set: { status: ORDER_STATUS.CONFIRMED },
        $push: {
          statusHistory: {
            status: ORDER_STATUS.CONFIRMED,
            note: "Tự động xác nhận sau 30 phút",
            at: now
          }
        }
      }
    );
  }

  async createOrder({ userId, recipientName, phone, address, note }) {
    const cart = await cartService.ensureCart(userId);
    if (!cart.items.length) {
      throw new Error("Giỏ hàng đang trống");
    }

    const productIds = cart.items.map((item) => item.productId);
    const products = await Product.find({ id: { $in: productIds } }).lean();
    const productsMap = new Map(products.map((product) => [product.id, product]));

    const orderItems = [];
    let subtotal = 0;
    for (const item of cart.items) {
      const product = productsMap.get(item.productId);
      if (!product) {
        throw new Error("Giỏ hàng có sản phẩm không tồn tại");
      }
      if (product.stock < item.quantity) {
        throw new Error(`Sản phẩm ${product.name} không đủ tồn kho`);
      }
      const lineSubtotal = product.price * item.quantity;
      subtotal += lineSubtotal;
      orderItems.push({
        productId: product.id,
        name: product.name,
        image: product.images?.[0] || "",
        price: product.price,
        originalPrice: product.originalPrice,
        quantity: item.quantity,
        subtotal: lineSubtotal
      });
    }

    const now = new Date();
    const order = await Order.create({
      code: this._createOrderCode(),
      userId,
      items: orderItems,
      subtotal,
      shippingFee: SHIPPING_FEE,
      total: subtotal + SHIPPING_FEE,
      recipientName: String(recipientName).trim(),
      phone: String(phone).trim(),
      address: String(address).trim(),
      note: note ? String(note).trim() : "",
      paymentMethod: "COD",
      status: ORDER_STATUS.NEW,
      statusHistory: [{ status: ORDER_STATUS.NEW, note: "Đặt hàng thành công", at: now }]
    });

    await Product.bulkWrite(
      orderItems.map((item) => ({
        updateOne: {
          filter: { id: item.productId },
          update: { $inc: { stock: -item.quantity, soldCount: item.quantity } }
        }
      }))
    );

    cart.items = [];
    await cart.save();

    return this._buildOrderResponse(order, now);
  }

  async getOrders(userId) {
    await this.autoConfirmOrders(userId);
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean();
    const now = new Date();
    return orders.map((order) => this._buildOrderResponse(order, now));
  }

  async getOrderById({ userId, orderId }) {
    await this.autoConfirmOrders(userId);
    const order = await Order.findOne({ _id: orderId, userId }).lean();
    if (!order) {
      const err = new Error("Không tìm thấy đơn hàng");
      err.statusCode = 404;
      throw err;
    }
    return this._buildOrderResponse(order);
  }

  async cancelOrder({ userId, orderId }) {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      const err = new Error("Không tìm thấy đơn hàng");
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    const withinCancelWindow = now - new Date(order.createdAt) <= AUTO_CONFIRM_MINUTES * 60 * 1000;
    if (!withinCancelWindow) {
      throw new Error("Chỉ được hủy trong 30 phút đầu sau khi đặt hàng");
    }

    if ([ORDER_STATUS.SHIPPING, ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELED].includes(order.status)) {
      throw new Error("Đơn hàng không thể hủy ở trạng thái hiện tại");
    }

    if (order.status === ORDER_STATUS.PREPARING) {
      order.status = ORDER_STATUS.CANCEL_REQUESTED;
      order.statusHistory.push({
        status: ORDER_STATUS.CANCEL_REQUESTED,
        note: "Gửi yêu cầu hủy đơn cho shop",
        at: now
      });
      await order.save();
      return this._buildOrderResponse(order, now);
    }

    if ([ORDER_STATUS.NEW, ORDER_STATUS.CONFIRMED].includes(order.status)) {
      order.status = ORDER_STATUS.CANCELED;
      order.statusHistory.push({
        status: ORDER_STATUS.CANCELED,
        note: "Đơn hàng đã hủy",
        at: now
      });
      await order.save();

      await Product.bulkWrite(
        order.items.map((item) => ({
          updateOne: {
            filter: { id: item.productId },
            update: { $inc: { stock: item.quantity, soldCount: -item.quantity } }
          }
        }))
      );

      return this._buildOrderResponse(order, now);
    }

    throw new Error("Đơn hàng không thể hủy ở trạng thái hiện tại");
  }

  async progressOrderStatus({ userId, orderId }) {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      const err = new Error("Không tìm thấy đơn hàng");
      err.statusCode = 404;
      throw err;
    }

    const progression = {
      [ORDER_STATUS.NEW]: ORDER_STATUS.CONFIRMED,
      [ORDER_STATUS.CONFIRMED]: ORDER_STATUS.PREPARING,
      [ORDER_STATUS.PREPARING]: ORDER_STATUS.SHIPPING,
      [ORDER_STATUS.SHIPPING]: ORDER_STATUS.DELIVERED
    };

    const nextStatus = progression[order.status];
    if (!nextStatus) {
      throw new Error("Đơn hàng không thể chuyển trạng thái tiếp theo");
    }

    const noteMap = {
      [ORDER_STATUS.CONFIRMED]: "Đơn hàng đã được xác nhận",
      [ORDER_STATUS.PREPARING]: "Shop đang chuẩn bị hàng",
      [ORDER_STATUS.SHIPPING]: "Đơn hàng đang được giao",
      [ORDER_STATUS.DELIVERED]: "Giao hàng thành công"
    };

    const now = new Date();
    order.status = nextStatus;
    order.statusHistory.push({ status: nextStatus, note: noteMap[nextStatus], at: now });
    await order.save();

    return this._buildOrderResponse(order, now);
  }
}

module.exports = new OrderService();
