// server/middleware/auth.js
import jwt from "jsonwebtoken";

// ✅ Verifies JWT and attaches req.session = { userId, role, email }
export const protect = (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : null;

    if (!token) {
      return res.status(401).json({ error: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ all controllers use req.session
    req.session = {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Not authorized, token failed" });
  }
};

// ✅ Admin-only guard (use AFTER protect, or standalone)
export const protectAdmin = (req, res, next) => {
  try {
    // If protect already ran, req.session exists
    if (req.session?.role) {
      if (req.session.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin access only" });
      }
      return next();
    }

    // Otherwise verify token here (standalone usage)
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : null;

    if (!token) {
      return res.status(401).json({ error: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin access only" });
    }

    req.session = {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Not authorized, token failed" });
  }
};
