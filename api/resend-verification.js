import clientPromise from "../lib/mongodb.js";
import crypto from "crypto";
import { Resend } from "resend";

export default async function handler(req, res) {
  // 🚫 Only POST
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const { email } = req.body || {};

    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({
        success: false,
        message: "Email required"
      });
    }

    // 🔌 Mongo
    let client;
    try {
      client = await clientPromise;
    } catch (err) {
      console.error("❌ Mongo error:", err);
      return res.status(500).json({
        success: false,
        message: "Database connection failed"
      });
    }

    const db = client.db("restorex");

    const user = await db.collection("users").findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.verified) {
      return res.status(400).json({
        success: false,
        message: "Already verified"
      });
    }

    // 🔑 New token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: {
          verificationToken: token,
          tokenExpires
        }
      }
    );

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const verifyLink = `${baseUrl}/api/verify?token=${token}`;

    // 📧 Email
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);

        const { data, error } = await resend.emails.send({
          from: "RestoreX <onboarding@resend.dev>",
          to: [cleanEmail],
          subject: "Verify your RestoreX account",
          html: `
            <div style="font-family:sans-serif">
              <h2>🔐 Verify your account</h2>
              <p>Click below:</p>

              <a href="${verifyLink}"
                style="display:inline-block;padding:10px 20px;background:#3b82f6;color:white;border-radius:6px;text-decoration:none;">
                Verify Account
              </a>

              <p style="font-size:12px;color:gray;margin-top:10px;">
                Link expires in 15 minutes.
              </p>
            </div>
          `
        });

        console.log("📧 RESEND RESULT:", data);
        if (error) console.error("❌ RESEND ERROR:", error);

      } catch (err) {
        console.error("❌ EMAIL ERROR:", err);
      }
    } else {
      console.warn("⚠️ RESEND_API_KEY missing");
    }

    return res.json({
      success: true,
      message: "Verification email sent"
    });

  } catch (err) {
    console.error("❌ RESEND API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
}
