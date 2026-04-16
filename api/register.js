import clientPromise from "../lib/mongodb";
import bcrypt from "bcrypt";

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    // 🚫 Check empty fields
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const client = await clientPromise;
    const db = client.db("restorex");

    // 🔍 Check if user exists
    const existingUser = await db.collection("users").findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 💾 Insert user
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

    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
}
