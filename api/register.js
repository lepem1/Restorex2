import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";
import clientPromise from "../lib/mongodb.js";

export default async function handler(req, res) {
  // 🚫 Only POST allowed
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const { email, password } = req.body || {};

    // 🧼 Clean input
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "").trim();

    // 🚫 Validation
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

    // 🔌 Connect MongoDB
    let client;
    try {
      client = await clientPromise;
    } catch (err) {
      console.error("❌ Mongo connect error:", err);
      return res.status(500).json({
        success: false,
        message: "Database connection failed"
      });
    }

    const db = client.db("restorex");

    // 🔍 Check existing user
    const existing = await db.collection("users").findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    // 🔑 Generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    // 💾 Save user
    await db.collection("users").insertOne({
      email: cleanEmail,
      password: hashedPassword,
      verified: false,
      verificationToken: token,
      tokenExpires,
      createdAt: new Date()
    });

    // 🌍 Create verification link
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const verifyLink = `${baseUrl}/api/verify?token=${token}`;

    // 📧 Send email (safe)
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);

        const { error } = await resend.emails.send({
          from: "RestoreX <onboarding@resend.dev>",
          to: [cleanEmail],
          subject: "Verify your RestoreX account",
          html: `
            <div style="font-family:sans-serif">
              <h2>🔐 Verify your account</h2>
              <p>Click the button below:</p>

              <a href="${verifyLink}"
                style="display:inline-block;padding:12px 20px;background:#3b82f6;color:white;border-radius:6px;text-decoration:none;">
                Verify Account
              </a>

              <p style="font-size:12px;color:gray;margin-top:10px;">
                This link expires in 15 minutes.
              </p>
            </div>
          `
        });

        if (error) {
          console.error("❌ Resend error:", error);
        }

      } catch (emailErr) {
        console.error("❌ Email send failed:", emailErr);
        // ⚠️ do NOT break register
      }
    } else {
      console.warn("⚠️ RESEND_API_KEY missing (email not sent)");
    }

    // ✅ Success
    return res.status(200).json({
      success: true,
      message: "Registered! Check your email to verify"
    });

  } catch (err) {
    console.error("❌ REGISTER ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
}
