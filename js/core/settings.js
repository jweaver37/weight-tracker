// Per-user settings shape and defaults.
import { DEFAULT_VISIBLE } from './nutrients.js';
import { lbToKg, ML_PER_FLOZ } from './units.js';
import { defaultGoals } from './goals.js';
import { defaultBodySettings } from './measurements.js';

export function defaultSettings() {
  return {
    units: { weight: 'lb', length: 'in', volume: 'floz' },
    water: { targetMl: 64 * ML_PER_FLOZ },
    // Age: new profiles start on "just my age" (least personal); see profileAge().
    profile: { name: '', sex: null, birthMode: 'age', birthDate: null, birthMonth: null, age: null, ageAsOf: null, heightCm: null, activity: 'light', goalWeightKg: null },
    targets: {
      mode: 'calculated', // 'calculated' | 'manual'
      values: {},
      lossRateKgPerWeek: lbToKg(1),
      minCalories: null, // null = default floor for the profile's sex
      proteinGPerKg: 1.6,
      recalcThresholdKg: lbToKg(5),
      basisWeightKg: null, // weight the current calculated targets are based on
      calculatedAt: null,
    },
    goals: defaultGoals(),
    // Set once from the first 7 weigh-ins (see baseline.js), then left as is: { weightKg, weighIns, startDate, setOn }.
    baseline: null,
    baselineFrom: null, // set by "Start a new baseline": only weigh-ins (and measurements) from this date count
    // Body measurements tab and options (see measurements.js); the measurement baseline is the first
    // full set of measurements: { date, values }, set once like the weight baseline.
    body: defaultBodySettings(),
    measureBaseline: null,
    rings: { daysPerWeek: 5 }, // days a week the "on target" weekly rings ask for
    usda: { apiKey: '' }, // blank = shared DEMO_KEY
    // The diet the person follows (null = none) and, for flexitarians, meat-free days a week to aim for.
    // avoidSeedOils: highlight recipes with seed oils and start swaps on "Seed-Oil Free".
    diet: { follow: null, meatFreeDays: 5, avoidSeedOils: false },
    visibleNutrients: [...DEFAULT_VISIBLE],
    disclaimerAcceptedAt: null,
    setupCompletedAt: null,
    lastBackupAt: null,
    backupReminderDays: 7,
  };
}

export function withDefaults(saved) {
  const d = defaultSettings();
  if (!saved) return d;
  return {
    ...d,
    ...saved,
    units: { ...d.units, ...saved.units },
    water: { ...d.water, ...saved.water },
    rings: { ...d.rings, ...saved.rings },
    usda: { ...d.usda, ...saved.usda },
    diet: { ...d.diet, ...saved.diet },
    body: { ...d.body, ...saved.body },
    // Profiles saved before the age options have a birth date and no mode: keep using the date.
    profile: { ...d.profile, ...(saved.profile?.birthDate && !saved.profile.birthMode && { birthMode: 'date' }), ...saved.profile },
    targets: { ...d.targets, ...saved.targets },
    goals: Object.fromEntries(Object.entries(d.goals).map(([k, v]) => [k, { ...v, ...saved.goals?.[k] }])),
  };
}

export const isSetupComplete = (s) => Boolean(s.disclaimerAcceptedAt && s.setupCompletedAt);

// Days since the last backup when a reminder is due, otherwise 0.
export function backupDaysOverdue(s, now = new Date()) {
  const since = s.lastBackupAt ?? s.setupCompletedAt;
  if (!since) return 0;
  const days = Math.floor((now - new Date(since)) / 86400000);
  return days >= s.backupReminderDays ? days : 0;
}
