const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const connectDB =
  require("./config/db");

const createDefaultAdmin =
  require("./config/defaultAdmin");

const authRoutes =
  require("./routes/authroutes");

const adminRoutes =
  require("./routes/adminroutes");
const patientRoutes = require("./routes/patientroutes");
const doctorRoutes = require("./routes/doctorRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const pharmacistRoutes = require("./routes/pharmacistRoutes");


const app = express();


/*
========================================
MIDDLEWARE
========================================
*/

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  express.json()
);


/*
========================================
START SERVER
========================================
*/

const startServer = async () => {

  try {

    // Connect MongoDB
    await connectDB();

    // Create default admin
    await createDefaultAdmin();


    /*
    ========================================
    ROUTES
    ========================================
    */

    app.use(
      "/api/auth",
      authRoutes
    );

    app.use(
      "/api/admin",
      adminRoutes
    );
    app.use("/api/patient",patientRoutes);
    app.use("/api/doctor", doctorRoutes);
    app.use("/api/hospital", hospitalRoutes);
    app.use("/api/pharmacist", pharmacistRoutes);


    /*
    ========================================
    TEST ROUTE
    ========================================
    */

    app.get("/", (req, res) => {
      res.json({
        message:
          "Student Health Center API is running",
      });
    });


    /*
    ========================================
    SERVER
    ========================================
    */

    const PORT =
      process.env.PORT || 5000;

    app.listen(
      PORT,
      () => {
        console.log(
          `Server running on port ${PORT}`
        );
      }
    );

  } catch (error) {

    console.error(
      "Server startup failed:",
      error
    );

    process.exit(1);
  }
};


startServer();