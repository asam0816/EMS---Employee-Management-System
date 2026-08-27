import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import sendEmail from "../config/nodemailer.js";
import { logAudit } from "../utils/auditLogger.js";

const computeDayType = (workingHours) => {
  if (workingHours >= 8) return "Full Day";
  if (workingHours >= 6) return "Three Quarter Day";
  if (workingHours >= 4) return "Half Day";
  return "Short Day";
};

// POST /api/auth/login
// ✅ role_type is OPTIONAL now. If not provided, login works for both roles.
export const login = async (req, res) => {
  try {
    const { email, password, role_type } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: String(email).trim(),
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    // Optional role verification
    if (role_type === "admin" && user.role !== "ADMIN") {
      return res.status(401).json({
        error: "Not authorized as admin",
      });
    }

    if (role_type === "employee" && user.role !== "EMPLOYEE") {
      return res.status(401).json({
        error: "Not authorized as employee",
      });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    // IMPORTANT:
    // Check suspension only after the password is verified.
    if (user.accountStatus === "SUSPENDED") {
      return res.status(403).json({
        error: "Your account is not active",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    const payload = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
      accountStatus: user.accountStatus || "ACTIVE",
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    req.session = payload;

    await logAudit(req, {
      action: "AUTH_LOGIN",
      entityType: "Auth",
      entityId: user._id,
      entityLabel: user.email,
    });

    return res.json({
      user: payload,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Login failed",
    });
  }
};

// GET /api/auth/session
export const session = (req, res) => {
  return res.json({ user: req.session });
};

// POST /api/auth/change-password
export const changePassword = async (req, res) => {
  try {
    const sessionData = req.session;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Both passwords are required" });
    }

    const user = await User.findById(sessionData.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(sessionData.userId, { password: hashed });

    await logAudit(req, {
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: user._id,
      entityLabel: user.email,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({ error: "Failed to change password" });
  }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email }).lean();

    // Always success (do not reveal if email exists)
    if (!user) return res.json({ success: true });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      resetPasswordTokenHash: resetTokenHash,
      resetPasswordTokenExpiresAt: expiresAt,
    });

    const clientBase = process.env.CLIENT_URL || "http://localhost:5173";
    const resetLink = `${clientBase}/reset-password/${resetToken}`;

    await sendEmail({
      to: email,
      subject: "Reset your password",
      body: `
        <div style="max-width:600px;font-family:Arial,sans-serif">
          <h2>Password reset request</h2>
          <p>Click the button below to reset your password:</p>
          <p style="margin:20px 0">
            <a href="${resetLink}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
              Reset Password
            </a>
          </p>
          <p>This link expires in 15 minutes.</p>
        </div>
      `,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("forgotPassword error:", error);
    return res.status(500).json({ error: "Failed to send reset email" });
  }
};

// POST /api/auth/reset-password/:token
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!token) return res.status(400).json({ error: "Token is required" });
    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordTokenExpiresAt: { $gt: new Date() },
    });

    if (!user)
      return res.status(400).json({ error: "Invalid or expired token" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordTokenExpiresAt = null;
    await user.save();

    return res.json({ success: true });
  } catch (error) {
    console.error("resetPassword error:", error);
    return res.status(500).json({ error: "Failed to reset password" });
  }
};

// POST /api/auth/logout  ✅ AUTO CLOCK-OUT HERE
export const logout = async (req, res) => {
  try {
    const sessionData = req.session;
    const now = new Date();

    if (sessionData?.role === "EMPLOYEE") {
      const employee = await Employee.findOne({
        userId: sessionData.userId,
        isDeleted: { $ne: true },
        employmentStatus: "ACTIVE",
      });

      if (employee) {
        const open = await Attendance.findOne({
          employeeId: employee._id,
          checkIn: { $ne: null },
          checkOut: null,
        }).sort({ checkIn: -1, createdAt: -1 });

        if (open) {
          const diffHours =
            (now.getTime() - new Date(open.checkIn).getTime()) /
            (1000 * 60 * 60);

          open.checkOut = now;
          open.workingHours = parseFloat(diffHours.toFixed(2));
          open.dayType = computeDayType(open.workingHours);
          await open.save();
        }
      }
    }

    await logAudit(req, {
      action: "AUTH_LOGOUT",
      entityType: "Auth",
      entityId: sessionData?.userId,
      entityLabel: sessionData?.email,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Logout failed" });
  }
};
