// Recipes: the list, and the editor (saves as you go).
import { confirmDialog, h, mount, toast } from '../dom.js';
import * as repo from '../../data/repo.js';
import { perServing, recipeTotals } from '../../core/recipes.js';
import { todayStr } from '../../core/dates.js';
import { field, numberInput, readNumber } from '../fields.js';
import { editFood } from '../foodEntry.js';
import { fmt, inputNumber } from '../format.js';
import { macroLine, nutrientDetails } from '../nutritionSummary.js';
import { ingredientList, logRecipe, recipeDisplayName } from '../recipeLog.js';
import { openImport, shareRecipe } from '../recipeImport.js';

export async function renderRecipes(view, id) {
  if (id) return renderEditor(view, id);
  const recipes = (await repo.listAll('recipes')).sort((a, b) => recipeDisplayName(a).localeCompare(recipeDisplayName(b)));
  const search = h('input', { type: 'search', placeholder: 'Search recipes', 'aria-label': 'Search recipes' });
  const list = h('ul', { class: 'entry-list' });
  const renderList = () => {
    const q = search.value.trim().toLowerCase();
    const shown = recipes.filter((r) => recipeDisplayName(r).toLowerCase().includes(q));
    mount(list, shown.map((r) => h('li', {},
      h('a', { class: 'entry', href: `#/recipes/${r.id}` },
        h('span', { class: 'entry-main' },
          h('span', { class: 'entry-name' }, recipeDisplayName(r)),
          h('small', { class: 'muted' }, `Makes ${fmt(r.yieldServings, 2)} · ${r.ingredients.length} ingredient${r.ingredients.length === 1 ? '' : 's'}`)),
        h('span', { class: 'entry-kcal' }, `${fmt(perServing(r.ingredients, r.yieldServings).nutrients.calories ?? 0)} kcal`)))),
    !shown.length && recipes.length > 0 && h('li', { class: 'muted empty' }, 'No matches.'));
  };
  search.addEventListener('input', renderList);
  renderList();

  mount(view,
    h('header', { class: 'page-head row' },
      h('h1', {}, 'Recipes'),
      h('div', { class: 'button-row tight' },
        h('button', { class: 'btn btn-small', type: 'button', onClick: openImport }, 'Import'),
        h('a', { class: 'btn btn-primary btn-small', href: '#/recipes/new' }, '+ New recipe'))),
    recipes.length
      ? h('section', { class: 'card' }, recipes.length > 5 && search, list, h('small', { class: 'muted' }, 'Calories are per serving.'))
      : h('section', { class: 'card empty' },
        h('p', {}, 'No recipes yet.'),
        h('p', { class: 'muted' }, 'Build a recipe from its ingredients once, then log it to any meal in two taps. Or tap Import to paste one from a website or open one a friend shared.')));
}

