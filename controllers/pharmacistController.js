const mongoose = require("mongoose");
const Medicine = require("../models/Medicine");
const MedicineTransaction = require("../models/MedicineTransaction");
const PatientBill = require("../models/PatientBill");
const { Patient } = require("../models/User");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const isNonNegativeInteger = (value) =>
  Number.isInteger(value) && value >= 0;
const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;
const isValidPrice = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;

const searchPatients = async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (query.length < 2) return res.status(200).json({ patients: [] });
  try {
    const matcher = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const patients = await Patient.find({
      isActive: { $ne: false },
      $or: [{ name: matcher }, { email: matcher }],
    }).select("name email").sort({ name: 1 }).limit(25).lean();
    return res.status(200).json({ patients });
  } catch (error) {
    console.error("Search patients for bill error:", error);
    return res.status(500).json({ message: "Failed to search patients" });
  }
};

const createPatientBill = async (req, res) => {
  const changedStock = [];
  let bill = null;
  try {
    const { patientId, items } = req.body;
    if (!isValidId(patientId)) return res.status(400).json({ message: "Select a valid patient" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Add at least one medicine to the bill" });
    }

    const quantities = new Map();
    for (const item of items) {
      if (!isValidId(item?.medicineId) || !isPositiveInteger(item?.quantity)) {
        return res.status(400).json({ message: "Each medicine needs a valid selection and a positive whole-number quantity" });
      }
      quantities.set(item.medicineId, (quantities.get(item.medicineId) || 0) + item.quantity);
    }

    const patient = await Patient.findOne({ _id: patientId, isActive: { $ne: false } }).select("_id");
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    const medicines = await Medicine.find({ _id: { $in: [...quantities.keys()] } });
    if (medicines.length !== quantities.size) return res.status(404).json({ message: "One or more medicines could not be found" });
    const byId = new Map(medicines.map((medicine) => [String(medicine._id), medicine]));

    const billItems = [...quantities].map(([medicineId, quantity]) => {
      const medicine = byId.get(medicineId);
      if (!isValidPrice(medicine.price)) {
        const error = new Error(`Set a valid price for ${medicine.name} before creating a bill`);
        error.statusCode = 409;
        throw error;
      }
      return {
        medicine: medicine._id,
        medicineName: medicine.name,
        quantity,
        unit: medicine.unit,
        unitPrice: medicine.price,
      };
    });
    const totalCents = billItems.reduce(
      (total, item) => total + Math.round(item.unitPrice * 100) * item.quantity,
      0
    );
    if (!Number.isSafeInteger(totalCents)) {
      return res.status(400).json({ message: "Bill total is too large to process" });
    }

    for (const [medicineId, quantity] of quantities) {
      const medicine = byId.get(medicineId);
      const updated = await Medicine.findOneAndUpdate(
        { _id: medicineId, stockQuantity: { $gte: quantity } },
        { $inc: { stockQuantity: -quantity } },
        { new: true, runValidators: true }
      );
      if (!updated) {
        const error = new Error(`${medicine.name} does not have enough stock`);
        error.statusCode = 409;
        throw error;
      }
      changedStock.push({ medicineId, quantity });
    }

    bill = await PatientBill.create({
      patient: patient._id,
      pharmacist: req.user.id,
      items: billItems,
      totalAmount: totalCents / 100,
    });
    await MedicineTransaction.insertMany(billItems.map((item) => ({
      medicine: item.medicine,
      medicineName: item.medicineName,
      type: "sale",
      quantity: item.quantity,
      pharmacist: req.user.id,
      bill: bill._id,
      note: `Patient bill ${bill._id}`,
    })));

    return res.status(201).json({ message: "Patient bill created", bill });
  } catch (error) {
    if (bill) {
      await MedicineTransaction.deleteMany({ bill: bill._id }).catch(() => {});
      await PatientBill.deleteOne({ _id: bill._id }).catch(() => {});
    }
    await Promise.all(changedStock.map(({ medicineId, quantity }) =>
      Medicine.updateOne({ _id: medicineId }, { $inc: { stockQuantity: quantity } }).catch(() => {})
    ));
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error("Create patient bill error:", error);
    return res.status(500).json({ message: "Failed to create patient bill" });
  }
};

const getLowStockMedicines = () =>
  Medicine.find({
    $expr: { $lte: ["$stockQuantity", "$lowStockThreshold"] },
  }).sort({ stockQuantity: 1, name: 1 });

const getTopSellingMedicines = (since) =>
  MedicineTransaction.aggregate([
    { $match: { type: "sale", occurredAt: { $gte: since } } },
    {
      $group: {
        _id: "$medicine",
        name: { $first: "$medicineName" },
        quantitySold: { $sum: "$quantity" },
      },
    },
    { $sort: { quantitySold: -1, name: 1 } },
    { $limit: 10 },
    { $project: { _id: 0, medicineId: "$_id", name: 1, quantitySold: 1 } },
  ]);

const listMedicines = async (req, res) => {
  try {
    const medicines = await Medicine.find().sort({ name: 1 });
    return res.status(200).json({ medicines });
  } catch (error) {
    console.error("List medicines error:", error);
    return res.status(500).json({ message: "Failed to fetch medicines" });
  }
};

const createMedicine = async (req, res) => {
  try {
    const {
      name,
      description = "",
      category = "",
      unit = "units",
      stockQuantity = 0,
      lowStockThreshold = 10,
    } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Medicine name is required" });
    }
    if (
      !isNonNegativeInteger(stockQuantity) ||
      !isNonNegativeInteger(lowStockThreshold)
    ) {
      return res.status(400).json({
        message: "Stock quantity and low-stock threshold must be non-negative integers",
      });
    }
    if (!isValidPrice(req.body.price)) {
      return res.status(400).json({ message: "Price must be a non-negative amount with at most two decimal places" });
    }
    if (typeof unit !== "string" || !unit.trim()) {
      return res.status(400).json({ message: "Unit must be a non-empty string" });
    }

    const trimmedName = name.trim();
    const medicine = await Medicine.create({
      name: trimmedName,
      normalizedName: trimmedName.toLowerCase(),
      description,
      category,
      unit: unit.trim(),
      price: req.body.price,
      stockQuantity,
      lowStockThreshold,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      message: "Medicine added successfully",
      medicine,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Medicine already exists" });
    }
    console.error("Create medicine error:", error);
    return res.status(500).json({ message: "Failed to add medicine" });
  }
};

const updateMedicine = async (req, res) => {
  let stockTransaction = null;
  try {
    const { medicineId } = req.params;
    const {
      name,
      description,
      category,
      unit,
      price,
      stockQuantity,
      lowStockThreshold,
    } = req.body;

    if (!isValidId(medicineId)) {
      return res.status(400).json({ message: "Invalid medicine ID" });
    }
    if (typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ message: "Medicine name must be at least 2 characters" });
    }
    if (typeof description !== "string" || typeof category !== "string") {
      return res.status(400).json({ message: "Description and category must be strings" });
    }
    if (typeof unit !== "string" || !unit.trim()) {
      return res.status(400).json({ message: "Unit must be a non-empty string" });
    }
    if (
      !isNonNegativeInteger(stockQuantity) ||
      !isNonNegativeInteger(lowStockThreshold)
    ) {
      return res.status(400).json({
        message: "Stock quantity and low-stock threshold must be non-negative integers",
      });
    }
    if (!isValidPrice(price)) {
      return res.status(400).json({
        message: "Price must be a non-negative amount with at most two decimal places",
      });
    }

    const current = await Medicine.findById(medicineId);
    if (!current) return res.status(404).json({ message: "Medicine not found" });

    const stockChange = stockQuantity - current.stockQuantity;
    if (stockChange !== 0) {
      stockTransaction = await MedicineTransaction.create({
        medicine: current._id,
        medicineName: name.trim(),
        type: stockChange > 0 ? "restock" : "adjustment",
        quantity: Math.abs(stockChange),
        pharmacist: req.user.id,
        note: "Stock quantity changed while editing medicine details",
      });
    }

    const medicine = await Medicine.findOneAndUpdate(
      { _id: medicineId, stockQuantity: current.stockQuantity },
      {
        $set: {
          name: name.trim(),
          normalizedName: name.trim().toLowerCase(),
          description: description.trim(),
          category: category.trim(),
          unit: unit.trim(),
          price,
          stockQuantity,
          lowStockThreshold,
        },
      },
      { new: true, runValidators: true }
    );

    if (!medicine) {
      if (stockTransaction) {
        await MedicineTransaction.deleteOne({ _id: stockTransaction._id });
      }
      return res.status(409).json({
        message: "Medicine stock changed while you were editing. Reload and try again.",
      });
    }

    return res.status(200).json({ message: "Medicine updated successfully", medicine });
  } catch (error) {
    if (stockTransaction) {
      try {
        await MedicineTransaction.deleteOne({ _id: stockTransaction._id });
      } catch (rollbackError) {
        console.error("Remove incomplete medicine update transaction error:", rollbackError);
      }
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: "A medicine with that name already exists" });
    }
    console.error("Update medicine error:", error);
    return res.status(500).json({ message: "Failed to update medicine" });
  }
};

