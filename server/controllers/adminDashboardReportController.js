import Employee from "../models/Employee.js";
import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import LeaveApplication from "../models/LeaveApplication.js";

import { getColomboDateKey, getColomboMinutes } from "../utils/colomboTime.js";

// ---------- helpers ----------
const monthKeyToRange = (monthKey) => {
  const [y, m] = String(monthKey).split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);
  return { start, end, startKey, endKey };
};

const getMonthKeys = (monthKey) => {
  const { start, end } = monthKeyToRange(monthKey);
  const keys = [];
  const d = new Date(start);
  while (d <= end) {
    keys.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return keys;
};

const weekdayShortColombo = (dateKey) => {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    weekday: "short",
  }).format(d);
};

const isWeekend = (dateKey) => {
  const wd = weekdayShortColombo(dateKey);
  return wd === "Sat" || wd === "Sun";
};

const prevDateKey = (dateKey) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
};

/**
 * ✅ SHIFT BASE dayKey:
 * If check-in Colombo time is 00:00–03:59 => previous day key (night shift base day)
 */
const shiftBaseDayKeyFromCheckIn = (checkInDate) => {
  const dayKey = getColomboDateKey(checkInDate);
  const mins = getColomboMinutes(checkInDate);
  if (mins < 4 * 60) return prevDateKey(dayKey);
  return dayKey;
};

const overlapLeaveDaysInKeySet = (leave, keySet) => {
  const start = leave?.startDate || leave?.fromDate;
  const end = leave?.endDate || leave?.toDate;
  if (!start || !end) return [];

  const a = new Date(start);
  const b = new Date(end);
  if (isNaN(a) || isNaN(b)) return [];

  const cur = new Date(
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()),
  );
  const last = new Date(
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()),
  );

  const days = [];
  while (cur <= last) {
    const key = cur.toISOString().slice(0, 10);
    if (keySet.has(key)) days.push(key);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
};

const setIntersectionSize = (setA, setB) => {
  let n = 0;
  for (const v of setA) if (setB.has(v)) n += 1;
  return n;
};

const clampPct = (n) => Math.max(0, Math.min(100, Number(n) || 0));

