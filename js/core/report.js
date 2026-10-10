// Data for the printable report: per-day details and summary figures for a date range.
import { datesBetween, daysBetween } from './dates.js';
import { MEALS, entryNutrients, waterMl } from './nutrition.js';
import { currentValue } from './trends.js';
import { CALORIE_TOLERANCE } from './rings.js';
import { weekStart } from './goals.js';

// Ranges longer than this show weekly averages instead of a row per day.
export const DAILY_TABLE_MAX_DAYS = 31;

// Nutrients averaged in the summary and shown in the daily table.
export const REPORT_NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugars', 'sodium'];

const MEAL_ORDER = Object.fromEntries(MEALS.map((m, i) => [m.key, i]));

const average = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export function buildReport({ start, end, entries, workouts, water, points, settings }) {
  const plainWater = new Map(water.map((w) => [w.date, w.ml]));
  const days = datesBetween(start, end).map((date) => {
    const dayEntries = entries
      .filter((e) => e.date === date)
      .sort((a, b) => (MEAL_ORDER[a.meal] ?? 9) - (MEAL_ORDER[b.meal] ?? 9) || (a.createdAt < b.createdAt ? -1 : 1));
    const dayWorkouts = workouts.filter((w) => w.date === date);
    const totals = {};
    for (const e of dayEntries) {
      for (const [k, v] of Object.entries(entryNutrients(e))) totals[k] = (totals[k] ?? 0) + v;
    }
    const weighIn = points.find((p) => p.date === date);
    return {
      date,
      entries: dayEntries,
      workouts: dayWorkouts,
      totals,
      logged: dayEntries.length > 0,
      waterMl: waterMl(dayEntries, plainWater.get(date) ?? 0),
      burned: dayWorkouts.reduce((n, w) => n + (w.calories ?? 0), 0),
      minutes: dayWorkouts.reduce((n, w) => n + (w.minutes ?? 0), 0),
      weightKg: weighIn?.value ?? null,
    };
  });

  const logged = days.filter((d) => d.logged);
  const calorieTarget = settings.targets.values.calories;
  const weighIns = points.filter((p) => p.date >= start && p.date <= end);

  // Start and end weight use the 7-day average, so one high or low day doesn't skew the change.
  const weightStart = weighIns.length ? currentValue(points, weighIns[0].date) : null;
  const weightEnd = weighIns.length ? currentValue(points, weighIns[weighIns.length - 1].date) : null;

  // Weekly averages (weeks start Sunday) for long ranges, where a row per day would run many pages.
  const weeks = [];
  for (const d of days) {
    const ws = weekStart(d.date);
    if (!weeks.length || weeks[weeks.length - 1].start !== ws) weeks.push({ start: ws, days: [] });
    weeks[weeks.length - 1].days.push(d);
  }
  const weekly = weeks.map((w) => {
    const loggedDays = w.days.filter((d) => d.logged);
    const weights = w.days.map((d) => d.weightKg).filter((v) => v != null);
    return {
      start: w.days[0].date,
      end: w.days[w.days.length - 1].date,
      daysLogged: loggedDays.length,
      dayCount: w.days.length,
      averages: Object.fromEntries(REPORT_NUTRIENTS.map((k) => [k, average(loggedDays.map((d) => d.totals[k] ?? 0))])),
      averageWaterMl: average(w.days.filter((d) => d.waterMl > 0).map((d) => d.waterMl)),
      workoutMinutes: w.days.reduce((n, d) => n + d.minutes, 0),
      averageWeightKg: average(weights),
    };
  });

  return {
    start,
    end,
    days,
    weekly,
    weighIns,
    summary: {
      dayCount: daysBetween(start, end) + 1,
      daysLogged: logged.length,
      // Averages are over days with food logged, so unlogged days don't pull them toward zero.
      averages: Object.fromEntries(REPORT_NUTRIENTS.map((k) => [k, average(logged.map((d) => d.totals[k] ?? 0))])),
      averageWaterMl: average(days.filter((d) => d.waterMl > 0).map((d) => d.waterMl)),
      daysOnCalorieTarget: calorieTarget
        ? logged.filter((d) => Math.abs((d.totals.calories ?? 0) - (calorieTarget + d.burned)) <= (calorieTarget + d.burned) * CALORIE_TOLERANCE).length
        : null,
      workoutCount: days.reduce((n, d) => n + d.workouts.length, 0),
      workoutMinutes: days.reduce((n, d) => n + d.minutes, 0),
      workoutCalories: days.reduce((n, d) => n + d.burned, 0),
      weightStart,
      weightEnd,
      weightChange: weightStart != null && weightEnd != null ? weightEnd - weightStart : null,
    },
  };
}
