import cron from "node-cron";
import Attendance from "../models/Attendance.js";

const minutesBetween = (start, end) => {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const diff = Math.floor((b - a) / 60000);
  return diff >= 0 ? diff : null;
};

export const startLiveWorkingHoursJob = () => {
  // Every minute (Colombo timezone)
  cron.schedule(
    "*/1 * * * *",
    async () => {
      try {
        const now = new Date();

        const open = await Attendance.find({
          checkIn: { $ne: null },
          checkOut: null,
        })
          .select("_id checkIn")
          .limit(1000)
          .lean();

        if (!open.length) return;

        const ops = [];

        for (const r of open) {
          const mins = minutesBetween(r.checkIn, now);
          if (mins == null) continue;

          const hours = Math.round((mins / 60) * 100) / 100; // 2 decimals

          ops.push({
            updateOne: {
              filter: { _id: r._id, checkOut: null },
              update: {
                $set: {
                  workingMinutes: mins,
                  workingHours: hours,
                },
              },
            },
          });
        }

        if (ops.length) {
          await Attendance.bulkWrite(ops, { ordered: false });
        }
      } catch (e) {
        console.error("[LIVE-WORK-HOURS] error:", e?.message || e);
      }
    },
    { timezone: "Asia/Colombo" },
  );

  console.log(
    "[LIVE-WORK-HOURS] Cron started (updates open attendance every minute).",
  );
};
