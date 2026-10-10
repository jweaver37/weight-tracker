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
  const cleaned = ingredient.name.replace(FILLER, ' ').replace(/[^\p{L}\s-]/gu, ' ')
    // Hyphens left over once a word is removed ("extra-virgin olive oil" → "- olive oil").
    .replace(/(^|\s)-+|-+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const terms = cleaned || ingredient.name;
  // A canned ingredient matches USDA's canned entries better when the search says so.
  return ingredient.unit === 'can' && !/canned/i.test(terms) ? `${terms} canned` : terms;
}

// Forms of a food that are rarely what a recipe means unless it says so.
const UNLIKELY = [
  'soup', 'condensed', 'babyfood', 'baby', 'dehydrated', 'dried', 'dry mix', 'mix', 'powder', 'dry', 'instant', 'nonfat',
  'frozen', 'imitation', 'infant', 'fast food', 'restaurant', 'evaporated',
  // Milk and cheese from other animals: "milk" in a recipe means cow's milk.
  'sheep', 'goat', 'buffalo', 'human', 'camel',
  // Special versions: only when the recipe asks for them.
  'low-sodium', 'low sodium', 'reduced sodium', 'reduced fat', 'reduced-fat', 'low fat', 'lowfat', 'fat free', 'fat-free', 'sugar free', 'sugar-free',
];
// Parts of an egg ("Egg, white") — wrong unless asked for.
const PARTS = ['white', 'yolk'];
// The everyday form a recipe means when it just says "milk" or "eggs".
const DEFAULT_FORMS = ['whole', 'raw', 'fresh', 'enriched', 'granulated', 'table', 'tap'];

