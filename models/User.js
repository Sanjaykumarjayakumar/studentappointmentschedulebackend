const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    role: {
      type: String,
      enum: ["patient", "doctor", "pharmacist", "admin"],
      required: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    speciality: {
      type: String,
      trim: true,
    },

    image: {
      type: String,
      trim: true,
    },

    hospitals: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    }],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Patient = mongoose.model(
  "Patient",
  userSchema,
  "patient_users"
);

const Doctor = mongoose.model(
  "Doctor",
  userSchema,
  "doctor_users"
);

const Pharmacist = mongoose.model(
  "Pharmacist",
  userSchema,
  "pharmacist_users"
);

const Admin = mongoose.model(
  "Admin",
  userSchema,
  "admin_users"
);

const modelsByRole = {
  patient: Patient,
  doctor: Doctor,
  pharmacist: Pharmacist,
  admin: Admin,
};

const getUserModel = (role) => {
  return modelsByRole[role];
};

module.exports = {
  Patient,
  Doctor,
  Pharmacist,
  Admin,
  getUserModel,
};