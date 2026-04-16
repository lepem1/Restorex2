import clientPromise from "../lib/mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  // ❌ Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // ✅ Safe body parsing
    const { email, password } = req.body || {};

    // 🚫 Missing fields
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    // 🔌 Connect MongoDB
    const client = await clientPromise;
    const db = client.db("restorex");

    // 🔍 Find user
    const user = await db.collection("users").findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // ⚠️ Safety check
    if (!user.password) {
      return res.status(500).json({ message: "User data corrupted" });
    }

    // 🔐 Compare password
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({ message: "Wrong password" });
    }

    // 🔑 Check JWT secret
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT not configured" });
    }

    // 🎟️ Create token
    const token = jwt.sign(
      { email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Success
    return res.status(200).json({
      message: "Login successful",
      token
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
}
