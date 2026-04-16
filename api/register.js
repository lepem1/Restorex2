import clientPromise from "../lib/mongodb";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  try {
    // ✅ Only POST allowed
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    // ✅ Safe body parsing
    const { email, password } = req.body || {};

    // 🚫 Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // 🔌 Connect to MongoDB
    const client = await clientPromise;
    const db = client.db("restorex");

    // 🔍 Check if user exists
    const existingUser = await db.collection("users").findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 💾 Save user
    await db.collection("users").insertOne({
      email,
      password: hashedPassword,
      createdAt: new Date()
    });

    // ✅ Success
    return res.status(200).json({
      message: "Registered successfully"
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    // 🔥 ALWAYS return JSON (prevents your frontend crash)
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
}
