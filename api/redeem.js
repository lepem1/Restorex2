import clientPromise from "../lib/mongodb.js";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT not configured" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { code } = req.body || {};

    if (!code) {
      return res.status(400).json({ message: "Code required" });
    }

    const client = await clientPromise;
    const db = client.db("restorex");

    const redeemCode = await db.collection("codes").findOne({ code });

    if (!redeemCode) {
      return res.status(400).json({ message: "Invalid code" });
    }

    if (redeemCode.used) {
      return res.status(400).json({ message: "Code already used" });
    }

    await db.collection("users").updateOne(
      { email: decoded.email },
      {
        $set: {
          premium: true,
          premiumSince: new Date()
        }
      }
    );

    await db.collection("codes").updateOne(
      { code },
      {
        $set: {
          used: true,
          usedBy: decoded.email,
          usedAt: new Date()
        }
      }
    );

    return res.json({
      success: true,
      message: "Premium activated!"
    });

  } catch (err) {
    console.error("REDEEM ERROR:", err);

    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
}
