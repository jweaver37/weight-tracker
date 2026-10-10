// Turns a parsed ingredient plus a USDA FoodData Central food into nutrition for the amount used.
// USDA nutrient values are per 100 g; portions ("1 cup = 256 g") convert household amounts to grams.
import { UNITS } from './ingredients.js';

// USDA nutrient numbers → this app's nutrient keys.
const NUTRIENT_NUMBERS = {
  208: 'calories', 203: 'protein', 204: 'fat', 205: 'carbs', 291: 'fiber', 269: 'sugars',
  307: 'sodium', 606: 'saturatedFat', 605: 'transFat', 645: 'monounsaturatedFat', 646: 'polyunsaturatedFat',
  601: 'cholesterol', 301: 'calcium', 303: 'iron', 306: 'potassium', 320: 'vitaminA', 401: 'vitaminC',
  328: 'vitaminD', 323: 'vitaminE', 430: 'vitaminK', 404: 'thiamin', 405: 'riboflavin', 406: 'niacin',
  415: 'vitaminB6', 435: 'folate', 418: 'vitaminB12', 305: 'phosphorus', 304: 'magnesium', 309: 'zinc',
  317: 'selenium', 312: 'copper', 315: 'manganese', 421: 'choline', 262: 'caffeine',
};
// Some Foundation foods report energy only as Atwater factors.
const ENERGY_FALLBACKS = ['957', '958'];

// Per-100 g nutrients from a search result (nutrientNumber/value) or full details (nutrient.number/amount).
export function per100g(foodNutrients) {
  const out = {};
  const energy = {};
  for (const n of foodNutrients ?? []) {
    const number = String(n.nutrientNumber ?? n.nutrient?.number ?? '');
    const value = n.value ?? n.amount;
    if (!Number.isFinite(value)) continue;
    if (ENERGY_FALLBACKS.includes(number)) energy[number] = value;
    const key = NUTRIENT_NUMBERS[number];
    if (key && out[key] == null) out[key] = value;
  }
  out.calories ??= energy['958'] ?? energy['957'];
  if (out.calories == null) delete out.calories;
  return out;
}

export const scaleTo = (per100, grams) =>
  Object.fromEntries(Object.entries(per100).map(([k, v]) => [k, (v * grams) / 100]));

// Words that describe preparation rather than the food, removed before searching.
// ("ground" and "lean" stay: ground or lean meat has different nutrition.)
const FILLER = /\b(fresh|freshly|chopped|diced|minced|sliced|shredded|grated|large|medium|small|extra|virgin|boneless|skinless|finely|roughly|thinly|packed|softened|melted|divided|optional|organic|boiling|hot|warm|cold|room temperature|to taste|for garnish|about|plus more)\b/gi;

