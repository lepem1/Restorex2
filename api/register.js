import clientPromise from "../lib/mongodb";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    // 🚫 Check empty
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    // 🚫 Password length check
    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    // 🔌 Connect MongoDB
    const client = await clientPromise;
    const db = client.db("restorex");

    // 🔍 Check if user already exists
    const existing = await db.collection("users").findOne({ email });

    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 💾 Save user
    await db.collection("users").insertOne({
      email: email,
      password: hashedPassword,
      createdAt: new Date()
    });

    // ✅ Success
    return res.status(200).json({
      message: "Registered successfully"
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    // 🔥 Always return JSON (fixes frontend crash)
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
}
