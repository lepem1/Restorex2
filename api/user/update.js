import clientPromise from "../../lib/mongodb.js";
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

    const { discord, showEmail } = req.body || {};

    const updateData = {};

    if (discord !== undefined) {
      updateData.discord = String(discord).trim().slice(0, 50);
    }

    if (showEmail !== undefined) {
      updateData.showEmail = !!showEmail;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const client = await clientPromise;
    const db = client.db("restorex");

    await db.collection("users").updateOne(
      { email: decoded.email },
      { $set: updateData }
    );

    return res.json({
      success: true,
      message: "Updated successfully"
    });

  } catch (err) {
    console.error("UPDATE ERROR:", err);

    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
}