// -----------------------------------------------------------
// ✅ ADMIN: GET /api/reports/admin-attendance?month=YYYY-MM&department=ALL&search=
// Returns Working Days / Present / Absent / Leave / Late (DAY-BASED)
// -----------------------------------------------------------
export const getAdminMonthlyAttendance = async (req, res) => {
  try {
    const now = new Date();
    const todayKey = getColomboDateKey(now);
    const currentMonthKey = todayKey.slice(0, 7);

    const monthKey = String(req.query.month || currentMonthKey);
    const department = String(req.query.department || "ALL");
    const search = String(req.query.search || "")
      .trim()
      .toLowerCase();

    const { start, end, startKey, endKey } = monthKeyToRange(monthKey);

    // month-to-date for current month, full month for past months
    const monthKeys = getMonthKeys(monthKey);
    const periodEndKey = monthKey === currentMonthKey ? todayKey : endKey;
    const periodKeys = monthKeys.filter((k) => k <= periodEndKey);
    const periodKeySet = new Set(periodKeys);

    // employees
    const empQuery = { isDeleted: { $ne: true }, employmentStatus: "ACTIVE" };
    if (department !== "ALL") empQuery.department = department;

    const employeesRaw = await Employee.find(empQuery)
      .select(
        "_id userId firstName lastName employeeId employeeCode department jobTitle designation position image createdAt",
      )
      .lean();

    // ✅ filter only EMPLOYEE users (remove admins)
    const userIds = employeesRaw.map((e) => e.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } })
      .select("_id role")
      .lean();
    const roleMap = new Map(users.map((u) => [String(u._id), u.role]));

    const employees = employeesRaw.filter(
      (e) => roleMap.get(String(e.userId)) === "EMPLOYEE",
    );

    const departments = [
      "ALL",
      ...Array.from(
        new Set(employees.map((e) => e.department).filter(Boolean)),
      ),
    ];
    const empIds = employees.map((e) => e._id);

    // attendance docs (buffer to catch cross-midnight)
    const startBuf = new Date(start.getTime() - 86400000);
    const endBuf = new Date(end.getTime() + 86400000);

    const attendanceDocs = await Attendance.find({
      employeeId: { $in: empIds },
      $or: [
        { attendanceDateKey: { $gte: startKey, $lte: endKey } },
        { checkIn: { $gte: startBuf, $lte: endBuf } },
        { date: { $gte: startBuf, $lte: endBuf } },
      ],
    })
      .select("employeeId attendanceDateKey checkIn date status")
      .lean();

    const leaveDocs = await LeaveApplication.find({
      employeeId: { $in: empIds },
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { startDate: { $lte: end }, endDate: { $gte: start } },
        { fromDate: { $lte: end }, toDate: { $gte: start } },
      ],
    }).lean();

    // group attendance by employee
    const attByEmp = new Map();
    for (const a of attendanceDocs) {
      const k = String(a.employeeId);
      if (!attByEmp.has(k)) attByEmp.set(k, []);
      attByEmp.get(k).push(a);
    }

    // group leaves by employee
    const leaveByEmp = new Map();
    for (const l of leaveDocs) {
      const k = String(l.employeeId);
      if (!leaveByEmp.has(k)) leaveByEmp.set(k, []);
      leaveByEmp.get(k).push(l);
    }

    const rows = [];

    // build per-employee
    for (const e of employees) {
      const employeeId = String(e._id);
      const name =
        `${e.firstName || ""} ${e.lastName || ""}`.trim() || "Employee";
      const employeeCode =
        e.employeeCode || e.employeeId || employeeId.slice(-6);
      const dept = e.department || "-";

      if (search) {
        const hay = `${name} ${employeeCode} ${dept}`.toLowerCase();
        if (!hay.includes(search)) continue;
      }

      // join date (use createdAt as fallback)
      const joinKey = getColomboDateKey(e.createdAt || new Date());
      const employeeStartKey = joinKey > startKey ? joinKey : startKey;

      // keys for this employee
      const empPeriodKeys = periodKeys.filter((k) => k >= employeeStartKey);
      const empKeySet = new Set(empPeriodKeys);

      // ✅ expected working days = weekdays + weekends only if employee has any record that weekend
      const weekdayKeys = empPeriodKeys.filter((k) => !isWeekend(k));

      // attendance day sets
      const presentDays = new Set();
      const lateDays = new Set();
      const explicitAbsentDays = new Set(); // if you ever store ABSENT

      const empAtt = attByEmp.get(employeeId) || [];
      for (const a of empAtt) {
        const base = a.checkIn || a.date;
        if (!base) continue;

        const dk = a.attendanceDateKey || shiftBaseDayKeyFromCheckIn(base);
        if (!empKeySet.has(dk)) continue;

        const st = String(a.status || "");
        if (st === "PRESENT" || st === "LATE") presentDays.add(dk);
        if (st === "LATE") lateDays.add(dk);
        if (st === "ABSENT") explicitAbsentDays.add(dk);
      }

      // leave days (approved, unique)
      const leaveDays = new Set();
      const empLeaves = leaveByEmp.get(employeeId) || [];
      const approvedLeaves = empLeaves.filter(
        (x) => String(x.status || "").toUpperCase() === "APPROVED",
      );
      for (const l of approvedLeaves) {
        for (const dk of overlapLeaveDaysInKeySet(l, empKeySet))
          leaveDays.add(dk);
      }

      // if present, it overrides leave
      for (const dk of presentDays) if (leaveDays.has(dk)) leaveDays.delete(dk);

      // include weekend days ONLY if there is any record that day (present/leave/absent)
      const weekendRecordDays = new Set();
      for (const dk of presentDays)
        if (isWeekend(dk)) weekendRecordDays.add(dk);
      for (const dk of leaveDays) if (isWeekend(dk)) weekendRecordDays.add(dk);
      for (const dk of explicitAbsentDays)
        if (isWeekend(dk)) weekendRecordDays.add(dk);

      const countableDaysSet = new Set([...weekdayKeys, ...weekendRecordDays]);

      const workingDays = countableDaysSet.size;

      const present = setIntersectionSize(presentDays, countableDaysSet);
      const late = setIntersectionSize(lateDays, countableDaysSet);
      const leave = setIntersectionSize(leaveDays, countableDaysSet);

      // absent = expected working days not present and not on leave
      const absent = Math.max(0, workingDays - present - leave);

      const attendancePercent = workingDays
        ? clampPct(Math.round((present / workingDays) * 100))
        : 0;

      rows.push({
        employeeId,
        employeeCode,
        name,
        image: e.image || null,
        department: dept,
        jobTitle: e.jobTitle || e.designation || e.position || "-",
        workingDays,
        present,
        absent,
        leave,
        late,
        attendancePercent,
      });
    }

    const pendingLeaves = leaveDocs.filter(
      (l) => String(l.status || "").toUpperCase() === "PENDING",
    ).length;

    return res.json({
      success: true,
      monthKey,
      periodEndKey,
      departments,
      top: {
        totalEmployees: employees.length,
        pendingLeaves,
      },
      monthly: { rows },
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Failed to load admin attendance report" });
  }
};

