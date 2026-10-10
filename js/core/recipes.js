// Recipe math. A recipe's ingredients have the same shape as food log entries
// ({ name, servings, servingSize, nutrients, custom }), where `servings` is the amount used.
// A logged recipe keeps its own copy of the ingredients, so editing the recipe later
// never changes past days, and editing a logged copy changes only that day.
import { entryCustom, entryNutrients, scaleValues, sumEntries } from './nutrition.js';

export const recipeTotals = (ingredients) => sumEntries(ingredients ?? []);

export function perServing(ingredients, yieldServings) {
  const totals = recipeTotals(ingredients);
  const factor = yieldServings > 0 ? 1 / yieldServings : 0;
  return { nutrients: scaleValues(totals.nutrients, factor), custom: scaleValues(totals.custom, factor) };
}

const copy = (value) => JSON.parse(JSON.stringify(value));

// Builds a log entry for `portions` servings of the recipe. Fields other than these
// (id, userId, timestamps) are added when it is saved.
export function recipeLogEntry(recipe, { date, meal, portions }) {
  return refreshRecipeEntry({
    kind: 'recipe',
    recipeId: recipe.id,
    name: recipe.name,
    date,
    meal,
    servings: portions,
    recipeYield: recipe.yieldServings,
    ingredients: copy(recipe.ingredients ?? []),
  });
}

// Recomputes a logged recipe's per-serving nutrition from its own ingredient copy.
export function refreshRecipeEntry(entry) {
  const per = perServing(entry.ingredients, entry.recipeYield);
  return {
    ...entry,
    servingSize: `serving (recipe makes ${entry.recipeYield})`,
    nutrients: per.nutrients,
    custom: per.custom,
  };
}

// What one ingredient contributes to a logged portion.
export function ingredientShare(ingredient, portions, yieldServings) {
  const factor = yieldServings > 0 ? portions / yieldServings : 0;
  return {
    nutrients: scaleValues(entryNutrients(ingredient), factor),
    custom: scaleValues(entryCustom(ingredient), factor),
  };
}
