// Logging recipes to a day, and editing a logged recipe's own copy.
import { confirmDialog, h, mount, showDialog } from './dom.js';
import { field, numberInput, readNumber, selectInput } from './fields.js';
import * as repo from '../data/repo.js';
import { MEALS, entryCustom, entryNutrients, parseAmount, scaleValues } from '../core/nutrition.js';
import { perServing, recipeLogEntry, refreshRecipeEntry } from '../core/recipes.js';
import { editFood, entryAmountText, entryCalories } from './foodEntry.js';
import { fmt, inputNumber } from './format.js';
import { macroLine, nutrientDetails } from './nutritionSummary.js';

export const recipeDisplayName = (recipe) => recipe.name || 'Untitled recipe';

// Picks a recipe, then a portion. Resolves 'saved' or undefined.
export async function addRecipeToDay({ date, meal }) {
  const recipe = await pickRecipe();
  if (!recipe) return undefined;
  return logRecipe(recipe, { date, meal });
}

async function pickRecipe() {
  const recipes = (await repo.listAll('recipes')).sort((a, b) => recipeDisplayName(a).localeCompare(recipeDisplayName(b)));
  return showDialog((close) => {
    const search = h('input', { type: 'search', placeholder: 'Search recipes', 'aria-label': 'Search recipes' });
    const list = h('ul', { class: 'pick-list' });
    const renderList = () => {
      const q = search.value.trim().toLowerCase();
      const shown = recipes.filter((r) => recipeDisplayName(r).toLowerCase().includes(q));
      list.replaceChildren(...shown.map((r) => h('li', {},
        h('button', { class: 'entry', type: 'button', onClick: () => close(r) },
          h('span', { class: 'entry-main' },
            h('span', { class: 'entry-name' }, recipeDisplayName(r)),
            h('small', { class: 'muted' }, `Makes ${fmt(r.yieldServings, 2)} · ${fmt(perServing(r.ingredients, r.yieldServings).nutrients.calories ?? 0)} kcal per serving`)),
          h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›')))));
      if (!shown.length) list.append(h('li', { class: 'muted empty' }, recipes.length ? 'No matches.' : 'No recipes yet.'));
    };
    search.addEventListener('input', renderList);
    renderList();
    if (recipes.length > 5) setTimeout(() => search.focus(), 0);
    return h('div', { class: 'dialog-body' },
      h('h2', {}, 'Add a recipe'),
      recipes.length > 0 && search,
      list,
      h('div', { class: 'dialog-actions' },
        h('a', { class: 'btn btn-left', href: '#/recipes/new', onClick: () => close() }, 'New recipe'),
        h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel')));
  });
}

// Portion choice for one recipe, then saves it to the day. Resolves 'saved' or undefined.
export function logRecipe(recipe, { date, meal }) {
  const per = perServing(recipe.ingredients, recipe.yieldServings);
  const mealSelect = selectInput(MEALS.map((m) => ({ value: m.key, label: m.label })), meal);
  const portions = numberInput('1', { 'aria-label': 'Servings eaten' });
  const preview = h('p', { class: 'entry-preview' });
  const update = () => { preview.textContent = macroLine(scaleValues(per.nutrients, parseAmount(portions.value.trim()) ?? 0)); };
  update();

  return showDialog((close) => {
    const save = async (ev) => {
      ev.preventDefault();
      const { value } = readNumber(portions);
      if (!value || value <= 0) { portions.classList.add('invalid'); return; }
      await repo.save('logEntries', recipeLogEntry(recipe, { date, meal: mealSelect.value, portions: value }));
      close('saved');
    };
    return h('form', { class: 'dialog-body', onSubmit: save, onInput: update },
      h('h2', {}, recipeDisplayName(recipe)),
      h('div', { class: 'input-row' },
        field('Meal', mealSelect),
        field(`Servings eaten (of ${fmt(recipe.yieldServings, 2)})`, portions)),
      preview,
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel'),
        h('button', { class: 'btn btn-primary', type: 'submit' }, 'Log it')));
  });
}

// Edits a logged recipe: portion, meal and that day's copy of the ingredients.
// Resolves 'saved', 'deleted' or undefined.
export function openRecipeEntry({ entry, customFields }) {
  let ingredients = JSON.parse(JSON.stringify(entry.ingredients ?? []));
  const mealSelect = selectInput(MEALS.map((m) => ({ value: m.key, label: m.label })), entry.meal);
  const portions = numberInput(inputNumber(entry.servings, 3), { 'aria-label': 'Servings eaten' });
  const listSlot = h('div', {});
  const preview = h('p', { class: 'entry-preview' });
  const detailsSlot = h('div', {});

  const current = () => refreshRecipeEntry({ ...entry, ingredients, servings: parseAmount(portions.value.trim()) ?? 0 });
  const update = () => {
    const portion = current();
    preview.textContent = macroLine(entryNutrients(portion));
    mount(detailsSlot, nutrientDetails({ nutrients: entryNutrients(portion), custom: entryCustom(portion) }, customFields, 'All nutrients for this portion'));
  };

  const editIngredient = async (index) => {
    const existing = ingredients[index];
    const result = await editFood({
      food: existing, customFields, title: existing ? 'Edit ingredient' : 'Add ingredient',
      amountLabel: 'Amount used (servings)', allowDelete: Boolean(existing),
      deleteMessage: existing && `Remove “${existing.name}” from this day’s entry?`,
    });
    if (result?.action === 'save') {
      ingredients = existing ? ingredients.map((x, i) => (i === index ? result.food : x)) : [...ingredients, result.food];
    } else if (result?.action === 'delete') {
      ingredients = ingredients.filter((_, i) => i !== index);
    } else return;
    renderIngredients();
    update();
  };

  const renderIngredients = () => {
    listSlot.replaceChildren(ingredientList(ingredients, editIngredient));
  };
  renderIngredients();
  update();

  return showDialog((close) => {
    const save = async (ev) => {
      ev.preventDefault();
      const { value } = readNumber(portions);
      if (!value || value <= 0) { portions.classList.add('invalid'); return; }
      await repo.save('logEntries', { ...current(), meal: mealSelect.value, servings: value });
      close('saved');
    };
    const remove = async () => {
      if (await confirmDialog(`Delete “${entry.name}” from this day?`, { okLabel: 'Delete', danger: true })) {
        await repo.remove('logEntries', entry.id);
        close('deleted');
      }
    };
    return h('form', { class: 'dialog-body', onSubmit: save, onInput: update },
      h('h2', {}, entry.name),
      h('div', { class: 'input-row' },
        field('Meal', mealSelect),
        field(`Servings eaten (of ${fmt(entry.recipeYield, 2)})`, portions)),
      preview,
      h('h3', {}, 'Ingredients'),
      h('p', { class: 'muted' }, 'Changes here affect only this day. To change the recipe itself, edit it in Recipes.'),
      listSlot,
      detailsSlot,
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-danger btn-left', type: 'button', onClick: remove }, 'Delete'),
        h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel'),
        h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save')));
  });
}

// Ingredient rows (tap to edit) plus an add button. onEdit(index) — index undefined means add.
export function ingredientList(ingredients, onEdit) {
  return h('div', {},
    ingredients.length > 0 && h('ul', { class: 'entry-list' }, ingredients.map((ing, i) => h('li', {},
      h('button', { class: 'entry', type: 'button', onClick: () => onEdit(i) },
        h('span', { class: 'entry-main' },
          h('span', { class: 'entry-name' }, ing.name),
          h('small', { class: 'muted' }, [ing.brand, entryAmountText(ing)].filter(Boolean).join(' · '))),
        h('span', { class: 'entry-kcal' }, fmt(entryCalories(ing))))))),
    h('button', { class: 'btn btn-ghost btn-block', type: 'button', onClick: () => onEdit(undefined) }, '+ Add ingredient'));
}
