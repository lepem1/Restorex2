import clientPromise from "../lib/mongodb";
import bcrypt from "bcrypt";

export default async function handler(req, res) {
  try {
    console.log("START REGISTER");

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    console.log("BODY:", req.body);

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    console.log("Connecting Mongo...");
    const client = await clientPromise;

    console.log("Connected!");
    const db = client.db("restorex");

    const existing = await db.collection("users").findOne({ email });

    if (existing) {
      return res.status(400).json({ message: "User exists" });
    }

    console.log("Hashing password...");
    const hashed = await bcrypt.hash(password, 10);

    console.log("Inserting...");
    await db.collection("users").insertOne({
      email,
      password: hashed
    });

    return res.json({ message: "Registered successfully" });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    return res.status(500).json({
      message: err.message
    });
  }
}
