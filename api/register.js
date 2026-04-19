import clientPromise from "../lib/mongodb";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // ✅ Allow only POST
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    // 🔍 Validation
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Please fill all fields" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    // 🔌 DB
    const client = await clientPromise;
    const db = client.db("restorex");

    // 🔍 Check existing
    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔑 Token
    const token = crypto.randomBytes(32).toString("hex");

    const tokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    // 💾 Save user FIRST (important)
    await db.collection("users").insertOne({
      email,
      password: hashedPassword,
      verified: false,
      verificationToken: token,
      tokenExpires,
      createdAt: new Date()
    });

    // 🌍 Safe BASE_URL fallback
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";

    const verifyLink = `${baseUrl}/api/verify?token=${token}`;

    // 📧 Send email (SAFE — won't crash API)
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: "RestoreX <onboarding@resend.dev>",
          to: email,
          subject: "Verify your RestoreX account",
          html: `
            <div style="font-family:sans-serif">
              <h2>🔐 Verify your account</h2>
              <p>Click below:</p>

              <a href="${verifyLink}"
                style="display:inline-block;padding:12px 20px;background:#3b82f6;color:white;border-radius:6px;text-decoration:none;">
                Verify Account
              </a>

              <p style="font-size:12px;color:gray;margin-top:10px;">
                Link expires in 15 minutes.
              </p>
            </div>
          `
        });
      } catch (emailErr) {
        console.error("EMAIL ERROR:", emailErr);
        // ⚠️ DO NOT crash register if email fails
      }
    } else {
      console.warn("⚠️ RESEND_API_KEY missing — email not sent");
    }

    // ✅ Always return JSON
    return res.status(200).json({
      success: true,
      message: "Registered! Check your email to verify"
    });

  } catch (err) {
    console.error("REGISTER ERROR FULL:", err);

    // ✅ Always JSON (prevents frontend crash)
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
}
