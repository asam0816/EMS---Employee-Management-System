import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import { logAudit } from "../utils/auditLogger.js";
import {
  formatColomboDate,
  formatColomboDateTime,
} from "../utils/colomboTime.js";

import { getShiftContext, SHIFT_LABELS } from "../utils/shifts.js";

const MIN_SECONDS_BEFORE_CLOCKOUT = 10;

const computeDayType = (workingHours) => {
  if (workingHours >= 8) return "Full Day";
  if (workingHours >= 6) return "Three Quarter Day";
  if (workingHours >= 4) return "Half Day";
  return "Short Day";
};

const normalizeAttendance = (record) => {
  const obj = record?.toObject ? record.toObject() : record;

  // display date should follow attendanceDateKey (shift base date)
  const displayDate = obj?.attendanceDateKey
    ? obj.attendanceDateKey // keep string for client formatting
    : formatColomboDate(obj?.date || new Date());

  return {
    ...obj,
    id: obj?._id?.toString?.() || obj?.id,
    displayDate, // YYYY-MM-DD
    checkInLabel: obj?.checkIn ? formatColomboDateTime(obj.checkIn) : null,
    checkOutLabel: obj?.checkOut ? formatColomboDateTime(obj.checkOut) : null,
    shiftLabel: obj?.shiftKey ? SHIFT_LABELS[obj.shiftKey] : null,
  };
};

// POST /api/attendance
export const clockInOut = async (req, res) => {
  try {
    const session = req.session;

    const employee = await Employee.findOne({
      userId: session.userId,
      isDeleted: { $ne: true },
      employmentStatus: "ACTIVE",
    });

    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const now = new Date();

    // 1) ✅ If open attendance exists -> CLOCK OUT (allowed anytime)
    const open = await Attendance.findOne({
      employeeId: employee._id,
      checkIn: { $ne: null },
      checkOut: null,
    }).sort({ checkIn: -1, createdAt: -1 });

    if (open) {
      const secondsSinceCheckIn =
        (now.getTime() - new Date(open.checkIn).getTime()) / 1000;

      if (secondsSinceCheckIn < MIN_SECONDS_BEFORE_CLOCKOUT) {
        return res.status(400).json({
          error: `Please wait ${Math.ceil(
            MIN_SECONDS_BEFORE_CLOCKOUT - secondsSinceCheckIn,
          )} seconds before clocking out.`,
        });
      }

      const diffHours =
        (now.getTime() - new Date(open.checkIn).getTime()) / (1000 * 60 * 60);

      open.checkOut = now;
      open.workingHours = parseFloat(diffHours.toFixed(2));
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
          dayType: open.dayType,
        },
      });

      return res.json({
        success: true,
        type: "CHECK_OUT",
        data: normalizeAttendance(open),
      });
    }

    // 2) ✅ No open attendance -> CLOCK IN only inside shift window
    const shift = getShiftContext(now);

    if (!shift.inShiftWindow) {
      return res.status(403).json({
        error:
          "Clock In is allowed only during shifts: 08:00 AM-05:00 PM and 07:00 PM-04:00 AM.",
      });
    }

    const existing = await Attendance.findOne({
      employeeId: employee._id,
      attendanceDateKey: shift.attendanceDateKey,
      shiftKey: shift.shiftKey,
    });

    if (existing?.checkOut) {
      return res.json({
        success: true,
        type: "COMPLETED",
        data: normalizeAttendance(existing),
      });
    }

    // late rules
    // DAY: late if after 08:00
    // NIGHT: late if after 19:00 or after midnight
    const isLate =
      shift.shiftKey === "DAY"
        ? shift.minutes > 8 * 60
        : shift.minutes < 4 * 60 || shift.minutes > 19 * 60;

    const attendance = await Attendance.create({
      employeeId: employee._id,
      date: now,
      attendanceDateKey: shift.attendanceDateKey,
      shiftKey: shift.shiftKey,
      checkIn: now,
      status: isLate ? "LATE" : "PRESENT",
      workingHours: null,
      dayType: null,
    });

    await logAudit(req, {
      action: "ATTENDANCE_CHECK_IN",
      entityType: "Attendance",
      entityId: attendance._id,
      entityLabel: `${employee.firstName} ${employee.lastName}`,
      meta: {
        attendanceDateKey: attendance.attendanceDateKey,
        shiftKey: attendance.shiftKey,
        status: attendance.status,
      },
    });

    return res.json({
      success: true,
      type: "CHECK_IN",
      data: normalizeAttendance(attendance),
    });
  } catch (error) {
    console.error("Attendance Error:", error);
    return res.status(500).json({ error: "Operation failed" });
  }
};

// GET /api/attendance
export const getAttendance = async (req, res) => {
  try {
    const session = req.session;

    const employee = await Employee.findOne({
      userId: session.userId,
      isDeleted: { $ne: true },
      employmentStatus: "ACTIVE",
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const limit = parseInt(req.query.limit || 30, 10);
    const now = new Date();
    const shift = getShiftContext(now);

    const historyRaw = await Attendance.find({ employeeId: employee._id })
      .sort({ checkIn: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const history = historyRaw.map(normalizeAttendance);

    // ✅ todayRecord should be open record first
    const open = history.find((r) => r.checkIn && !r.checkOut) || null;

    // else current shift record
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
  } catch (error) {
    console.error("Failed to fetch attendance:", error);
    return res.status(500).json({ error: "Failed to fetch attendance" });
  }
};
