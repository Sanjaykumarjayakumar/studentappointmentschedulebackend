const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  createSlots,
  getMySlots,
  getMySlotsByDate,
  getMyAppointments,
  cancelSlot,
  createAppointmentForPatient,
  searchPatients,
} = require("../controllers/doctorController");


// Create slots
router.get(
  "/patients",
  protect,
  authorizeRoles("doctor"),
  searchPatients
);

router.post(
  "/slots",
  protect,
  authorizeRoles("doctor"),
  createSlots
);


// View all doctor's slots
router.get(
  "/slots",
  protect,
  authorizeRoles("doctor"),
  getMySlots
);


// View doctor's slots for a date
router.get(
  "/slots/:date",
  protect,
  authorizeRoles("doctor"),
  getMySlotsByDate
);


// Cancel a slot
router.put(
  "/slots/:slotId/cancel",
  protect,
  authorizeRoles("doctor"),
  cancelSlot
);

router.get(
  "/appointments",
  protect,
  authorizeRoles("doctor"),
  getMyAppointments
);

router.post(
  "/appointments",
  protect,
  authorizeRoles("doctor"),
  createAppointmentForPatient
);


module.exports = router;
