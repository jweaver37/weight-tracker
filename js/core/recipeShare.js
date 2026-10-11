// Recipe files for sharing with friends: one recipe, with no personal data or device ids.
import { MEALS } from './nutrition.js';
import { DIET_KEYS } from './diet.js';
import { cleanSource, isFromSource, photoIsOwn } from './source.js';

const MEAL_KEYS = MEALS.map((m) => m.key);
const APP_ID = 'WeightTracker';
const KIND = 'recipe';
export const RECIPE_FILE_VERSION = 1;

const INGREDIENT_FIELDS = ['kind', 'name', 'brand', 'servings', 'servingSize', 'nutrients', 'volumeMl', 'countsAsWater', 'source'];

// Custom-field values are keyed by field id, which differs per person, so the file names the fields.
// include.steps / include.photo: whether to pass on the directions and notes, and the photo. For a
// recipe from someone else these are the creator's own writing and picture, so sharing defaults to
// leaving them out and sending the source link instead (see shareDefaults).
export function buildRecipeFile(recipe, customFields, include = { steps: true, photo: true }) {
  const usedFieldIds = new Set((recipe.ingredients ?? []).flatMap((i) => Object.keys(i.custom ?? {})));
  const source = cleanSource(recipe.source);
  return {
    app: APP_ID,
    kind: KIND,
    version: RECIPE_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    customFields: customFields.filter((f) => usedFieldIds.has(f.id)).map((f) => ({ id: f.id, name: f.name, unit: f.unit })),
    recipe: {
      name: recipe.name,
      yieldServings: recipe.yieldServings,
      prepMinutes: recipe.prepMinutes ?? null,
      cookMinutes: recipe.cookMinutes ?? null,
      instructions: include.steps ? recipe.instructions ?? '' : '',
      notes: include.steps ? recipe.notes ?? '' : '',
      meals: recipe.meals ?? [],
      dietOverrides: recipe.dietOverrides ?? {},
      ...(source && { source }),
      ...(include.photo && recipe.image && { image: recipe.image }),
      ingredients: (recipe.ingredients ?? []).map((i) => ({
        ...Object.fromEntries(INGREDIENT_FIELDS.filter((k) => i[k] !== undefined).map((k) => [k, i[k]])),
        custom: i.custom ?? {},
      })),
    },
  };
}

// What sharing includes unless the person changes it: everything for their own recipes; for a
// recipe from a website, only the ingredients, nutrition and source link (and their own photo).
export function shareDefaults(recipe) {
  const fromSource = isFromSource(recipe);
  return { steps: !fromSource, photo: Boolean(recipe.image) && photoIsOwn(recipe) };
}

// Returns { recipe, missingFields } ready to save. Custom-field values are kept when this person
// has a field with the same name and unit; fields they don't have are listed in missingFields
// ({ id, name, unit }) so they can be offered — add them, then read the file again.
export function readRecipeFile(text, localFields) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('This file isn’t a recipe file.');
  }
  if (file?.app !== APP_ID || file.kind !== KIND || typeof file.recipe !== 'object') {
    throw new Error(file?.app === APP_ID && file.data ? 'This is a full app backup. Import it in Settings → Backup instead.' : 'This file isn’t a Weight Tracker recipe.');
  }
  if (file.version > RECIPE_FILE_VERSION) throw new Error('This recipe was shared from a newer version of the app. Update the app first.');

  const match = new Map();
  const missing = [];
  for (const f of file.customFields ?? []) {
    if (!f?.id || typeof f.name !== 'string' || typeof f.unit !== 'string') continue;
    const local = localFields.find((l) => l.name.toLowerCase() === f.name.toLowerCase() && l.unit === f.unit);
    if (local) match.set(f.id, local.id);
    else missing.push({ id: f.id, name: f.name.slice(0, 60), unit: f.unit.slice(0, 12) });
  }

  const r = file.recipe;
  const number = (v, fallback) => (Number.isFinite(v) && v > 0 ? v : fallback);
  const recipe = {
    name: String(r.name ?? '').slice(0, 200),
    yieldServings: number(r.yieldServings, 1),
    prepMinutes: Number.isFinite(r.prepMinutes) ? r.prepMinutes : null,
    cookMinutes: Number.isFinite(r.cookMinutes) ? r.cookMinutes : null,
    instructions: String(r.instructions ?? ''),
    notes: String(r.notes ?? ''),
    meals: (Array.isArray(r.meals) ? r.meals : []).filter((m) => MEAL_KEYS.includes(m)),
    ...(cleanSource(r.source) && { source: cleanSource(r.source) }),
    // Only small JPEG/PNG/WebP photos in the formats the app makes are accepted.
    ...(typeof r.image === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.image) && r.image.length < 3_000_000 && { image: r.image }),
    dietOverrides: Object.fromEntries(Object.entries(r.dietOverrides && typeof r.dietOverrides === 'object' ? r.dietOverrides : {})
      .filter(([k, v]) => DIET_KEYS.includes(k) && typeof v === 'boolean')),
    ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []).map((i) => ({
      kind: 'food',
      name: String(i.name ?? 'Ingredient'),
      brand: i.brand ?? null,
      servings: number(i.servings, 1),
      servingSize: i.servingSize ?? null,
      nutrients: Object.fromEntries(Object.entries(i.nutrients ?? {}).filter(([, v]) => Number.isFinite(v))),
      custom: Object.fromEntries(Object.entries(i.custom ?? {}).filter(([id, v]) => match.has(id) && Number.isFinite(v)).map(([id, v]) => [match.get(id), v])),
      // The USDA match an ingredient came from (kept for reference; only known fields).
      ...(Number.isFinite(i.source?.fdcId) && {
        source: { type: 'usda', fdcId: i.source.fdcId, description: String(i.source.description ?? '').slice(0, 200), grams: Number.isFinite(i.source.grams) ? i.source.grams : null },
      }),
    })),
  };
  return { recipe, missingFields: missing };
}

export const recipeFileName = (name) =>
  `${(name || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'recipe'}.recipe.json`;
