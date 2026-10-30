const bcrypt = require("bcryptjs");
const { randomBytes } = require("crypto");
const jwt = require("jsonwebtoken");
const verifyFirebaseIdToken = require("../config/firebaseTokenVerifier");

const {
  Patient,
  Doctor,
  Pharmacist,
  Admin,
} = require("../models/User");
const HospitalAccount = require("../models/HospitalAccount");

const createToken = (user, additionalClaims = {}) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      ...additionalClaims,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );
};

const sanitizeUser = (user) => {
  const userResponse = user.toObject();

  delete userResponse.password;

  return userResponse;
};

const findUserByEmail = async (email) => {
  const [patient, doctor, pharmacist, admin, hospitalAccount] = await Promise.all([
    Patient.findOne({ email }),
    Doctor.findOne({ email }),
    Pharmacist.findOne({ email }),
    Admin.findOne({ email }),
    HospitalAccount.findOne({ email }).populate("hospital"),
  ]);

  return [patient, doctor, pharmacist, admin, hospitalAccount].filter(Boolean);
};

const getCredentials = (body) => ({
  email:
    typeof body.email === "string"
      ? body.email.toLowerCase().trim()
      : "",

  password: body.password,
});


/*
========================================
PATIENT SIGNUP
========================================
*/

const signUp = async (req, res) => {
  try {
    const { name, phone } = req.body;

    const { email, password } =
      getCredentials(req.body);

    if (!name || !email || !password) {
      return res.status(400).json({
        message:
          "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters",
      });
    }

    const matchingAccounts = await findUserByEmail(email);

    if (matchingAccounts.length > 0) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const user = await Patient.create({
      name,
      email,
      password: hashedPassword,
      role: "patient",
      phone,
      isActive: true,
    });

    res.status(201).json({
      message:
        "Patient registered successfully",

      token: createToken(user),

      user: sanitizeUser(user),
    });

  } catch (error) {
    console.error(
      "Signup error:",
      error
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};


/*
========================================
PATIENT / DOCTOR / PHARMACIST LOGIN
========================================
*/

const signIn = async (req, res) => {
  try {
    const { email, password } =
      getCredentials(req.body);

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password are required",
      });
    }

    const matchingAccounts = await findUserByEmail(email);

    if (matchingAccounts.length > 1) {
      return res.status(409).json({
        message: "This email is linked to multiple account roles. Contact an administrator to resolve the duplicate accounts.",
      });
    }

    const user = matchingAccounts[0];

    if (!user) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatch) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message:
          "Your account is inactive",
      });
    }

    const isHospital = user.role === "hospital";
    const userResponse = isHospital
      ? {
          _id: user._id,
          email: user.email,
          role: user.role,
          hospital: user.hospital,
        }
      : sanitizeUser(user);

    res.status(200).json({
      message: "Login successful",

      token: createToken(
        user,
        isHospital ? { hospitalId: user.hospital._id } : {}
      ),

      user: userResponse,
    });

  } catch (error) {
    console.error(
      "Signin error:",
      error
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};


/*
========================================
ADMIN LOGIN
========================================
*/

const adminLogin = async (req, res) => {
  try {
    const { email, password } =
      getCredentials(req.body);

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password are required",
      });
    }

    const admin =
      await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    const passwordMatch =
      await bcrypt.compare(
        password,
        admin.password
      );

    if (!passwordMatch) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        message:
          "Your account is inactive",
      });
    }

    res.status(200).json({
      message:
        "Admin login successful",

      token: createToken(admin),

      user: sanitizeUser(admin),
    });

  } catch (error) {
    console.error(
      "Admin login error:",
      error
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

const firebaseSignIn = async (req, res) => {
  const idToken = req.body?.idToken;

  if (typeof idToken !== "string" || !idToken) {
    return res.status(400).json({ message: "Firebase ID token is required" });
  }

  if (!process.env.FIREBASE_PROJECT_ID) {
    return res.status(503).json({ message: "Firebase project is not configured on the backend" });
  }

  let verifyingToken = true;
  try {
    const profile = await verifyFirebaseIdToken(idToken);
    verifyingToken = false;

    if (typeof profile.email !== "string" || profile.email_verified !== true) {
      return res.status(401).json({ message: "Firebase account email is not verified" });
    }
    if (profile.firebase?.sign_in_provider !== "google.com") {
      return res.status(403).json({ message: "Please sign in using Google" });
    }

    const email = profile.email.toLowerCase().trim();
    const [patient, doctor, pharmacist, admin, hospitalAccount] = await Promise.all([
      Patient.findOne({ email }),
      Doctor.findOne({ email }),
      Pharmacist.findOne({ email }),
      Admin.findOne({ email }),
      HospitalAccount.findOne({ email }).populate("hospital"),
    ]);
    const matchingAccounts = [patient, doctor, pharmacist, admin, hospitalAccount].filter(Boolean);

    if (matchingAccounts.length > 1) {
      return res.status(409).json({
        message: "This email is linked to multiple account roles. Contact an administrator to resolve the duplicate accounts.",
      });
    }

    let user = matchingAccounts[0];
    if (user && !user.isActive) {
      return res.status(403).json({ message: "Your account is inactive" });
    }

    if (!user) {
      // New Google identities are provisioned as patients; privileged roles must be assigned by an administrator.
      const randomPassword = randomBytes(32).toString("hex");
      try {
        user = await Patient.create({
          name: profile.name || email.split("@")[0],
          email,
          password: await bcrypt.hash(randomPassword, 10),
          role: "patient",
          image: profile.picture || "",
          isActive: true,
        });
      } catch (error) {
        // Another request may have created the same patient after our lookup.
        if (error.code !== 11000) throw error;
        user = await Patient.findOne({ email });
        if (!user) throw error;
        if (!user.isActive) {
          return res.status(403).json({ message: "Your account is inactive" });
        }
      }
    }

    if (user.role === "hospital" && !user.hospital) {
      return res.status(403).json({ message: "The hospital linked to this account is unavailable" });
    }

    const isHospital = user.role === "hospital";
    const userResponse = isHospital
      ? {
          _id: user._id,
          email: user.email,
          role: user.role,
          hospital: user.hospital,
        }
      : sanitizeUser(user);

    return res.status(200).json({
      message: "Firebase sign-in successful",
      token: createToken(
        user,
        isHospital ? { hospitalId: user.hospital._id } : {}
      ),
      user: userResponse,
    });
  } catch (error) {
    if (verifyingToken) {
      return res.status(401).json({ message: "Invalid Firebase ID token" });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account already exists for this email" });
    }

    console.error("Firebase sign-in error:", error);
    return res.status(500).json({ message: "Firebase sign-in failed" });
  }
};

module.exports = {
  signUp,
  signIn,
  adminLogin,
  firebaseSignIn,
};