// -----------------------------------------------------------
// ✅ Drawer endpoint: GET /api/reports/admin-attendance/:employeeId?month=YYYY-MM
// -----------------------------------------------------------
export const getAdminEmployeeMonthlyDetail = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const now = new Date();
    const todayKey = getColomboDateKey(now);
    const currentMonthKey = todayKey.slice(0, 7);

    const monthKey = String(req.query.month || currentMonthKey);
    const { start, end, startKey, endKey } = monthKeyToRange(monthKey);

    const monthKeys = getMonthKeys(monthKey);
    const periodEndKey = monthKey === currentMonthKey ? todayKey : endKey;
    const periodKeys = monthKeys.filter((k) => k <= periodEndKey);
    const periodKeySet = new Set(periodKeys);

    const emp = await Employee.findById(employeeId)
      .select(
        "_id firstName lastName employeeId employeeCode department jobTitle designation position image createdAt",
      )
      .lean();

    if (!emp) return res.status(404).json({ error: "Employee not found" });

    const joinKey = getColomboDateKey(emp.createdAt || new Date());
    const employeeStartKey = joinKey > startKey ? joinKey : startKey;

    const empPeriodKeys = periodKeys.filter((k) => k >= employeeStartKey);
    const empKeySet = new Set(empPeriodKeys);

    const startBuf = new Date(start.getTime() - 86400000);
    const endBuf = new Date(end.getTime() + 86400000);

    const att = await Attendance.find({
      employeeId: emp._id,
      $or: [
        { attendanceDateKey: { $gte: startKey, $lte: endKey } },
        { checkIn: { $gte: startBuf, $lte: endBuf } },
        { date: { $gte: startBuf, $lte: endBuf } },
      ],
    })
      .select("attendanceDateKey checkIn date status")
      .lean();

    const leaves = await LeaveApplication.find({
      employeeId: emp._id,
      status: "APPROVED",
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } },
        { fromDate: { $lte: end }, toDate: { $gte: start } },
      ],
    }).lean();

    const dailyStatus = {};
    for (const k of empPeriodKeys)
      dailyStatus[k] = isWeekend(k) ? "WEEKEND" : "ABSENT";

    const leaveDays = new Set();
    for (const l of leaves) {
      for (const dk of overlapLeaveDaysInKeySet(l, empKeySet)) {
        leaveDays.add(dk);
        dailyStatus[dk] = "LEAVE";
      }
    }

    const presentDays = new Set();
    const lateDays = new Set();

    for (const a of att) {
      const base = a.checkIn || a.date;
      if (!base) continue;

      const dk = a.attendanceDateKey || shiftBaseDayKeyFromCheckIn(base);
      if (!empKeySet.has(dk)) continue;

      const st = String(a.status || "");
      if (st === "PRESENT" || st === "LATE") {
        presentDays.add(dk);
        dailyStatus[dk] = "PRESENT";
      }
      if (st === "LATE") {
        lateDays.add(dk);
        dailyStatus[dk] = "LATE";
      }
    }

    // present overrides leave
    for (const dk of presentDays) if (leaveDays.has(dk)) leaveDays.delete(dk);

    // countable days set
    const weekdayKeys = empPeriodKeys.filter((k) => !isWeekend(k));
    const weekendRecordDays = new Set();
    for (const dk of presentDays) if (isWeekend(dk)) weekendRecordDays.add(dk);
    for (const dk of leaveDays) if (isWeekend(dk)) weekendRecordDays.add(dk);

    const countableDaysSet = new Set([...weekdayKeys, ...weekendRecordDays]);

    const workingDays = countableDaysSet.size;
    const present = setIntersectionSize(presentDays, countableDaysSet);
    const late = setIntersectionSize(lateDays, countableDaysSet);
    const leave = setIntersectionSize(leaveDays, countableDaysSet);
    const absent = Math.max(0, workingDays - present - leave);
    const attendancePercent = workingDays
      ? clampPct(Math.round((present / workingDays) * 100))
      : 0;

    return res.json({
      success: true,
      monthKey,
      periodEndKey,
      employee: {
        employeeId: String(emp._id),
        employeeCode:
          emp.employeeCode || emp.employeeId || String(emp._id).slice(-6),
        name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        image: emp.image || null,
        jobTitle: emp.jobTitle || emp.designation || emp.position || "-",
        department: emp.department || "-",
      },
      stats: { workingDays, present, absent, leave, late, attendancePercent },
      calendar: { monthKeys: empPeriodKeys, dailyStatus },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load employee detail" });
  }
};
