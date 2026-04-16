import clientPromise from "../lib/mongodb";
import bcrypt from "bcrypt";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, password } = req.body;

  const client = await clientPromise;
  const db = client.db("restorex");

  const existing = await db.collection("users").findOne({ email });
  if (existing) {
    return res.json({ message: "User already exists" });
  }

  const hashed = await bcrypt.hash(password, 10);

  await db.collection("users").insertOne({
    email,
    password: hashed
  });

  res.json({ message: "Registered successfully" });
}
