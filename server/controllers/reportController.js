import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveApplication from "../models/LeaveApplication.js"; // <-- change if your file name differs

const safeKey = (x) =>
  x === undefined || x === null || x === "" ? "UNKNOWN" : String(x);

const diffDaysInclusive = (a, b) => {
  const start = new Date(a);
  const end = new Date(b);
  if (isNaN(start) || isNaN(end)) return 0;
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return days > 0 ? days : 0;
};

const computeLeaveDays = (l) => {
  const direct = Number(l.totalDays ?? l.days ?? l.noOfDays);
  if (Number.isFinite(direct) && direct > 0) return direct;

  if (l.startDate && l.endDate)
    return diffDaysInclusive(l.startDate, l.endDate);
  if (l.fromDate && l.toDate) return diffDaysInclusive(l.fromDate, l.toDate);

  return 0;
};

const monthKeyToRange = (monthKey) => {
  // monthKey: "YYYY-MM"
  const [y, m] = String(monthKey).split("-").map(Number);

  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)); // last day of month

  const startKey = start.toISOString().slice(0, 10); // YYYY-MM-DD
  const endKey = end.toISOString().slice(0, 10);

  return { start, end, startKey, endKey };
};

// ✅ Admin-only: Monthly per-employee report
// GET /api/reports/monthly-employees?month=YYYY-MM
export const getMonthlyEmployeesReport = async (req, res) => {
  try {
    const now = new Date();
    const defaultMonth = now.toISOString().slice(0, 7); // YYYY-MM
    const monthKey = String(req.query.month || defaultMonth);

    const { start, end, startKey, endKey } = monthKeyToRange(monthKey);

    // 1) Active employees
    const employees = await Employee.find({
      isDeleted: { $ne: true },
      employmentStatus: "ACTIVE",
    })
      .select("_id firstName lastName department jobTitle designation position")
      .lean();

    // 2) Attendance aggregate per employee for month (attendanceDateKey is ISO string)
    const attendanceAgg = await Attendance.aggregate([
      { $match: { attendanceDateKey: { $gte: startKey, $lte: endKey } } },
      {
        $group: {
          _id: "$employeeId",
          totalRecords: { $sum: 1 },

          present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$status", "LATE"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] } },

          fullDay: {
            $sum: { $cond: [{ $eq: ["$dayType", "Full Day"] }, 1, 0] },
          },
          threeQuarterDay: {
            $sum: { $cond: [{ $eq: ["$dayType", "Three Quarter Day"] }, 1, 0] },
          },
          halfDay: {
            $sum: { $cond: [{ $eq: ["$dayType", "Half Day"] }, 1, 0] },
          },
          shortDay: {
            $sum: { $cond: [{ $eq: ["$dayType", "Short Day"] }, 1, 0] },
          },

          totalHours: { $sum: { $ifNull: ["$workingHours", 0] } },
          hoursCount: {
            $sum: { $cond: [{ $ne: ["$workingHours", null] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          employeeId: "$_id",
          _id: 0,
          totalRecords: 1,
          present: 1,
          late: 1,
          absent: 1,
          fullDay: 1,
          threeQuarterDay: 1,
          halfDay: 1,
          shortDay: 1,
          totalHours: { $round: ["$totalHours", 2] },
          avgHours: {
            $round: [
              {
                $cond: [
                  { $gt: ["$hoursCount", 0] },
                  { $divide: ["$totalHours", "$hoursCount"] },
                  0,
                ],
              },
              2,
            ],
          },
        },
      },
    ]);

    const attMap = new Map(attendanceAgg.map((x) => [String(x.employeeId), x]));

    // 3) Leaves for month (by startDate OR createdAt)
    const leavesRaw = await LeaveApplication.find({
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { startDate: { $gte: start, $lte: end } },
        { fromDate: { $gte: start, $lte: end } },
      ],
    }).lean();

    const leaveMap = new Map(); // empId -> {statusCounts, typeCounts, approvedDays, totals}
    for (const l of leavesRaw) {
      const empId = String(l.employeeId || "");
      if (!empId) continue;

      if (!leaveMap.has(empId)) {
        leaveMap.set(empId, {
          statusCounts: {},
          typeCounts: {},
          approvedDays: 0,
        });
      }

      const row = leaveMap.get(empId);

      const status = safeKey(l.status).toUpperCase();
      row.statusCounts[status] = (row.statusCounts[status] || 0) + 1;

      const type = safeKey(l.leaveType ?? l.type ?? l.category).toUpperCase();
      row.typeCounts[type] = (row.typeCounts[type] || 0) + 1;

      const days = computeLeaveDays(l);
      if (status === "APPROVED") row.approvedDays += days;
    }

    // 4) Build final rows (every employee)
    const data = employees.map((e) => {
      const empId = String(e._id);

      const attendance = attMap.get(empId) || {
        totalRecords: 0,
        present: 0,
        late: 0,
        absent: 0,
        fullDay: 0,
        threeQuarterDay: 0,
        halfDay: 0,
        shortDay: 0,
        totalHours: 0,
        avgHours: 0,
      };

      const leaves = leaveMap.get(empId) || {
        statusCounts: {},
        typeCounts: {},
        approvedDays: 0,
      };

      return {
        employeeId: empId,
        name: `${e.firstName || ""} ${e.lastName || ""}`.trim() || "Employee",
        department: e.department || "-",
        jobTitle: e.jobTitle || e.designation || e.position || "-",
        attendance,
        leaves,
      };
    });

    return res.json({
      success: true,
      monthKey,
      range: { startKey, endKey },
      data,
    });
  } catch (err) {
    console.error("getMonthlyEmployeesReport error:", err);
    return res.status(500).json({ error: "Failed to load monthly report" });
  }
};
