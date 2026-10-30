const bcrypt = require("bcryptjs");

const {
  Doctor,
  Pharmacist,
} = require("../models/User");

const sanitizeUser = (user) => {
  const userResponse =
    user.toObject();

  delete userResponse.password;

  return userResponse;
};


/*
========================================
CREATE DOCTOR
========================================
*/

const createDoctor = async (req, res) => {
  try {

    const {
      name,
      email,
      password,
      phone,
      speciality,
      image,
    } = req.body;

    if (
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters",
      });
    }

    const normalizedEmail =
      email.toLowerCase().trim();

    const existingDoctor =
      await Doctor.findOne({
        email: normalizedEmail,
      });

    if (existingDoctor) {
      return res.status(400).json({
        message:
          "Doctor already exists",
      });
    }

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );

    const doctor =
      await Doctor.create({
        name,
        email: normalizedEmail,
        password: hashedPassword,

        // Backend decides role
        role: "doctor",

        phone,
        speciality,
        image,
        isActive: true,
      });

    res.status(201).json({
      message:
        "Doctor created successfully",

      doctor:
        sanitizeUser(doctor),
    });

  } catch (error) {

    console.error(
      "Create doctor error:",
      error
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};


/*
========================================
CREATE PHARMACIST
========================================
*/

const createPharmacist =
  async (req, res) => {

    try {

      const {
        name,
        email,
        password,
        phone,
      } = req.body;

      if (
        !name ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          message:
            "Name, email and password are required",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          message:
            "Password must be at least 6 characters",
        });
      }

      const normalizedEmail =
        email.toLowerCase().trim();

      const existingPharmacist =
        await Pharmacist.findOne({
          email: normalizedEmail,
        });

      if (existingPharmacist) {
        return res.status(400).json({
          message:
            "Pharmacist already exists",
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      const pharmacist =
        await Pharmacist.create({
          name,
          email: normalizedEmail,
          password: hashedPassword,
          role: "pharmacist",
          phone,
          isActive: true,
        });

      res.status(201).json({
        message:
          "Pharmacist created successfully",

        pharmacist:
          sanitizeUser(pharmacist),
      });

    } catch (error) {

      console.error(
        "Create pharmacist error:",
        error
      );

      res.status(500).json({
        message: "Server error",
      });
    }
  };


module.exports = {
  createDoctor,
  createPharmacist,
};