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

    // 🔌 IMPORT DB SAFELY (IMPORTANT)
    let clientPromise;
    try {
      clientPromise = (await import("../lib/mongodb")).default;
    } catch (err) {
      console.error("❌ Mongo import failed:", err);
      return res.status(500).json({
        success: false,
        message: "Database not configured"
      });
    }

    let client;
    try {
      client = await clientPromise;
    } catch (err) {
      console.error("❌ Mongo connect failed:", err);
      return res.status(500).json({
        success: false,
        message: "Database connection failed"
      });
    }

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

    // 📧 EMAIL (SAFE)
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: "RestoreX <onboarding@resend.dev>",
          to: [cleanEmail],
          subject: "Verify your RestoreX account",
          html: `<a href="${verifyLink}">Verify Account</a>`
        });

      } catch (err) {
        console.error("❌ Email failed:", err);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Registered! Check your email"
    });

  } catch (err) {
    console.error("❌ REGISTER FULL ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
}
