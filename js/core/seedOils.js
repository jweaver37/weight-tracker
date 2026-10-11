// Seed-oil detection. "Seed oil" isn't an official category (USDA and FDA don't define it); this uses
// the commonly cited list. Peanut, sesame and cold-pressed seed oils (flax, hemp, pumpkin) are
// counted as "other" because lists disagree on them.

// The core list, plus plain "vegetable oil" (almost always soybean oil or a blend of these).
const SEED = ['canola', 'rapeseed', 'corn oil', 'cottonseed', 'soybean oil', 'soy oil', 'sunflower oil', 'safflower',
  'grapeseed', 'grape seed oil', 'rice bran', 'vegetable oil', 'oil, vegetable', 'oil, soybean', 'oil, corn', 'oil, canola',
  'oil, sunflower', 'oil, safflower', 'oil, cottonseed', 'oil, grapeseed', 'oil, rice bran'];
const OTHER = ['peanut oil', 'groundnut oil', 'sesame oil', 'flaxseed oil', 'flax oil', 'linseed oil', 'hemp oil', 'hempseed oil',
  'hemp seed oil', 'pumpkin seed oil', 'oil, peanut', 'oil, sesame', 'oil, flaxseed'];
// Usually made with soybean or canola oil — depends on the product.
const CHECK = [
  { words: ['mayonnaise', 'mayo', 'aioli'], why: 'usually made with soybean or canola oil' },
  { words: ['margarine', 'vegan butter', 'buttery spread', 'shortening'], why: 'usually made with soybean, canola or palm oil' },
  { words: ['cooking spray', 'nonstick spray'], why: 'usually canola or soybean oil' },
  { words: ['dressing', 'vinaigrette'], why: 'store-bought dressings usually use soybean or canola oil' },
  { words: ['frying oil', 'neutral oil', 'cooking oil', 'oil for frying'], why: 'often canola or vegetable oil' },
];
// Non-seed oils whose names would otherwise look like a check item.
const NON_SEED = ['olive oil', 'avocado oil', 'coconut oil', 'palm oil', 'oil, olive', 'oil, avocado', 'oil, coconut',
  'avocado mayo', 'avocado oil mayo', 'olive oil mayo'];

const has = (text, list) => list.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[,]/g, ',?').replace(/\s+/g, '[-\\s]')}`, 'i').test(text));

// 'seed' | 'other' | 'check' | 'non', with a reason for 'check'.
export function classifyOil(ingredient) {
  // The USDA match names oils precisely ("Oil, canola"), so it is checked along with the name.
  const text = `${ingredient.name ?? ''} ${ingredient.source?.description ?? ''}`.toLowerCase();
  if (has(text, NON_SEED) && !has(text, SEED)) return { kind: 'non' };
  if (has(text, SEED)) return { kind: 'seed' };
  if (has(text, OTHER)) return { kind: 'other' };
  const check = CHECK.find((c) => has(text, c.words));
  if (check) return { kind: 'check', why: check.why };
  // "Oil" with no type named could be anything, including canola.
  if (/\boils?\b/.test(text)) return { kind: 'check', why: 'the type of oil isn’t named' };
  return { kind: 'non' };
}

export const SEED_OIL_STATUSES = {
  seed: { label: 'Seed Oil', short: 'Seed Oil' },
  check: { label: 'Seed Oil?', short: 'Seed Oil?' },
  other: { label: 'Other Oil', short: 'Other Oil' },
  non: { label: 'Non Seed Oil', short: 'Non Seed Oil' },
};

// The recipe's status: 'seed' if any ingredient is a seed oil, else 'check', else 'other', else 'non'.
// recipe.seedOilOverride ('seed' | 'other' | 'non') is the person's own answer and wins.
export function recipeSeedOil(recipe) {
  const found = { seed: [], check: [], other: [] };
  for (const ing of recipe.ingredients ?? []) {
    const c = classifyOil(ing);
    if (c.kind === 'seed') found.seed.push(ing.name);
    else if (c.kind === 'other') found.other.push(ing.name);
    else if (c.kind === 'check') found.check.push({ name: ing.name, why: c.why });
  }
  const detected = found.seed.length ? 'seed' : found.check.length ? 'check' : found.other.length ? 'other' : 'non';
  const override = ['seed', 'other', 'non'].includes(recipe.seedOilOverride) ? recipe.seedOilOverride : null;
  return { status: override ?? detected, source: override ? 'set' : 'auto', detected, found };
}

// Index of the first seed-oil ingredient (what a "swap the oil" button opens), or -1.
export const firstSeedOilIndex = (recipe) => (recipe.ingredients ?? []).findIndex((i) => classifyOil(i).kind === 'seed');
