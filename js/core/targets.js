// Calorie and nutrient targets calculated from standard recommendations.
import { parseDateStr } from './dates.js';

// Everyday activity, not counting logged workouts: their calories are added to the day separately,
// so including exercise here would count it twice.
export const ACTIVITY_LEVELS = [
  { key: 'sedentary', label: 'Sedentary (mostly sitting, e.g. desk job)', factor: 1.2 },
  { key: 'light', label: 'Lightly active (on your feet part of the day)', factor: 1.375 },
  { key: 'moderate', label: 'Active (on your feet most of the day)', factor: 1.55 },
  { key: 'active', label: 'Very active (physically demanding job)', factor: 1.725 },
];

export const LOSS_RATES_LB = [0.5, 1, 1.5, 2];
export const KCAL_PER_KG = 3500 / 0.45359237; // ~3,500 kcal per lb of body weight
export const DEFAULT_MIN_CALORIES = { female: 1200, male: 1500 };

// How progress is judged: 'goal' = aim for it, 'min' = at least this much, 'max' = stay under.
const TARGET_KINDS = {
  protein: 'min', fiber: 'min',
  sodium: 'max', addedSugars: 'max', saturatedFat: 'max', transFat: 'max', cholesterol: 'max',
};
export const targetKind = (key) => TARGET_KINDS[key] ?? 'goal';

// The nutrients calculated mode sets; manual mode can set a target for any nutrient.
export const CALCULATED_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'addedSugars', 'saturatedFat'];

export function ageOn(birthDate, today) {
  const b = parseDateStr(birthDate);
  const t = parseDateStr(today);
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--;
  return age;
}

// Resting energy use (kcal/day), Mifflin-St Jeor equation.
export function mifflinStJeor({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export const minCaloriesFor = (sex, override) => override ?? DEFAULT_MIN_CALORIES[sex] ?? DEFAULT_MIN_CALORIES.female;

export function calculateTargets({ sex, age, heightCm, weightKg, goalWeightKg, activity, lossRateKgPerWeek, minCalories, proteinGPerKg }) {
  const level = ACTIVITY_LEVELS.find((a) => a.key === activity) ?? ACTIVITY_LEVELS[0];
  const bmr = mifflinStJeor({ sex, weightKg, heightCm, age });
  const maintenance = bmr * level.factor;
  const unclamped = maintenance - (lossRateKgPerWeek * KCAL_PER_KG) / 7;
  const floor = minCaloriesFor(sex, minCalories);
  const calories = Math.round(Math.max(floor, unclamped));

  // Protein is based on goal weight when it is lower, so it stays sensible at higher body weights.
  const proteinBasisKg = goalWeightKg && goalWeightKg < weightKg ? goalWeightKg : weightKg;
  const protein = Math.round(proteinBasisKg * proteinGPerKg);
  const fat = Math.round((calories * 0.3) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return {
    values: {
      calories,
      protein,
      carbs,
      fat,
      fiber: Math.round((calories / 1000) * 14),
      sodium: 2300,
      addedSugars: Math.round((calories * 0.1) / 4),
      saturatedFat: Math.round((calories * 0.1) / 9),
    },
    bmr: Math.round(bmr),
    maintenance: Math.round(maintenance),
    floorApplied: unclamped < floor,
  };
}

export const canCalculate = (profile) => Boolean(profile.sex && profile.birthDate && profile.heightCm);

export function calculateFromSettings(settings, weightKg, today) {
  const p = settings.profile;
  const t = settings.targets;
  if (!canCalculate(p) || !weightKg) return null;
  return calculateTargets({
    sex: p.sex,
    age: ageOn(p.birthDate, today),
    heightCm: p.heightCm,
    weightKg,
    goalWeightKg: p.goalWeightKg,
    activity: p.activity,
    lossRateKgPerWeek: t.lossRateKgPerWeek,
    minCalories: t.minCalories,
    proteinGPerKg: t.proteinGPerKg,
  });
}

// Calculated targets update only after the 7-day average has dropped by the threshold since the
// last calculation, so day-to-day swings don't cause constant changes.
export const shouldRecalculate = (targets, avgKg) =>
  targets.mode === 'calculated' &&
  targets.basisWeightKg != null &&
  avgKg != null &&
  targets.basisWeightKg - avgKg >= targets.recalcThresholdKg;

export const applyCalculation = (targets, result, basisWeightKg, nowIso) =>
  ({ ...targets, values: result.values, basisWeightKg, calculatedAt: nowIso });
