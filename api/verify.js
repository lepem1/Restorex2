import clientPromise from "../lib/mongodb";

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.send("Invalid link");
  }

  const client = await clientPromise;
  const db = client.db("restorex");

  const user = await db.collection("users").findOne({
    verificationToken: token
  });

  if (!user) {
    return res.send("Invalid or expired link");
  }

  // ⏱ Check expiry
  if (new Date() > new Date(user.tokenExpires)) {
    return res.send("Link expired");
  }

  // ✅ Verify user
  await db.collection("users").updateOne(
    { _id: user._id },
    {
      $set: { verified: true },
      $unset: { verificationToken: "", tokenExpires: "" }
    }
  );

  // 🎉 Redirect to login
  res.redirect("/RestoreX/login.html");
}
