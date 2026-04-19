import bcrypt from "bcryptjs";
import clientPromise from "../lib/mongodb.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const { email, password } = req.body || {};

    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "").trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({
        success: false,
        message: "Please fill all fields"
      });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const client = await clientPromise;
    const db = client.db("restorex");

    const existing = await db.collection("users").findOne({ email: cleanEmail });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    await db.collection("users").insertOne({
      email: cleanEmail,
      password: hashedPassword,
      createdAt: new Date()
    });

    return res.status(200).json({
      success: true,
      message: "Registered successfully"
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
}
