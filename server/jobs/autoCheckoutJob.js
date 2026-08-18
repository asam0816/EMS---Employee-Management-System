// server/jobs/autoCheckoutJob.js
import cron from "node-cron";
import Attendance from "../models/Attendance.js";
import {
  getColomboDateKey,
  addDaysToDateKey,
  buildColomboInstant,
} from "../utils/colomboTime.js";

const computeDayType = (workingHours) => {
  if (workingHours >= 8) return "Full Day";
  if (workingHours >= 6) return "Three Quarter Day";
  if (workingHours >= 4) return "Half Day";
  return "Short Day";
};

const closeOpenAttendances = async ({
  attendanceDateKey,
  shiftKey,
  closeAt,
}) => {
  const openRecords = await Attendance.find({
    attendanceDateKey,
    shiftKey,
    checkIn: { $ne: null },
    checkOut: null,
  }).sort({ checkIn: 1 });

  if (!openRecords.length) return 0;

  for (const rec of openRecords) {
    const diffMs = closeAt.getTime() - new Date(rec.checkIn).getTime();
    const workingMinutes = Math.max(0, Math.round(diffMs / 60000));
    const workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    rec.checkOut = closeAt; // closes exactly at scheduled time
    rec.workingMinutes = workingMinutes;
    rec.workingHours = workingHours;
    rec.dayType = computeDayType(rec.workingHours);

    await rec.save();
  }

  return openRecords.length;
};

export const startAutoCheckoutJob = () => {
  // 05:00 PM Colombo -> close DAY shift (today)
  cron.schedule(
    "0 17 * * *",
    async () => {
      try {
        const now = new Date();
        const todayKey = getColomboDateKey(now);

        // close at exactly 17:00 Colombo instant
        const closeAt = buildColomboInstant(todayKey, 17, 0, 0, 0);

        const closed = await closeOpenAttendances({
          attendanceDateKey: todayKey,
          shiftKey: "DAY",
          closeAt,
        });

        if (closed) {
          console.log(
            `[AUTO-CHECKOUT] DAY closed ${closed} record(s) for ${todayKey} at 17:00`,
          );
        }
      } catch (e) {
        console.error("[AUTO-CHECKOUT][DAY] error:", e);
      }
    },
    { timezone: "Asia/Colombo" },
  );

  // 04:00 AM Colombo -> close NIGHT shift (yesterday)
  cron.schedule(
    "0 4 * * *",
    async () => {
      try {
        const now = new Date();
        const todayKey = getColomboDateKey(now);
        const yesterdayKey = addDaysToDateKey(todayKey, -1);

        // close at exactly today 04:00 (end of yesterday night shift)
        const closeAt = buildColomboInstant(todayKey, 4, 0, 0, 0);

        const closed = await closeOpenAttendances({
          attendanceDateKey: yesterdayKey,
          shiftKey: "NIGHT",
          closeAt,
        });

        if (closed) {
          console.log(
            `[AUTO-CHECKOUT] NIGHT closed ${closed} record(s) for ${yesterdayKey} at 04:00`,
          );
        }
      } catch (e) {
        console.error("[AUTO-CHECKOUT][NIGHT] error:", e);
      }
    },
    { timezone: "Asia/Colombo" },
  );

  console.log(
    "[AUTO-CHECKOUT] Cron started (Asia/Colombo) at 17:00 and 04:00.",
  );
};
