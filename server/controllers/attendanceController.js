// server/controllers/attendanceController.js
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import { logAudit } from "../utils/auditLogger.js";
import {
  formatColomboDateTime,
  getColomboDateKey,
  getColomboMinutes,
} from "../utils/colomboTime.js";
import {
  getShiftBounds,
  getShiftContext,
  SHIFT_LABELS,
} from "../utils/shifts.js";

const MIN_SECONDS_BEFORE_CLOCKOUT = 10;
const CLOCK_IN_LATE_GRACE_MIN = 10; // 10 minutes grace
const CLOCK_OUT_EXTRA_GRACE_MIN = 180; // allow clock out up to +3 hours after shift end

const computeDayType = (workingHours) => {
  if (workingHours >= 8) return "Full Day";
  if (workingHours >= 6) return "Three Quarter Day";
  if (workingHours >= 4) return "Half Day";
  return "Short Day";
};

const mustGetEmployee = async (req) => {
  const session = req.session;

  const employee = await Employee.findOne({
    userId: session?.userId,
    isDeleted: { $ne: true },
    employmentStatus: "ACTIVE",
  });

  return employee || null;
};

// If any old record has missing shiftKey/dateKey, derive from checkIn
const deriveKeyFromCheckIn = (rec) => {
  const base = rec?.checkIn || rec?.date || rec?.createdAt || new Date();
  const minutes = getColomboMinutes(base);

  const inferredShiftKey =
    minutes >= 8 * 60 && minutes <= 17 * 60 ? "DAY" : "NIGHT";
  let attendanceDateKey = rec?.attendanceDateKey || getColomboDateKey(base);

  // if NIGHT and time is 00:00..04:00 => previous dateKey
  if (inferredShiftKey === "NIGHT" && minutes <= 4 * 60) {
    const [y, m, d] = attendanceDateKey.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    attendanceDateKey = dt.toISOString().slice(0, 10);
  }

  return { shiftKey: rec?.shiftKey || inferredShiftKey, attendanceDateKey };
};

const normalizeAttendance = (record) => {
  const obj = record?.toObject ? record.toObject() : record;
  const derived = deriveKeyFromCheckIn(obj);

  const shiftKey = obj?.shiftKey || derived.shiftKey;
  const attendanceDateKey = obj?.attendanceDateKey || derived.attendanceDateKey;

  return {
    ...obj,
    id: obj?._id?.toString?.() || obj?.id,
    shiftKey,
    attendanceDateKey,
    shiftLabel: shiftKey ? SHIFT_LABELS[shiftKey] : null,
    checkInLabel: obj?.checkIn ? formatColomboDateTime(obj.checkIn) : null,
    checkOutLabel: obj?.checkOut ? formatColomboDateTime(obj.checkOut) : null,
  };
};

const canClockOutNow = (openRecord, now) => {
  const derived = deriveKeyFromCheckIn(openRecord);
  const shiftKey = openRecord.shiftKey || derived.shiftKey;
  const attendanceDateKey =
    openRecord.attendanceDateKey || derived.attendanceDateKey;

  const { shiftEndAt } = getShiftBounds({ attendanceDateKey, shiftKey });
  if (!shiftEndAt) return true;

  const max = new Date(
    shiftEndAt.getTime() + CLOCK_OUT_EXTRA_GRACE_MIN * 60000,
  );
  return now.getTime() <= max.getTime();
};

