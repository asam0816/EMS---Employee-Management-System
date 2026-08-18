// server/utils/colomboTime.js
export const COLOMBO_TIME_ZONE = "Asia/Colombo";

// YYYY-MM-DD in Colombo timezone
export const getColomboDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COLOMBO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
};

// Minutes of day in Colombo (0..1439)
export const getColomboMinutes = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date(date));

  let hh = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const mm = Number(parts.find((p) => p.type === "minute")?.value || 0);

  // Some environments can return 24:xx -> treat 24 as 0
  if (hh === 24) hh = 0;

  return hh * 60 + mm;
};

// DateKey +/- days safely (uses UTC to avoid server timezone issues)
export const addDaysToDateKey = (dateKey, days) => {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

// Build an exact instant using Colombo offset (+05:30)
export const buildColomboInstant = (dateKey, hh, mm, ss = 0, ms = 0) => {
  const H = String(hh).padStart(2, "0");
  const M = String(mm).padStart(2, "0");
  const S = String(ss).padStart(2, "0");
  const MS = String(ms).padStart(3, "0");
  // Fixed offset for Sri Lanka (+05:30)
  return new Date(`${dateKey}T${H}:${M}:${S}.${MS}+05:30`);
};

export const formatColomboDateTime = (date) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
};

export const formatColomboDate = (date) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(date));
};
