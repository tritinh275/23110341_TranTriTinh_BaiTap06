const express = require("express");
const { Product } = require("../models/Product");
const { User } = require("../models/User");
const { Cart } = require("../models/Cart");
const { Order } = require("../models/Order");
const { signMemberToken } = require("../utils/jwt");
const { requireMemberApi } = require("../middleware/auth");

const apiRouter = express.Router();

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return value.toLowerCase() === "true";
}

function buildProductFilter(query) {
  const {
    q,
    category,
    minPrice,
    maxPrice,
    minRating,
    onlyInStock,
    isNew,
    bestSeller,
    sort
  } = query;

  const qText = (q || "").trim();
  const categoryText = (category || "").trim();
  const minPriceNumber = Number(minPrice) || 0;
  const maxPriceNumber = Number(maxPrice) || Number.MAX_SAFE_INTEGER;
  const minRatingNumber = Number(minRating) || 0;

  const filter = {
    price: { $gte: minPriceNumber, $lte: maxPriceNumber },
    rating: { $gte: minRatingNumber }
  };

  if (qText) {
    const regex = new RegExp(qText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: regex }, { description: regex }, { category: regex }];
  }
  if (categoryText) filter.category = categoryText;
  if (parseBoolean(onlyInStock)) filter.stock = { $gt: 0 };
  if (parseBoolean(isNew)) filter.isNew = true;
  if (parseBoolean(bestSeller)) filter.bestSeller = true;

  const sortOption =
    sort === "price-asc"
      ? { price: 1 }
      : sort === "price-desc"
        ? { price: -1 }
        : sort === "best-seller"
          ? { soldCount: -1 }
          : { createdAt: -1 };

  return { filter, sortOption };
}

function parsePagination(query, fallbackLimit = 8) {
  const pageNumber = Math.max(Number(query.page) || 1, 1);
  const limitNumber = Math.max(Number(query.limit) || fallbackLimit, 1);
  return {
    pageNumber,
    limitNumber,
    skip: (pageNumber - 1) * limitNumber
  };
}

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

function getUserId(req) {
  return req.user?.sub || req.user?.id || req.user?._id || "";
}

function createOrderCode() {
  const now = new Date();
  const dateText = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `DH${dateText}-${random}`;
}

function buildCartDetail(cart, productsMap) {
  let totalQuantity = 0;
  let subtotal = 0;
  const items = [];
  const normalizedItems = [];

  cart.items.forEach((item) => {
    const product = productsMap.get(item.productId);
    if (!product) return;
    if (product.stock <= 0) return;
    const safeQty = Math.max(1, Math.min(item.quantity, product.stock));
    const lineSubtotal = product.price * safeQty;
    items.push({
      productId: item.productId,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      stock: product.stock,
      image: product.images?.[0] || "",
      quantity: safeQty,
      subtotal: lineSubtotal
    });
    normalizedItems.push({ productId: item.productId, quantity: safeQty });
    totalQuantity += safeQty;
    subtotal += lineSubtotal;
  });

  return {
    items,
    summary: {
      totalQuantity,
      subtotal,
      shippingFee: SHIPPING_FEE,
      total: subtotal + SHIPPING_FEE
    },
    normalizedItems
  };
}

function isCartChanged(originalItems, normalizedItems) {
  if (originalItems.length !== normalizedItems.length) return true;
  return originalItems.some(
    (item, index) =>
      item.productId !== normalizedItems[index]?.productId ||
      item.quantity !== normalizedItems[index]?.quantity
  );
}

function buildOrderResponse(order, now = new Date()) {
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

async function autoConfirmOrders(userId) {
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

async function ensureCart(userId) {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }
  return cart;
}

async function buildCartPayload(cart) {
  const productIds = cart.items.map((item) => item.productId);
  if (!productIds.length) {
    return {
      items: [],
      summary: { totalQuantity: 0, subtotal: 0, shippingFee: SHIPPING_FEE, total: 0 }
    };
  }
  const products = await Product.find({ id: { $in: productIds } }).lean();
  const productsMap = new Map(products.map((product) => [product.id, product]));
  const { items, summary, normalizedItems } = buildCartDetail(cart, productsMap);
  if (isCartChanged(cart.items, normalizedItems)) {
    cart.items = normalizedItems;
    await cart.save();
  }
  return { items, summary };
}

apiRouter.post("/auth/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password }).lean();

    if (!user || user.role !== "member") {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
    }

    const token = signMemberToken(user);
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000
    });

    return res.json({
      message: "Đăng nhập thành công",
      user: { username: user.username, fullName: user.fullName, role: user.role }
    });
  } catch (error) {
    return next(error);
  }
});

