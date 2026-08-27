// server/controllers/attendanceController.js
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import { logAudit } from "../utils/auditLogger.js";
import {
  getActiveShiftContext,
  computeLateMinutes,
  computeDayType,
} from "../utils/shiftEngine.js";

const MIN_SECONDS_BEFORE_CLOCKOUT = 10;

const mustGetEmployee = async (req) => {
  const userId = req?.session?.userId;
  if (!userId) return null;

  return Employee.findOne({
    userId,
    isDeleted: { $ne: true },
    employmentStatus: "ACTIVE",
  }).lean();
};

const minutesBetween = (a, b) =>
  Math.max(
    0,
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000),
  );

const toHours = (mins) => Math.round((mins / 60) * 100) / 100;

const normalize = (doc) => {
  const o = doc?.toObject ? doc.toObject() : doc;
  return { ...o, id: o?._id?.toString?.() || o?.id };
};

// ✅ Updates live working time in DB for open record
const refreshOpenWorkingTime = async (openDoc) => {
  if (!openDoc?.checkIn || openDoc?.checkOut) return openDoc;

  const now = new Date();
  const mins = minutesBetween(openDoc.checkIn, now);
  const hrs = toHours(mins);

  // Update DB
  await Attendance.updateOne(
    { _id: openDoc._id, checkOut: null, attendanceState: "WORKING" },
    { $set: { workingMinutes: mins, workingHours: hrs } },
  );

  // Update local object for response
  openDoc.workingMinutes = mins;
  openDoc.workingHours = hrs;

  return openDoc;
};

// GET /api/attendance/today
export const getTodayAttendance = async (req, res) => {
  try {
    const employee = await mustGetEmployee(req);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const shift = getActiveShiftContext(new Date());

    // open record (any date)
    let open = await Attendance.findOne({
      employeeId: employee._id,
      checkIn: { $ne: null },
      checkOut: null,
      attendanceState: "WORKING",
    }).sort({ checkIn: -1 });

    if (open) {
      open = await refreshOpenWorkingTime(open);
    }

    const todayRecord = await Attendance.findOne({
      employeeId: employee._id,
      attendanceDateKey: shift.workDateKey,
    });

    const canClockIn = shift.inWindow && !open && !todayRecord?.checkIn;
    const canClockOut = !!open;

    return res.json({
      success: true,
      employee: {
        id: String(employee._id),
        name: `${employee.firstName || ""} ${employee.lastName || ""}`.trim(),
      },
      shift: shift.inWindow
        ? {
            shiftKey: shift.shiftKey,
            shiftName: shift.shiftName,
            label: shift.label,
            nextDay: shift.nextDay,
            workDateKey: shift.workDateKey,
            shiftStartAt: shift.shiftStartAt,
            scheduledEndAt: shift.scheduledEndAt,
            inWindow: true,
          }
        : {
            shiftKey: null,
            shiftName: null,
            label: null,
            nextDay: false,
            workDateKey: shift.workDateKey,
            shiftStartAt: null,
            scheduledEndAt: null,
            inWindow: false,
          },
      openRecord: open ? normalize(open) : null,
      todayRecord: todayRecord ? normalize(todayRecord) : null,
      canClockIn,
      canClockOut,
    });
  } catch (e) {
    console.error("getTodayAttendance error:", e);
    return res.status(500).json({ error: "Failed to load attendance" });
  }
};

