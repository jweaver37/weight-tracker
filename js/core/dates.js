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

export const monthStart = (str) => `${str.slice(0, 8)}01`;

export function monthEnd(str) {
  const d = parseDateStr(str);
  return toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export const daysInMonth = (str) => Number(monthEnd(str).slice(8));

// Every date from start to end, inclusive.
export function datesBetween(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export const minDate = (a, b) => (a < b ? a : b);
export const maxDate = (a, b) => (a > b ? a : b);

// Whole days from a to b (rounded so daylight-saving shifts don't matter).
export const daysBetween = (a, b) => Math.round((parseDateStr(b) - parseDateStr(a)) / 86400000);
