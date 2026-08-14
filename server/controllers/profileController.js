import Employee from "../models/Employee.js";
import { logAudit } from "../utils/auditLogger.js";

export const getProfile = async (req, res) => {
  try {
    const session = req.session;
    const employee = await Employee.findOne({ userId: session.userId });

    if (!employee) {
      return res.json({
        firstName: "Admin",
        lastName: "User",
        email: session.email,
      });
    }
    return res.json(employee);
  } catch {
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const session = req.session;
    const employee = await Employee.findOne({ userId: session.userId });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    if (employee.isDeleted) {
      return res.status(403).json({
        error: "Your account is deactivated. You cannot update your profile.",
      });
    }

    await Employee.findByIdAndUpdate(employee._id, { bio: req.body.bio });

    // ✅ AUDIT BEFORE RETURN
    await logAudit(req, {
      action: "PROFILE_UPDATED",
      entityType: "Profile",
      entityId: employee._id,
      entityLabel: `${employee.firstName} ${employee.lastName}`,
    });

    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Failed to update profile" });
  }
};
