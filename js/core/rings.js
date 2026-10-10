// Goal rings for a day, week and month. Each ring type is defined once in RINGS; a ring appears
// when its goal or target is set. New ring types (e.g. steps in Phase 2) are added to RINGS.
import { addDays, datesBetween, daysInMonth, maxDate, minDate, monthEnd, monthStart } from './dates.js';
import { targetHit, weekStart } from './goals.js';
import { targetKind } from './targets.js';
import { currentValue } from './trends.js';
import { entryNutrients, waterMl } from './nutrition.js';
import { nutrientByKey } from './nutrients.js';

// Calories count as on target within this fraction of the day's budget.
export const CALORIE_TOLERANCE = 0.1;

export function periodRange(period, anchor) {
  if (period === 'day') return { start: anchor, end: anchor };
  if (period === 'week') {
    const start = weekStart(anchor);
    return { start, end: addDays(start, 6) };
  }
  return { start: monthStart(anchor), end: monthEnd(anchor) };
}

// Dates whose data the rings for `anchor` need: its week and month, plus full weeks that start in the month.
export function dataRange(anchor, today) {
  const start = minDate(weekStart(anchor), monthStart(anchor));
  const end = maxDate(addDays(weekStart(anchor), 6), addDays(monthEnd(anchor), 6));
  return { start, end: minDate(end, today) };
}

// Per-day totals: { eaten, nutrients, burned, workouts, waterMl, logged }.
export function buildDaySummaries({ entries, workouts, water }) {
  const days = new Map();
  const day = (date) => {
    if (!days.has(date)) days.set(date, { eaten: 0, nutrients: {}, burned: 0, workouts: 0, waterMl: 0, logged: false, entries: [] });
    return days.get(date);
  };
  for (const e of entries) {
    const d = day(e.date);
    d.entries.push(e);
    d.logged = true;
    for (const [k, v] of Object.entries(entryNutrients(e))) d.nutrients[k] = (d.nutrients[k] ?? 0) + v;
  }
  for (const w of water) day(w.date).waterMl += w.ml;
  for (const d of days.values()) {
    d.eaten = d.nutrients.calories ?? 0;
    d.waterMl = waterMl(d.entries, d.waterMl);
    delete d.entries;
  }
  for (const w of workouts) {
    const d = day(w.date);
    d.burned += w.calories ?? 0;
    d.workouts += 1;
  }
  return days;
}

const EMPTY_DAY = { eaten: 0, nutrients: {}, burned: 0, workouts: 0, waterMl: 0, logged: false };

// ---- Daily checks, reused by the weekly and monthly rings ----

const calorieBudget = (s, day) => s.targets.values.calories + day.burned;
const caloriesOnTarget = (s, day) => {
  const budget = calorieBudget(s, day);
  return day.logged && Math.abs(day.eaten - budget) <= budget * CALORIE_TOLERANCE;
};
const waterReached = (s, day) => day.waterMl >= s.water.targetMl;

