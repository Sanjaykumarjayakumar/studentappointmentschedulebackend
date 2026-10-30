const express = require("express");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  createDoctorForHospital,
  createPharmacistForHospital,
} = require("../controllers/hospitalController");

const router = express.Router();

router.post(
  "/doctors",
  protect,
  authorizeRoles("hospital"),
  createDoctorForHospital
);

router.post(
  "/pharmacists",
  protect,
  authorizeRoles("hospital"),
  createPharmacistForHospital
);

module.exports = router;
