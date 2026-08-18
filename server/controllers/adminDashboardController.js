import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payslip from "../models/Payslip.js";
import { getColomboDateKey, getColomboMinutes } from "../utils/colomboTime.js";

const COLOMBO_TZ = "Asia/Colombo";

const isValidMonthKey = (v) => /^\d{4}-\d{2}$/.test(String(v || ""));
const safeStatus = (v) =>
  String(v || "")
    .toUpperCase()
    .trim();
const safeNum = (v, fb = 0) => (Number.isFinite(Number(v)) ? Number(v) : fb);

const prevDateKey = (dateKey) => {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
};

const monthKeyToRange = (monthKey) => {
  const [y, m] = String(monthKey).split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);
  return { start, end, startKey, endKey };
};

const weekdayShortColombo = (dateKey) => {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO_TZ,
    weekday: "short",
  }).format(d);
};

const isWeekend = (dateKey) => {
  const wd = weekdayShortColombo(dateKey);
  return wd === "Sat" || wd === "Sun";
};

const weekdayKeysBetween = (startKey, endKey) => {
  if (!startKey || !endKey || startKey > endKey) return [];
  const cur = new Date(`${startKey}T12:00:00.000Z`);
  const last = new Date(`${endKey}T12:00:00.000Z`);
  const out = [];
  while (cur <= last) {
    const key = cur.toISOString().slice(0, 10);
    if (!isWeekend(key)) out.push(key);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
};

// ✅ shift base dayKey rule for attendance records:
const shiftBaseDayKeyFromCheckIn = (checkIn) => {
  const dk = getColomboDateKey(checkIn);
  const mins = getColomboMinutes(checkIn);
  if (mins < 4 * 60) return prevDateKey(dk);
  return dk;
};

const getAttendanceDayKey = (record) => {
  if (record?.attendanceDateKey) return String(record.attendanceDateKey);
  const base = record?.checkIn || record?.date || record?.createdAt;
  if (!base) return null;
  return shiftBaseDayKeyFromCheckIn(base);
};

// ✅ current running shift base dayKey (fixes midnight collapse)
const getCurrentShiftBaseDayKey = () => {
  const now = new Date();
  const todayKey = getColomboDateKey(now);
  const mins = getColomboMinutes(now);
  // between 00:00–03:59 => still yesterday's NIGHT shift base day
  return mins < 4 * 60 ? prevDateKey(todayKey) : todayKey;
};

/**
 * ✅ last fully closed dayKey:
 * - If now < 04:00 => night shift not finished for yesterday base => last closed = today-2
 * - else          => last closed = today-1
 */
const getLastFinalDayKey = () => {
  const now = new Date();
  const todayKey = getColomboDateKey(now);
  const mins = getColomboMinutes(now);
  if (mins < 4 * 60) return prevDateKey(prevDateKey(todayKey));
  return prevDateKey(todayKey);
};

// Leave overlap helpers (weekday only)
const getLeaveRange = (leave) => {
  const start = leave?.startDate || leave?.fromDate;
  const end = leave?.endDate || leave?.toDate;
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;

  const startUTC = new Date(
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()),
  );
  const endUTC = new Date(
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()),
  );
  return { startUTC, endUTC };
};

