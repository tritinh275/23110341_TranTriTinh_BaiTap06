const { Product } = require("../models/Product");

class ProductService {
  _parseBoolean(value) {
    if (typeof value === "boolean") return value;
    if (typeof value !== "string") return false;
    return value.toLowerCase() === "true";
  }

  _buildProductFilter(query) {
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
    if (this._parseBoolean(onlyInStock)) filter.stock = { $gt: 0 };
    if (this._parseBoolean(isNew)) filter.isNew = true;
    if (this._parseBoolean(bestSeller)) filter.bestSeller = true;

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

  _parsePagination(query, fallbackLimit = 8) {
    const pageNumber = Math.max(Number(query.page) || 1, 1);
    const limitNumber = Math.max(Number(query.limit) || fallbackLimit, 1);
    return {
      pageNumber,
      limitNumber,
      skip: (pageNumber - 1) * limitNumber
    };
  }

  async getCategories() {
    const categories = await Product.distinct("category");
    categories.sort((a, b) => a.localeCompare(b));
    return categories;
  }

  async getProducts(query) {
    const { filter, sortOption } = this._buildProductFilter(query);
    const { pageNumber, limitNumber, skip } = this._parsePagination(query, 8);

    const [total, data] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort(sortOption).skip(skip).limit(limitNumber).lean()
    ]);

    const totalPages = Math.max(Math.ceil(total / limitNumber), 1);

    return {
      data,
      meta: { total, page: pageNumber, limit: limitNumber, totalPages }
    };
  }

  async getProductsByCategory(categoryName, query) {
    const category = (categoryName || "").trim();
    if (!category) {
      const err = new Error("Danh mục không hợp lệ");
      err.statusCode = 400;
      throw err;
    }

    const { pageNumber, limitNumber, skip } = this._parsePagination(query, 8);
    const filter = { category };

    const [total, data] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNumber).lean()
    ]);

    const totalPages = Math.max(Math.ceil(total / limitNumber), 1);
    return {
      data,
      meta: { total, page: pageNumber, limit: limitNumber, totalPages, category }
    };
  }

  async getTopProducts(query) {
    const type = query.type === "most-viewed" ? "most-viewed" : "best-selling";
    const sortOption = type === "most-viewed" ? { viewCount: -1, soldCount: -1 } : { soldCount: -1 };
    const { limitNumber } = this._parsePagination(query, 5);
    
    const total = Math.min(await Product.countDocuments({}), 10);
    const totalPages = Math.max(Math.ceil(total / limitNumber), 1);
    const pageNumber = Math.min(Math.max(Number(query.page) || 1, 1), totalPages);
    const skip = (pageNumber - 1) * limitNumber;
    const queryLimit = Math.max(Math.min(limitNumber, total - skip), 0);
    
    const topTenData =
      queryLimit > 0
        ? await Product.find({}).sort(sortOption).skip(skip).limit(queryLimit).lean()
        : [];

    return {
      data: topTenData,
      meta: { total: Math.min(total, 10), page: pageNumber, limit: limitNumber, totalPages, type }
    };
  }

  async getProductById(id) {
    const product = await Product.findOneAndUpdate(
      { id }, 
      { $inc: { viewCount: 1 } }, 
      { new: true, lean: true }
    );
    if (!product) {
      const err = new Error("Không tìm thấy sản phẩm");
      err.statusCode = 404;
      throw err;
    }
    return product;
  }

  async getProductByIdOrSlug(idOrSlug) {
    const byId = Number(idOrSlug);
    const filter = Number.isNaN(byId)
      ? { slug: idOrSlug }
      : { $or: [{ id: byId }, { slug: idOrSlug }] };
      
    const product = await Product.findOneAndUpdate(
      filter,
      { $inc: { viewCount: 1 } },
      { new: true, lean: true }
    );
    return product;
  }

  async getSimilarProducts(product, limit = 4) {
    return Product.find({
      id: { $ne: product.id },
      category: product.category
    })
      .limit(limit)
      .lean();
  }

  async getHomeData(limit = 8) {
    const [categories, products, productsCount, promotions, newest, bestSellers] = await Promise.all([
      Product.distinct("category"),
      Product.find({}).sort({ createdAt: -1 }).limit(limit).lean(),
      Product.countDocuments({}),
      Product.find({ $expr: { $gt: ["$originalPrice", "$price"] } }).limit(4).lean(),
      Product.find({}).sort({ createdAt: -1 }).limit(4).lean(),
      Product.find({}).sort({ soldCount: -1 }).limit(4).lean()
    ]);

    categories.sort((a, b) => a.localeCompare(b));

    return {
      categories,
      products,
      productsCount,
      promotions,
      newest,
      bestSellers
    };
  }

  async deleteProduct(id) {
    const product = await Product.findOneAndDelete({ id });
    if (!product) {
      const err = new Error("Không tìm thấy sản phẩm");
      err.statusCode = 404;
      throw err;
    }
    return product;
  }
}

module.exports = new ProductService();
