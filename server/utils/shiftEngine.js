// server/utils/shiftEngine.js
import { getColomboDateKey, getColomboMinutes } from "./colomboTime.js";

const addDaysToKey = (dateKey, days) => {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

const colomboInstant = (dateKey, hh, mm) =>
  new Date(
    `${dateKey}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`,
  );

export const SHIFTS = {
  DAY: {
    shiftKey: "DAY",
    shiftName: "Day Shift",
    label: "Day Shift (08:00 AM - 05:00 PM)",
    startMin: 8 * 60,
    endMin: 17 * 60,
    startHH: 8,
    startMM: 0,
    endHH: 17,
    endMM: 0,
    crossesMidnight: false,
  },
  NIGHT: {
    shiftKey: "NIGHT",
    shiftName: "Night Shift",
    label: "Night Shift (07:00 PM - 04:00 AM)",
    startMin: 19 * 60,
    endMin: 4 * 60,
    startHH: 19,
    startMM: 0,
    endHH: 4,
    endMM: 0,
    crossesMidnight: true,
  },
};

// ✅ choose shift based on Colombo time (not employee assignment)
export const getActiveShiftContext = (now = new Date()) => {
  const minutes = getColomboMinutes(now);
  const todayKey = getColomboDateKey(now);

  // DAY window 08:00–17:00
  const inDay = minutes >= SHIFTS.DAY.startMin && minutes <= SHIFTS.DAY.endMin;

  // NIGHT window 19:00–04:00 (cross midnight)
  const inNight =
    minutes >= SHIFTS.NIGHT.startMin || minutes <= SHIFTS.NIGHT.endMin;

  if (!inDay && !inNight) {
    return {
      inWindow: false,
      shiftKey: null,
      shiftName: null,
      label: null,
      nextDay: false,
      workDateKey: todayKey,
      shiftStartAt: null,
      scheduledEndAt: null,
    };
  }

  const shift = inDay ? SHIFTS.DAY : SHIFTS.NIGHT;

  // ✅ Work date key:
  // For NIGHT between 00:00–04:00, belongs to previous day
  let workDateKey = todayKey;
  if (shift.shiftKey === "NIGHT" && minutes <= shift.endMin) {
    workDateKey = addDaysToKey(todayKey, -1);
  }

  const shiftStartAt = colomboInstant(
    workDateKey,
    shift.startHH,
    shift.startMM,
  );

  const scheduledEndKey = shift.crossesMidnight
    ? addDaysToKey(workDateKey, 1)
    : workDateKey;
  const scheduledEndAt = colomboInstant(
    scheduledEndKey,
    shift.endHH,
    shift.endMM,
  );

  return {
    inWindow: true,
    shiftKey: shift.shiftKey,
    shiftName: shift.shiftName,
    label: shift.label,
    nextDay: shift.crossesMidnight,
    workDateKey,
    shiftStartAt,
    scheduledEndAt,
  };
};

export const computeLateMinutes = (checkIn, shiftStartAt) => {
  if (!checkIn || !shiftStartAt) return 0;
  const diff = Math.floor(
    (new Date(checkIn).getTime() - new Date(shiftStartAt).getTime()) / 60000,
  );
  return Math.max(0, diff);
};

export const computeDayType = (workingHours) => {
  const wh = Number(workingHours);
  if (!Number.isFinite(wh) || wh < 0) return null;
  if (wh >= 8) return "Full Day";
  if (wh >= 6) return "Three Quarter Day";
  if (wh >= 4) return "Half Day";
  return "Short Day";
};
