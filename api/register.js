import clientPromise from "../lib/mongodb";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    // 🚫 Validation
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

    // 🔍 Check existing
    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔑 Token
    const token = crypto.randomBytes(32).toString("hex");

    // ⏱ Expiry
    const tokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    // 💾 Save user
    await db.collection("users").insertOne({
      email,
      password: hashedPassword,
      verified: false,
      verificationToken: token,
      tokenExpires,
      createdAt: new Date()
    });

    // 🔗 Use BASE_URL (IMPORTANT)
    const verifyLink = `${process.env.BASE_URL}/api/verify?token=${token}`;

    // 📧 Send email via Resend
    await resend.emails.send({
      from: "RestoreX <onboarding@resend.dev>", // works without domain
      to: email,
      subject: "Verify your RestoreX account",
      html: `
        <div style="font-family:sans-serif">
          <h2>🔐 Verify your account</h2>

          <p>Click below to verify:</p>

          <a href="${verifyLink}"
            style="display:inline-block;padding:12px 20px;background:#3b82f6;color:white;border-radius:6px;text-decoration:none;">
            Verify Account
          </a>

          <p style="margin-top:15px;font-size:12px;color:gray;">
            This link expires in 15 minutes.<br>
            If you didn’t request this, ignore this email.
          </p>
        </div>
      `
    });

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
