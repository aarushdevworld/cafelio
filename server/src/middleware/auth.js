import { verifyToken } from "../services/auth.js";

export const optionalAuth = (req, _res, next) => {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);

  if (payload?.id) {
    req.user = {
      id: payload.id,
      email: payload.email,
      name: payload.name
    };
  }

  next();
};

export const userScope = (req) => req.user?.id || req.get("x-guest-id") || "guest";
