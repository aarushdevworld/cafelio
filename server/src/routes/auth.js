import express from "express";
import User from "../models/User.js";
import { isMongoReady } from "../config/db.js";
import { hashPassword, signToken, verifyPassword } from "../services/auth.js";
import { optionalAuth } from "../middleware/auth.js";

const router = express.Router();
const memoryUsers = new Map();

const cleanUser = (user) => ({
  id: String(user._id || user.id),
  name: user.name,
  email: user.email
});

const issueSession = (user) => {
  const safeUser = cleanUser(user);
  return {
    user: safeUser,
    token: signToken(safeUser)
  };
};

router.post("/signup", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 6) {
      return res.status(400).json({ message: "Name, email, and a 6 character password are required." });
    }

    const passwordFields = await hashPassword(password);

    if (isMongoReady()) {
      const existing = await User.findOne({ email }).lean();
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists." });
      }

      const user = await User.create({ name, email, ...passwordFields });
      return res.status(201).json(issueSession(user));
    }

    if (memoryUsers.has(email)) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const user = { id: `memory-${Date.now()}`, name, email, ...passwordFields };
    memoryUsers.set(email, user);
    res.status(201).json(issueSession(user));
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = isMongoReady()
      ? await User.findOne({ email })
      : memoryUsers.get(email);

    if (!user || !(await verifyPassword(password, user))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    res.json(issueSession(user));
  } catch (error) {
    next(error);
  }
});

router.get("/me", optionalAuth, (req, res) => {
  res.json({ user: req.user || null });
});

export default router;
