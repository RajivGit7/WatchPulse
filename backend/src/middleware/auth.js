import jwt from "jsonwebtoken";
import User from "../models/User.js";

const userCache = new Map();
const CACHE_TTL = 60 * 1000;

export const invalidateUserCache = (userId) => {
  userCache.delete(userId.toString());
};

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const cached = userCache.get(decoded.id);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      req.user = cached.user;
      return next();
    }

    const user = await User.findById(decoded.id).select("_id username email avatar");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    userCache.set(decoded.id, { user, time: Date.now() });

    if (userCache.size > 500) {
      const oldest = userCache.keys().next().value;
      userCache.delete(oldest);
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};
