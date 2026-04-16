import clientPromise from "../lib/mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, password } = req.body;

  const client = await clientPromise;
  const db = client.db("restorex");

  const user = await db.collection("users").findOne({ email });
  if (!user) return res.json({ message: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ message: "Wrong password" });

  const token = jwt.sign(
    { email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ message: "Login success", token });
}
