const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Hospital = require("../models/Hospital");
const HospitalAccount = require("../models/HospitalAccount");
const { Doctor, Pharmacist } = require("../models/User");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const createHospital = async (req, res) => {
  try {
    const {
      name,
      address,
      phone,
      email,
      website,
      image,
      loginEmail,
      password,
    } = req.body;

    if (!name || !address || !phone || !loginEmail || !password) {
      return res.status(400).json({
        message: "Name, address, phone, loginEmail and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedLoginEmail = loginEmail.toLowerCase().trim();
    const existingAccount = await HospitalAccount.findOne({
      email: normalizedLoginEmail,
    });

    if (existingAccount) {
      return res.status(400).json({ message: "Hospital login email already exists" });
    }

    const hospital = await Hospital.create({
      name,
      address,
      phone,
      email,
      website,
      image,
    });

    try {
      await HospitalAccount.create({
        hospital: hospital._id,
        email: normalizedLoginEmail,
        password: await bcrypt.hash(password, 10),
      });
    } catch (error) {
      await Hospital.findByIdAndDelete(hospital._id);
      throw error;
    }

    return res.status(201).json({
      message: "Hospital created successfully",
      hospital,
    });
  } catch (error) {
    console.error("Create hospital error:", error);
    return res.status(500).json({
      message: "Failed to create hospital",
      error: error.message,
    });
  }
};

const createStaffForHospital = (Model, role, staffLabel) => async (req, res) => {
  try {
    const { name, email, password, phone, speciality, image } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingStaff = await Model.findOne({ email: normalizedEmail });
    if (existingStaff) {
      return res.status(400).json({ message: `${staffLabel} already exists` });
    }

    const staff = await Model.create({
      name,
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      role,
      phone,
      speciality: role === "doctor" ? speciality : undefined,
      image,
      hospitals: [req.user.hospitalId],
      isActive: true,
    });

    const response = staff.toObject();
    delete response.password;
    return res.status(201).json({
      message: `${staffLabel} created successfully`,
      [role]: response,
    });
  } catch (error) {
    console.error(`Create ${staffLabel} error:`, error);
    return res.status(500).json({
      message: `Failed to create ${staffLabel}`,
      error: error.message,
    });
  }
};

const createDoctorForHospital = createStaffForHospital(Doctor, "doctor", "Doctor");
const createPharmacistForHospital = createStaffForHospital(
  Pharmacist,
  "pharmacist",
  "Pharmacist"
);

const assignDoctorToHospitals = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { hospitalIds } = req.body;

    if (!isValidId(doctorId) || !Array.isArray(hospitalIds)) {
      return res.status(400).json({
        message: "A valid doctor ID and hospitalIds array are required",
      });
    }

    if (!hospitalIds.every(isValidId)) {
      return res.status(400).json({
        message: "Every hospital ID must be valid",
      });
    }

    const uniqueHospitalIds = [...new Set(hospitalIds)];
    const hospitals = await Hospital.find({
      _id: { $in: uniqueHospitalIds },
      isActive: true,
    });

    if (hospitals.length !== uniqueHospitalIds.length) {
      return res.status(404).json({
        message: "One or more hospitals were not found",
      });
    }

    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { hospitals: uniqueHospitalIds },
      { new: true, runValidators: true }
    ).select("-password").populate("hospitals");

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    return res.status(200).json({
      message: "Doctor hospitals updated successfully",
      doctor,
    });
  } catch (error) {
    console.error("Assign doctor hospitals error:", error);
    return res.status(500).json({
      message: "Failed to update doctor hospitals",
      error: error.message,
    });
  }
};

const getHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find({ isActive: true }).sort({ name: 1 });
    return res.status(200).json({ hospitals });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch hospitals",
      error: error.message,
    });
  }
};

const getHospitalDoctors = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    if (!isValidId(hospitalId)) {
      return res.status(400).json({ message: "Invalid hospital ID" });
    }

    const hospital = await Hospital.findOne({ _id: hospitalId, isActive: true });
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    const doctors = await Doctor.find({
      hospitals: hospitalId,
      isActive: true,
    })
      .select("name email phone speciality image hospitals")
      .populate("hospitals", "name address phone email website image")
      .sort({ name: 1 });

    return res.status(200).json({ hospital, doctors });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch hospital doctors",
      error: error.message,
    });
  }
};

const getDoctorHospitals = async (req, res) => {
  try {
    const { doctorId } = req.params;

    if (!isValidId(doctorId)) {
      return res.status(400).json({ message: "Invalid doctor ID" });
    }

    const doctor = await Doctor.findOne({ _id: doctorId, isActive: true })
      .select("name email phone speciality image hospitals")
      .populate("hospitals", "name address phone email website image");

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    return res.status(200).json({
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        speciality: doctor.speciality,
        image: doctor.image,
      },
      hospitals: doctor.hospitals,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch doctor hospitals",
      error: error.message,
    });
  }
};

module.exports = {
  createHospital,
  assignDoctorToHospitals,
  getHospitals,
  getHospitalDoctors,
  getDoctorHospitals,
  createDoctorForHospital,
  createPharmacistForHospital,
};
