import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payslip from "../models/Payslip.js"; // if your payslip model name differs, change this
import { getColomboDateKey } from "../utils/colomboTime.js";

// ---------- helpers ----------
const safe = (v, fallback = 0) =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;

const monthKeyToRange = (monthKey) => {
  const [y, m] = String(monthKey).split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);
  return { start, end, startKey, endKey };
};

const getMonthDateKeys = (monthKey) => {
  const { start, end } = monthKeyToRange(monthKey);
  const keys = [];
  const cur = new Date(start);
  while (cur <= end) {
    keys.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return keys;
};

const getColomboWeekdayShort = (dateKey) => {
  // use noon UTC to avoid timezone edge cases
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    weekday: "short",
  }).format(d);
};

const isWeekend = (dateKey) => {
  const wd = getColomboWeekdayShort(dateKey);
  return wd === "Sat" || wd === "Sun";
};

const overlapLeaveDaysInMonth = (leave, monthKeysSet) => {
  // supports (startDate,endDate) or (fromDate,toDate)
  const start = leave?.startDate || leave?.fromDate;
  const end = leave?.endDate || leave?.toDate;
  if (!start || !end) return [];

  const a = new Date(start);
  const b = new Date(end);
  if (isNaN(a) || isNaN(b)) return [];

  const days = [];
  const cur = new Date(
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()),
  );
  const last = new Date(
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()),
  );

  while (cur <= last) {
    const key = cur.toISOString().slice(0, 10);
    if (monthKeysSet.has(key) && !isWeekend(key)) days.push(key); // count only working day leaves
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
};

