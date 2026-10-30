const mongoose = require("mongoose");

const patientBillSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    pharmacist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacist",
      required: true,
    },
    items: [
      {
        medicine: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Medicine",
          required: true,
        },
        medicineName: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
        unit: { type: String, default: "units", trim: true },
        unitPrice: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0 },
    billedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: "patient_bills" }
);

patientBillSchema.index({ patient: 1, billedAt: -1 });

module.exports = mongoose.model("PatientBill", patientBillSchema);
