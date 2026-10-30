const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  getDoctors,
  getDoctorById,
  getDoctorSlots,
  bookSlot,
  getMyAppointments,
  getMyBills,
} = require("../controllers/patientController");
const {
  getHospitals,
  getHospitalDoctors,
  getDoctorHospitals,
} = require("../controllers/hospitalController");

router.get("/doctors",protect,authorizeRoles("patient"),getDoctors);
router.get("/doctors/:doctorId", protect, authorizeRoles("patient"), getDoctorById);
router.get("/hospitals", protect, authorizeRoles("patient"), getHospitals);
router.get("/hospitals/:hospitalId/doctors", protect, authorizeRoles("patient"), getHospitalDoctors);
router.get("/doctors/:doctorId/hospitals", protect, authorizeRoles("patient"), getDoctorHospitals);
router.get("/doctors/:doctorId/slots/:date",protect,authorizeRoles("patient"),getDoctorSlots);
router.post(
  "/appointments",
  protect,
  authorizeRoles("patient"),
  bookSlot
);
router.get("/appointments", protect, authorizeRoles("patient"), getMyAppointments);
router.get("/bills", protect, authorizeRoles("patient"), getMyBills);
module.exports = router;
