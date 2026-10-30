const express = require("express");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  listMedicines,
  createMedicine,
  updateMedicine,
  updateMedicinePrice,
  deleteMedicine,
  adjustMedicineStock,
  recordMedicineSale,
  getLowStock,
  getWeeklyTopSelling,
  getDashboard,
  searchPatients,
  createPatientBill,
} = require("../controllers/pharmacistController");

const router = express.Router();
const pharmacistOnly = [protect, authorizeRoles("pharmacist")];

router.get("/dashboard", ...pharmacistOnly, getDashboard);
router.get("/patients/search", ...pharmacistOnly, searchPatients);
router.post("/bills", ...pharmacistOnly, createPatientBill);
router.get("/medicines", ...pharmacistOnly, listMedicines);
router.post("/medicines", ...pharmacistOnly, createMedicine);
router.patch("/medicines/:medicineId", ...pharmacistOnly, updateMedicine);
router.patch("/medicines/:medicineId/price", ...pharmacistOnly, updateMedicinePrice);
router.delete("/medicines/:medicineId", ...pharmacistOnly, deleteMedicine);
router.get("/medicines/low-stock", ...pharmacistOnly, getLowStock);
router.get("/sales/top-week", ...pharmacistOnly, getWeeklyTopSelling);
router.patch("/medicines/:medicineId/stock", ...pharmacistOnly, adjustMedicineStock);
router.post("/medicines/:medicineId/sales", ...pharmacistOnly, recordMedicineSale);

module.exports = router;
