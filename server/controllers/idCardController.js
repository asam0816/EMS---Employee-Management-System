import Employee from "../models/Employee.js";
import User from "../models/User.js";

// GET /api/id-cards  (Admin only)
export const getAllEmployeeIdCards = async (req, res) => {
  try {
    const employees = await Employee.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean();

    // Fetch user images for each employee userId
    const userIds = employees.map((e) => e.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } })
      .select("_id image")
      .lean();

    const imageMap = new Map(
      users.map((u) => [u._id.toString(), u.image || null]),
    );

    const data = employees.map((e) => ({
      id: e._id.toString(),
      employeeId: e._id.toString(),
      firstName: e.firstName,
      lastName: e.lastName,
      name: `${e.firstName} ${e.lastName}`.trim(),
      email: e.email,
      nationalIdNumber: e.nationalIdNumber || "",
      position: e.position || "",
      joinDate: e.joinDate,
      image: imageMap.get(e.userId?.toString()) || null,
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error("getAllEmployeeIdCards error:", error);
    return res.status(500).json({ error: "Failed to fetch ID cards" });
  }
};

// GET /api/id-cards/:id  (Admin only)
export const getEmployeeIdCardById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).lean();
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const user = employee.userId
      ? await User.findById(employee.userId).select("image").lean()
      : null;

    return res.json({
      success: true,
      data: {
        id: employee._id.toString(),
        employeeId: employee._id.toString(),
        firstName: employee.firstName,
        lastName: employee.lastName,
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        email: employee.email,
        nationalIdNumber: employee.nationalIdNumber || "",
        position: employee.position || "",
        joinDate: employee.joinDate,
        image: user?.image || null,
      },
    });
  } catch (error) {
    console.error("getEmployeeIdCardById error:", error);
    return res.status(500).json({ error: "Failed to fetch ID card" });
  }
};