apiRouter.post("/auth/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ message: "Đã đăng xuất" });
});

apiRouter.get("/auth/me", requireMemberApi, (req, res) => {
  return res.json({ user: req.user });
});

apiRouter.get("/categories", async (req, res, next) => {
  try {
    const categories = await Product.distinct("category");
    categories.sort((a, b) => a.localeCompare(b));
    return res.json({ categories });
  } catch (error) {
    return next(error);
  }
});

apiRouter.get("/products", async (req, res, next) => {
  try {
    const { filter, sortOption } = buildProductFilter(req.query);
    const { pageNumber, limitNumber, skip } = parsePagination(req.query, 8);

    const [total, data] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort(sortOption).skip(skip).limit(limitNumber).lean()
    ]);

    const totalPages = Math.max(Math.ceil(total / limitNumber), 1);

    return res.json({
      data,
      meta: { total, page: pageNumber, limit: limitNumber, totalPages }
    });
  } catch (error) {
    return next(error);
  }
});

apiRouter.get("/categories/:category/products", async (req, res, next) => {
  try {
    const category = (req.params.category || "").trim();
    if (!category) {
      return res.status(400).json({ message: "Danh mục không hợp lệ" });
    }

    const { pageNumber, limitNumber, skip } = parsePagination(req.query, 8);
    const filter = { category };

    const [total, data] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNumber).lean()
    ]);

    const totalPages = Math.max(Math.ceil(total / limitNumber), 1);
    return res.json({
      data,
      meta: { total, page: pageNumber, limit: limitNumber, totalPages, category }
    });
  } catch (error) {
    return next(error);
  }
});

apiRouter.get("/products/top", async (req, res, next) => {
  try {
    const type = req.query.type === "most-viewed" ? "most-viewed" : "best-selling";
    const sortOption = type === "most-viewed" ? { viewCount: -1, soldCount: -1 } : { soldCount: -1 };
    const { limitNumber } = parsePagination(req.query, 5);
    const total = Math.min(await Product.countDocuments({}), 10);
    const totalPages = Math.max(Math.ceil(total / limitNumber), 1);
    const pageNumber = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
    const skip = (pageNumber - 1) * limitNumber;
    const queryLimit = Math.max(Math.min(limitNumber, total - skip), 0);
    const topTenData =
      queryLimit > 0
        ? await Product.find({}).sort(sortOption).skip(skip).limit(queryLimit).lean()
        : [];

    return res.json({
      data: topTenData,
      meta: { total: Math.min(total, 10), page: pageNumber, limit: limitNumber, totalPages, type }
    });
  } catch (error) {
    return next(error);
  }
});

apiRouter.get("/products/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const product = await Product.findOneAndUpdate({ id }, { $inc: { viewCount: 1 } }, { new: true, lean: true });
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
    return res.json({ data: product });
  } catch (error) {
    return next(error);
  }
});

