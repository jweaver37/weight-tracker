// Diet detection from a recipe's ingredients and steps. Each ingredient is sorted into the kinds of
// animal food it contains (red meat, poultry, seafood, dairy, eggs, honey); each diet allows some of
// those kinds. It reads names only, so it is a helpful guess: unsure ingredients are flagged
// "check", raw diets are never confirmed automatically, and the user's own answer always wins.
import { entryNutrients } from './nutrition.js';

// Diets a recipe can be checked against, most restrictive first. `allows`: animal foods it permits.
// (Flexitarian is about how often meat is eaten, not what a dish contains, so it isn't a recipe diet.)
export const DIETS = [
  { key: 'fruitarian', label: 'Fruitarian', allows: [], raw: true, fruit: true, note: 'Raw fruits, nuts and seeds' },
  { key: 'rawVegan', label: 'Raw vegan', allows: [], raw: true, note: 'Vegan and uncooked (below about 116°F)' },
  { key: 'vegan', label: 'Vegan', allows: [], note: 'No animal foods' },
  { key: 'vegetarian', label: 'Vegetarian (lacto-ovo)', short: 'Vegetarian', allows: ['dairy', 'eggs', 'honey'], note: 'No meat, poultry or fish' },
  { key: 'lactoVegetarian', label: 'Lacto-vegetarian', allows: ['dairy', 'honey'], note: 'Vegetarian with dairy, no eggs' },
  { key: 'ovoVegetarian', label: 'Ovo-vegetarian', allows: ['eggs', 'honey'], note: 'Vegetarian with eggs, no dairy' },
  { key: 'pescatarian', label: 'Pescatarian', allows: ['seafood', 'dairy', 'eggs', 'honey'], note: 'Fish and seafood, no meat or poultry' },
  { key: 'pollotarian', label: 'Pollotarian', allows: ['poultry', 'dairy', 'eggs', 'honey'], note: 'Poultry, no red meat or seafood' },
];
export const DIET_KEYS = DIETS.map((d) => d.key);
export const dietByKey = (key) => DIETS.find((d) => d.key === key);

// ---- Ingredient words ----

const RED_MEAT = ['beef', 'steak', 'brisket', 'veal', 'pork', 'ham', 'bacon', 'pancetta', 'prosciutto', 'pepperoni',
  'salami', 'chorizo', 'lamb', 'mutton', 'venison', 'bison', 'lard', 'tallow', 'suet', 'gelatin', 'gelatine'];
const POULTRY = ['chicken', 'turkey', 'duck', 'goose', 'quail'];
const SEAFOOD = ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'trout', 'sardine', 'anchovy', 'anchovies',
  'mackerel', 'catfish', 'mahi', 'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster', 'squid',
  'calamari', 'octopus', 'worcestershire', 'dashi', 'bonito'];
// Meat of an unnamed kind: rules out pescatarian; pollotarian must check (could be chicken sausage).
const SOME_MEAT = ['meat', 'sausage', 'hot dog', 'meatball', 'jerky', 'liver', 'bone broth'];
const DAIRY = ['milk', 'buttermilk', 'butter', 'ghee', 'cream', 'half-and-half', 'half and half', 'cheese', 'cheddar',
  'mozzarella', 'parmesan', 'ricotta', 'feta', 'brie', 'gouda', 'provolone', 'mascarpone', 'yogurt', 'yoghurt',
  'whey', 'casein', 'custard', 'kefir', 'ice cream'];
const EGGS = ['egg', 'mayonnaise', 'mayo', 'meringue', 'custard', 'aioli'];
const HONEY = ['honey'];

// Ingredients that might contain an animal food, depending on the product.
const MAYBE = [
  { words: ['broth', 'stock', 'bouillon'], kinds: ['redMeat', 'poultry'], why: 'could be meat-based' },
  { words: ['gravy'], kinds: ['redMeat', 'poultry', 'dairy'], why: 'often made with meat drippings' },
  { words: ['caesar'], kinds: ['seafood', 'eggs', 'dairy'], why: 'classic Caesar contains anchovies, egg and cheese' },
  { words: ['chocolate'], kinds: ['dairy'], why: 'may contain milk' },
  { words: ['bread', 'bun', 'roll', 'bagel', 'naan', 'brioche'], kinds: ['dairy', 'eggs'], why: 'may contain milk or egg' },
  { words: ['pesto'], kinds: ['dairy'], why: 'usually contains parmesan' },
  { words: ['margarine'], kinds: ['dairy'], why: 'some contain whey' },
  { words: ['dressing'], kinds: ['dairy', 'eggs'], why: 'may contain dairy or egg' },
  { words: ['pasta', 'noodle'], kinds: ['eggs'], why: 'fresh pasta and some noodles contain egg' },
];

