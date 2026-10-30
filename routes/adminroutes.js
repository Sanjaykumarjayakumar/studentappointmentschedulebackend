const express = require("express");

const router = express.Router();

const protect =
  require("../middleware/authMiddleware");

const authorizeRoles =
  require("../middleware/roleMiddleware");

const {
  createHospital,
} = require("../controllers/hospitalController");

router.post(
  "/hospitals",
  protect,
  authorizeRoles("admin"),
  createHospital
);

module.exports = router;