// POST /api/attendance/clock-in
export const clockIn = async (req, res) => {
  try {
    const employee = await mustGetEmployee(req);

    if (!employee) {
      return res.status(404).json({
        error: "Employee not found",
      });
    }

    const shift = getActiveShiftContext(new Date());

    // Outside both work shifts
    if (!shift.inWindow) {
      return res.status(403).json({
        error:
          "Clock in is allowed only during shift time (08:00–17:00 or 19:00–04:00).",
      });
    }

    // Prevent DAY employee
    // clocking in at NIGHT,
    // and vice versa.
    if (shift.shiftKey !== employee.shiftKey) {
      const assignedLabel =
        employee.shiftKey === "NIGHT"
          ? "Night Shift (07:00 PM - 04:00 AM)"
          : "Day Shift (08:00 AM - 05:00 PM)";

      return res.status(403).json({
        error:
          `You are assigned to ${assignedLabel}. ` +
          `You cannot clock in during the other shift.`,
      });
    }

    const open = await Attendance.findOne({
      employeeId: employee._id,

      checkIn: {
        $ne: null,
      },

      checkOut: null,

      attendanceState: "WORKING",
    });

    if (open) {
      return res.status(400).json({
        error: "Already clocked in. Please clock out.",
      });
    }

    const existingDay = await Attendance.findOne({
      employeeId: employee._id,

      attendanceDateKey: shift.workDateKey,
    });

    if (existingDay?.checkIn) {
      if (existingDay.checkOut) {
        return res.status(400).json({
          error:
            "Attendance already completed for today. Only one shift per day is allowed.",
        });
      }

      return res.status(400).json({
        error: "Already clocked in for today. Please clock out.",
      });
    }

    const now = new Date();

    const lateMinutes = computeLateMinutes(now, shift.shiftStartAt);

    const status = lateMinutes > 0 ? "LATE" : "PRESENT";

    const doc =
      existingDay ||
      new Attendance({
        employeeId: employee._id,

        attendanceDateKey: shift.workDateKey,
      });

    doc.shiftKey = shift.shiftKey;

    doc.checkIn = now;

    doc.checkOut = null;

    doc.scheduledEndAt = shift.scheduledEndAt;

    doc.attendanceState = "WORKING";

    doc.status = status;

    doc.lateMinutes = lateMinutes;

    doc.workingMinutes = null;

    doc.workingHours = null;

    doc.totalWorkingMinutes = null;

    doc.dayType = null;

    await doc.save();

    await logAudit(req, {
      action: "ATTENDANCE_CLOCK_IN",

      entityType: "Attendance",

      entityId: doc._id,

      entityLabel: `${employee.firstName} ${employee.lastName}`,

      meta: {
        attendanceDateKey: doc.attendanceDateKey,

        shiftKey: doc.shiftKey,

        status: doc.status,

        lateMinutes,
      },
    });

    return res.json({
      success: true,

      data: normalize(doc),
    });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({
        error: "Attendance already exists for today.",
      });
    }

    console.error("clockIn error:", e);

    return res.status(500).json({
      error: "Clock in failed",
    });
  }
};

// POST /api/attendance/clock-out
export const clockOut = async (req, res) => {
  try {
    const employee = await mustGetEmployee(req);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const open = await Attendance.findOne({
      employeeId: employee._id,
      checkIn: { $ne: null },
      checkOut: null,
      attendanceState: "WORKING",
    }).sort({ checkIn: -1 });

    if (!open)
      return res.status(400).json({ error: "No active clock-in found." });

    const now = new Date();
    const seconds = (now.getTime() - new Date(open.checkIn).getTime()) / 1000;
    if (seconds < MIN_SECONDS_BEFORE_CLOCKOUT) {
      return res
        .status(400)
        .json({ error: "Please wait a few seconds before clocking out." });
    }

    open.checkOut = now;
    open.attendanceState = "COMPLETED";

    const mins = minutesBetween(open.checkIn, open.checkOut);
    open.totalWorkingMinutes = mins;
    open.workingMinutes = mins;
    open.workingHours = toHours(mins);
    open.dayType = computeDayType(open.workingHours);

    await open.save();

    await logAudit(req, {
      action: "ATTENDANCE_CLOCK_OUT",
      entityType: "Attendance",
      entityId: open._id,
      entityLabel: `${employee.firstName} ${employee.lastName}`,
      meta: {
        attendanceDateKey: open.attendanceDateKey,
        shiftKey: open.shiftKey,
        minutes: mins,
      },
    });

    return res.json({ success: true, data: normalize(open) });
  } catch (e) {
    console.error("clockOut error:", e);
    return res.status(500).json({ error: "Clock out failed" });
  }
};

// GET /api/attendance/history?limit=20
export const getHistory = async (req, res) => {
  try {
    const employee = await mustGetEmployee(req);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const limit = Math.min(Number(req.query.limit || 20), 500);

    let rows = await Attendance.find({ employeeId: employee._id })
      .sort({ attendanceDateKey: -1, createdAt: -1 })
      .limit(limit);

    // ✅ update live time for the newest open record in the list (if any)
    const open = rows.find(
      (r) => r.checkIn && !r.checkOut && r.attendanceState === "WORKING",
    );
    if (open) await refreshOpenWorkingTime(open);

    rows = rows.map((r) => r.toObject());

    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error("getHistory error:", e);
    return res.status(500).json({ error: "Failed to load history" });
  }
};

// POST /api/attendance (toggle)
export const clockInOut = async (req, res) => {
  const employee = await mustGetEmployee(req);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const open = await Attendance.findOne({
    employeeId: employee._id,
    checkIn: { $ne: null },
    checkOut: null,
    attendanceState: "WORKING",
  });

  if (open) return clockOut(req, res);
  return clockIn(req, res);
};
