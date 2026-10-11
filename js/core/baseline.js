// The baseline: the average of the first 7 weigh-ins, the starting point for weight-loss milestones.
// It is set once, from weigh-ins within 14 days of the first one (late entries for missed days count);
// when 14 days pass with fewer, it uses the weigh-ins there are. Once set it never changes.
// Pure functions: points are { date, value } sorted by date (see trends.dailyValues).
import { addDays } from './dates.js';

export const BASELINE_WEIGH_INS = 7;
export const BASELINE_WINDOW_DAYS = 14;

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

// Where the baseline stands. Returns null with no weigh-ins, otherwise
// { ready, weightKg, weighIns, startDate, endDate, setOn }:
// ready = true once 7 weigh-ins are in (setOn = the 7th weigh-in's date) or the 14 days are up
// (setOn = the day after the window). Before then weightKg is the average so far.
// from: after "Start a new baseline", only weigh-ins on or after this date count (null = all).
export function baselineProgress(points, today, from = null) {
  if (from) points = points.filter((p) => p.date >= from);
  const first = points[0]?.date;
  if (!first) return null;
  const endDate = addDays(first, BASELINE_WINDOW_DAYS - 1);
  const used = points.filter((p) => p.date <= endDate && p.date <= today).slice(0, BASELINE_WEIGH_INS);
  const full = used.length >= BASELINE_WEIGH_INS;
  const ready = full || today > endDate;
  return {
    ready,
    weightKg: mean(used.map((p) => p.value)),
    weighIns: used.length,
    startDate: first,
    endDate,
    setOn: full ? used[used.length - 1].date : ready ? addDays(endDate, 1) : null,
  };
}

// The milestone that records the baseline (shown once, kept in the Trophy Room).
export const baselineMilestone = (b) => ({
  key: 'baseline',
  type: 'baseline',
  weightKg: b.weightKg,
  weighIns: b.weighIns,
  startDate: b.startDate,
});
