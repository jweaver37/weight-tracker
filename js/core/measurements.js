// Body measurements: what can be measured, the measurement baseline, total change, milestones,
// and body-composition estimates. Pure functions. Values are stored in cm; entries look like
// { date, values: { waist: 90.2, armLeft: 33.1, ... } }.
import { inToCm } from './units.js';

// side: measured on one side by default (left), or both when the person chooses.
// optional: off unless turned on in Settings. gain: counts toward "build muscle" totals.
export const MEASUREMENTS = [
  { key: 'neck', label: 'Neck', optional: true, hint: 'Just below the Adam’s apple, keeping the tape level.' },
  { key: 'chest', label: 'Chest', gain: true, hint: 'Around the fullest part, under your arms, after a normal breath out.' },
  { key: 'waist', label: 'Waist', hint: 'Level with your navel. Stand relaxed; don’t pull your stomach in.' },
  { key: 'hips', label: 'Hips', hint: 'Around the widest part of your buttocks, feet together.' },
  { key: 'arm', label: 'Arm', side: true, gain: true, hint: 'Around the middle of your upper arm, relaxed and hanging down.' },
  { key: 'thigh', label: 'Thigh', side: true, gain: true, hint: 'Around the widest part, just below your buttocks.' },
  { key: 'calf', label: 'Calf', side: true, optional: true, gain: true, hint: 'Around the widest part of your calf, standing.' },
];

export function defaultBodySettings() {
  return {
    enabled: false,
    bothSides: false, // arms, thighs and calves: left only, or left and right
    neck: false,
    calves: false,
    composition: false, // show estimated body fat and BMI
  };
}

// Neck is needed for the body-fat estimate, so it's measured whenever that is on.
const isOn = (m, body) => !m.optional || (m.key === 'neck' ? body.neck || body.composition : body.calves);

// The boxes to show, in order: { key, label, base, side, hint }. Keys: 'waist', 'armLeft', 'armRight'…
export function activeFields(body) {
  const out = [];
  for (const m of MEASUREMENTS) {
    if (!isOn(m, body)) continue;
    if (!m.side) out.push({ key: m.key, label: m.label, base: m, side: null, hint: m.hint });
    else {
      out.push({ key: `${m.key}Left`, label: body.bothSides ? `Left ${m.label}` : m.label, base: m, side: 'left', hint: m.hint });
      if (body.bothSides) out.push({ key: `${m.key}Right`, label: `Right ${m.label}`, base: m, side: 'right', hint: m.hint });
    }
  }
  return out;
}

const baseOf = (key) => MEASUREMENTS.find((m) => key === m.key || key === `${m.key}Left` || key === `${m.key}Right`);
export const fieldLabel = (key) => {
  const m = baseOf(key);
  if (!m) return key;
  return key.endsWith('Left') ? `Left ${m.label}` : key.endsWith('Right') ? `Right ${m.label}` : m.label;
};

const byDate = (entries) => [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));

// The first entry with every active measurement filled in (on or after `from`), or null.
// It becomes the measurement baseline: { date, values }.
export function findMeasureBaseline(entries, body, from = null) {
  const keys = activeFields(body).map((f) => f.key);
  const first = byDate(entries).find((e) => (!from || e.date >= from) && keys.every((k) => e.values?.[k] > 0));
  return first ? { date: first.date, values: { ...first.values } } : null;
}

// The most recent value of each measurement on or before `today`: { key: { value, date } }.
export function latestValues(entries, today) {
  const out = {};
  for (const e of byDate(entries)) {
    if (e.date > today) continue;
    for (const [k, v] of Object.entries(e.values ?? {})) if (v > 0) out[k] = { value: v, date: e.date };
  }
  return out;
}

// Change in each measurement since the baseline (latest − baseline, cm), only for ones in both.
export function changesSinceBaseline(baseline, latest) {
  const out = {};
  for (const [k, base] of Object.entries(baseline?.values ?? {})) {
    if (latest[k]) out[k] = latest[k].value - base;
  }
  return out;
}

// Total progress in cm for a goal mode: 'lose' = inches lost across every measurement (one area can
// stall while others shrink); 'gain' = inches gained on chest, arms, thighs and calves (building muscle).
export function totalProgress(changes, mode) {
  let total = 0;
  for (const [k, change] of Object.entries(changes)) {
    if (mode === 'gain') { if (baseOf(k)?.gain) total += change; }
    else total -= change;
  }
  return total;
}

export function defaultMeasureGoal() {
  return { enabled: false, mode: 'lose', stepCm: inToCm(2) };
}

export const measureLevel = (totalCm, stepCm) => (stepCm > 0 ? Math.floor(totalCm / stepCm + 1e-9) : 0);

// A new total-inches milestone, or null. achieved: milestones already recorded.
export function evaluateMeasureGoal({ goal, baseline, entries, today, achieved }) {
  if (!goal.enabled || !baseline) return null;
  const total = totalProgress(changesSinceBaseline(baseline, latestValues(entries, today)), goal.mode);
  const level = measureLevel(total, goal.stepCm);
  const prefix = `measure:${goal.mode}:${baseline.date}:${goal.stepCm.toFixed(3)}:`;
  const highest = Math.max(0, ...achieved.filter((m) => m.key.startsWith(prefix)).map((m) => m.level ?? 0));
  if (level < 1 || level <= highest) return null;
  return { key: `${prefix}${level}`, type: 'measureTotal', mode: goal.mode, level, totalCm: level * goal.stepCm, actualCm: total, baselineStart: baseline.date };
}

// ---- Body composition ----

// Estimated body fat % by the U.S. Navy method (inches): men need waist, neck and height;
// women also hips. Null when something is missing or the numbers don't make sense.
export function navyBodyFat({ sex, heightCm, waistCm, neckCm, hipsCm }) {
  const log = Math.log10;
  const inch = (cm) => cm / 2.54;
  if (!heightCm || !waistCm || !neckCm || (sex !== 'male' && sex !== 'female')) return null;
  let bf;
  if (sex === 'male') {
    if (waistCm <= neckCm) return null;
    bf = 86.010 * log(inch(waistCm - neckCm)) - 70.041 * log(inch(heightCm)) + 36.76;
  } else {
    if (!hipsCm || waistCm + hipsCm <= neckCm) return null;
    bf = 163.205 * log(inch(waistCm + hipsCm - neckCm)) - 97.684 * log(inch(heightCm)) - 78.387;
  }
  return Number.isFinite(bf) && bf > 2 && bf < 75 ? bf : null;
}

// What the body-fat estimate still needs, as labels (empty when it can be calculated).
export function bodyFatMissing({ sex, heightCm, waistCm, neckCm, hipsCm }) {
  const missing = [];
  if (sex !== 'male' && sex !== 'female') missing.push('sex (in your profile)');
  if (!heightCm) missing.push('height (in your profile)');
  if (!waistCm) missing.push('waist');
  if (!neckCm) missing.push('neck');
  if (sex === 'female' && !hipsCm) missing.push('hips');
  return missing;
}

export const bmi = (weightKg, heightCm) => (weightKg && heightCm ? weightKg / (heightCm / 100) ** 2 : null);

// Standard adult BMI categories.
export function bmiCategory(value) {
  if (value == null) return null;
  if (value < 18.5) return 'Underweight';
  if (value < 25) return 'Healthy weight';
  if (value < 30) return 'Overweight';
  return 'Obesity';
}
