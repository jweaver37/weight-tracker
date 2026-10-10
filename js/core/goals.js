// Personal goals and the milestones they produce. Pure functions: callers pass in the data.
import { addDays, parseDateStr } from './dates.js';
import { targetKind } from './targets.js';
import { lbToKg } from './units.js';

export function defaultGoals() {
  return {
    weightLoss: { enabled: false, stepKg: lbToKg(5) },
    loggingStreak: { enabled: false, days: 7 },
    workoutsPerWeek: { enabled: false, perWeek: 3, weeks: 4 },
    nutrition: { enabled: false, nutrient: 'protein', days: 5 },
  };
}

export const NUTRITION_WINDOW_DAYS = 7;
// A 'goal'-type target (like calories) counts as hit within this fraction of the target.
export const GOAL_TOLERANCE = 0.1;

// ---- Measurements ----

export const weightLossLevel = (startKg, currentKg, stepKg) =>
  startKg != null && currentKg != null && stepKg > 0 ? Math.floor((startKg - currentKg) / stepKg + 1e-9) : 0;

// Consecutive days with food logged, ending today (or yesterday when today has nothing yet).
export function loggingStreak(loggedDates, today) {
  let day = loggedDates.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (loggedDates.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return { count, startDate: count ? addDays(day, 1) : null };
}

// Weeks start on Sunday.
export const weekStart = (date) => addDays(date, -parseDateStr(date).getDay());

// Consecutive weeks with at least `perWeek` workouts. The current week counts once it qualifies;
// until then it doesn't break the streak.
export function workoutWeekStreak(workoutDates, today, perWeek) {
  const perWeekCounts = new Map();
  for (const date of workoutDates) {
    const week = weekStart(date);
    perWeekCounts.set(week, (perWeekCounts.get(week) ?? 0) + 1);
  }
  let week = weekStart(today);
  if ((perWeekCounts.get(week) ?? 0) < perWeek) week = addDays(week, -7);
  let count = 0;
  while ((perWeekCounts.get(week) ?? 0) >= perWeek) {
    count++;
    week = addDays(week, -7);
  }
  return { count, startWeek: count ? addDays(week, 7) : null };
}

export function targetHit(value, target, kind) {
  if (kind === 'min') return value >= target;
  if (kind === 'max') return value <= target;
  return Math.abs(value - target) <= target * GOAL_TOLERANCE;
}

// Days in the window ending endDate on which the nutrient target was hit.
// dailyTotals: Map of date → nutrient totals; days with nothing logged count as missed.
export function nutritionHits(dailyTotals, nutrient, target, endDate, windowDays = NUTRITION_WINDOW_DAYS) {
  const kind = targetKind(nutrient);
  let hits = 0;
  for (let i = 0; i < windowDays; i++) {
    const totals = dailyTotals.get(addDays(endDate, -i));
    if (totals && targetHit(totals[nutrient] ?? 0, target, kind)) hits++;
  }
  return hits;
}

// ---- Milestones ----
// Each milestone has a unique key so it is shown once. `achieved` is the list already recorded.

export function evaluateGoals({ goals, targets, today, weights, loggedDates, workoutDates, dailyTotals, achieved }) {
  const found = [];
  const seen = new Set(achieved.map((m) => m.key));
  const highest = (prefix) => Math.max(0, ...achieved.filter((m) => m.key.startsWith(prefix)).map((m) => m.level ?? 0));

  // Weight loss: one milestone per step of 7-day-average loss from the first weigh-in.
  const wl = goals.weightLoss;
  if (wl.enabled && weights.start != null) {
    const level = weightLossLevel(weights.start, weights.current, wl.stepKg);
    const prefix = `weightLoss:${wl.stepKg.toFixed(3)}:`;
    if (level >= 1 && level > highest(prefix)) {
      found.push({ key: `${prefix}${level}`, type: 'weightLoss', level, lostKg: level * wl.stepKg, startKg: weights.start, currentKg: weights.current });
    }
  }

  // Logging streak: at every multiple of the chosen number of days.
  const ls = goals.loggingStreak;
  if (ls.enabled) {
    const streak = loggingStreak(loggedDates, today);
    const level = Math.floor(streak.count / ls.days);
    const prefix = `loggingStreak:${ls.days}:${streak.startDate}:`;
    if (level >= 1 && level > highest(prefix)) {
      found.push({ key: `${prefix}${level}`, type: 'loggingStreak', level, days: level * ls.days });
    }
  }

  // Workouts per week: at every multiple of the chosen number of weeks.
  const wp = goals.workoutsPerWeek;
  if (wp.enabled) {
    const streak = workoutWeekStreak(workoutDates, today, wp.perWeek);
    const level = Math.floor(streak.count / wp.weeks);
    const prefix = `workoutsPerWeek:${wp.perWeek}x${wp.weeks}:${streak.startWeek}:`;
    if (level >= 1 && level > highest(prefix)) {
      found.push({ key: `${prefix}${level}`, type: 'workoutsPerWeek', level, weeks: level * wp.weeks, perWeek: wp.perWeek });
    }
  }

  // Nutrition consistency over the last 7 finished days; at most once per 7-day window.
  const nu = goals.nutrition;
  const target = targets.values[nu.nutrient];
  if (nu.enabled && target) {
    const endDate = addDays(today, -1);
    const hits = nutritionHits(dailyTotals, nu.nutrient, target, endDate);
    const prefix = `nutrition:${nu.nutrient}:`;
    const recent = achieved.some((m) => m.key.startsWith(prefix) && m.endDate > addDays(endDate, -NUTRITION_WINDOW_DAYS));
    const key = `${prefix}${endDate}`;
    if (hits >= nu.days && !recent && !seen.has(key)) {
      found.push({ key, type: 'nutrition', nutrient: nu.nutrient, hits, endDate });
    }
  }

  return found;
}
