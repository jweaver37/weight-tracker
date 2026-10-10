// Dates are stored as local calendar dates in "YYYY-MM-DD" form, which also sort correctly as strings.

export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const todayStr = (now = new Date()) => toDateStr(now);

export function parseDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(str, days) {
  const date = parseDateStr(str);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
}

// Whole days from a to b (rounded so daylight-saving shifts don't matter).
export const daysBetween = (a, b) => Math.round((parseDateStr(b) - parseDateStr(a)) / 86400000);
