const mongoose = require("mongoose");

const medicineTransactionSchema = new mongoose.Schema(
  {
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
      index: true,
    },
    medicineName: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["sale", "restock", "adjustment"],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },
    pharmacist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacist",
      required: true,
    },
    bill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientBill",
      default: null,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true, collection: "medicine_transactions" }
);

medicineTransactionSchema.index({ type: 1, occurredAt: -1 });

module.exports = mongoose.model(
  "MedicineTransaction",
  medicineTransactionSchema
);