const calcMaxConsecutiveAbsences = (workingKeys, dailyStatus) => {
  let best = 0;
  let cur = 0;
  for (const k of workingKeys) {
    if (dailyStatus[k] === "ABSENT") {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
};

// ---------- MAIN: monthly summary for all employees ----------
export const getAdminMonthlyAttendance = async (req, res) => {
  try {
    const now = new Date();
    const defaultMonth = getColomboDateKey(now).slice(0, 7); // YYYY-MM
    const monthKey = String(req.query.month || defaultMonth);

    const department = String(req.query.department || "ALL");
    const search = String(req.query.search || "")
      .trim()
      .toLowerCase();

    const { start, end, startKey, endKey } = monthKeyToRange(monthKey);
    const monthKeys = getMonthDateKeys(monthKey);
    const monthKeysSet = new Set(monthKeys);

    const workingKeys = monthKeys.filter((k) => !isWeekend(k));
    const workingDays = workingKeys.length;

    // Employees
    const empQuery = {
      isDeleted: { $ne: true },
      employmentStatus: "ACTIVE",
    };
    if (department !== "ALL") empQuery.department = department;

    const employees = await Employee.find(empQuery)
      .select(
        "_id firstName lastName employeeId employeeCode department jobTitle designation position image createdAt",
      )
      .lean();

    // Attendance for month (all employees, shift-based day key already stored)
    const attendanceDocs = await Attendance.find({
      attendanceDateKey: { $gte: startKey, $lte: endKey },
      employeeId: { $in: employees.map((e) => e._id) },
    })
      .select("employeeId attendanceDateKey status workingHours")
      .lean();

    // Leaves for month (approved + pending for top cards)
    const leaveDocs = await LeaveApplication.find({
      employeeId: { $in: employees.map((e) => e._id) },
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { startDate: { $lte: end }, endDate: { $gte: start } },
        { fromDate: { $lte: end }, toDate: { $gte: start } },
      ],
    }).lean();

    // Payroll total (optional / safe)
    let payrollTotal = 0;
    try {
      const payslips = await Payslip.find({
        createdAt: { $gte: start, $lte: end },
      })
        .select("netPay netSalary net total amount")
        .lean();

      payrollTotal = payslips.reduce(
        (sum, p) =>
          sum +
          safe(p.netPay ?? p.netSalary ?? p.net ?? p.total ?? p.amount, 0),
        0,
      );
    } catch {
      payrollTotal = 0;
    }

    // Build maps
    const attByEmp = new Map(); // empId -> array docs
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

    // Top cards helpers
    const totalEmployees = employees.length;

    const newEmployeesThisMonth = employees.filter((e) => {
      const d = new Date(e.createdAt);
      return d >= start && d <= end;
    }).length;

    const pendingLeaves = leaveDocs.filter(
      (l) => String(l.status || "").toUpperCase() === "PENDING",
    ).length;

    const attentionLeaves = leaveDocs.filter((l) => {
      const status = String(l.status || "").toUpperCase();
      if (status !== "PENDING") return false;
      const created = new Date(l.createdAt);
      const ageDays = (Date.now() - created.getTime()) / 86400000;
      return ageDays >= 3;
    }).length;

    // Build per employee rows + daily totals
    const rows = [];
    const dailyTotals = monthKeys.map((k) => ({
      dateKey: k,
      day: Number(k.slice(8, 10)),
      present: 0,
      late: 0,
      leave: 0,
      absent: 0,
    }));

    const totals = { present: 0, late: 0, leave: 0, absent: 0, workingDays };

    // pre-index dailyTotals
    const dailyIndex = new Map(dailyTotals.map((d) => [d.dateKey, d]));

    for (const e of employees) {
      const empId = String(e._id);
      const fullName =
        `${e.firstName || ""} ${e.lastName || ""}`.trim() || "Employee";
      const empCode = e.employeeCode || e.employeeId || empId.slice(-6);
      const dept = e.department || "-";

      // search filter
      if (search) {
        const hay = `${fullName} ${empCode} ${dept}`.toLowerCase();
        if (!hay.includes(search)) continue;
      }

      // daily status map for calendar/daily computation
      const dailyStatus = {};
      for (const k of workingKeys) dailyStatus[k] = "ABSENT";
      for (const k of monthKeys.filter(isWeekend)) dailyStatus[k] = "WEEKEND";

      // Apply leave (approved) -> LEAVE
      const empLeaves = leaveByEmp.get(empId) || [];
      const approvedLeaves = empLeaves.filter(
        (l) => String(l.status || "").toUpperCase() === "APPROVED",
      );

      const leaveDaysSet = new Set();
      for (const l of approvedLeaves) {
        const days = overlapLeaveDaysInMonth(l, monthKeysSet);
        for (const dk of days) {
          leaveDaysSet.add(dk);
          dailyStatus[dk] = "LEAVE";
        }
      }

      // Apply attendance -> PRESENT / LATE (if any record that day is LATE -> LATE)
      const empAtt = attByEmp.get(empId) || [];
      const dayStatus = new Map(); // dayKey -> "PRESENT"/"LATE"
      let hoursSum = 0;

      for (const a of empAtt) {
        const dk = a.attendanceDateKey;
        if (!dk) continue;
        if (String(a.status) === "LATE") dayStatus.set(dk, "LATE");
        else if (String(a.status) === "PRESENT" && !dayStatus.has(dk))
          dayStatus.set(dk, "PRESENT");
        hoursSum += safe(a.workingHours, 0);
      }

      // mark in dailyStatus
      for (const [dk, st] of dayStatus.entries()) {
        if (!monthKeysSet.has(dk)) continue;
        if (isWeekend(dk)) continue;
        dailyStatus[dk] = st; // overrides ABSENT/LEAVE
      }

      // Count stats
      const presentDays = workingKeys.filter(
        (k) => dailyStatus[k] === "PRESENT" || dailyStatus[k] === "LATE",
      ).length;
      const lateDays = workingKeys.filter(
        (k) => dailyStatus[k] === "LATE",
      ).length;
      const leaveDays = workingKeys.filter(
        (k) => dailyStatus[k] === "LEAVE",
      ).length;
      const absentDays = workingKeys.filter(
        (k) => dailyStatus[k] === "ABSENT",
      ).length;

      const attendancePercent =
        workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;

      // Update daily totals
      for (const k of workingKeys) {
        const dt = dailyIndex.get(k);
        if (!dt) continue;
        const st = dailyStatus[k];
        if (st === "PRESENT") dt.present += 1;
        else if (st === "LATE") {
          dt.present += 1;
          dt.late += 1;
        } else if (st === "LEAVE") dt.leave += 1;
        else if (st === "ABSENT") dt.absent += 1;
      }

      totals.present += presentDays;
      totals.late += lateDays;
      totals.leave += leaveDays;
      totals.absent += absentDays;

      rows.push({
        employeeId: empId,
        employeeCode: empCode,
        name: fullName,
        image: e.image || null,
        department: dept,
        jobTitle: e.jobTitle || e.designation || e.position || "-",
        workingDays,
        present: presentDays,
        absent: absentDays,
        leave: leaveDays,
        late: lateDays,
        attendancePercent,
        totalHours: Math.round(hoursSum * 100) / 100,

        // for alerts/drawer
        dailyStatus,
      });
    }

    // Attendance today (based on Colombo dateKey)
    const todayKey = getColomboDateKey(new Date());
    let todayPresent = 0,
      todayLate = 0,
      todayAbsent = 0,
      todayLeave = 0;

    for (const r of rows) {
      const st = r.dailyStatus?.[todayKey];
      if (st === "PRESENT") todayPresent += 1;
      else if (st === "LATE") {
        todayPresent += 1;
        todayLate += 1;
      } else if (st === "LEAVE") todayLeave += 1;
      else if (st === "ABSENT") todayAbsent += 1;
    }

    const attendanceTodayPercent =
      totalEmployees > 0
        ? Math.round((todayPresent / totalEmployees) * 100)
        : 0;

    // Alerts
    const alerts = [];
    for (const r of rows) {
      const maxAbs = calcMaxConsecutiveAbsences(workingKeys, r.dailyStatus);
      if (maxAbs >= 2) {
        alerts.push({
          severity: "HIGH",
          employeeId: r.employeeId,
          name: r.name,
          message: `${maxAbs} consecutive absences`,
          when: "This month",
        });
      }
      if (r.late >= 4) {
        alerts.push({
          severity: "MEDIUM",
          employeeId: r.employeeId,
          name: r.name,
          message: `${r.late} late arrivals this month`,
          when: "This month",
        });
      }
      if (r.attendancePercent < 80) {
        alerts.push({
          severity: "LOW",
          employeeId: r.employeeId,
          name: r.name,
          message: `Attendance below 80% (${r.attendancePercent}%)`,
          when: "This month",
        });
      }
    }

    // Performance top 3
    const performance = [...rows]
      .sort((a, b) => b.attendancePercent - a.attendancePercent)
      .slice(0, 3)
      .map((r) => ({
        employeeId: r.employeeId,
        name: r.name,
        percent: r.attendancePercent,
      }));

    // Average attendance
    const avgAttendance =
      rows.length > 0
        ? Number(
            (
              rows.reduce((s, r) => s + r.attendancePercent, 0) / rows.length
            ).toFixed(1),
          )
        : 0;

    return res.json({
      success: true,
      monthKey,
      top: {
        totalEmployees,
        newEmployeesThisMonth,
        pendingLeaves,
        attentionLeaves,
        attendanceTodayPercent,
        attendanceToday: {
          present: todayPresent,
          late: todayLate,
          absent: todayAbsent,
          leave: todayLeave,
        },
        payrollTotal,
      },
      monthly: {
        workingDays,
        rows: rows.map(({ dailyStatus, ...rest }) => rest), // keep table light
      },
      overview: {
        avgAttendance,
        present: totals.present,
        late: totals.late,
        absent: totals.absent,
        leave: totals.leave,
      },
      daily: dailyTotals,
      alerts: alerts.slice(0, 6),
      performance,
      // provide departments list for filter UI
      departments: [
        "ALL",
        ...Array.from(
          new Set(employees.map((e) => e.department).filter(Boolean)),
        ),
      ],
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Failed to load admin dashboard report" });
  }
};

// ---------- Employee detail for drawer ----------
export const getAdminEmployeeMonthlyDetail = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const now = new Date();
    const defaultMonth = getColomboDateKey(now).slice(0, 7);
    const monthKey = String(req.query.month || defaultMonth);

    const { startKey, endKey } = monthKeyToRange(monthKey);
    const monthKeys = getMonthDateKeys(monthKey);
    const monthKeysSet = new Set(monthKeys);
    const workingKeys = monthKeys.filter((k) => !isWeekend(k));
    const workingDays = workingKeys.length;

    const emp = await Employee.findById(employeeId)
      .select(
        "_id firstName lastName employeeId employeeCode department jobTitle designation position image",
      )
      .lean();

    if (!emp) return res.status(404).json({ error: "Employee not found" });

    const att = await Attendance.find({
      employeeId: emp._id,
      attendanceDateKey: { $gte: startKey, $lte: endKey },
    })
      .select("attendanceDateKey status workingHours")
      .lean();

    const leaves = await LeaveApplication.find({
      employeeId: emp._id,
      status: "APPROVED",
      $or: [
        { startDate: { $exists: true }, endDate: { $exists: true } },
        { fromDate: { $exists: true }, toDate: { $exists: true } },
      ],
    }).lean();

    const dailyStatus = {};
    for (const k of workingKeys) dailyStatus[k] = "ABSENT";
    for (const k of monthKeys.filter(isWeekend)) dailyStatus[k] = "WEEKEND";

    // leave -> LEAVE
    for (const l of leaves) {
      const days = overlapLeaveDaysInMonth(l, monthKeysSet);
      for (const dk of days) dailyStatus[dk] = "LEAVE";
    }

    // attendance -> PRESENT/LATE
    const dayStatus = new Map();
    let totalHours = 0;
    for (const a of att) {
      const dk = a.attendanceDateKey;
      if (!dk) continue;
      if (String(a.status) === "LATE") dayStatus.set(dk, "LATE");
      else if (String(a.status) === "PRESENT" && !dayStatus.has(dk))
        dayStatus.set(dk, "PRESENT");
      totalHours += safe(a.workingHours, 0);
    }
    for (const [dk, st] of dayStatus.entries()) {
      if (!monthKeysSet.has(dk)) continue;
      if (isWeekend(dk)) continue;
      dailyStatus[dk] = st;
    }

    const present = workingKeys.filter(
      (k) => dailyStatus[k] === "PRESENT" || dailyStatus[k] === "LATE",
    ).length;
    const late = workingKeys.filter((k) => dailyStatus[k] === "LATE").length;
    const leave = workingKeys.filter((k) => dailyStatus[k] === "LEAVE").length;
    const absent = workingKeys.filter(
      (k) => dailyStatus[k] === "ABSENT",
    ).length;

    const attendancePercent =
      workingDays > 0 ? Math.round((present / workingDays) * 100) : 0;

    return res.json({
      success: true,
      monthKey,
      employee: {
        employeeId: String(emp._id),
        employeeCode:
          emp.employeeCode || emp.employeeId || String(emp._id).slice(-6),
        name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        image: emp.image || null,
        jobTitle: emp.jobTitle || emp.designation || emp.position || "-",
        department: emp.department || "-",
      },
      stats: {
        workingDays,
        present,
        absent,
        leave,
        late,
        attendancePercent,
        totalHours: Math.round(totalHours * 100) / 100,
      },
      calendar: { monthKeys, dailyStatus },
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Failed to load employee monthly detail" });
  }
};
