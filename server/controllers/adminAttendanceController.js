// server/controllers/adminDashboardController.js
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payslip from "../models/Payslip.js";
import AuditLog from "../models/AuditLog.js";

import { getColomboDateKey, getColomboMinutes } from "../utils/colomboTime.js";

const COLOMBO_TZ = "Asia/Colombo";

const isValidMonthKey = (v) => /^\d{4}-\d{2}$/.test(String(v || ""));

const safeStatus = (v) =>
  String(v || "")
    .toUpperCase()
    .trim();

const safeNum = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

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
  return { start, end, startKey, endKey, y, m };
};

const getMonthKeys = (monthKey, endKeyOverride = null) => {
  const { y, m } = monthKeyToRange(monthKey);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endDay = endKeyOverride
    ? Number(String(endKeyOverride).slice(8, 10))
    : lastDay;

  const keys = [];
  for (let day = 1; day <= endDay; day += 1) {
    keys.push(
      `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
  }
  return keys;
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

// Attendance "day key" must follow your shift rule:
// If check-in Colombo time is 00:00–03:59 => previous day (night shift base day)
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

const timeAgo = (date) => {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  if (!Number.isFinite(ms)) return null;

  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

export const getAdminDashboardSummary = async (req, res) => {
  try {
    // Month control
    const todayKey = getColomboDateKey(new Date());
    const currentMonthKey = todayKey.slice(0, 7);

    const monthKey = isValidMonthKey(req.query.month)
      ? String(req.query.month)
      : currentMonthKey;

    const {
      start,
      end,
      startKey,
      endKey: rawEndKey,
    } = monthKeyToRange(monthKey);

    // Month-to-date (if month is current)
    const periodEndKey = monthKey === currentMonthKey ? todayKey : rawEndKey;

    const monthKeys = getMonthKeys(monthKey, periodEndKey);
    const monthKeySet = new Set(monthKeys);

    const workingKeys = monthKeys.filter((k) => !isWeekend(k));
    const workingDays = workingKeys.length;

    // Employees (REAL)
    const employeesAll = await Employee.find({ isDeleted: { $ne: true } })
      .select(
        "_id firstName lastName name employeeCode employeeId department jobTitle designation position image createdAt employmentStatus",
      )
      .lean();

    const totalEmployees = employeesAll.length;

    const isActive = (e) =>
      String(e?.employmentStatus || "ACTIVE").toUpperCase() === "ACTIVE";
    const employeesActive = employeesAll.filter(isActive);
    const activeEmployees = employeesActive.length;
    const inactiveEmployees = totalEmployees - activeEmployees;

    const joinedThisMonth = employeesAll.filter((e) => {
      if (!e?.createdAt) return false;
      const k = getColomboDateKey(e.createdAt).slice(0, 7);
      return k === monthKey;
    }).length;

    // Attendance (month-to-date) - use attendanceDateKey primarily
    const employeeIds = employeesAll.map((e) => e._id);

    const attendanceDocs = await Attendance.find({
      employeeId: { $in: employeeIds },
      $or: [
        { attendanceDateKey: { $gte: startKey, $lte: periodEndKey } },
        { checkIn: { $gte: start, $lte: end } }, // fallback old records
        { date: { $gte: start, $lte: end } },
      ],
    })
      .select(
        "employeeId attendanceDateKey shiftKey status checkIn checkOut date workingHours workingMinutes dayType createdAt",
      )
      .lean();

    // Leaves (month-to-date)
    const leaveDocs = await LeaveApplication.find({
      employeeId: { $in: employeeIds },
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { startDate: { $lte: end }, endDate: { $gte: start } },
        { fromDate: { $lte: end }, toDate: { $gte: start } },
      ],
    }).lean();

    // Payroll (month-to-date)
    let payslips = [];
    try {
      payslips = await Payslip.find({ createdAt: { $gte: start, $lte: end } })
        .select(
          "employeeId employee netPay netSalary net total amount status createdAt",
        )
        .lean();
    } catch {
      payslips = [];
    }

    // Audit logs (recent)
    let audit = [];
    try {
      audit = await AuditLog.find({}).sort({ createdAt: -1 }).limit(12).lean();
    } catch {
      audit = [];
    }

    // ---- Build maps for fast lookup ----
    const attByEmp = new Map();
    for (const a of attendanceDocs) {
      const k = String(a.employeeId);
      if (!attByEmp.has(k)) attByEmp.set(k, []);
      attByEmp.get(k).push(a);
    }

    const leavesByEmp = new Map();
    for (const l of leaveDocs) {
      const k = String(l.employeeId);
      if (!leavesByEmp.has(k)) leavesByEmp.set(k, []);
      leavesByEmp.get(k).push(l);
    }

    // ---- Today: attendance + leave (REAL) ----
    const todayAttendanceDocs = attendanceDocs.filter((a) => {
      const dk = getAttendanceDayKey(a);
      // day-key based (works with your shift dayKey)
      return dk === todayKey;
    });

    const hasAttendanceRecordedToday = todayAttendanceDocs.length > 0;

    // present/late sets (distinct employee)
    const presentEmp = new Set();
    const lateEmp = new Set();

    for (const a of todayAttendanceDocs) {
      const st = safeStatus(a.status);
      if (st === "PRESENT" || st === "LATE")
        presentEmp.add(String(a.employeeId));
      if (st === "LATE") lateEmp.add(String(a.employeeId));
    }

    // leave today sets (approved/pending)
    const leaveApprovedEmp = new Set();
    const leavePendingEmp = new Set();
    for (const e of employeesAll) {
      const empId = String(e._id);
      const empLeaves = leavesByEmp.get(empId) || [];
      for (const lv of empLeaves) {
        const st = safeStatus(lv.status);
        const days = overlapLeaveDays(lv, new Set([todayKey]));
        if (!days.length) continue;
        if (st === "APPROVED") leaveApprovedEmp.add(empId);
        if (st === "PENDING") leavePendingEmp.add(empId);
      }
    }

    const presentToday = presentEmp.size;
    const lateToday = lateEmp.size;
    const leaveTodayApproved = leaveApprovedEmp.size;
    const leaveTodayPending = leavePendingEmp.size;

    // absent today: ONLY meaningful if there is any attendance recorded today
    const absentToday = hasAttendanceRecordedToday
      ? Math.max(0, activeEmployees - presentToday - leaveTodayApproved)
      : null;

    const attendanceTodayPercent =
      hasAttendanceRecordedToday && activeEmployees > 0
        ? Math.round((presentToday / activeEmployees) * 100)
        : null;

    // ---- Weekly trend (last 7 colombo date keys) ----
    const last7 = [];
    for (let i = 6; i >= 0; i -= 1) {
      const [y, m, d] = todayKey.split("-").map(Number);
      const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      base.setUTCDate(base.getUTCDate() - i);
      last7.push(base.toISOString().slice(0, 10));
    }

    const weekly = last7.map((dk) => {
      const docs = attendanceDocs.filter((a) => getAttendanceDayKey(a) === dk);
      const hasData = docs.length > 0;

      const presentSet = new Set();
      const lateSet = new Set();
      for (const a of docs) {
        const st = safeStatus(a.status);
        if (st === "PRESENT" || st === "LATE")
          presentSet.add(String(a.employeeId));
        if (st === "LATE") lateSet.add(String(a.employeeId));
      }

      const leaveApprovedSet = new Set();
      for (const e of employeesAll) {
        const empId = String(e._id);
        const empLeaves = leavesByEmp.get(empId) || [];
        for (const lv of empLeaves) {
          if (safeStatus(lv.status) !== "APPROVED") continue;
          const days = overlapLeaveDays(lv, new Set([dk]));
          if (days.length) leaveApprovedSet.add(empId);
        }
      }

      const present = presentSet.size;
      const late = lateSet.size;
      const leave = leaveApprovedSet.size;
      const absent = hasData
        ? Math.max(0, activeEmployees - present - leave)
        : null;

      const percent =
        hasData && activeEmployees > 0
          ? Math.round((present / activeEmployees) * 100)
          : null;

      return {
        dateKey: dk,
        day: weekdayShortColombo(dk),
        present,
        late,
        leave,
        absent,
        attendancePercent: percent,
        hasData,
      };
    });

    const weeklyHasAnyData = weekly.some((d) => d.hasData);

    // ---- Leave overview (month-to-date) ----
    const leaveCounts = { pending: 0, approved: 0, rejected: 0 };
    for (const lv of leaveDocs) {
      const st = safeStatus(lv.status);
      if (st === "PENDING") leaveCounts.pending += 1;
      else if (st === "APPROVED") leaveCounts.approved += 1;
      else if (st === "REJECTED" || st === "DECLINED" || st === "DENIED")
        leaveCounts.rejected += 1;
    }

    // upcoming leave (next 5) — approved leaves that start in the future
    const upcoming = [];
    const today = new Date();
    for (const lv of leaveDocs) {
      if (safeStatus(lv.status) !== "APPROVED") continue;
      const startDate = lv.startDate || lv.fromDate;
      const endDate = lv.endDate || lv.toDate;
      if (!startDate || !endDate) continue;

      const startD = new Date(startDate);
      const endD = new Date(endDate);
      if (isNaN(startD.getTime()) || isNaN(endD.getTime())) continue;
      if (startD < today) continue;

      const emp = employeesAll.find(
        (e) => String(e._id) === String(lv.employeeId),
      );
      if (!emp) continue;

      upcoming.push({
        employeeId: String(emp._id),
        name: getEmployeeName(emp),
        type: lv.leaveType || lv.type || "Leave",
        startDate: startD.toISOString(),
        endDate: endD.toISOString(),
      });
    }
    upcoming.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    // ---- Monthly attendance table (REAL, day-based, no double-count for 2 shifts) ----
    const monthWorkingKeysSet = new Set(workingKeys);

    // attendance per employee (distinct days)
    const monthlyRows = [];
    const deptBuckets = new Map(); // dept -> {sumPct, count}

    for (const e of employeesAll) {
      const empId = String(e._id);

      // joining date: do not count before join
      const joinKey = e.createdAt ? getColomboDateKey(e.createdAt) : startKey;
      const effectiveStartKey = joinKey > startKey ? joinKey : startKey;

      const empWorkingKeys = workingKeys.filter((k) => k >= effectiveStartKey);
      const empWorkingSet = new Set(empWorkingKeys);
      const empWorkingDays = empWorkingKeys.length;

      const empAtt = attByEmp.get(empId) || [];
      const presentDays = new Set();
      const lateDays = new Set();
      let totalHours = 0;

      for (const a of empAtt) {
        const dk = getAttendanceDayKey(a);
        if (!dk) continue;
        if (!empWorkingSet.has(dk)) continue;

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

      // leaves (approved days)
      const empLeaves = leavesByEmp.get(empId) || [];
      const leaveDays = new Set();
      for (const lv of empLeaves) {
        if (safeStatus(lv.status) !== "APPROVED") continue;
        const days = overlapLeaveDays(lv, empWorkingSet);
        for (const dk of days) leaveDays.add(dk);
      }

      // present overrides leave
      for (const dk of presentDays) if (leaveDays.has(dk)) leaveDays.delete(dk);

      const present = presentDays.size;
      const late = lateDays.size;
      const leave = leaveDays.size;

      // absent meaningful when there are working days in period
      const absent =
        empWorkingDays > 0 ? Math.max(0, empWorkingDays - present - leave) : 0;

      const attendancePercent =
        empWorkingDays > 0
          ? Math.round((present / empWorkingDays) * 100)
          : null;

      const dept = e.department || "Unknown";

      if (attendancePercent != null) {
        const bucket = deptBuckets.get(dept) || { sum: 0, count: 0 };
        bucket.sum += attendancePercent;
        bucket.count += 1;
        deptBuckets.set(dept, bucket);
      }

      monthlyRows.push({
        employeeId: empId,
        employeeCode: getEmployeeCode(e),
        name: getEmployeeName(e),
        image: e.image || null,
        department: dept,
        jobTitle: getJobTitle(e),

        workingDays: empWorkingDays,
        present,
        absent,
        leave,
        late,
        totalHours: Math.round(totalHours * 100) / 100,
        attendancePercent,
      });
    }

    // sort critical first
    monthlyRows.sort(
      (a, b) => (a.attendancePercent ?? 999) - (b.attendancePercent ?? 999),
    );

    const departments = [
      "ALL",
      ...Array.from(
        new Set(employeesAll.map((e) => e.department).filter(Boolean)),
      ),
    ];

    const departmentAttendance = Array.from(deptBuckets.entries())
      .map(([department, v]) => ({
        department,
        attendancePercent: v.count
          ? Number((v.sum / v.count).toFixed(1))
          : null,
        employees: v.count,
      }))
      .filter((d) => d.department)
      .sort((a, b) => (b.attendancePercent ?? 0) - (a.attendancePercent ?? 0));

    // ---- Alerts (REAL conditions only) ----
    const alerts = [];

    if (leaveCounts.pending > 0) {
      alerts.push({
        type: "LEAVE",
        severity: "MEDIUM",
        title: "Leave requests pending",
        message: `${leaveCounts.pending} leave request(s) require approval`,
        to: "/leave",
      });
    }

    // low attendance employees (month-to-date)
    const lowAttendance = monthlyRows
      .filter((r) => r.attendancePercent != null && r.attendancePercent < 80)
      .slice(0, 5);

    for (const r of lowAttendance) {
      alerts.push({
        type: "ATTENDANCE",
        severity: "HIGH",
        title: "Low attendance",
        message: `${r.name} has ${r.attendancePercent}% attendance`,
        employeeId: r.employeeId,
      });
    }

    const frequentLate = monthlyRows
      .filter((r) => (r.late ?? 0) >= 5)
      .slice(0, 5);

    for (const r of frequentLate) {
      alerts.push({
        type: "ATTENDANCE",
        severity: "MEDIUM",
        title: "Frequent late arrivals",
        message: `${r.name} has ${r.late} late day(s) this month`,
        employeeId: r.employeeId,
      });
    }

    // ---- Payroll (REAL) ----
    const payrollHasData = payslips.length > 0;
    const payrollTotal = payslips.reduce((s, p) => s + sumPayslip(p), 0);

    const paidEmployeeSet = new Set(
      payslips
        .map((p) => String(p.employeeId || p.employee || ""))
        .filter(Boolean),
    );

    const employeesPaid = paidEmployeeSet.size;
    const pendingPayslips =
      activeEmployees > 0 ? Math.max(0, activeEmployees - employeesPaid) : null;

    // ---- Recent activity (REAL) ----
    const recentActivity = audit.map((a) => ({
      id: String(a._id),
      when: timeAgo(a.createdAt),
      at: a.createdAt,
      action: a.action || a.type || "ACTIVITY",
      label: a.entityLabel || a.message || a.summary || null,
      meta: a.meta || null,
    }));

    // ---- Notifications (REAL “events”) ----
    const notifications = {
      count:
        (leaveCounts.pending || 0) +
        (lowAttendance.length || 0) +
        (pendingPayslips || 0),
      items: [
        ...(leaveCounts.pending
          ? [
              {
                type: "LEAVE",
                text: `${leaveCounts.pending} pending leave request(s)`,
              },
            ]
          : []),
        ...(lowAttendance.length
          ? [
              {
                type: "ATTENDANCE",
                text: `${lowAttendance.length} employee(s) below 80% attendance`,
              },
            ]
          : []),
        ...(pendingPayslips
          ? [
              {
                type: "PAYROLL",
                text: `${pendingPayslips} payslip(s) pending for active employees`,
              },
            ]
          : []),
      ],
    };

    // ---- Pending actions (REAL) ----
    const pendingActions = {
      total: (leaveCounts.pending || 0) + (pendingPayslips || 0),
      leaves: leaveCounts.pending || 0,
      payslips: pendingPayslips || 0,
      other: 0,
    };

    return res.json({
      success: true,
      monthKey,
      periodEndKey,

      employees: {
        total: totalEmployees,
        active: activeEmployees,
        inactive: inactiveEmployees,
        joinedThisMonth,
      },

      today: {
        dateKey: todayKey,
        hasAttendanceRecorded: hasAttendanceRecordedToday,
        present: hasAttendanceRecordedToday ? presentToday : null,
        late: hasAttendanceRecordedToday ? lateToday : null,
        absent: absentToday,
        leaveApproved: leaveTodayApproved,
        leavePending: leaveTodayPending,
        attendancePercent: attendanceTodayPercent,
      },

      weekly: {
        hasAnyData: weeklyHasAnyData,
        days: weekly,
      },

      leaves: {
        month: leaveCounts,
        upcoming: upcoming.slice(0, 5),
      },

      payroll: {
        hasData: payrollHasData,
        total: payrollHasData ? payrollTotal : null,
        payslipsGenerated: payslips.length,
        employeesPaid: payrollHasData ? employeesPaid : null,
        activeEmployees,
        pending: payrollHasData ? pendingPayslips : null,
      },

      monthlyAttendance: {
        workingDays,
        rows: monthlyRows,
        departments,
        hasAnyData: attendanceDocs.length > 0,
      },

      departmentAttendance,

      alerts,

      recentActivity,

      notifications,

      pendingActions,
    });
  } catch (e) {
    console.error("getAdminDashboardSummary error:", e);
    return res
      .status(500)
      .json({ error: "Failed to load admin dashboard summary" });
  }
};
