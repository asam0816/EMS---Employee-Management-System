import jwt from "jsonwebtoken";
import User from "../models/User.js";

const getBearerToken = (req) => {
  const auth = req.headers.authorization || "";

  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
};

// Verify token + check CURRENT user status from MongoDB
export const protect = async (req, res, next) => {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: "Not authorized, no token",
        code: "NO_TOKEN",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Do not trust only the old JWT.
    // Read current account information from MongoDB.
    const currentUser = await User.findById(decoded.userId)
      .select("email role accountStatus")
      .lean();

    if (!currentUser) {
      return res.status(401).json({
        error: "User account no longer exists",
        code: "USER_NOT_FOUND",
      });
    }

    // Block suspended accounts
    if (currentUser.accountStatus === "SUSPENDED") {
      return res.status(403).json({
        error: "Your account is not active",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    req.session = {
      userId: currentUser._id.toString(),
      role: currentUser.role,
      email: currentUser.email,
      accountStatus: currentUser.accountStatus || "ACTIVE",
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Not authorized, token failed",
      code: "INVALID_TOKEN",
    });
  }
};

export const protectAdmin = (req, res, next) => {
  if (!req.session) {
    return res.status(401).json({
      error: "Not authorized",
    });
  }

  if (req.session.role !== "ADMIN") {
    return res.status(403).json({
      error: "Admin access only",
    });
  }

  next();
};