export function searchTerms(ingredient) {
  const cleaned = ingredient.name.replace(FILLER, ' ').replace(/[^\p{L}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const terms = cleaned || ingredient.name;
  // A canned ingredient matches USDA's canned entries better when the search says so.
  return ingredient.unit === 'can' && !/canned/i.test(terms) ? `${terms} canned` : terms;
}

// Forms of a food that are rarely what a recipe means unless it says so.
const UNLIKELY = ['soup', 'condensed', 'babyfood', 'baby', 'dehydrated', 'dry mix', 'mix', 'powder', 'dry', 'instant', 'nonfat', 'frozen', 'imitation', 'infant', 'fast food', 'restaurant'];
// Parts of a food ("Egg, white") — wrong unless asked for.
const PARTS = ['white', 'yolk'];
// The everyday form a recipe means when it just says "milk" or "eggs".
const DEFAULT_FORMS = ['whole', 'raw', 'fresh', 'enriched', 'granulated', 'table', 'tap'];

const words = (text) => text.toLowerCase().match(/[a-z]+/g) ?? [];
const singular = (w) => (w.length > 3 && w.endsWith('es') && !w.endsWith('ses') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

// Re-orders USDA search results for a recipe ingredient. USDA's own order often puts soups and
// mixes first (e.g. "black beans" → "Soup, black bean"), so results are scored on how well the
// description matches the ingredient's words, with the main food word (the last one) counting most.
export function rankCandidates(terms, foods) {
  const query = words(terms).map(singular);
  const head = query[query.length - 1];
  // USDA files broth and stock under "Soup, …", and powders are "dry powder", so those aren't unlikely then.
  const allowed = new Set([
    ...(/\b(broth|stock|bouillon)\b/i.test(terms) ? ['soup'] : []),
    ...(/\bpowder\b/i.test(terms) ? ['dry'] : []),
  ]);
  const scored = foods.map((food, index) => {
    const desc = food.description.toLowerCase();
    // "Chicken, canned, no broth" is chicken without broth: words after "no"/"without" don't count.
    const negated = new Set(words(desc.match(/\b(?:no|without)\s+[a-z]+/g)?.join(' ') ?? '').map(singular));
    const descWords = words(desc).map(singular).filter((w) => !negated.has(w));
    const segments = desc.split(',');
    const firstPart = words(segments[0]).map(singular);
    const leadWords = words(segments.slice(0, 2).join(' ')).map(singular);
    let score = 0;
    for (const w of query) if (descWords.includes(w)) score += 3;
    if (head && firstPart.includes(head)) score += 3;
    // All the ingredient's words in the first two parts, e.g. "Oil, olive" for "olive oil".
    if (query.length > 1 && query.every((w) => leadWords.includes(w) && !negated.has(w))) score += 2;
    for (const u of UNLIKELY) if (new RegExp(`\\b${u}\\b`).test(desc) && !allowed.has(u) && !terms.toLowerCase().includes(u)) score -= 4;
    for (const p of PARTS) if (descWords.includes(p) && !query.includes(p)) score -= 2;
    for (const d of DEFAULT_FORMS) if (descWords.includes(d)) score += 1.5;
    score -= descWords.filter((w) => !query.includes(w)).length * 0.15; // prefer plainer descriptions
    return { food, score, index };
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.food);
}

const portionText = (p) =>
  [p.measureUnit?.name && p.measureUnit.name !== 'undetermined' ? p.measureUnit.name : '', p.modifier ?? '', p.portionDescription ?? '']
    .join(' ').toLowerCase();

// Volume (ml) of one USDA portion when it is a cup / tbsp / tsp / fl oz measure.
function portionMl(p) {
  const text = portionText(p);
  for (const key of ['cup', 'tbsp', 'tsp', 'floz']) {
    if (UNITS[key].aliases.some((a) => a.length > 1 && new RegExp(`\\b${a.replace('.', '\\.')}\\b`, 'i').test(text))) {
      return (p.amount || 1) * UNITS[key].factor;
    }
  }
  return null;
}

// Grams for the ingredient's amount. method: 'stated' (weight on the line), 'portion' (USDA measure),
// 'estimate' (assumed density or a typical piece), or 'none' (no amount, e.g. "to taste").
export function gramsFor(ingredient, portions = []) {
  const { quantity, unit, name } = ingredient;
  if (ingredient.grams != null) return { grams: ingredient.grams, method: 'stated' };
  if (quantity == null) return { grams: 0, method: 'none' };
  const usable = portions.filter((p) => p.gramWeight > 0 && !/racc/i.test(portionText(p)));
  const kind = unit ? UNITS[unit].kind : 'count';

  if (kind === 'mass') return { grams: quantity * UNITS[unit].factor, method: 'stated' };

  if (kind === 'volume') {
    const ml = quantity * UNITS[unit].factor;
    const measured = usable.map((p) => ({ p, ml: portionMl(p) })).find((x) => x.ml);
    if (measured) return { grams: (ml / measured.ml) * measured.p.gramWeight, method: 'portion' };
    return { grams: ml, method: 'estimate' }; // assume about 1 g per ml, like water
  }

  // Counts: "3 cloves", "1 large onion", "2 eggs". Prefer a portion naming the unit or size.
  const words = [unit, ...(name.toLowerCase().match(/\b(large|medium|small|extra large|jumbo)\b/g) ?? [])].filter(Boolean);
  const named = usable.find((p) => words.some((w) => portionText(p).includes(w)) && !portionMl(p));
  if (named) return { grams: (quantity / (named.amount || 1)) * named.gramWeight, method: 'portion' };
  const anyPiece = usable.find((p) => !portionMl(p));
  if (anyPiece) return { grams: (quantity / (anyPiece.amount || 1)) * anyPiece.gramWeight, method: 'estimate' };
  return { grams: null, method: 'unknown' };
}