// `display` tells the screen how to label value / target.
export const RINGS = [
  {
    key: 'calories', period: 'day', label: 'Calories', color: 'red',
    applies: (s) => s.targets.values.calories > 0,
    measure: (s, ctx) => {
      const d = ctx.day(ctx.range.start);
      const budget = calorieBudget(s, d);
      return { value: d.eaten, target: budget, display: 'kcal', complete: caloriesOnTarget(s, d), over: d.eaten > budget * (1 + CALORIE_TOLERANCE) };
    },
  },
  {
    key: 'protein', period: 'day', label: 'Protein', color: 'blue',
    applies: (s) => s.targets.values.protein > 0,
    measure: (s, ctx) => {
      const value = ctx.day(ctx.range.start).nutrients.protein ?? 0;
      return { value, target: s.targets.values.protein, display: 'g', complete: value >= s.targets.values.protein };
    },
  },
  {
    key: 'water', period: 'day', label: 'Water', color: 'cyan',
    applies: (s) => s.water.targetMl > 0,
    measure: (s, ctx) => {
      const d = ctx.day(ctx.range.start);
      return { value: d.waterMl, target: s.water.targetMl, display: 'volume', complete: waterReached(s, d) };
    },
  },

  {
    key: 'workouts', period: 'week', label: 'Workouts', color: 'orange',
    applies: (s) => s.goals.workoutsPerWeek.enabled,
    measure: (s, ctx) => {
      const value = ctx.dates.reduce((n, date) => n + ctx.day(date).workouts, 0);
      const target = s.goals.workoutsPerWeek.perWeek;
      return { value, target, display: 'workouts', complete: value >= target };
    },
  },
  {
    key: 'caloriesDays', period: 'week', label: 'Calorie days', color: 'red',
    applies: (s) => s.targets.values.calories > 0,
    measure: (s, ctx) => countDays(ctx, (d) => caloriesOnTarget(s, d), s.rings.daysPerWeek),
  },
  {
    key: 'nutrition', period: 'week', color: 'purple',
    label: (s) => `${nutrientByKey(s.goals.nutrition.nutrient)?.label ?? 'Nutrient'} days`,
    // A calories nutrition goal is already covered by the "Calorie days" ring.
    applies: (s) => s.goals.nutrition.enabled && s.goals.nutrition.nutrient !== 'calories' && s.targets.values[s.goals.nutrition.nutrient] > 0,
    measure: (s, ctx) => {
      const { nutrient, days } = s.goals.nutrition;
      const target = s.targets.values[nutrient];
      return countDays(ctx, (d) => d.logged && targetHit(d.nutrients[nutrient] ?? 0, target, targetKind(nutrient)), days);
    },
  },
  {
    key: 'waterDays', period: 'week', label: 'Water days', color: 'cyan',
    applies: (s) => s.water.targetMl > 0,
    measure: (s, ctx) => countDays(ctx, (d) => waterReached(s, d), s.rings.daysPerWeek),
  },

  {
    key: 'weightPace', period: 'month', label: 'Weight loss pace', color: 'green',
    applies: (s) => Boolean(s.profile.goalWeightKg) && s.targets.lossRateKgPerWeek > 0,
    measure: (s, ctx) => {
      const { start, end } = ctx.range;
      const inMonth = ctx.points.filter((p) => p.date >= start && p.date <= end);
      const startKg = currentValue(ctx.points, addDays(start, -1)) ?? inMonth[0]?.value ?? null;
      const nowKg = currentValue(ctx.points, minDate(end, ctx.today));
      const lost = startKg != null && nowKg != null ? Math.max(0, startKg - nowKg) : 0;
      const target = (s.targets.lossRateKgPerWeek * daysInMonth(start)) / 7;
      return { value: lost, target, display: 'weight', complete: lost >= target };
    },
  },
  {
    key: 'loggingDays', period: 'month', label: 'Logging days', color: 'blue',
    applies: () => true,
    measure: (s, ctx) => countDays(ctx, (d) => d.logged, daysInMonth(ctx.range.start)),
  },
  {
    key: 'workoutWeeks', period: 'month', label: 'Workout weeks', color: 'orange',
    applies: (s) => s.goals.workoutsPerWeek.enabled,
    measure: (s, ctx) => {
      // Weeks that start (Sunday) in this month, counted over their full seven days.
      const sundays = datesBetween(ctx.range.start, ctx.range.end).filter((d) => weekStart(d) === d);
      const perWeek = s.goals.workoutsPerWeek.perWeek;
      const value = sundays.filter((sun) =>
        datesBetween(sun, addDays(sun, 6)).reduce((n, date) => n + ctx.day(date).workouts, 0) >= perWeek).length;
      return { value, target: sundays.length, display: 'weeks', complete: value >= sundays.length };
    },
  },
  {
    key: 'dailyClosed', period: 'month', label: 'Daily circles closed', color: 'pink',
    applies: (s) => ringsFor(s, 'day').length > 0,
    measure: (s, ctx) => countDays(ctx, (d, date) => dayClosed(s, ctx, date), daysInMonth(ctx.range.start)),
  },
];

// Counts days in the period (up to today) that pass `check`, against `target` days.
function countDays(ctx, check, target) {
  const value = ctx.dates.filter((date) => check(ctx.day(date), date)).length;
  return { value, target, display: 'days', complete: value >= target };
}

export const ringsFor = (settings, period) => RINGS.filter((r) => r.period === period && r.applies(settings));

function dayClosed(s, ctx, date) {
  const daily = ringsFor(s, 'day');
  const dayCtx = { ...ctx, range: { start: date, end: date }, dates: [date] };
  return daily.length > 0 && daily.every((r) => r.measure(s, dayCtx).complete);
}

// Results for one circle: rings (outermost first) and whether every ring is complete.
export function evaluatePeriod(settings, period, { anchor, today, days, points }) {
  const range = periodRange(period, anchor);
  const ctx = {
    range,
    today,
    points,
    // Future days in the period haven't happened yet, so they aren't counted.
    dates: range.start > today ? [] : datesBetween(range.start, minDate(range.end, today)),
    day: (date) => days.get(date) ?? EMPTY_DAY,
  };
  const rings = ringsFor(settings, period).map((r) => {
    const m = r.measure(settings, ctx);
    const label = typeof r.label === 'function' ? r.label(settings) : r.label;
    return { key: r.key, label, color: r.color, ...m, progress: m.target > 0 ? Math.min(1, m.value / m.target) : 0 };
  });
  return { period, range, rings, allComplete: rings.length > 0 && rings.every((r) => r.complete) };
}
