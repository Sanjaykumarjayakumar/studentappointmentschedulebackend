const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DoctorSlot",
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    time: {
      type: String,
      required: true,
    },

    tokenNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: [
        "booked",
        "completed",
        "cancelled",
      ],
      default: "booked",
    },
  },
  {
    timestamps: true,
  }
);

appointmentSchema.index(
  { patient: 1, doctor: 1, date: 1, time: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["booked", "completed"] } } }
);

module.exports = mongoose.model(
  "Appointment",
  appointmentSchema
);
