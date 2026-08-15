import Employee from "../models/Employee.js";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { logAudit } from "../utils/auditLogger.js";

export const getEmployees = async (req, res) => {
  try {
    const { department } = req.query;
    const where = {};
    if (department) where.department = department;

    const employees = await Employee.find(where)
      .populate("userId", "email role")
      .sort({ createdAt: -1 })
      .lean();

    const result = employees.map((emp) => ({
      ...emp,
      id: emp._id.toString(),
      user: emp.userId
        ? { email: emp.userId.email, role: emp.userId.role }
        : null,
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch employees" });
  }
};

export const createEmployee = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      nationalIdNumber,
      position,
      department,
      basicSalary,
      allowances,
      deductions,
      joinDate,
      password,
      role,
      bio,
    } = req.body;

    // ✅ NIC required
    if (!email || !password || !firstName || !lastName || !nationalIdNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashed,
      role: role || "EMPLOYEE",
    });

    const employee = await Employee.create({
      userId: user._id,
      firstName,
      lastName,
      email,
      phone,
      nationalIdNumber,
      position,
      department: department || "Engineering",
      basicSalary: Number(basicSalary) || 0,
      allowances: Number(allowances) || 0,
      deductions: Number(deductions) || 0,
      joinDate: new Date(joinDate),
      bio: bio || "",
    });

    await logAudit(req, {
      action: "EMPLOYEE_CREATED",
      entityType: "Employee",
      entityId: employee._id,
      entityLabel: `${employee.firstName} ${employee.lastName} (${employee.email})`,
      meta: {
        department: employee.department,
        role: user.role,
        nationalIdNumber,
      },
    });

    return res.status(201).json({ success: true, employee });
  } catch (error) {
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0];
      if (key === "email")
        return res.status(400).json({ error: "Email already exists" });
      if (key === "nationalIdNumber")
        return res.status(400).json({ error: "NIC number already exists" });
      return res.status(400).json({ error: "Duplicate value" });
    }

    console.error("Create employee error:", error);
    return res.status(500).json({ error: "Failed to create employee" });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      firstName,
      lastName,
      email,
      phone,
      nationalIdNumber,
      position,
      department,
      basicSalary,
      allowances,
      deductions,
      joinDate,
      password,
      role,
      bio,
      employmentStatus,
    } = req.body;

    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    await Employee.findByIdAndUpdate(id, {
      firstName,
      lastName,
      email,
      phone,
      nationalIdNumber,
      position,
      department: department || "Engineering",
      basicSalary: Number(basicSalary) || 0,
      allowances: Number(allowances) || 0,
      deductions: Number(deductions) || 0,
      employmentStatus: employmentStatus || "ACTIVE",
      bio: bio || "",
      ...(joinDate ? { joinDate: new Date(joinDate) } : {}),
    });

    const userUpdate = { email };
    if (role) userUpdate.role = role;
    if (password) userUpdate.password = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(employee.userId, userUpdate);

    await logAudit(req, {
      action: "EMPLOYEE_UPDATED",
      entityType: "Employee",
      entityId: employee._id,
      entityLabel: `${firstName || employee.firstName} ${lastName || employee.lastName} (${email || employee.email})`,
      meta: { nationalIdNumber },
    });

    return res.json({ success: true });
  } catch (error) {
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0];
      if (key === "email")
        return res.status(400).json({ error: "Email already exists" });
      if (key === "nationalIdNumber")
        return res.status(400).json({ error: "NIC number already exists" });
      return res.status(400).json({ error: "Duplicate value" });
    }

    console.error("Update employee error:", error);
    return res.status(500).json({ error: "Failed to update employee" });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    employee.isDeleted = true;
    employee.employmentStatus = "INACTIVE";
    await employee.save();

    await logAudit(req, {
      action: "EMPLOYEE_DEACTIVATED",
      entityType: "Employee",
      entityId: employee._id,
      entityLabel: `${employee.firstName} ${employee.lastName} (${employee.email})`,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete employee error:", error);
    return res.status(500).json({ error: "Failed to delete employee" });
  }
};