apiRouter.get("/cart", requireMemberApi, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const cart = await ensureCart(userId);
    const payload = await buildCartPayload(cart);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

apiRouter.post("/cart/items", requireMemberApi, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const productId = Number(req.body.productId);
    const quantity = Number(req.body.quantity) || 1;

    if (!productId || quantity <= 0) {
      return res.status(400).json({ message: "Sản phẩm hoặc số lượng không hợp lệ" });
    }

    const product = await Product.findOne({ id: productId }).lean();
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
    if (product.stock <= 0) {
      return res.status(400).json({ message: "Sản phẩm đã hết hàng" });
    }
    if (product.stock <= 0) {
      return res.status(400).json({ message: "Sản phẩm đã hết hàng" });
    }

    const cart = await ensureCart(userId);
    const existingItem = cart.items.find((item) => item.productId === productId);
    const newQty = Math.min((existingItem?.quantity || 0) + quantity, product.stock);
    if (existingItem) {
      existingItem.quantity = newQty;
    } else {
      cart.items.push({ productId, quantity: Math.min(quantity, product.stock) });
    }
    await cart.save();

    const payload = await buildCartPayload(cart);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

apiRouter.patch("/cart/items/:productId", requireMemberApi, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const productId = Number(req.params.productId);
    const quantity = Number(req.body.quantity);

    if (!productId || !Number.isFinite(quantity) || quantity < 1) {
      return res.status(400).json({ message: "Số lượng không hợp lệ" });
    }

    const product = await Product.findOne({ id: productId }).lean();
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const cart = await ensureCart(userId);
    const existingItem = cart.items.find((item) => item.productId === productId);
    if (!existingItem) {
      return res.status(404).json({ message: "Sản phẩm chưa có trong giỏ hàng" });
    }

    existingItem.quantity = Math.min(quantity, product.stock);
    await cart.save();

    const payload = await buildCartPayload(cart);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

apiRouter.delete("/cart/items/:productId", requireMemberApi, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const productId = Number(req.params.productId);
    if (!productId) {
      return res.status(400).json({ message: "Sản phẩm không hợp lệ" });
    }
    const cart = await ensureCart(userId);
    cart.items = cart.items.filter((item) => item.productId !== productId);
    await cart.save();
    const payload = await buildCartPayload(cart);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

apiRouter.delete("/cart", requireMemberApi, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const cart = await ensureCart(userId);
    cart.items = [];
    await cart.save();
    return res.json({ items: [], summary: { totalQuantity: 0, subtotal: 0, shippingFee: SHIPPING_FEE, total: 0 } });
  } catch (error) {
    return next(error);
  }
});

apiRouter.post("/orders", requireMemberApi, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { recipientName, phone, address, note, paymentMethod } = req.body;

    if (!recipientName || !phone || !address) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin nhận hàng" });
    }
    if (paymentMethod && paymentMethod !== "COD") {
      return res.status(400).json({ message: "Hiện chỉ hỗ trợ thanh toán COD" });
    }

    const cart = await ensureCart(userId);
    if (!cart.items.length) {
      return res.status(400).json({ message: "Giỏ hàng đang trống" });
    }

    const productIds = cart.items.map((item) => item.productId);
    const products = await Product.find({ id: { $in: productIds } }).lean();
    const productsMap = new Map(products.map((product) => [product.id, product]));

    const orderItems = [];
    let subtotal = 0;
    for (const item of cart.items) {
      const product = productsMap.get(item.productId);
      if (!product) {
        return res.status(400).json({ message: "Giỏ hàng có sản phẩm không tồn tại" });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Sản phẩm ${product.name} không đủ tồn kho` });
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
      code: createOrderCode(),
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

    return res.status(201).json({ data: buildOrderResponse(order, now) });
  } catch (error) {
    return next(error);
  }
});

apiRouter.get("/orders", requireMemberApi, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await autoConfirmOrders(userId);
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean();
    const now = new Date();
    return res.json({ data: orders.map((order) => buildOrderResponse(order, now)) });
  } catch (error) {
    return next(error);
  }
});

apiRouter.get("/orders/:id", requireMemberApi, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await autoConfirmOrders(userId);
    const order = await Order.findOne({ _id: req.params.id, userId }).lean();
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }
    return res.json({ data: buildOrderResponse(order) });
  } catch (error) {
    return next(error);
  }
});

apiRouter.post("/orders/:id/cancel", requireMemberApi, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const order = await Order.findOne({ _id: req.params.id, userId });
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const now = new Date();
    const withinCancelWindow = now - new Date(order.createdAt) <= AUTO_CONFIRM_MINUTES * 60 * 1000;
    if (!withinCancelWindow) {
      return res.status(400).json({ message: "Chỉ được hủy trong 30 phút đầu sau khi đặt hàng" });
    }

    if ([ORDER_STATUS.SHIPPING, ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELED].includes(order.status)) {
      return res.status(400).json({ message: "Đơn hàng không thể hủy ở trạng thái hiện tại" });
    }

    if (order.status === ORDER_STATUS.PREPARING) {
      order.status = ORDER_STATUS.CANCEL_REQUESTED;
      order.statusHistory.push({
        status: ORDER_STATUS.CANCEL_REQUESTED,
        note: "Gửi yêu cầu hủy đơn cho shop",
        at: now
      });
      await order.save();
      return res.json({ data: buildOrderResponse(order, now) });
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

      return res.json({ data: buildOrderResponse(order, now) });
    }

    return res.status(400).json({ message: "Đơn hàng không thể hủy ở trạng thái hiện tại" });
  } catch (error) {
    return next(error);
  }
});

apiRouter.patch("/orders/:id/status", requireMemberApi, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const order = await Order.findOne({ _id: req.params.id, userId });
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const progression = {
      [ORDER_STATUS.NEW]: ORDER_STATUS.CONFIRMED,
      [ORDER_STATUS.CONFIRMED]: ORDER_STATUS.PREPARING,
      [ORDER_STATUS.PREPARING]: ORDER_STATUS.SHIPPING,
      [ORDER_STATUS.SHIPPING]: ORDER_STATUS.DELIVERED
    };

    const nextStatus = progression[order.status];
    if (!nextStatus) {
      return res.status(400).json({ message: "Đơn hàng không thể chuyển trạng thái tiếp theo" });
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

    return res.json({ data: buildOrderResponse(order, now) });
  } catch (error) {
    return next(error);
  }
});

module.exports = { apiRouter };

