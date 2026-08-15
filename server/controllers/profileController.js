import Employee from "../models/Employee.js";
import User from "../models/User.js";
import { logAudit } from "../utils/auditLogger.js";

export const getProfile = async (req, res) => {
  try {
    const session = req.session;

    const user = await User.findById(session.userId).lean();
    const employee = await Employee.findOne({ userId: session.userId }).lean();

    // Admin (no Employee doc)
    if (!employee) {
      return res.json({
        firstName: "Admin",
        lastName: "User",
        email: session.email,
        position: "Administrator",
        bio: "",
        isDeleted: false,
        image: user?.image || null,
      });
    }

    // Employee
    return res.json({
      ...employee,
      image: user?.image || null, // ✅ always from User
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const session = req.session;

    const { bio, image } = req.body; // ✅ JSON payload

    const employee = await Employee.findOne({ userId: session.userId });

    // If employee exists, check deactivated
    if (employee?.isDeleted) {
      return res.status(403).json({
        error: "Your account is deactivated. You cannot update your profile.",
      });
    }

    // Update employee bio (if employee)
    if (employee) {
      await Employee.findByIdAndUpdate(employee._id, {
        ...(bio !== undefined ? { bio } : {}),
      });
    }

    // Update user image (for ALL users)
    if (image !== undefined) {
      await User.findByIdAndUpdate(session.userId, { image });
    }

    // ✅ AUDIT (before return)
    await logAudit(req, {
      action: "PROFILE_UPDATED",
      entityType: "Profile",
      entityId: employee?._id || session.userId,
      entityLabel: session.email,
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update profile" });
  }
};
