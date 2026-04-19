import clientPromise from "../lib/mongodb.js";
import crypto from "crypto";
import { Resend } from "resend";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email } = req.body || {};

    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ message: "Email required" });
    }

    const client = await clientPromise;
    const db = client.db("restorex");

    const user = await db.collection("users").findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.verified) {
      return res.status(400).json({ message: "Already verified" });
    }

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

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);

        const { data, error } = await resend.emails.send({
          from: "RestoreX <onboarding@resend.dev>",
          to: [cleanEmail],
          subject: "Verify your RestoreX account",
          html: `
            <h2>🔐 Verify your account</h2>
            <a href="${verifyLink}">Verify Account</a>
          `
        });

        if (error) {
          console.error("RESEND ERROR:", error);
        } else {
          console.log("RESEND EMAIL SENT:", data);
        }

      } catch (err) {
        console.error("EMAIL ERROR:", err);
      }
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("RESEND ERROR:", err);

    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
}