const overlapLeaveDays = (leave, keySet) => {
  const range = getLeaveRange(leave);
  if (!range) return [];
  const out = [];
  const cur = new Date(range.startUTC);
  while (cur <= range.endUTC) {
    const key = cur.toISOString().slice(0, 10);
    if (keySet.has(key) && !isWeekend(key)) out.push(key);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
};

const getEmployeeName = (e) => {
  const n = `${e?.firstName || ""} ${e?.lastName || ""}`.trim();
  return n || e?.name || "Employee";
};

const getEmployeeCode = (e) =>
  e?.employeeCode || e?.employeeId || String(e?._id || "").slice(-6);

const getJobTitle = (e) =>
  e?.jobTitle || e?.designation || e?.position || "Employee";

const sumPayslip = (p) =>
  safeNum(p?.netPay ?? p?.netSalary ?? p?.net ?? p?.total ?? p?.amount, 0);

export const getAdminDashboardSummary = async (req, res) => {
  try {
    const now = new Date();
    const todayKey = getColomboDateKey(now);
    const currentMonthKey = todayKey.slice(0, 7);

    const monthKey = isValidMonthKey(req.query.month)
      ? String(req.query.month)
      : currentMonthKey;

    const {
      start,
      end,
      startKey,
      endKey: monthEndKey,
    } = monthKeyToRange(monthKey);
    const periodEndKey = monthKey === currentMonthKey ? todayKey : monthEndKey;

    // ✅ these two keys drive strict absence logic correctly
    const lastFinalDayKey =
      monthKey === currentMonthKey ? getLastFinalDayKey() : periodEndKey;
    const currentShiftBaseKey = getCurrentShiftBaseDayKey(); // could be yesterday after midnight

    // Employees
    const employees = await Employee.find({ isDeleted: { $ne: true } })
      .select(
        "_id firstName lastName name employeeCode employeeId department jobTitle designation position image createdAt joinedAt hireDate employmentStatus",
      )
      .lean();

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(
      (e) => String(e?.employmentStatus || "ACTIVE").toUpperCase() === "ACTIVE",
    ).length;

    const joinedThisMonth = employees.filter((e) => {
      if (!e?.createdAt) return false;
      return getColomboDateKey(e.createdAt).slice(0, 7) === monthKey;
    }).length;

    const employeeIds = employees.map((e) => e._id);

    // Attendance
    const attendanceDocs = await Attendance.find({
      employeeId: { $in: employeeIds },
      $or: [
        { attendanceDateKey: { $gte: startKey, $lte: periodEndKey } },
        { checkIn: { $gte: start, $lte: end } },
        { date: { $gte: start, $lte: end } },
      ],
    })
      .select(
        "employeeId attendanceDateKey status checkIn checkOut date workingHours workingMinutes createdAt shiftKey dayType",
      )
      .lean();

    // Leaves
    const leaveDocs = await LeaveApplication.find({
      employeeId: { $in: employeeIds },
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { startDate: { $lte: end }, endDate: { $gte: start } },
        { fromDate: { $lte: end }, toDate: { $gte: start } },
      ],
    }).lean();

    // Payslips
    let payslips = [];
    try {
      payslips = await Payslip.find({ createdAt: { $gte: start, $lte: end } })
        .select("employeeId netPay netSalary net total amount createdAt")
        .lean();
    } catch {
      payslips = [];
    }

    // Maps
    const attByEmp = new Map();
    for (const a of attendanceDocs) {
      const k = String(a.employeeId);
      if (!attByEmp.has(k)) attByEmp.set(k, []);
      attByEmp.get(k).push(a);
    }

    const leaveByEmp = new Map();
    for (const l of leaveDocs) {
      const k = String(l.employeeId);
      if (!leaveByEmp.has(k)) leaveByEmp.set(k, []);
      leaveByEmp.get(k).push(l);
    }

    // ✅ Today summary (no fake absent)
    const todayDocs = attendanceDocs.filter(
      (a) => getAttendanceDayKey(a) === todayKey,
    );
    const hasAttendanceRecordedToday = todayDocs.length > 0;

    const presentTodaySet = new Set();
    const lateTodaySet = new Set();
    for (const a of todayDocs) {
      const st = safeStatus(a.status);
      if (st === "PRESENT" || st === "LATE")
        presentTodaySet.add(String(a.employeeId));
      if (st === "LATE") lateTodaySet.add(String(a.employeeId));
    }

    const attendanceTodayPercent =
      hasAttendanceRecordedToday && activeEmployees > 0
        ? Math.round((presentTodaySet.size / activeEmployees) * 100)
        : null;

    // Leave counts (month)
    const leaveCounts = { pending: 0, approved: 0, rejected: 0 };
    for (const lv of leaveDocs) {
      const st = safeStatus(lv.status);
      if (st === "PENDING") leaveCounts.pending += 1;
      else if (st === "APPROVED") leaveCounts.approved += 1;
      else if (st === "REJECTED" || st === "DECLINED" || st === "DENIED")
        leaveCounts.rejected += 1;
    }

    // ✅ Strict monthly table with correct midnight handling
    const deptBuckets = new Map();

    const monthlyRows = employees.map((e) => {
      const empId = String(e._id);

      const joinBase = e?.joinedAt || e?.hireDate || e?.createdAt || now;
      const joinKey = getColomboDateKey(joinBase);
      const employeeStartKey = joinKey > startKey ? joinKey : startKey;

      const finalEndKey =
        lastFinalDayKey < periodEndKey ? lastFinalDayKey : periodEndKey;

      // final (closed) working days
      const finalWorkingKeys = weekdayKeysBetween(
        employeeStartKey,
        finalEndKey,
      );
      const finalWorkingSet = new Set(finalWorkingKeys);

      // ✅ pending key = current running shift base key (can be yesterday after midnight)
      const pendingKey =
        currentShiftBaseKey > finalEndKey &&
        currentShiftBaseKey >= employeeStartKey &&
        currentShiftBaseKey <= periodEndKey &&
        !isWeekend(currentShiftBaseKey)
          ? currentShiftBaseKey
          : null;

      const pendingKeySet = pendingKey ? new Set([pendingKey]) : new Set();

      const empAtt = attByEmp.get(empId) || [];
      const presentDays = new Set();
      const lateDays = new Set();
      let totalHours = 0;

      for (const a of empAtt) {
        const dk = getAttendanceDayKey(a);
        if (!dk) continue;

        const st = safeStatus(a.status);
        if (st === "PRESENT" || st === "LATE") presentDays.add(dk);
        if (st === "LATE") lateDays.add(dk);

        const wh =
          a.workingHours != null
            ? safeNum(a.workingHours, 0)
            : a.workingMinutes != null
              ? safeNum(a.workingMinutes, 0) / 60
              : a.checkIn && a.checkOut
                ? Math.max(
                    0,
                    (new Date(a.checkOut) - new Date(a.checkIn)) / 3600000,
                  )
                : 0;

        totalHours += safeNum(wh, 0);
      }

      // Approved leave days (final)
      const empLeaves = leaveByEmp.get(empId) || [];
      const leaveDaysFinal = new Set();
      let leavePendingCount = 0;

      for (const lv of empLeaves) {
        if (safeStatus(lv.status) !== "APPROVED") continue;

        const daysFinal = overlapLeaveDays(lv, finalWorkingSet);
        for (const dk of daysFinal) leaveDaysFinal.add(dk);

        // pendingKey leave (if running shift base is a leave day)
        if (pendingKey) {
          const daysPending = overlapLeaveDays(lv, pendingKeySet);
          if (daysPending.length) leavePendingCount = 1;
        }
      }

      // present overrides leave (final)
      for (const dk of presentDays)
        if (leaveDaysFinal.has(dk)) leaveDaysFinal.delete(dk);

      const presentFinal = finalWorkingKeys.filter((k) =>
        presentDays.has(k),
      ).length;
      const lateFinal = finalWorkingKeys.filter((k) => lateDays.has(k)).length;
      const leaveFinal = finalWorkingKeys.filter((k) =>
        leaveDaysFinal.has(k),
      ).length;
      const absentFinal = Math.max(
        0,
        finalWorkingKeys.length - presentFinal - leaveFinal,
      );

      // include pending key only if employee already has data (present or approved leave)
      const includePending =
        !!pendingKey &&
        (presentDays.has(pendingKey) || leavePendingCount === 1);

      const workingDays = finalWorkingKeys.length + (includePending ? 1 : 0);
      const present =
        presentFinal + (includePending && presentDays.has(pendingKey) ? 1 : 0);
      const late =
        lateFinal + (includePending && lateDays.has(pendingKey) ? 1 : 0);
      const leave =
        leaveFinal + (includePending && leavePendingCount === 1 ? 1 : 0);

      const attendancePercent =
        workingDays > 0 ? Math.round((present / workingDays) * 100) : null;

      const dept = e.department || "Unknown";
      if (attendancePercent != null) {
        const b = deptBuckets.get(dept) || { sum: 0, count: 0 };
        b.sum += attendancePercent;
        b.count += 1;
        deptBuckets.set(dept, b);
      }

      return {
        employeeId: empId,
        employeeCode: getEmployeeCode(e),
        name: getEmployeeName(e),
        image: e.image || null,
        department: dept,
        jobTitle: getJobTitle(e),

        workingDays,
        present,
        absent: absentFinal,
        leave,
        late,
        totalHours: Math.round(totalHours * 100) / 100,
        attendancePercent,
      };
    });

    const departmentAttendance = Array.from(deptBuckets.entries())
      .map(([department, v]) => ({
        department,
        attendancePercent: v.count
          ? Number((v.sum / v.count).toFixed(1))
          : null,
      }))
      .sort((a, b) => (b.attendancePercent ?? 0) - (a.attendancePercent ?? 0));

    const payrollHasData = payslips.length > 0;
    const payrollTotal = payslips.reduce((s, p) => s + sumPayslip(p), 0);

    return res.json({
      success: true,
      monthKey,
      periodEndKey,
      // helpful debug info
      lastFinalDayKey,
      currentShiftBaseKey,

      employees: {
        total: totalEmployees,
        active: activeEmployees,
        inactive: Math.max(0, totalEmployees - activeEmployees),
        joinedThisMonth,
      },

      today: {
        dateKey: todayKey,
        hasAttendanceRecorded: hasAttendanceRecordedToday,
        present: hasAttendanceRecordedToday ? presentTodaySet.size : null,
        late: hasAttendanceRecordedToday ? lateTodaySet.size : null,
        absent: null, // strict: do not mark today absent
        leaveApproved: leaveCounts.approved,
        leavePending: leaveCounts.pending,
        attendancePercent: attendanceTodayPercent,
      },

      monthlyAttendance: {
        hasAnyData: attendanceDocs.length > 0 || leaveDocs.length > 0,
        rows: monthlyRows,
        departments: [
          "ALL",
          ...Array.from(
            new Set(employees.map((e) => e.department).filter(Boolean)),
          ),
        ],
      },

      departmentAttendance,

      leaves: { month: leaveCounts, upcoming: [] },

      payroll: {
        hasData: payrollHasData,
        total: payrollHasData ? payrollTotal : null,
        payslipsGenerated: payslips.length,
      },

      alerts: [],
      notifications: { count: 0, items: [] },
      pendingActions: { total: 0, leaves: 0, payslips: 0, other: 0 },
      weekly: { hasAnyData: false, days: [] },
    });
  } catch (e) {
    console.error("getAdminDashboardSummary error:", e);
    return res
      .status(500)
      .json({ error: "Failed to load admin dashboard summary" });
  }
};
