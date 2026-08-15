// server/jobs/autoCheckoutJob.js
import cron from "node-cron";
import Attendance from "../models/Attendance.js";
import { getColomboDateKey } from "../utils/colomboTime.js";

const computeDayType = (workingHours) => {
  if (workingHours >= 8) return "Full Day";
  if (workingHours >= 6) return "Three Quarter Day";
  if (workingHours >= 4) return "Half Day";
  return "Short Day";
};

// YYYY-MM-DD -> previous day YYYY-MM-DD (safe)
const prevDateKey = (dateKey) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
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
    const diffHours =
      (closeAt.getTime() - new Date(rec.checkIn).getTime()) / (1000 * 60 * 60);

    rec.checkOut = closeAt; // ✅ closes exactly at the scheduled time instant
    rec.workingHours = parseFloat(diffHours.toFixed(2));
    rec.dayType = computeDayType(rec.workingHours);

    await rec.save();
  }

  return openRecords.length;
};

export const startAutoCheckoutJob = () => {
  // ✅ 05:00 PM Colombo time -> close DAY shift (todayKey)
  cron.schedule(
    "0 17 * * *",
    async () => {
      try {
        const now = new Date();
        now.setSeconds(0, 0);

        const todayKey = getColomboDateKey(now);

        const closed = await closeOpenAttendances({
          attendanceDateKey: todayKey,
          shiftKey: "DAY",
          closeAt: now,
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

  // ✅ 04:00 AM Colombo time -> close NIGHT shift (yesterdayKey)
  cron.schedule(
    "0 4 * * *",
    async () => {
      try {
        const now = new Date();
        now.setSeconds(0, 0);

        const todayKey = getColomboDateKey(now);
        const yesterdayKey = prevDateKey(todayKey);

        const closed = await closeOpenAttendances({
          attendanceDateKey: yesterdayKey,
          shiftKey: "NIGHT",
          closeAt: now,
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
