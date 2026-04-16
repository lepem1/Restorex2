import clientPromise from "../lib/mongodb";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Missing email or password" });
    }

    const client = await clientPromise;
    const db = client.db("restorex");

    // Check existing user
    const existing = await db.collection("users").findOne({ email });

    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Insert user
    await db.collection("users").insertOne({
      email,
      password: hashed,
      createdAt: new Date()
    });

    return res.status(200).json({
      message: "Registered successfully"
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    return res.status(500).json({
      message: "Register failed",
      error: err.message
    });
  }
}
