import clientPromise from "../lib/mongodb";
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // 🚫 Only POST
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const client = await clientPromise;
    const db = client.db("restorex");

    const user = await db.collection("users").findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.verified) {
      return res.status(400).json({ message: "Already verified" });
    }

    // 🔑 New token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    // 💾 Update DB
    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: {
          verificationToken: token,
          tokenExpires
        }
      }
    );

    // 🔗 Use BASE_URL (IMPORTANT)
    const verifyLink = `${process.env.BASE_URL}/api/verify?token=${token}`;

    // 📧 Send email via Resend
    await resend.emails.send({
      from: "RestoreX <onboarding@resend.dev>",
      to: email,
      subject: "Verify your RestoreX account",
      html: `
        <div style="font-family:sans-serif">
          <h2>🔐 Verify your account</h2>
          <p>Click the button below:</p>

          <a href="${verifyLink}"
            style="display:inline-block;padding:10px 20px;background:#3b82f6;color:white;border-radius:6px;text-decoration:none;">
            Verify Account
          </a>

          <p style="margin-top:12px;font-size:12px;color:gray;">
            This link expires in 15 minutes.
          </p>
        </div>
      `
    });

    return res.json({ success: true });

  } catch (err) {
    console.error("RESEND ERROR:", err);

    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
}
