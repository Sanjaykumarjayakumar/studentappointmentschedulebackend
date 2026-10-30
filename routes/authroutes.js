const express = require("express");

const router = express.Router();

const {
  signUp,
  signIn,
  adminLogin,
  firebaseSignIn,
} = require("../controllers/authController");


// Patient registration
router.post(
  "/signup",
  signUp
);


// Patient / Doctor / Pharmacist login
router.post(
  "/signin",
  signIn
);

// Firebase patient sign-in / first-time registration
router.post(
  "/firebase",
  firebaseSignIn
);


// Admin login
router.post(
  "/adminlogin",
  adminLogin
);

module.exports = router;