// Looks up one ingredient line ("1 ¾ cups almond flour") in USDA FoodData Central and returns a
// recipe ingredient with nutrition for that amount — the same steps the recipe import uses.
import { parseIngredientLine, UNITS } from '../core/ingredients.js';
import { gramsFor, per100g, rankCandidates, scaleTo, searchTerms } from '../core/foodMatch.js';
import { getFoods, searchFoods } from '../data/usda.js';
import { roundTo } from '../core/units.js';
import { fmt } from './format.js';
import { state } from './state.js';

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Resolves { ingredient, description, grams, method } — ingredient has no nutrition when no match
// was found (description null). Throws UsdaError when the lookup itself fails.
export async function lookUpIngredient(line, { searchAs } = {}) {
  const apiKey = state.settings.usda?.apiKey ?? '';
  const parsed = parseIngredientLine(line);
  const base = { kind: 'food', name: capitalize(parsed?.name ?? line), brand: null, servings: 1, custom: {} };
  if (!parsed) return { ingredient: { ...base, servingSize: line, nutrients: {} }, description: null };

  const terms = searchAs ?? searchTerms(parsed);
  const needsPortion = parsed.grams == null && UNITS[parsed.unit]?.kind !== 'mass';
  const [best] = rankCandidates(terms, await searchFoods(terms, apiKey), { needsPortion });
  if (!best) return { ingredient: { ...base, servingSize: parsed.original, nutrients: {} }, description: null };

  const [detail] = await getFoods([best.fdcId], apiKey);
  const g = gramsFor(parsed, detail?.foodPortions ?? []);
  if (!g.grams) return { ingredient: { ...base, servingSize: parsed.original, nutrients: {} }, description: best.description, method: g.method };

  const per100 = per100g(detail?.foodNutrients ?? best.foodNutrients);
  return {
    ingredient: {
      ...base,
      servingSize: `${parsed.original} (${fmt(g.grams)} g)`,
      nutrients: Object.fromEntries(Object.entries(scaleTo(per100, g.grams)).map(([k, v]) => [k, roundTo(v, 2)])),
      source: { type: 'usda', fdcId: best.fdcId, description: best.description, grams: g.grams },
    },
    description: best.description,
    grams: g.grams,
    method: g.method,
  };
}