const updateMedicinePrice = async (req, res) => {
  try {
    const { medicineId } = req.params;
    const { price } = req.body;
    if (!isValidId(medicineId)) {
      return res.status(400).json({ message: "Invalid medicine ID" });
    }
    if (!isValidPrice(price)) {
      return res.status(400).json({ message: "Price must be a non-negative amount with at most two decimal places" });
    }

    const medicine = await Medicine.findByIdAndUpdate(
      medicineId,
      { $set: { price } },
      { new: true, runValidators: true }
    );
    if (!medicine) return res.status(404).json({ message: "Medicine not found" });
    return res.status(200).json({ message: "Medicine price updated", medicine });
  } catch (error) {
    console.error("Update medicine price error:", error);
    return res.status(500).json({ message: "Failed to update medicine price" });
  }
};

const adjustMedicineStock = async (req, res) => {
  try {
    const { medicineId } = req.params;
    const { action, quantity, reason = "" } = req.body;

    if (!isValidId(medicineId)) {
      return res.status(400).json({ message: "Invalid medicine ID" });
    }
    if (!["add", "reduce"].includes(action) || !isPositiveInteger(quantity)) {
      return res.status(400).json({
        message: "Action must be 'add' or 'reduce' and quantity must be a positive integer",
      });
    }
    if (typeof reason !== "string") {
      return res.status(400).json({ message: "Reason must be a string" });
    }

    const update = action === "add"
      ? { $inc: { stockQuantity: quantity } }
      : { $inc: { stockQuantity: -quantity } };
    const filter = { _id: medicineId };
    if (action === "reduce") filter.stockQuantity = { $gte: quantity };

    const medicine = await Medicine.findOneAndUpdate(filter, update, {
      new: true,
      runValidators: true,
    });
    if (!medicine) {
      const exists = await Medicine.exists({ _id: medicineId });
      return exists
        ? res.status(409).json({ message: "Insufficient stock" })
        : res.status(404).json({ message: "Medicine not found" });
    }

    try {
      await MedicineTransaction.create({
        medicine: medicine._id,
        medicineName: medicine.name,
        type: action === "add" ? "restock" : "adjustment",
        quantity,
        pharmacist: req.user.id,
        note: reason.trim(),
      });
    } catch (error) {
      await Medicine.updateOne(
        { _id: medicine._id },
        { $inc: { stockQuantity: action === "add" ? -quantity : quantity } }
      );
      throw error;
    }

    return res.status(200).json({
      message: action === "add" ? "Stock added successfully" : "Stock reduced successfully",
      medicine,
    });
  } catch (error) {
    console.error("Adjust medicine stock error:", error);
    return res.status(500).json({ message: "Failed to adjust medicine stock" });
  }
};

