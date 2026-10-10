// Time-series helpers. Points are { date: 'YYYY-MM-DD', value: number } sorted by date.
import { addDays } from './dates.js';

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

// Collapses records to one point per date (the mean when a date has several), sorted by date.
export function dailyValues(records, field) {
  const byDate = new Map();
  for (const record of records) {
    const value = record[field];
    if (!Number.isFinite(value)) continue;
    if (!byDate.has(record.date)) byDate.set(record.date, []);
    byDate.get(record.date).push(value);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, values]) => ({ date, value: mean(values) }));
}

// Mean of the points in the `days`-day window ending on endDate, or null when the window is empty.
export function averageOver(points, endDate, days = 7) {
  const start = addDays(endDate, -(days - 1));
  const inWindow = points.filter((p) => p.date >= start && p.date <= endDate).map((p) => p.value);
  return inWindow.length ? mean(inWindow) : null;
}

export const rollingAverage = (points, days = 7) =>
  points.map((p) => ({ date: p.date, value: averageOver(points, p.date, days) }));

// The 7-day average when there are recent entries, otherwise the latest entry on or before today.
export function currentValue(points, today) {
  const avg = averageOver(points, today, 7);
  if (avg != null) return avg;
  const past = points.filter((p) => p.date <= today);
  return past.length ? past[past.length - 1].value : null;
}
