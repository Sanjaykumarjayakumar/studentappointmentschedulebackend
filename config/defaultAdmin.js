const bcrypt = require("bcryptjs");
const { Admin } = require("../models/User");

const createDefaultAdmin = async () => {
  const isProduction = process.env.NODE_ENV === "production";
  const email =
    process.env.DEFAULT_ADMIN_EMAIL ||
    (isProduction ? "" : "admin@gmail.com");
  const password =
    process.env.DEFAULT_ADMIN_PASSWORD ||
    (isProduction ? "" : "12345678");

  if (!email || !password) {
    throw new Error("DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD must be configured");
  }

  try {
    const existingAdmin = await Admin.findOne({
      email: email.toLowerCase(),
    });

    if (existingAdmin) {
      return existingAdmin;
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name: "System Admin",
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "admin",
      phone: "0000000000",
      isActive: true,
    });

    console.log(
      "Default admin created:",
      admin.email
    );

    return admin;
  } catch (error) {
    console.error(
      "Default admin creation failed:",
      error.message
    );

    return null;
  }
};

module.exports = createDefaultAdmin;