const recordMedicineSale = async (req, res) => {
  try {
    const { medicineId } = req.params;
    const { quantity, note = "" } = req.body;

    if (!isValidId(medicineId)) {
      return res.status(400).json({ message: "Invalid medicine ID" });
    }
    if (!isPositiveInteger(quantity)) {
      return res.status(400).json({ message: "Quantity must be a positive integer" });
    }
    if (typeof note !== "string") {
      return res.status(400).json({ message: "Note must be a string" });
    }

    const medicine = await Medicine.findOneAndUpdate(
      { _id: medicineId, stockQuantity: { $gte: quantity } },
      { $inc: { stockQuantity: -quantity } },
      { new: true, runValidators: true }
    );

    if (!medicine) {
      const exists = await Medicine.exists({ _id: medicineId });
      return exists
        ? res.status(409).json({ message: "Insufficient stock" })
        : res.status(404).json({ message: "Medicine not found" });
    }

    let transaction;
    try {
      transaction = await MedicineTransaction.create({
        medicine: medicine._id,
        medicineName: medicine.name,
        type: "sale",
        quantity,
        pharmacist: req.user.id,
        note: note.trim(),
      });
    } catch (error) {
      await Medicine.updateOne(
        { _id: medicine._id },
        { $inc: { stockQuantity: quantity } }
      );
      throw error;
    }

    return res.status(201).json({
      message: "Medicine sale recorded successfully",
      medicine,
      transaction,
    });
  } catch (error) {
    console.error("Record medicine sale error:", error);
    return res.status(500).json({ message: "Failed to record medicine sale" });
  }
};

