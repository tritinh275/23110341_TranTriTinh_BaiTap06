const { Cart } = require("../models/Cart");
const { Product } = require("../models/Product");

const SHIPPING_FEE = 0;

class CartService {
  async ensureCart(userId) {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }
    return cart;
  }

  _buildCartDetail(cart, productsMap) {
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

  _isCartChanged(originalItems, normalizedItems) {
    if (originalItems.length !== normalizedItems.length) return true;
    return originalItems.some(
      (item, index) =>
        item.productId !== normalizedItems[index]?.productId ||
        item.quantity !== normalizedItems[index]?.quantity
    );
  }

  async buildCartPayload(cart) {
    const productIds = cart.items.map((item) => item.productId);
    if (!productIds.length) {
      return {
        items: [],
        summary: { totalQuantity: 0, subtotal: 0, shippingFee: SHIPPING_FEE, total: 0 }
      };
    }
    const products = await Product.find({ id: { $in: productIds } }).lean();
    const productsMap = new Map(products.map((product) => [product.id, product]));
    const { items, summary, normalizedItems } = this._buildCartDetail(cart, productsMap);
    if (this._isCartChanged(cart.items, normalizedItems)) {
      cart.items = normalizedItems;
      await cart.save();
    }
    return { items, summary };
  }

  async getCart(userId) {
    const cart = await this.ensureCart(userId);
    return this.buildCartPayload(cart);
  }

  async addToCart({ userId, productId, quantity }) {
    const product = await Product.findOne({ id: productId }).lean();
    if (!product) {
      const err = new Error("Không tìm thấy sản phẩm");
      err.statusCode = 404;
      throw err;
    }
    if (product.stock <= 0) {
      throw new Error("Sản phẩm đã hết hàng");
    }

    const cart = await this.ensureCart(userId);
    const existingItem = cart.items.find((item) => item.productId === productId);
    const newQty = Math.min((existingItem?.quantity || 0) + quantity, product.stock);
    
    if (existingItem) {
      existingItem.quantity = newQty;
    } else {
      cart.items.push({ productId, quantity: Math.min(quantity, product.stock) });
    }
    await cart.save();

    return this.buildCartPayload(cart);
  }

  async updateCartItem({ userId, productId, quantity }) {
    const product = await Product.findOne({ id: productId }).lean();
    if (!product) {
      const err = new Error("Không tìm thấy sản phẩm");
      err.statusCode = 404;
      throw err;
    }

    const cart = await this.ensureCart(userId);
    const existingItem = cart.items.find((item) => item.productId === productId);
    if (!existingItem) {
      const err = new Error("Sản phẩm chưa có trong giỏ hàng");
      err.statusCode = 404;
      throw err;
    }

    existingItem.quantity = Math.min(quantity, product.stock);
    await cart.save();

    return this.buildCartPayload(cart);
  }

  async deleteCartItem({ userId, productId }) {
    const cart = await this.ensureCart(userId);
    cart.items = cart.items.filter((item) => item.productId !== productId);
    await cart.save();
    return this.buildCartPayload(cart);
  }

  async clearCart(userId) {
    const cart = await this.ensureCart(userId);
    cart.items = [];
    await cart.save();
    return {
      items: [],
      summary: { totalQuantity: 0, subtotal: 0, shippingFee: SHIPPING_FEE, total: 0 }
    };
  }
}

module.exports = new CartService();
