const COLOMBO_TIME_ZONE = "Asia/Colombo";

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

export const getColomboDayRange = (date = new Date()) => {
  const key = getColomboDateKey(date);

  return {
    key,
    start: new Date(`${key}T00:00:00+05:30`),
    end: new Date(`${key}T23:59:59.999+05:30`),
  };
};

export const getColomboMinutes = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(date));

  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);

  return hour * 60 + minute;
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
