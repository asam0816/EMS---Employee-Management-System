// server/utils/shifts.js
import { getColomboDateKey, getColomboMinutes } from "./colomboTime.js";

const DAY_START = 8 * 60; // 08:00
const DAY_END = 17 * 60; // 17:00

const NIGHT_START = 19 * 60; // 19:00
const NIGHT_END = 4 * 60; // 04:00 (next day)

const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

export const getShiftContext = (now = new Date()) => {
  const minutes = getColomboMinutes(now);

  // Day shift: 08:00 - 17:00
  if (minutes >= DAY_START && minutes < DAY_END) {
    return {
      inShiftWindow: true,
      shiftKey: "DAY",
      attendanceDateKey: getColomboDateKey(now),
      minutes,
    };
  }

  // Night shift: 19:00 - 04:00 (cross midnight)
  if (minutes >= NIGHT_START || minutes < NIGHT_END) {
    // after midnight belongs to previous day night shift
    const baseDate = minutes < NIGHT_END ? addDays(now, -1) : now;

    return {
      inShiftWindow: true,
      shiftKey: "NIGHT",
      attendanceDateKey: getColomboDateKey(baseDate),
      minutes,
    };
  }

  return {
    inShiftWindow: false,
    shiftKey: null,
    attendanceDateKey: getColomboDateKey(now),
    minutes,
  };
};

export const SHIFT_LABELS = {
  DAY: "Day Shift (08:00 AM - 05:00 PM)",
  NIGHT: "Night Shift (07:00 PM - 04:00 AM)",
};
