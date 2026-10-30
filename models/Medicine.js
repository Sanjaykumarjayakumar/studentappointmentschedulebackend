const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "",
    },
    unit: {
      type: String,
      trim: true,
      default: "units",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stockQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isInteger,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
      validate: Number.isInteger,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacist",
      required: true,
    },
  },
  { timestamps: true, collection: "medicines" }
);

medicineSchema.index({ stockQuantity: 1 });

module.exports = mongoose.model("Medicine", medicineSchema);