// Plant versions whose names contain an animal word; removed from the name before checking.
const PLANT_PHRASES = [
  'almond milk', 'oat milk', 'soy milk', 'soya milk', 'rice milk', 'coconut milk', 'cashew milk', 'hemp milk',
  'peanut butter', 'almond butter', 'cashew butter', 'sunflower butter', 'seed butter', 'nut butter', 'apple butter',
  'cocoa butter', 'shea butter', 'butter bean', 'butternut', 'buttercup', 'coconut cream', 'cream of tartar',
  'coconut yogurt', 'soy yogurt', 'vegetable broth', 'vegetable stock', 'veggie broth', 'veggie stock',
  'mushroom broth', 'nutritional yeast', 'egg replacer', 'flax egg', 'chia egg', 'eggless [a-z]+', 'rice noodle',
  'vegan [a-z]+', 'plant-based [a-z]+', 'plant based [a-z]+', 'dairy-free [a-z]+', 'non-dairy [a-z]+',
  'meatless [a-z]+', 'vegetarian [a-z]+', 'jackfruit', 'oyster mushroom', 'king oyster',
];
const PLANT_RE = new RegExp(`\\b(${PLANT_PHRASES.join('|')})s?\\b`, 'g');

// Whole words, allowing simple plurals (eggs, anchovies, tomatoes).
const has = (text, list) => list.some((w) => new RegExp(`\\b${w.replace(/[-\s]/g, '[-\\s]')}(s|es|ies)?\\b`).test(text));

// The animal foods one ingredient contains ({ kinds }) or might contain ({ maybe, why }).
export function classifyIngredient(name) {
  const text = String(name ?? '').toLowerCase().replace(PLANT_RE, ' ');
  const kinds = new Set();
  // "Turkey bacon" and "chicken sausage" are poultry, not red meat.
  if (has(text, POULTRY)) kinds.add('poultry');
  else if (has(text, RED_MEAT)) kinds.add('redMeat');
  else if (has(text, SOME_MEAT)) kinds.add('someMeat');
  if (has(text, SEAFOOD)) kinds.add('seafood');
  if (has(text, DAIRY)) kinds.add('dairy');
  if (has(text, EGGS)) kinds.add('eggs');
  if (has(text, HONEY)) kinds.add('honey');
  const maybe = new Set();
  const why = [];
  if (!kinds.size) {
    for (const m of MAYBE) {
      if (has(text, m.words)) {
        m.kinds.forEach((k) => maybe.add(k));
        why.push(m.why);
      }
    }
  }
  return { kinds, maybe, why };
}

// ---- Raw and fruit checks ----

// Cooking in the steps, or a cooked/processed ingredient, rules out raw diets.
const HEAT_RE = /\b(bake[sd]?|baking|cook(?:ed|ing|s)?|boil(?:ed|ing|s)?|simmer(?:ed|ing|s)?|roast(?:ed|ing|s)?|fr(?:y|ied|ies|ying)|saut[eé](?:ed|ing|s)?|grill(?:ed|ing|s)?|toast(?:ed|ing|s)?|broil(?:ed|ing|s)?|steam(?:ed|ing|s)?|poach(?:ed|ing|es)?|microwave[ds]?|oven|stovetop|skillet|preheat(?:ed)?|heat(?:ed|ing|s)?|canned|pasteuri[sz]ed|melt(?:ed|ing|s)?|sear(?:ed|ing|s)?|blanch(?:ed|ing|es)?|brais(?:e|ed|ing)|smoked|char(?:red|ring)|carameli[sz](?:e|ed|ing))\b|\b\d{3}\s*°?\s*[fc]\b/i;

const FRUIT_NUT_SEED = ['apple', 'banana', 'berry', 'berries', 'strawberry', 'raspberry', 'blackberry', 'blueberry',
  'cranberry', 'cherry', 'grape', 'orange', 'lemon', 'lime', 'grapefruit', 'mango', 'pineapple', 'papaya', 'peach',
  'pear', 'plum', 'apricot', 'nectarine', 'kiwi', 'melon', 'watermelon', 'cantaloupe', 'honeydew', 'fig', 'date',
  'pomegranate', 'avocado', 'coconut', 'passion fruit', 'guava', 'lychee', 'persimmon', 'tangerine', 'clementine',
  'almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut', 'pine nut', 'nut',
  'chia', 'flax', 'flaxseed', 'sunflower seed', 'pumpkin seed', 'sesame', 'hemp seed', 'seed', 'juice'];

const isFruitNutSeed = (name) => has(String(name).toLowerCase(), FRUIT_NUT_SEED);

// Share of the recipe's calories from fruits, nuts and seeds (by count when calories are missing).
function fruitShare(ingredients) {
  const kcal = ingredients.map((i) => entryNutrients(i).calories ?? 0);
  const total = kcal.reduce((a, b) => a + b, 0);
  if (total > 0) return ingredients.reduce((s, i, n) => s + (isFruitNutSeed(i.name) ? kcal[n] : 0), 0) / total;
  return ingredients.length ? ingredients.filter((i) => isFruitNutSeed(i.name)).length / ingredients.length : 0;
}

// ---- Detection ----

const MEAT_KINDS = ['redMeat', 'poultry', 'seafood', 'someMeat'];

