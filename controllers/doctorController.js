const DoctorSlot = require("../models/doctorSlot");
const Appointment = require("../models/Appointment");
const { Patient } = require("../models/User");

const searchPatients = async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (query.length < 2) return res.status(200).json({ patients: [] });

  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(escaped, "i");
    const patients = await Patient.find({
      isActive: { $ne: false },
      $or: [{ name: matcher }, { email: matcher }],
    })
      .select("name email")
      .sort({ name: 1 })
      .limit(25)
      .lean();

    return res.status(200).json({ patients });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to search patients" });
  }
};

const createSlots = async(req,res)=>{
    try{
        const {dates,startTime,endTime,maxAppointments} = req.body;
        if(!dates || !startTime || !endTime || !maxAppointments){
            return res.status(400).json({message:"All fields are required"});
        }
        if(!dates || !Array.isArray(dates) || dates.length === 0){
            return res.status(400).json({messag:"Please provide at least one date"});
        }
        if(!startTime){
            return res.status(400).json({message:"Please provide start time"});
        }
        if(!maxAppointments || maxAppointments < 1){
            return res.status(400).json({message:"Please provide valid max appointments"});
        }
        const createdSlots = [];
        for(const i of dates){
            try{
                const slot = await DoctorSlot.create({
                    doctor:req.user.id,
                    date:i,
                    startTime: startTime,
                    endTime: endTime || null,
                    maxAppointments: maxAppointments
                });
                createdSlots.push(slot);
            }
            catch(error){
                if(error.code === 11000){
                    return res.status(400).json({message:`Slot already exists for date ${i} and time ${startTime}`});
                }
                else{
                    throw error;
                }
            }
        }
        return res.status(201).json({message:"Slots created successfully",slots:createdSlots});
    }
    catch(error){
        return res.status(500).json({message:"Internal server error"});
    };
}

const getSlots = async(req,res)=>{
    try{
        const now = new Date();
        const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        let slots = await DoctorSlot.find({ doctor: req.user.id, status: "available", date: { $gte: today } }).sort({ date: 1, startTime: 1 });
        slots = slots.filter((slot) => slot.date !== today || (slot.endTime || slot.startTime) > currentTime);
        return res.status(200).json({message:"Slots retrieved successfully",slots:slots});
    }
    catch(error){
        return res.status(500).json({message:"Failed to fetch slots",error:error.message});
    }
}

const getSlotsByDate = async(req,res)=>{
    try{
        const {date} = req.params;
        const slots = await DoctorSlot.find({doctor:req.user.id,date:date});
        return res.status(200).json({message:"Slots retrieved successfully",slots:slots});
    }
    catch(error){
        return res.status(500).json({message:"Failed to fetch slots by date",error:error.message});
    }
}

const getMyAppointments = async (req, res) => {
  try {
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    let appointments = await Appointment.find({
      doctor: req.user.id,
      status: { $ne: "completed" },
      date: { $gte: today },
    })
      .populate("patient", "name email phone")
      .populate("slot", "date startTime endTime")
      .sort({ date: 1, time: 1, tokenNumber: 1 });
    appointments = appointments.filter((appointment) => appointment.date !== today || appointment.time.slice(-5) > currentTime);

    return res.status(200).json({
      message: "Doctor appointments retrieved successfully",
      appointments,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to fetch doctor appointments",
      error: error.message,
    });
  }
};

const cancelSlot = async (req, res) => {
  try {

    const { slotId } = req.params;

    // Make sure the slot belongs to the logged-in doctor
    const slot = await DoctorSlot.findOne({
      _id: slotId,
      doctor: req.user.id
    });

    if (!slot) {
      return res.status(404).json({
        message: "Slot not found"
      });
    }

    // Check if already cancelled
    if (slot.status === "cancelled") {
      return res.status(400).json({
        message: "Slot is already cancelled"
      });
    }

    // Cancel the slot
    slot.status = "cancelled";

    await slot.save();

    return res.status(200).json({
      message: "Slot cancelled successfully",
      slot: slot
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      message: "Failed to cancel slot",
      error: error.message
    });
  }
};

const createAppointmentForPatient = async (req, res) => {
  try {
    const { patientId, slotId } = req.body;

    if (!patientId) {
      return res.status(400).json({
        message: "Patient ID is required",
      });
    }

    if (!slotId) {
      return res.status(400).json({
        message: "Slot ID is required",
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    const requestedSlot = await DoctorSlot.findOne({ _id: slotId, doctor: req.user.id });
    if (!requestedSlot) return res.status(404).json({ message: "Slot not found" });
    const appointmentTime = requestedSlot.endTime
      ? `${requestedSlot.startTime}-${requestedSlot.endTime}`
      : requestedSlot.startTime;
    const duplicate = await Appointment.exists({
      patient: patient._id,
      doctor: req.user.id,
      date: requestedSlot.date,
      time: appointmentTime,
      status: { $ne: "cancelled" },
    });
    if (duplicate) return res.status(409).json({ message: "This patient already has an appointment with this doctor at that date and time." });

    const slot = await DoctorSlot.findOneAndUpdate(
      {
        _id: slotId,
        doctor: req.user.id,
        status: "available",
        $expr: {
          $lt: ["$bookedAppointments", "$maxAppointments"],
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

    let appointment;
    try {
      appointment = await Appointment.create({
        patient: patient._id,
        doctor: req.user.id,
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
      if (error.code === 11000) return res.status(409).json({ message: "This patient already has an appointment with this doctor at that date and time." });
      throw error;
    }

    if (slot.bookedAppointments >= slot.maxAppointments) {
      await DoctorSlot.findByIdAndUpdate(slot._id, {
        status: "full",
      });
    }

    return res.status(201).json({
      message: "Appointment created for patient successfully",
      appointment,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to create appointment",
      error: error.message,
    });
  }
};


// ======================================================
// EXPORT
// ======================================================

module.exports = {
  searchPatients,
  createSlots,
  getMySlots: getSlots,
  getMySlotsByDate: getSlotsByDate,
  getMyAppointments,
  cancelSlot,
  createAppointmentForPatient,
};
