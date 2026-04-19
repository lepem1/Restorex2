import clientPromise from "../lib/mongodb";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "").trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ success: false, message: "Please fill all fields" });
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
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const token = crypto.randomBytes(32).toString("hex");
    const tokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    await db.collection("users").insertOne({
      email: cleanEmail,
      password: hashedPassword,
      verified: false,
      verificationToken: token,
      tokenExpires,
      createdAt: new Date()
    });

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const verifyLink = `${baseUrl}/api/verify?token=${token}`;

    // 📧 Send email
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);

        const { data, error } = await resend.emails.send({
          from: "RestoreX <onboarding@resend.dev>",
          to: [cleanEmail], // ⚠️ MUST be array
          subject: "Verify your RestoreX account",
          html: `
            <div style="font-family:sans-serif">
              <h2>🔐 Verify your account</h2>
              <p>Click below:</p>

              <a href="${verifyLink}"
                style="padding:12px 20px;background:#3b82f6;color:white;border-radius:6px;text-decoration:none;">
                Verify Account
              </a>

              <p style="font-size:12px;color:gray;margin-top:10px;">
                Link expires in 15 minutes.
              </p>
            </div>
          `
        });

        if (error) {
          console.error("RESEND ERROR:", error);
        } else {
          console.log("EMAIL SENT:", data);
        }

      } catch (emailErr) {
        console.error("EMAIL CRASH:", emailErr);
      }
    } else {
      console.warn("⚠️ RESEND_API_KEY missing");
    }

    return res.status(200).json({
      success: true,
      message: "Registered! Check your email to verify"
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