const words = (text) => text.toLowerCase().match(/[a-z]+/g) ?? [];
const squash = (text) => text.toLowerCase().replace(/[-\s]/g, '');
// berries → berry, tomatoes → tomato, peaches → peach, whites → white, eggs → egg.
function singular(w) {
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (/(oes|ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

// Re-orders USDA search results for a recipe ingredient. USDA's own order often puts soups and
// mixes first (e.g. "black beans" → "Soup, black bean"), so results are scored on how well the
// description matches the ingredient's words, with the main food word (the last one) counting most.
// needsPortion: the amount is in cups, spoons or pieces, so entries from USDA's SR Legacy set —
// which list household measures — are preferred over Foundation entries, which often don't.
export function rankCandidates(terms, foods, { needsPortion = false } = {}) {
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
    // "Asked for" ignores hyphens and spaces, so "low-fat" in the recipe matches USDA's "lowfat".
    for (const u of UNLIKELY) if (new RegExp(`\\b${u}\\b`).test(desc) && !allowed.has(u) && !squash(terms).includes(squash(u))) score -= 4;
    // Only for eggs: "white" is also how USDA names white flour, rice and bread.
    if (query.includes('egg')) for (const p of PARTS) if (descWords.includes(p) && !query.includes(p)) score -= 2;
    for (const d of DEFAULT_FORMS) if (descWords.includes(d)) score += 1.5;
    if (needsPortion && food.dataType === 'SR Legacy') score += 1.5;
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

// Typical weights (g) of foods recipes count rather than measure, from USDA reference portions.
// Used when the matched USDA entry has no matching portion (e.g. "2 large eggs" matched to an entry
// without a "large" measure).
const TYPICAL_PIECES = [
  { food: 'egg', label: 'egg', sizes: { small: 38, medium: 44, large: 50, 'extra large': 56, jumbo: 63 }, usual: 'large' },
  { food: 'garlic', unit: 'clove', label: 'clove', grams: 3 },
  { food: 'onion', label: 'onion', sizes: { small: 70, medium: 110, large: 150 }, usual: 'medium' },
  { food: 'banana', label: 'banana', sizes: { small: 101, medium: 118, large: 136 }, usual: 'medium' },
  { food: 'apple', label: 'apple', sizes: { small: 149, medium: 182, large: 223 }, usual: 'medium' },
  { food: 'potato', label: 'potato', sizes: { small: 170, medium: 213, large: 369 }, usual: 'medium' },
  { food: 'carrot', label: 'carrot', sizes: { small: 50, medium: 61, large: 72 }, usual: 'medium' },
  { food: 'tomato', label: 'tomato', sizes: { small: 91, medium: 123, large: 182 }, usual: 'medium' },
  { food: 'lemon', label: 'lemon', grams: 58 },
  { food: 'lime', label: 'lime', grams: 67 },
  { food: 'butter', unit: 'stick', label: 'stick', grams: 113 },
];
const SIZE_RE = /\b(extra large|jumbo|large|medium|small)\b/;

function typicalPiece(ingredient) {
  const name = ingredient.name.toLowerCase();
  const nameWords = words(name).map(singular);
  const entry = TYPICAL_PIECES.find((t) => nameWords.includes(t.food) && (t.unit ? ingredient.unit === t.unit : !ingredient.unit));
  if (!entry) return null;
  if (entry.grams) return { grams: entry.grams, label: entry.label };
  const size = name.match(SIZE_RE)?.[1] ?? entry.usual;
  return { grams: entry.sizes[size], label: `${size} ${entry.label}` };
}

// Grams per US cup of common ingredients (USDA household measures), for when the matched entry has
// no cup/spoon measure. First match wins, so more specific names come first.
const CUP_WEIGHTS = [
  [['almond', 'flour'], 96], [['whole', 'wheat', 'flour'], 120], [['bread', 'flour'], 127], [['cake', 'flour'], 114],
  [['flour'], 125],
  [['brown', 'sugar'], 220], [['powdered', 'sugar'], 120], [['confectioner'], 120], [['sugar'], 200],
  [['cocoa'], 86], [['cornstarch'], 128], [['baking', 'powder'], 220], [['baking', 'soda'], 221], [['salt'], 292],
  [['peanut', 'butter'], 258], [['butter'], 227],
  [['olive', 'oil'], 216], [['oil'], 218],
  [['coconut', 'milk'], 226], [['almond', 'milk'], 240], [['buttermilk'], 245], [['milk'], 244],
  [['sour', 'cream'], 230], [['cream', 'cheese'], 232], [['cream'], 238],
  [['yogurt'], 245], [['honey'], 339], [['maple', 'syrup'], 322], [['mayonnaise'], 220],
  [['rice'], 185], [['oat'], 81], [['chocolate', 'chip'], 168], [['raisin'], 145],
  [['shredded', 'cheese'], 113], [['cheddar'], 113], [['parmesan'], 100],
  [['vanilla'], 202], [['broth'], 240], [['stock'], 240], [['water'], 237],
];

function typicalCupGrams(name) {
  const nameWords = words(name).map(singular);
  const hit = CUP_WEIGHTS.find(([keys]) => keys.every((k) => nameWords.some((w) => w.startsWith(k))));
  return hit?.[1] ?? null;
}

// How a unit reads in "2 cups × 200 g per cup".
const UNIT_LABELS = { cup: 'cup', tbsp: 'tbsp', tsp: 'tsp', floz: 'fl oz', ml: 'ml', l: 'liter', pint: 'pint', quart: 'quart', pinch: 'pinch', dash: 'dash' };

// Grams for the ingredient's amount, as { grams, method, each } where each = { grams, label } is one
// unit of what the recipe counted or measured ("large egg", "cup"), so the screen can show
// "2 large eggs × 50 g each". method: 'stated' (weight given in the recipe), 'portion' (USDA measure),
// 'typical' (standard size, e.g. a large egg), 'estimate' (rough guess — check it), 'none' (no amount,
// e.g. "to taste") or 'unknown' (enter the grams).
export function gramsFor(ingredient, portions = []) {
  const { quantity, unit, name } = ingredient;
  if (ingredient.grams != null) return { grams: ingredient.grams, method: 'stated' };
  if (quantity == null) return { grams: 0, method: 'none' };
  const usable = portions.filter((p) => p.gramWeight > 0 && !/racc/i.test(portionText(p)));
  const kind = unit ? UNITS[unit].kind : 'count';

  if (kind === 'mass') return { grams: quantity * UNITS[unit].factor, method: 'stated' };

  if (kind === 'volume') {
    const unitMl = UNITS[unit].factor;
    const measured = usable.map((p) => ({ p, ml: portionMl(p) })).find((x) => x.ml);
    const label = UNIT_LABELS[unit] ?? unit;
    if (measured) {
      const per = (unitMl / measured.ml) * measured.p.gramWeight;
      return { grams: quantity * per, method: 'portion', each: { grams: per, label } };
    }
    // No volume measure on the entry: use a typical cup weight for common ingredients…
    const cup = typicalCupGrams(name);
    if (cup) {
      const per = (unitMl / UNITS.cup.factor) * cup;
      return { grams: quantity * per, method: 'typical', each: { grams: per, label, food: name } };
    }
    // …and only as a last resort assume about 1 g per ml, like water.
    return { grams: quantity * unitMl, method: 'estimate', each: { grams: unitMl, label } };
  }

  // Counts: "3 cloves", "1 large onion", "2 eggs". Prefer a USDA portion naming the unit or size.
  const sizeWords = name.toLowerCase().match(new RegExp(SIZE_RE.source, 'g')) ?? [];
  const wanted = [unit, ...sizeWords].filter(Boolean);
  const named = wanted.length ? usable.find((p) => wanted.some((w) => portionText(p).includes(w)) && !portionMl(p)) : null;
  if (named) {
    const per = named.gramWeight / (named.amount || 1);
    return { grams: quantity * per, method: 'portion', each: { grams: per, label: wanted.join(' ') } };
  }
  const typical = typicalPiece(ingredient);
  if (typical) return { grams: quantity * typical.grams, method: 'typical', each: typical };
  const anyPiece = usable.find((p) => !portionMl(p));
  if (anyPiece) {
    const per = anyPiece.gramWeight / (anyPiece.amount || 1);
    return { grams: quantity * per, method: 'estimate', each: { grams: per, label: portionText(anyPiece).trim() || 'piece' } };
  }
  return { grams: null, method: 'unknown' };
}
