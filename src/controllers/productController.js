const productService = require("../services/productService");

class ProductController {
  async getCategories(req, res, next) {
    try {
      const categories = await productService.getCategories();
      return res.json({ categories });
    } catch (error) {
      return next(error);
    }
  }

  async getProducts(req, res, next) {
    try {
      const result = await productService.getProducts(req.query);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getProductsByCategory(req, res, next) {
    try {
      const result = await productService.getProductsByCategory(req.params.category, req.query);
      return res.json(result);
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({ message: error.message });
    }
  }

  async getTopProducts(req, res, next) {
    try {
      const result = await productService.getTopProducts(req.query);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getProductById(req, res, next) {
    try {
      const id = Number(req.params.id);
      const product = await productService.getProductById(id);
      return res.json({ data: product });
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({ message: error.message });
    }
  }

  async deleteProduct(req, res, next) {
    try {
      const id = Number(req.params.id);
      const product = await productService.deleteProduct(id);
      return res.json({ message: "Xóa sản phẩm thành công", data: product });
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({ message: error.message });
    }
  }
}

module.exports = new ProductController();
