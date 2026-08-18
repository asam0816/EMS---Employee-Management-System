import Attendance from "../models/Attendance.js";
import LeaveApplication from "../models/LeaveApplication.js"; // <-- change if your file differs
import { getColomboDateKey } from "../utils/colomboTime.js";

const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

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

// ✅ ADMIN only: overall summary (all employees) last 30 days
// GET /api/summary
export const getAdminSummary = async (req, res) => {
  try {
    const now = new Date();
    const endKey = getColomboDateKey(now);
    const startKey = getColomboDateKey(addDays(now, -29));
    const startDate = addDays(now, -29);

    // -------- Attendance (all employees) --------
    const attendanceRows = await Attendance.find({
      attendanceDateKey: { $gte: startKey, $lte: endKey },
    }).lean();

    const attendance = {
      range: { startKey, endKey },
      totalRecords: attendanceRows.length,
      statusCounts: {},
      dayTypeCounts: {},
      totalHours: 0,
      avgHours: 0,
    };

    let hoursCount = 0;

    for (const a of attendanceRows) {
      const s = safeKey(a.status);
      attendance.statusCounts[s] = (attendance.statusCounts[s] || 0) + 1;

      const d = safeKey(a.dayType);
      attendance.dayTypeCounts[d] = (attendance.dayTypeCounts[d] || 0) + 1;

      if (typeof a.workingHours === "number") {
        attendance.totalHours += a.workingHours;
        hoursCount += 1;
      }
    }

    attendance.totalHours = Number(attendance.totalHours.toFixed(2));
    attendance.avgHours = hoursCount
      ? Number((attendance.totalHours / hoursCount).toFixed(2))
      : 0;

    // -------- Leaves (all employees) --------
    const leaveRows = await LeaveApplication.find({
      createdAt: { $gte: startDate, $lte: now },
    }).lean();

    const leaves = {
      rangeDays: 30,
      totalRequests: leaveRows.length,
      statusCounts: {},
      typeCounts: {},
      approvedDays: 0,
    };

    for (const l of leaveRows) {
      const status = safeKey(l.status).toUpperCase();
      leaves.statusCounts[status] = (leaves.statusCounts[status] || 0) + 1;

      const type = safeKey(l.leaveType ?? l.type ?? l.category);
      leaves.typeCounts[type] = (leaves.typeCounts[type] || 0) + 1;

      const days = computeLeaveDays(l);
      if (status === "APPROVED") leaves.approvedDays += days;
    }

    return res.json({ success: true, attendance, leaves });
  } catch (e) {
    console.error("getAdminSummary error:", e);
    return res.status(500).json({ error: "Failed to load summary" });
  }
};
