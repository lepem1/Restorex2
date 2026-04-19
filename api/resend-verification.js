import clientPromise from "../lib/mongodb";
import crypto from "crypto";

export default async function handler(req, res) {
  const { email } = req.body;

  const client = await clientPromise;
  const db = client.db("restorex");

  const user = await db.collection("users").findOne({ email });

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

  const verifyLink = `https://restorex.ddns.net/api/verify?token=${token}`;

  await fetch("https://api.send.com/v1/email", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.SEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: email,
      subject: "Verify your RestoreX account",
      html: `
        <h2>🔐 Verify your account</h2>
        <a href="${verifyLink}">Verify Account</a>
      `
    })
  });

  res.json({ success: true });
}