// ✅ GET /api/attendance/status
export const getAttendanceStatus = async (req, res) => {
  try {
    const employee = await mustGetEmployee(req);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const now = new Date();
    const shift = getShiftContext(now);

    const open = await Attendance.findOne({
      employeeId: employee._id,
      checkIn: { $ne: null },
      checkOut: null,
    }).sort({ checkIn: -1, createdAt: -1 });

    // return both keys to prevent frontend mismatch
    const inShiftWindow = !!shift.inShiftWindow;

    // If open record exists, allow clock out (even if outside shift) within grace window
    if (open) {
      const allowed = canClockOutNow(open, now);

      return res.json({
        now,
        isShiftTime: inShiftWindow,
        inShiftWindow,
        currentShift: {
          ...shift,
          shiftLabel: shift.shiftKey ? SHIFT_LABELS[shift.shiftKey] : null,
        },
        openRecord: normalizeAttendance(open),
        canClockIn: false,
        canClockOut: allowed,
        reason: allowed ? null : "Clock-out time expired. Contact admin.",
      });
    }

    // No open record: clock-in only if inside window and not already completed for this shift
    if (!inShiftWindow) {
      return res.json({
        now,
        isShiftTime: false,
        inShiftWindow: false,
        currentShift: {
          ...shift,
          shiftLabel: null,
        },
        openRecord: null,
        canClockIn: false,
        canClockOut: false,
        reason:
          "Outside shift time. Allowed: 08:00 AM–05:00 PM and 07:00 PM–04:00 AM (Colombo).",
      });
    }

    const existing = await Attendance.findOne({
      employeeId: employee._id,
      attendanceDateKey: shift.attendanceDateKey,
      shiftKey: shift.shiftKey,
    });

    // If already completed this shift, no actions
    if (existing?.checkIn && existing?.checkOut) {
      return res.json({
        now,
        isShiftTime: true,
        inShiftWindow: true,
        currentShift: {
          ...shift,
          shiftLabel: shift.shiftKey ? SHIFT_LABELS[shift.shiftKey] : null,
        },
        openRecord: null,
        todayRecord: normalizeAttendance(existing),
        canClockIn: false,
        canClockOut: false,
        reason: "Attendance already completed for this shift.",
      });
    }

    // else allow clock in
    return res.json({
      now,
      isShiftTime: true,
      inShiftWindow: true,
      currentShift: {
        ...shift,
        shiftLabel: shift.shiftKey ? SHIFT_LABELS[shift.shiftKey] : null,
      },
      openRecord: null,
      todayRecord: existing ? normalizeAttendance(existing) : null,
      canClockIn: true,
      canClockOut: false,
      reason: null,
    });
  } catch (e) {
    console.error("getAttendanceStatus error:", e);
    return res.status(500).json({ error: "Failed to load attendance status" });
  }
};

// internal clock-in
const doClockIn = async (req, res) => {
  const employee = await mustGetEmployee(req);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const now = new Date();

  // prevent multiple open
  const open = await Attendance.findOne({
    employeeId: employee._id,
    checkIn: { $ne: null },
    checkOut: null,
  });
  if (open)
    return res
      .status(400)
      .json({ error: "Already clocked in. Please clock out." });

  const shift = getShiftContext(now);
  if (!shift.inShiftWindow) {
    return res.status(403).json({
      error:
        "Clock In allowed only: 08:00 AM–05:00 PM and 07:00 PM–04:00 AM (Colombo).",
    });
  }

  const existing = await Attendance.findOne({
    employeeId: employee._id,
    attendanceDateKey: shift.attendanceDateKey,
    shiftKey: shift.shiftKey,
  });

  if (existing?.checkIn && existing?.checkOut) {
    return res
      .status(400)
      .json({ error: "Attendance already completed for this shift." });
  }

  const shiftStart = shift.shiftStartAt;
  const diffMin = shiftStart
    ? Math.floor((now.getTime() - shiftStart.getTime()) / 60000)
    : 0;
  const lateMinutes = Math.max(0, diffMin - CLOCK_IN_LATE_GRACE_MIN);
  const isLate = lateMinutes > 0;

  const attendance =
    existing ||
    new Attendance({
      employeeId: employee._id,
      date: now,
      attendanceDateKey: shift.attendanceDateKey,
      shiftKey: shift.shiftKey,
    });

  attendance.checkIn = now;
  attendance.checkOut = null;
  attendance.status = isLate ? "LATE" : "PRESENT";
  attendance.lateMinutes = lateMinutes;
  attendance.workingHours = null;
  attendance.workingMinutes = null;
  attendance.dayType = null;

  await attendance.save();

  await logAudit(req, {
    action: "ATTENDANCE_CHECK_IN",
    entityType: "Attendance",
    entityId: attendance._id,
    entityLabel: `${employee.firstName} ${employee.lastName}`,
    meta: {
      attendanceDateKey: attendance.attendanceDateKey,
      shiftKey: attendance.shiftKey,
      status: attendance.status,
      lateMinutes: attendance.lateMinutes,
    },
  });

  return res.json({
    success: true,
    type: "CHECK_IN",
    data: normalizeAttendance(attendance),
  });
};

