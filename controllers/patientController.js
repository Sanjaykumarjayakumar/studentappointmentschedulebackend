const {Doctor} = require("../models/User");
const mongoose = require("mongoose");
const DoctorSlot = require("../models/doctorSlot");
const Appointment = require("../models/Appointment");
const PatientBill = require("../models/PatientBill");
const getDoctors = async(req,res)=>{
    try{
        const doctors = await Doctor.find({isActive:true})
          .select("name email phone role speciality image hospitals")
          .populate("hospitals", "name address phone email website image")
          .sort({name:1});
        res.status(200).json({
            message:"Doctors fetched successfully",
            doctors:doctors,
        });
    }
    catch(error){
        console.error("Get doctors error:",error);
        res.status(500).json({
            message:"Server error",
        });
    }
};

const getDoctorById = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.doctorId)) {
    return res.status(404).json({ message: "Doctor not found" });
  }
  try {
    const doctor = await Doctor.findOne({ _id: req.params.doctorId, isActive: true })
      .select("name email phone role speciality image hospitals")
      .populate("hospitals", "name address phone email website image")
      .lean();
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    return res.status(200).json({ doctor });
  } catch (error) {
    console.error("Get doctor details error:", error);
    return res.status(500).json({ message: "Failed to fetch doctor details" });
  }
};

const getDoctorSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.params;
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (date < today) return res.status(200).json({ message: "No future slots available", slots: [] });

    let slots = await DoctorSlot.find({
      doctor: doctorId,
      date: date,
      status: { $ne: "cancelled" },
    }).sort({
      startTime: 1,
    });
    if (date === today) slots = slots.filter((slot) => (slot.endTime || slot.startTime) > currentTime);

    res.status(200).json({
      message: "Available slots fetched successfully",
      slots,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch slots",
      error: error.message,
    });
  }
};

const bookSlot = async (req, res) => {
  try {
    const { slotId } = req.body;
    const requestedSlot = await DoctorSlot.findOne({
      _id: slotId,
      status: "available",
      $expr: { $lt: ["$bookedAppointments", "$maxAppointments"] },
    });
    if (!requestedSlot) return res.status(400).json({ message: "Slot is full, cancelled, or unavailable" });

    const appointmentTime = requestedSlot.endTime
      ? `${requestedSlot.startTime}-${requestedSlot.endTime}`
      : requestedSlot.startTime;
    const duplicate = await Appointment.exists({
      patient: req.user.id,
      doctor: requestedSlot.doctor,
      date: requestedSlot.date,
      time: appointmentTime,
      status: { $ne: "cancelled" },
    });
    if (duplicate) return res.status(409).json({ message: "You already have an appointment with this doctor at that date and time." });

    // Find an available slot
    const slot = await DoctorSlot.findOneAndUpdate(
      {
        _id: slotId,
        status: "available",
        $expr: {
          $lt: [
            "$bookedAppointments",
            "$maxAppointments"
          ],
        },
      },
      {
        $inc: {
          bookedAppointments: 1,
        },
      },
      {
        new: true,
      }
    );

    if (!slot) {
      return res.status(400).json({
        message: "Slot is full, cancelled, or unavailable",
      });
    }

    // Create appointment
    let appointment;
    try {
      appointment = await Appointment.create({
        patient: req.user.id,
        doctor: slot.doctor,
        slot: slot._id,
        date: slot.date,
        time: appointmentTime,
        tokenNumber: slot.bookedAppointments,
        status: "booked",
      });
    } catch (error) {
      await DoctorSlot.findByIdAndUpdate(slot._id, {
        $inc: { bookedAppointments: -1 },
        $set: { status: "available" },
      });
      if (error.code === 11000) return res.status(409).json({ message: "You already have an appointment with this doctor at that date and time." });
      throw error;
    }

    // If maximum appointments reached
    if (
      slot.bookedAppointments >=
      slot.maxAppointments
    ) {
      await DoctorSlot.findByIdAndUpdate(
        slot._id,
        {
          status: "full",
        }
      );
    }

    res.status(201).json({
      message: "Appointment booked successfully",
      appointment,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to book appointment",
      error: error.message,
    });
  }
};

const getMyAppointments = async (req, res) => {
  try {
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    let appointments = await Appointment.find({ patient: req.user.id, status: { $ne: "completed" }, date: { $gte: today } })
      .populate("doctor", "name speciality image")
      .sort({ date: 1, time: 1, tokenNumber: 1 });
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    appointments = appointments.filter((appointment) => appointment.date !== today || appointment.time.slice(-5) > currentTime);
    return res.status(200).json({ appointments });
  } catch (error) {
    console.error("Get patient appointments error:", error);
    return res.status(500).json({ message: "Failed to fetch appointments" });
  }
};

const getMyBills = async (req, res) => {
  try {
    const bills = await PatientBill.find({ patient: req.user.id })
      .populate("pharmacist", "name")
      .sort({ billedAt: -1 })
      .lean();
    return res.status(200).json({ bills });
  } catch (error) {
    console.error("Get patient bills error:", error);
    return res.status(500).json({ message: "Failed to fetch bills" });
  }
};

module.exports = { getDoctors, getDoctorById, getDoctorSlots, bookSlot, getMyAppointments, getMyBills };
