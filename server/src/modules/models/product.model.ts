import { model, Schema } from "mongoose";

const productSchema = new Schema(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "USD", uppercase: true },
    inventoryCount: { type: Number, required: true, min: 0 },
    images: { type: [String], default: [] },
    specifications: { type: Map, of: String, default: {} },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ name: "text", description: "text", sku: "text" });

export const Product = model("Product", productSchema);