// internal clock-out
const doClockOut = async (req, res) => {
  const employee = await mustGetEmployee(req);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const now = new Date();

  const open = await Attendance.findOne({
    employeeId: employee._id,
    checkIn: { $ne: null },
    checkOut: null,
  }).sort({ checkIn: -1, createdAt: -1 });

  if (!open)
    return res.status(400).json({ error: "No active clock-in found." });

  const secondsSinceCheckIn =
    (now.getTime() - new Date(open.checkIn).getTime()) / 1000;

  if (secondsSinceCheckIn < MIN_SECONDS_BEFORE_CLOCKOUT) {
    return res.status(400).json({
      error: `Please wait ${Math.ceil(MIN_SECONDS_BEFORE_CLOCKOUT - secondsSinceCheckIn)} seconds before clocking out.`,
    });
  }

  if (!canClockOutNow(open, now)) {
    return res
      .status(403)
      .json({ error: "Clock-out time expired. Contact admin." });
  }

  const diffMs = now.getTime() - new Date(open.checkIn).getTime();
  const workingMinutes = Math.max(0, Math.round(diffMs / 60000));
  const workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

  // ensure keys exist (for older records)
  const derived = deriveKeyFromCheckIn(open);
  open.shiftKey = open.shiftKey || derived.shiftKey;
  open.attendanceDateKey = open.attendanceDateKey || derived.attendanceDateKey;

  open.checkOut = now;
  open.workingMinutes = workingMinutes;
  open.workingHours = workingHours;
  open.dayType = computeDayType(open.workingHours);

  await open.save();

  await logAudit(req, {
    action: "ATTENDANCE_CHECK_OUT",
    entityType: "Attendance",
    entityId: open._id,
    entityLabel: `${employee.firstName} ${employee.lastName}`,
    meta: {
      attendanceDateKey: open.attendanceDateKey,
      shiftKey: open.shiftKey,
      workingHours: open.workingHours,
      workingMinutes: open.workingMinutes,
      dayType: open.dayType,
    },
  });

  return res.json({
    success: true,
    type: "CHECK_OUT",
    data: normalizeAttendance(open),
  });
};

// ✅ POST /api/attendance  (toggle endpoint)
// IMPORTANT: this export name must match your routes import
export const clockInOut = async (req, res) => {
  try {
    const employee = await mustGetEmployee(req);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const open = await Attendance.findOne({
      employeeId: employee._id,
      checkIn: { $ne: null },
      checkOut: null,
    });

    if (open) return doClockOut(req, res);
    return doClockIn(req, res);
  } catch (e) {
    console.error("clockInOut error:", e);
    return res.status(500).json({ error: "Operation failed" });
  }
};

// ✅ GET /api/attendance
export const getAttendance = async (req, res) => {
  try {
    const employee = await mustGetEmployee(req);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const limit = Math.min(parseInt(req.query.limit || 30, 10), 500);

    const now = new Date();
    const shift = getShiftContext(now);

    const historyRaw = await Attendance.find({ employeeId: employee._id })
      .sort({ checkIn: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const history = historyRaw.map(normalizeAttendance);

    const open = history.find((r) => r.checkIn && !r.checkOut) || null;

    const currentShiftRecord =
      history.find(
        (r) =>
          r.attendanceDateKey === shift.attendanceDateKey &&
          r.shiftKey === shift.shiftKey,
      ) || null;

    return res.json({
      data: history,
      todayRecord: open || currentShiftRecord,
      currentShift: {
        ...shift,
        shiftLabel: shift.shiftKey ? SHIFT_LABELS[shift.shiftKey] : null,
      },
      employee: { isDeleted: employee.isDeleted },
    });
  } catch (e) {
    console.error("getAttendance error:", e);
    return res.status(500).json({ error: "Failed to fetch attendance" });
  }
};