// Result per diet: 'yes' | 'no' | 'check', plus the ingredients behind each 'no' or 'check'.
export function detectDiets(recipe) {
  const ingredients = recipe.ingredients ?? [];
  const classified = ingredients.map((i) => ({ name: i.name, ...classifyIngredient(i.name) }));
  const cookedBy = HEAT_RE.exec(`${recipe.instructions ?? ''}\n${ingredients.map((i) => `${i.name} ${i.servingSize ?? ''}`).join('\n')}`)?.[0];
  const share = fruitShare(ingredients);

  const result = {};
  for (const diet of DIETS) {
    const blockedBy = [];
    const checkFor = [];
    for (const c of classified) {
      const definite = [...c.kinds].filter((k) => k !== 'someMeat' && !diet.allows.includes(k));
      // Unnamed meat: rules out every diet except pollotarian, which has to check it is poultry.
      if (c.kinds.has('someMeat')) {
        if (diet.key === 'pollotarian') checkFor.push({ name: c.name, why: 'could be red meat or poultry' });
        else definite.push('someMeat');
      }
      if (definite.length) blockedBy.push(c.name);
      else if ([...c.maybe].some((k) => !diet.allows.includes(k))) checkFor.push({ name: c.name, why: c.why.join('; ') });
    }
    let status = blockedBy.length ? 'no' : checkFor.length ? 'check' : 'yes';
    const notes = [];
    if (diet.raw && status !== 'no') {
      if (cookedBy) { status = 'no'; notes.push(`Cooked or heated (“${cookedBy}”)`); }
      // Raw can only be confirmed by the user: products like nut butters may be roasted.
      else { status = 'check'; notes.push('No cooking found — confirm the ingredients are raw'); }
    }
    if (diet.fruit && status !== 'no' && share < 0.75) {
      status = 'no';
      notes.push(`${Math.round(share * 100)}% of calories from fruits, nuts and seeds (needs most of them)`);
    }
    result[diet.key] = { status, blockedBy, checkFor, notes };
  }
  return { diets: result, hasMeat: classified.some((c) => MEAT_KINDS.some((k) => c.kinds.has(k))) };
}

// Does a logged entry contain meat, poultry or fish? A logged recipe is checked ingredient by
// ingredient. Unsure items (e.g. plain "broth") get the benefit of the doubt.
export function entryHasMeat(entry) {
  const names = [entry.name, ...(entry.ingredients ?? []).map((i) => i.name)];
  return names.some((n) => {
    const { kinds } = classifyIngredient(n);
    return MEAT_KINDS.some((k) => kinds.has(k));
  });
}

// Diets a person can follow, for Settings. Flexitarian is a way of eating (mostly plant-based,
// some meat) rather than a property of a recipe, so it appears here but not in recipe diets.
export const FOLLOWED_DIETS = [
  { key: 'flexitarian', label: 'Flexitarian (semi-vegetarian)', note: 'Mostly plant-based, with meat, poultry or fish now and then. Track meat-free days on the Goals tab.' },
  ...DIETS.map((d) => ({ key: d.key, label: d.label, note: d.note })),
];

// Older recipes stored one choice in recipe.diet; it maps onto the per-diet answers.
function legacyOverrides(diet) {
  if (diet === 'vegan') return { vegan: true, vegetarian: true, lactoVegetarian: true, ovoVegetarian: true, pescatarian: true, pollotarian: true };
  if (diet === 'vegetarian') return { vegan: false, vegetarian: true };
  if (diet === 'neither') return { vegan: false, vegetarian: false, lactoVegetarian: false, ovoVegetarian: false };
  return {};
}

// Each diet's status after the user's answers: recipe.dietOverrides[key] = true (fits) | false (doesn't).
// Returns { [key]: { status, source: 'auto' | 'set', detected } }.
export function recipeDiets(recipe) {
  const { diets } = detectDiets(recipe);
  const overrides = { ...legacyOverrides(recipe.diet), ...recipe.dietOverrides };
  const out = {};
  for (const d of DIETS) {
    const set = overrides[d.key];
    out[d.key] = typeof set === 'boolean'
      ? { status: set ? 'yes' : 'no', source: 'set', detected: diets[d.key] }
      : { status: diets[d.key].status, source: 'auto', detected: diets[d.key] };
  }
  return out;
}

// One badge for list rows: the most plant-based diet the recipe fits ('?' when it needs checking).
const BADGE_ORDER = ['fruitarian', 'rawVegan', 'vegan', 'vegetarian', 'pescatarian', 'pollotarian'];
export function dietBadge(diets) {
  for (const key of BADGE_ORDER) {
    if (diets[key].status === 'yes') return { key, label: dietByKey(key).short ?? dietByKey(key).label };
  }
  // Only flag "Vegan?" / "Vegetarian?" — raw diets are always unconfirmed until the user says so.
  for (const key of ['vegan', 'vegetarian']) {
    if (diets[key].status === 'check') return { key, label: `${dietByKey(key).short ?? dietByKey(key).label}?` };
  }
  return null;
}
