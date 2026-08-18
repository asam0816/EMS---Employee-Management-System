// server/utils/shifts.js
import { getColomboDateKey, getColomboMinutes } from "./colomboTime.js";

const DAY_START = 8 * 60; // 08:00
const DAY_END = 17 * 60; // 17:00 (inclusive)

const NIGHT_START = 19 * 60; // 19:00
const NIGHT_END = 4 * 60; // 04:00 (inclusive)

export const SHIFT_LABELS = {
  DAY: "Day Shift (08:00 AM - 05:00 PM)",
  NIGHT: "Night Shift (07:00 PM - 04:00 AM)",
};

// YYYY-MM-DD -> add days safely in UTC
const addDaysToKey = (dateKey, days) => {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

// Create an exact instant in Colombo offset (+05:30)
const colomboInstant = (dateKey, hh, mm) =>
  new Date(
    `${dateKey}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`,
  );

export const getShiftBounds = ({ attendanceDateKey, shiftKey }) => {
  if (!attendanceDateKey || !shiftKey)
    return { shiftStartAt: null, shiftEndAt: null };

  if (shiftKey === "DAY") {
    return {
      shiftStartAt: colomboInstant(attendanceDateKey, 8, 0),
      shiftEndAt: colomboInstant(attendanceDateKey, 17, 0),
    };
  }

  if (shiftKey === "NIGHT") {
    const nextKey = addDaysToKey(attendanceDateKey, 1);
    return {
      shiftStartAt: colomboInstant(attendanceDateKey, 19, 0),
      shiftEndAt: colomboInstant(nextKey, 4, 0),
    };
  }

  return { shiftStartAt: null, shiftEndAt: null };
};

export const getShiftContext = (now = new Date()) => {
  const minutes = getColomboMinutes(now);

  // DAY: 08:00 - 17:00
  if (minutes >= DAY_START && minutes <= DAY_END) {
    const attendanceDateKey = getColomboDateKey(now);
    const { shiftStartAt, shiftEndAt } = getShiftBounds({
      attendanceDateKey,
      shiftKey: "DAY",
    });

    return {
      inShiftWindow: true,
      shiftKey: "DAY",
      attendanceDateKey,
      minutes,
      shiftLabel: SHIFT_LABELS.DAY,
      shiftStartAt,
      shiftEndAt,
    };
  }

  // NIGHT: 19:00 - 04:00 (cross midnight)
  // Condition must be: >= 19:00 OR <= 04:00
  if (minutes >= NIGHT_START || minutes <= NIGHT_END) {
    const todayKey = getColomboDateKey(now);

    // After midnight (00:00..04:00) belongs to previous day's NIGHT shift
    const attendanceDateKey =
      minutes <= NIGHT_END ? addDaysToKey(todayKey, -1) : todayKey;

    const { shiftStartAt, shiftEndAt } = getShiftBounds({
      attendanceDateKey,
      shiftKey: "NIGHT",
    });

    return {
      inShiftWindow: true,
      shiftKey: "NIGHT",
      attendanceDateKey,
      minutes,
      shiftLabel: SHIFT_LABELS.NIGHT,
      shiftStartAt,
      shiftEndAt,
    };
  }

  // Outside both shifts
  return {
    inShiftWindow: false,
    shiftKey: null,
    attendanceDateKey: getColomboDateKey(now),
    minutes,
    shiftLabel: null,
    shiftStartAt: null,
    shiftEndAt: null,
  };
};