const getLowStock = async (req, res) => {
  try {
    const medicines = await getLowStockMedicines();
    return res.status(200).json({ medicines });
  } catch (error) {
    console.error("Get low stock error:", error);
    return res.status(500).json({ message: "Failed to fetch low-stock medicines" });
  }
};

const getWeeklyTopSelling = async (req, res) => {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const medicines = await getTopSellingMedicines(since);
    return res.status(200).json({
      period: { from: since, to: now },
      medicines,
    });
  } catch (error) {
    console.error("Get weekly medicine sales error:", error);
    return res.status(500).json({ message: "Failed to fetch weekly medicine sales" });
  }
};

const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [lowStockMedicines, topSellingMedicines] = await Promise.all([
      getLowStockMedicines(),
      getTopSellingMedicines(since),
    ]);

    return res.status(200).json({
      lowStockMedicines,
      lowStockCount: lowStockMedicines.length,
      topSellingMedicines,
      salesPeriod: { from: since, to: now },
    });
  } catch (error) {
    console.error("Get pharmacist dashboard error:", error);
    return res.status(500).json({ message: "Failed to fetch pharmacist dashboard" });
  }
};

const deleteMedicine = async (req, res) => {
  try {
    const { medicineId } = req.params;
    if (!isValidId(medicineId)) {
      return res.status(400).json({ message: "Invalid medicine ID" });
    }

    const medicine = await Medicine.findById(medicineId);
    if (!medicine) {
      return res.status(404).json({ message: "Medicine not found" });
    }

    const hasTransactions = await MedicineTransaction.exists({ medicine: medicineId });
    if (hasTransactions) {
      return res.status(409).json({
        message: "This medicine has stock history and cannot be deleted. Reduce its stock to zero instead.",
      });
    }

    await medicine.deleteOne();
    return res.status(200).json({ message: "Medicine deleted successfully" });
  } catch (error) {
    console.error("Delete medicine error:", error);
    return res.status(500).json({ message: "Failed to delete medicine" });
  }
};

module.exports = {
  searchPatients,
  createPatientBill,
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
};
