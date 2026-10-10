// Nutrition math: serving scaling and daily totals.
// A log entry stores its own copy of nutrients per serving (`nutrients`, `custom`) plus `servings`,
// so later edits to a food or recipe never change past days.

export const MEALS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'drinks', label: 'Drinks' },
];

// Water for a day: the plain water tally plus drinks marked "counts toward water".
// Drink entries store `volumeMl` per serving.
export function waterMl(entries, plainWaterMl = 0) {
  let total = plainWaterMl;
  for (const e of entries) {
    if (e.countsAsWater && Number.isFinite(e.volumeMl)) total += e.volumeMl * e.servings;
  }
  return total;
}

// Parses "1.5", "2", ".5", "1/2" and "1 1/2". Returns null for anything that isn't a non-negative number.
export function parseAmount(text) {
  if (typeof text === 'number') return Number.isFinite(text) && text >= 0 ? text : null;
  const s = String(text ?? '').trim();
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[3]) ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) : null;
  const fraction = s.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[2]) ? Number(fraction[1]) / Number(fraction[2]) : null;
  return /^(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null;
}

export function scaleValues(values, factor) {
  const out = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    if (Number.isFinite(value)) out[key] = value * factor;
  }
  return out;
}

export function addInto(target, values) {
  for (const [key, value] of Object.entries(values ?? {})) {
    if (Number.isFinite(value)) target[key] = (target[key] ?? 0) + value;
  }
  return target;
}

export const entryNutrients = (entry) => scaleValues(entry.nutrients, entry.servings);
export const entryCustom = (entry) => scaleValues(entry.custom, entry.servings);

export function sumEntries(entries) {
  const totals = { nutrients: {}, custom: {} };
  for (const entry of entries) {
    addInto(totals.nutrients, entryNutrients(entry));
    addInto(totals.custom, entryCustom(entry));
  }
  return totals;
}

export function groupByMeal(entries) {
  const groups = Object.fromEntries(MEALS.map((m) => [m.key, []]));
  for (const entry of entries) (groups[entry.meal] ?? groups.snacks).push(entry);
  return groups;
}