async function renderEditor(view, id) {
  const customFields = await repo.listAll('customFields');
  let recipe = id === 'new' ? null : await repo.get('recipes', id);
  if (id !== 'new' && !recipe) {
    mount(view, h('section', { class: 'card empty' }, h('p', {}, 'This recipe was not found.'), h('a', { href: '#/recipes' }, 'Back to recipes')));
    return;
  }
  recipe ??= { name: '', yieldServings: 4, ingredients: [], prepMinutes: null, cookMinutes: null, instructions: '', notes: '' };

  const status = h('small', { class: 'muted save-status' }, recipe.id ? 'Saved' : '');
  let saveTimer = null;
  let saving = Promise.resolve();
  const persist = () => {
    clearTimeout(saveTimer);
    saving = saving.then(async () => {
      const isNew = !recipe.id;
      recipe = await repo.save('recipes', recipe);
      // Give a new recipe its own address without re-rendering the page.
      if (isNew) history.replaceState(null, '', `#/recipes/${recipe.id}`);
      status.textContent = 'Saved';
      deleteBtn.hidden = false;
      logBtn.disabled = false;
      shareBtn.disabled = false;
    });
    return saving;
  };
  const persistSoon = () => {
    status.textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  };

  const name = h('input', { type: 'text', value: recipe.name, placeholder: 'e.g. Turkey chili' });
  name.addEventListener('input', () => { recipe.name = name.value.trim(); persistSoon(); });

  const yieldInput = numberInput(inputNumber(recipe.yieldServings, 2));
  yieldInput.addEventListener('input', () => {
    const { value } = readNumber(yieldInput);
    if (!value || value <= 0) { yieldInput.classList.add('invalid'); return; }
    recipe.yieldServings = value;
    renderNutrition();
    persistSoon();
  });

  const minutesInput = (key) => {
    const input = numberInput(recipe[key] ?? '', { inputmode: 'numeric' });
    input.addEventListener('input', () => {
      const r = readNumber(input);
      if (!r.empty && r.value == null) return;
      recipe[key] = r.value;
      persistSoon();
    });
    return h('div', { class: 'input-unit' }, input, h('span', {}, 'min'));
  };
  const textArea = (key, placeholder) => {
    const area = h('textarea', { rows: 4, placeholder }, recipe[key] ?? '');
    area.addEventListener('input', () => { recipe[key] = area.value; persistSoon(); });
    return area;
  };

  const ingredientsSlot = h('div', {});
  const nutritionSlot = h('div', {});

  const editIngredient = async (index) => {
    const existing = recipe.ingredients[index];
    const result = await editFood({
      food: existing, customFields, title: existing ? 'Edit ingredient' : 'Add ingredient',
      amountLabel: 'Amount used (servings)', allowDelete: Boolean(existing),
      deleteMessage: existing && `Remove “${existing.name}” from the recipe?`,
    });
    if (result?.action === 'save') {
      recipe.ingredients = existing ? recipe.ingredients.map((x, i) => (i === index ? result.food : x)) : [...recipe.ingredients, result.food];
    } else if (result?.action === 'delete') {
      recipe.ingredients = recipe.ingredients.filter((_, i) => i !== index);
    } else return;
    renderIngredients();
    renderNutrition();
    await persist();
  };

  const renderIngredients = () => mount(ingredientsSlot, ingredientList(recipe.ingredients, editIngredient));
  const renderNutrition = () => {
    const per = perServing(recipe.ingredients, recipe.yieldServings);
    const total = recipeTotals(recipe.ingredients);
    mount(nutritionSlot,
      h('div', { class: 'recipe-nutrition' },
        h('div', {}, h('small', { class: 'muted' }, 'Per serving'), h('strong', {}, macroLine(per.nutrients))),
        h('div', {}, h('small', { class: 'muted' }, `Whole recipe (${fmt(recipe.yieldServings, 2)} servings)`), h('span', {}, macroLine(total.nutrients)))),
      nutrientDetails(per, customFields, 'All nutrients per serving'));
  };
  renderIngredients();
  renderNutrition();

  const logBtn = h('button', { class: 'btn btn-primary', type: 'button', disabled: !recipe.id }, 'Log to today');
  logBtn.addEventListener('click', async () => {
    await persist();
    if (await logRecipe(recipe, { date: todayStr(), meal: suggestedMeal() })) toast('Logged to today');
  });
  const shareBtn = h('button', { class: 'btn', type: 'button', disabled: !recipe.id }, 'Share recipe');
  shareBtn.addEventListener('click', async () => {
    await persist();
    await shareRecipe(recipe);
  });
  const deleteBtn = h('button', { class: 'btn btn-danger', type: 'button', hidden: !recipe.id }, 'Delete recipe');
  deleteBtn.addEventListener('click', async () => {
    const ok = await confirmDialog(`Delete “${recipeDisplayName(recipe)}”? Days you already logged it keep their numbers.`, { okLabel: 'Delete', danger: true });
    if (!ok) return;
    clearTimeout(saveTimer);
    await saving;
    await repo.remove('recipes', recipe.id);
    location.hash = '#/recipes';
  });

  mount(view,
    h('header', { class: 'page-head row' },
      h('a', { class: 'back-link', href: '#/recipes' }, '‹ Recipes'),
      status),
    h('section', { class: 'card form-grid' },
      field('Recipe name', name),
      field('Makes how many servings?', yieldInput)),
    h('section', { class: 'card' }, h('h2', {}, 'Ingredients'), ingredientsSlot),
    h('section', { class: 'card' }, h('h2', {}, 'Nutrition'), nutritionSlot),
    h('section', { class: 'card form-grid' },
      h('h2', {}, 'Preparation'),
      h('div', { class: 'input-row' }, field('Prep time', minutesInput('prepMinutes')), field('Cook time', minutesInput('cookMinutes'))),
      field('Instructions', textArea('instructions', 'Steps, one per line')),
      field('Notes', textArea('notes', 'Tips, substitutions, where the recipe came from…'))),
    h('div', { class: 'button-row' }, logBtn, shareBtn, deleteBtn));

  if (!recipe.id) setTimeout(() => name.focus(), 0);
}

// Breakfast before 10:30, lunch before 3, dinner before 9, otherwise snacks.
function suggestedMeal(now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 630) return 'breakfast';
  if (minutes < 900) return 'lunch';
  if (minutes < 1260) return 'dinner';
  return 'snacks';
}
