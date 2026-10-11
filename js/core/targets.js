// Calorie and nutrient targets calculated from standard recommendations.
import { addDays, parseDateStr } from './dates.js';

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
  const deficit = (lossRateKgPerWeek * KCAL_PER_KG) / 7;
  const unclamped = maintenance - deficit;
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
    // The steps, for showing how the calorie target was reached:
    // BMR × activity factor = maintenance; maintenance − deficit = target (but not below the floor).
    bmr: Math.round(bmr),
    activityFactor: level.factor,
    activityLabel: level.label,
    maintenance: Math.round(maintenance),
    deficit: Math.round(deficit),
    floor,
    floorApplied: unclamped < floor,
  };
}

// Age can come from a full birth date, a birth month and year, or just an age. The calorie formula
// uses whole years (each year changes BMR by ~5 kcal), so the day isn't needed.
// profile.birthMode: 'date' (birthDate 'YYYY-MM-DD'), 'month' (birthMonth 'YYYY-MM'), or
// 'age' (age, ageAsOf 'YYYY-MM-DD' — counted on a year each year after it was entered).
export function profileAge(profile, today) {
  const mode = profile.birthMode ?? (profile.birthDate ? 'date' : profile.birthMonth ? 'month' : 'age');
  if (mode === 'date' && profile.birthDate) return ageOn(profile.birthDate, today);
  // Birthday assumed on the 1st of the month, so the age is never more than a month behind.
  if (mode === 'month' && /^\d{4}-\d{2}$/.test(profile.birthMonth ?? '')) return ageOn(`${profile.birthMonth}-01`, today);
  if (mode === 'age' && Number.isFinite(profile.age) && profile.ageAsOf) {
    return profile.age + Math.max(0, ageOn(profile.ageAsOf, today));
  }
  return null;
}

export const canCalculate = (profile) => Boolean(profile.sex && profile.heightCm && profileAge(profile, new Date().toISOString().slice(0, 10)) != null);

export function calculateFromSettings(settings, weightKg, today) {
  const p = settings.profile;
  const t = settings.targets;
  if (!canCalculate(p) || !weightKg) return null;
  return calculateTargets({
    sex: p.sex,
    age: profileAge(p, today),
    heightCm: p.heightCm,
    weightKg,
    goalWeightKg: p.goalWeightKg,
    activity: p.activity,
    lossRateKgPerWeek: t.lossRateKgPerWeek,
    minCalories: t.minCalories,
    proteinGPerKg: t.proteinGPerKg,
  });
}

// The weight calculated targets should be based on, worked out from the weigh-ins themselves so it is
// always correct after any weigh-in is added, changed or deleted. Going through the history in date
// order, the basis moves to the 7-day average whenever that average has moved by at least the
// threshold (down or up) since the last move — so day-to-day swings don't change targets.
// points: [{ date, value (kg) }] sorted by date.
export function basisWeightFromHistory(points, thresholdKg) {
  let basis = null;
  for (const p of points) {
    const start = addDays(p.date, -6);
    const window = points.filter((q) => q.date >= start && q.date <= p.date);
    const avg = window.reduce((s, q) => s + q.value, 0) / window.length;
    if (basis == null || Math.abs(avg - basis) >= thresholdKg - 1e-9) basis = avg;
  }
  return basis;
}

// A weigh-in far from the previous one is probably a typo (145 for 245). Allowed change: the larger of
// 5 lb (2.27 kg) or 3% of body weight, plus about ½ lb (0.23 kg) a day since the previous weigh-in.
export function unusualWeighIn(previous, newKg, date) {
  if (!previous) return null;
  const days = Math.max(0, Math.round((parseDateStr(date) - parseDateStr(previous.date)) / 86400000));
  const allowed = Math.max(2.27, previous.value * 0.03) + Math.abs(days) * 0.23;
  const diff = newKg - previous.value;
  return Math.abs(diff) > allowed ? { previous, diffKg: diff, allowedKg: allowed } : null;
}

export const applyCalculation = (targets, result, basisWeightKg, nowIso) =>
  ({ ...targets, values: result.values, basisWeightKg, calculatedAt: nowIso });
