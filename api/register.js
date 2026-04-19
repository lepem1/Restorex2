import clientPromise from "../lib/mongodb";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const client = await clientPromise;
    const db = client.db("restorex");

    // Check existing user
    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    //  Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");

    //  Expiry (15 min)
    const tokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    //  Save user
    await db.collection("users").insertOne({
      email,
      password: hashedPassword,
      verified: false,
      verificationToken: token,
      tokenExpires,
      createdAt: new Date()
    });

    //  Create verification link
    const verifyLink = `https://restorex.ddns.net/api/verify?token=${token}`;

    //  Send email using send.com
    await fetch("https://api.send.com/v1/email", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.SEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: email,
        subject: "Verify your RestoreX account",
        html: `
          <h2>🔐 Verify your account</h2>
          <p>Click the button below to verify your account:</p>

          <a href="${verifyLink}"
            style="display:inline-block;padding:12px 20px;background:#3b82f6;color:white;border-radius:6px;text-decoration:none;">
            Verify Account
          </a>

          <p>This link expires in 15 minutes.</p>
          <p>If you didn’t request this, ignore this email.</p>
        `
      })
    });

    //  Response (IMPORTANT: success:true for frontend)
    return res.status(200).json({
      success: true,
      message: "Registered! Check your email to verify"
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
}
