// Per-user settings shape and defaults.
import { DEFAULT_VISIBLE } from './nutrients.js';
import { lbToKg, ML_PER_FLOZ } from './units.js';
import { defaultGoals } from './goals.js';

export function defaultSettings() {
  return {
    units: { weight: 'lb', length: 'in', volume: 'floz' },
    water: { targetMl: 64 * ML_PER_FLOZ },
    profile: { name: '', sex: null, birthDate: null, heightCm: null, activity: 'light', goalWeightKg: null },
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
    profile: { ...d.profile, ...saved.profile },
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
