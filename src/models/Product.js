const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    slug: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true, trim: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number, required: true },
    rating: { type: Number, required: true },
    stock: { type: Number, required: true },
    soldCount: { type: Number, required: true },
    viewCount: { type: Number, required: true, default: 0 },
    isNew: { type: Boolean, required: true },
    bestSeller: { type: Boolean, required: true },
    createdAt: { type: Date, required: true },
    promoLabel: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    images: { type: [String], required: true }
  }
);

productSchema.index({ name: "text", description: "text", category: "text" });

const Product = mongoose.model("Product", productSchema);

module.exports = { Product };
