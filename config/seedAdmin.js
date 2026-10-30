const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { Admin } = require("../models/User");

const configPath = process.env.ENV_FILE || path.resolve(__dirname, "../.env");
dotenv.config({ path: configPath });

const seedAdmin = async () => {
  const email = process.env.DEFAULT_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!process.env.MONGO_URI || !email || !password) {
    throw new Error("MONGO_URI, DEFAULT_ADMIN_EMAIL, and DEFAULT_ADMIN_PASSWORD must be configured");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const hashedPassword = await bcrypt.hash(password, 10);
  await Admin.updateOne(
    { email },
    {
      $set: {
        name: "System Admin",
        email,
        password: hashedPassword,
        role: "admin",
        phone: "0000000000",
        isActive: true,
      },
    },
    { upsert: true, runValidators: true }
  );

  const seededAdmin = await Admin.findOne({ email });
  if (!seededAdmin || !(await bcrypt.compare(password, seededAdmin.password))) {
    throw new Error("Admin account verification failed");
  }

  console.log(`Admin account created or updated and verified: ${email}`);
};

seedAdmin()
  .catch((error) => {
    console.error("Admin seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
