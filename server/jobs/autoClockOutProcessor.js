// server/jobs/autoClockOutProcessor.js
import cron from "node-cron";
import Attendance from "../models/Attendance.js";
import { computeDayType } from "../utils/shiftEngine.js";

const minutesBetween = (a, b) =>
  Math.max(
    0,
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000),
  );

const toHours = (mins) => Math.round((mins / 60) * 100) / 100;

export const processAutomaticClockOuts = async () => {
  const now = new Date();

  const expired = await Attendance.find({
    attendanceState: "WORKING",
    checkIn: { $ne: null },
    checkOut: null,
    scheduledEndAt: { $ne: null, $lte: now },
  }).limit(500);

  for (const rec of expired) {
    const end = rec.scheduledEndAt;

    rec.checkOut = end;
    rec.attendanceState = "AUTO_CLOCKED_OUT";

    const mins = minutesBetween(rec.checkIn, end);
    rec.totalWorkingMinutes = mins;
    rec.workingMinutes = mins;
    rec.workingHours = toHours(mins);
    rec.dayType = computeDayType(rec.workingHours);

    await rec.save();
  }

  return expired.length;
};

export const startAutoClockOutProcessor = () => {
  cron.schedule(
    "*/1 * * * *",
    async () => {
      try {
        await processAutomaticClockOuts();
      } catch (e) {
        console.error("[AUTO-CLOCKOUT] error:", e?.message || e);
      }
    },
    { timezone: "Asia/Colombo" },
  );

  console.log("[AUTO-CLOCKOUT] Processor running every minute (Asia/Colombo).");
};
