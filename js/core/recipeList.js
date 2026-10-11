// Sorting and filtering the recipe list. Items are { recipe, per, diets, oil } where `per` is nutrition
// per serving ({ nutrients, custom }), `diets` comes from recipeDiets() and `oil` from recipeSeedOil().
import { NUTRIENTS } from './nutrients.js';
import { targetKind } from './targets.js';

export const SORTS = [
  { key: 'name', label: 'Name' },
  { key: 'recent', label: 'Newest' },
  ...NUTRIENTS.map((n) => ({ key: n.key, label: n.label, nutrient: true })),
];

// Nutrients people usually want more of sort highest first; the rest lowest first.
const MORE_IS_BETTER = new Set(['protein', 'fiber', ...NUTRIENTS.filter((n) => n.group === 'micro').map((n) => n.key)]);
MORE_IS_BETTER.delete('caffeine');
export const defaultDirection = (key) => {
  if (key === 'name') return 'asc';
  if (key === 'recent') return 'desc';
  return MORE_IS_BETTER.has(key) || targetKind(key) === 'min' ? 'desc' : 'asc';
};

const displayName = (r) => r.name || 'Untitled recipe';

export function sortRecipes(items, key, direction) {
  const sign = direction === 'desc' ? -1 : 1;
  const value = (item) => {
    if (key === 'name') return displayName(item.recipe).toLowerCase();
    if (key === 'recent') return item.recipe.createdAt ?? '';
    return item.per.nutrients[key] ?? null;
  };
  return [...items].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // Recipes missing the nutrient go last whichever way you sort.
    if (va == null && vb == null) return displayName(a.recipe).localeCompare(displayName(b.recipe));
    if (va == null) return 1;
    if (vb == null) return -1;
    const order = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return order * sign || displayName(a.recipe).localeCompare(displayName(b.recipe));
  });
}

// filters: { query, diet: diet key | null, meals: [meal keys], nutrients: [{ key, op: 'min'|'max', value }],
//            maxCalories } — every set condition must hold. A recipe tagged with any chosen meal matches.
// A diet filter keeps recipes that fit and ones marked "check" (shown with a "?"), never hiding
// a possible match.
// seedOil: 'non' | 'other' | 'seed' — "seed" also keeps recipes marked "Seed Oil?" (check).
export function filterRecipes(items, { query = '', diet = null, seedOil = null, meals = [], nutrients = [], maxCalories = null }) {
  const q = query.trim().toLowerCase();
  return items.filter(({ recipe, per, diets, oil }) => {
    if (q && !displayName(recipe).toLowerCase().includes(q)) return false;
    if (diet && diets[diet]?.status === 'no') return false;
    if (seedOil && oil && !(oil.status === seedOil || (seedOil === 'seed' && oil.status === 'check'))) return false;
    if (meals.length && !meals.some((m) => (recipe.meals ?? []).includes(m))) return false;
    for (const f of nutrients) {
      const v = per.nutrients[f.key];
      if (v == null) return false;
      if (f.op === 'min' ? v < f.value : v > f.value) return false;
    }
    if (maxCalories != null && (per.nutrients.calories ?? 0) > maxCalories) return false;
    return true;
  });
}
