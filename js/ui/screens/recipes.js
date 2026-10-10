// Recipes: the list, and the editor (saves as you go).
import { confirmDialog, h, mount, showDialog, toast } from '../dom.js';
import * as repo from '../../data/repo.js';
import { state } from '../state.js';
import { perServing, recipeTotals } from '../../core/recipes.js';
import { todayStr } from '../../core/dates.js';
import { MEALS, sumEntries } from '../../core/nutrition.js';
import { NUTRIENTS, nutrientByKey } from '../../core/nutrients.js';
import { targetKind } from '../../core/targets.js';
import { totalBurned } from '../../core/workouts.js';
import { DIETS, dietBadge, dietByKey, recipeDiets } from '../../core/diet.js';
import { defaultDirection, filterRecipes, SORTS, sortRecipes } from '../../core/recipeList.js';
import { field, numberInput, readNumber, selectInput } from '../fields.js';
import { editFood } from '../foodEntry.js';
import { fmt, fmtAmount, inputNumber } from '../format.js';
import { macroLine, nutrientDetails } from '../nutritionSummary.js';
import { ingredientList, logRecipe, recipeDisplayName } from '../recipeLog.js';
import { openImport, shareRecipe } from '../recipeImport.js';

// ---- The list: search, sort and filter ----

// Sort and filters are remembered on this device (a convenience; losing them is harmless).
const PREFS_KEY = 'recipeListPrefs';
const DEFAULT_PREFS = { sort: 'name', direction: 'asc', diet: null, meals: [], nutrients: [], fitsToday: false };

function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* not available */ }
}

// The nutrients most people sort by come first in the menu.
const COMMON_SORTS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugars', 'sodium'];

// Calories left today (target + logged exercise − eaten), or null without a calorie target.
async function caloriesLeftToday() {
  const target = state.settings.targets.values.calories;
  if (!target) return null;
  const today = todayStr();
  const [entries, workouts] = await Promise.all([repo.listForDate('logEntries', today), repo.listForDate('workouts', today)]);
  return target + totalBurned(workouts) - (sumEntries(entries).nutrients.calories ?? 0);
}

export async function renderRecipes(view, id) {
  if (id) return renderEditor(view, id);
  const [recipes, caloriesLeft] = await Promise.all([repo.listAll('recipes'), caloriesLeftToday()]);
  const items = recipes.map((recipe) => ({ recipe, per: perServing(recipe.ingredients, recipe.yieldServings), diets: recipeDiets(recipe) }));
  const prefs = loadPrefs();
  let query = '';

  const header = h('header', { class: 'page-head row' },
    h('h1', {}, 'Recipes'),
    h('div', { class: 'button-row tight' },
      h('button', { class: 'btn btn-small', type: 'button', onClick: openImport }, 'Import'),
      h('a', { class: 'btn btn-primary btn-small', href: '#/recipes/new' }, '+ New recipe')));

  if (!recipes.length) {
    mount(view, header, h('section', { class: 'card empty' },
      h('p', {}, 'No recipes yet.'),
      h('p', { class: 'muted' }, 'Build a recipe from its ingredients once, then log it to any meal in two taps. Or tap Import to paste one from a website or open one a friend shared.')));
    return;
  }

  const controls = h('section', { class: 'card recipe-controls' });
  const results = h('section', { class: 'card' });
  const update = () => {
    savePrefs(prefs);
    renderControls();
    renderResults();
  };

  const search = h('input', { type: 'search', placeholder: 'Search recipes', 'aria-label': 'Search recipes' });
  search.addEventListener('input', () => { query = search.value; renderResults(); });

  const toggle = (label, pressed, onClick) =>
    h('button', { class: `chip-toggle ${pressed ? 'on' : ''}`, type: 'button', 'aria-pressed': String(pressed), onClick }, label);
  const flip = (list, key) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  function renderControls() {
    const sort = h('select', { 'aria-label': 'Sort by' },
      h('optgroup', { label: 'General' }, SORTS.filter((s) => !s.nutrient).map((s) => h('option', { value: s.key, selected: s.key === prefs.sort }, s.label))),
      h('optgroup', { label: 'Per serving' }, COMMON_SORTS.map((k) => h('option', { value: k, selected: k === prefs.sort }, nutrientByKey(k).label))),
      h('optgroup', { label: 'More nutrients' }, SORTS.filter((s) => s.nutrient && !COMMON_SORTS.includes(s.key)).map((s) => h('option', { value: s.key, selected: s.key === prefs.sort }, s.label))));
    sort.addEventListener('change', () => {
      prefs.sort = sort.value;
      prefs.direction = defaultDirection(sort.value);
      update();
    });
    const dirLabels = prefs.sort === 'name' ? ['A–Z', 'Z–A'] : prefs.sort === 'recent' ? ['Oldest first', 'Newest first'] : ['Lowest first', 'Highest first'];
    const direction = h('button', { class: 'btn btn-small', type: 'button', onClick: () => { prefs.direction = prefs.direction === 'asc' ? 'desc' : 'asc'; update(); } },
      prefs.direction === 'asc' ? `↑ ${dirLabels[0]}` : `↓ ${dirLabels[1]}`);

    const dietSelect = h('select', { 'aria-label': 'Diet' },
      // Not everyone follows a diet: this is the "no diet" choice too.
      h('option', { value: '', selected: !prefs.diet }, 'Any / None'),
      DIETS.map((d) => h('option', { value: d.key, selected: d.key === prefs.diet }, d.label)));
    dietSelect.addEventListener('change', () => { prefs.diet = dietSelect.value || null; update(); });

    const filtersOn = prefs.diet || prefs.meals.length || prefs.nutrients.length || prefs.fitsToday;
    mount(controls,
      search,
      h('div', { class: 'input-row align-center' }, field('Sort by', sort), direction),
      field('Diet', dietSelect),
      h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Meal' },
        MEALS.map((m) => toggle(m.label, prefs.meals.includes(m.key), () => { prefs.meals = flip(prefs.meals, m.key); update(); })),
        caloriesLeft != null && toggle(`Fits today (${fmt(Math.max(0, caloriesLeft))} kcal left)`, prefs.fitsToday, () => { prefs.fitsToday = !prefs.fitsToday; update(); })),
      prefs.nutrients.length > 0 && h('div', { class: 'chip-row' }, prefs.nutrients.map((f, i) => {
        const n = nutrientByKey(f.key);
        return h('span', { class: 'chip-toggle on' }, `${n.label} ${f.op === 'min' ? '≥' : '≤'} ${fmtAmount(f.value, n.unit)}`,
          h('button', { class: 'chip-x', type: 'button', 'aria-label': `Remove ${n.label} filter`, onClick: () => { prefs.nutrients = prefs.nutrients.filter((_, j) => j !== i); update(); } }, '×'));
      })),
      h('div', { class: 'button-row tight' },
        h('button', { class: 'link-btn', type: 'button', onClick: async () => { const f = await askNutrientFilter(); if (f) { prefs.nutrients = [...prefs.nutrients, f]; update(); } } }, '+ Nutrient filter'),
        filtersOn && h('button', { class: 'link-btn', type: 'button', onClick: () => { Object.assign(prefs, { diet: null, meals: [], nutrients: [], fitsToday: false }); update(); } }, 'Clear filters')));
  }

  function renderResults() {
    const shown = sortRecipes(filterRecipes(items, {
      query,
      diet: prefs.diet,
      meals: prefs.meals,
      nutrients: prefs.nutrients,
      maxCalories: prefs.fitsToday ? caloriesLeft : null,
    }), prefs.sort, prefs.direction);
    const shownKey = nutrientByKey(prefs.sort) ? prefs.sort : 'calories';
    const shownNutrient = nutrientByKey(shownKey);
    mount(results,
      h('p', { class: 'muted result-count' }, shown.length === items.length ? `${items.length} recipe${items.length === 1 ? '' : 's'}` : `Showing ${shown.length} of ${items.length} recipes`),
      shown.length
        ? h('ul', { class: 'entry-list' }, shown.map(({ recipe: r, per, diets }) => {
          // With a diet filter on, the badge shows that diet (with "?" if it needs checking).
          const filtered = prefs.diet && dietByKey(prefs.diet);
          const badge = filtered
            ? `${filtered.short ?? filtered.label}${diets[prefs.diet].status === 'check' ? '?' : ''}`
            : dietBadge(diets)?.label;
          const value = per.nutrients[shownKey];
          return h('li', {},
            h('a', { class: 'entry', href: `#/recipes/${r.id}` },
              h('span', { class: 'entry-main' },
                h('span', { class: 'entry-name' }, recipeDisplayName(r)),
                h('small', { class: 'muted' },
                  badge && h('span', { class: `diet-badge ${badge.endsWith('?') ? 'unsure' : 'sure'}` }, badge),
                  [mealLabels(r), `Makes ${fmt(r.yieldServings, 2)}`].filter(Boolean).join(' · '))),
              h('span', { class: 'entry-kcal' },
                value == null ? '–' : shownKey === 'calories' ? `${fmt(value)} kcal` : `${fmtAmount(value, shownNutrient.unit)}`,
                shownKey !== 'calories' && h('small', { class: 'muted sort-label' }, shownNutrient.label.toLowerCase()))));
        }))
        : h('p', { class: 'muted empty' }, 'No recipes match. Try removing a filter.'),
      h('small', { class: 'muted' }, 'Amounts are per serving. Diet labels are detected from ingredient names; a “?” means something needs checking — open the recipe to confirm.'));
  }

  mount(view, header, controls, results);
  renderControls();
  renderResults();
}

const mealLabels = (r) => MEALS.filter((m) => (r.meals ?? []).includes(m.key)).map((m) => m.label).join(', ');

// Resolves { key, op, value } or undefined.
function askNutrientFilter() {
  return showDialog((close) => {
    const nutrient = selectInput([...COMMON_SORTS, ...NUTRIENTS.map((n) => n.key).filter((k) => !COMMON_SORTS.includes(k))]
      .map((k) => ({ value: k, label: nutrientByKey(k).label })), 'protein');
    const op = selectInput([{ value: 'min', label: 'at least' }, { value: 'max', label: 'at most' }], 'min');
    const amount = numberInput('', { 'aria-label': 'Amount' });
    const unit = h('span', {}, nutrientByKey('protein').unit);
    nutrient.addEventListener('change', () => {
      unit.textContent = nutrientByKey(nutrient.value).unit;
      op.value = targetKind(nutrient.value) === 'max' ? 'max' : 'min';
    });
    const add = (ev) => {
      ev.preventDefault();
      const { value } = readNumber(amount);
      if (value == null) { amount.classList.add('invalid'); return; }
      close({ key: nutrient.value, op: op.value, value });
    };
    setTimeout(() => amount.focus(), 0);
    return h('form', { class: 'dialog-body', onSubmit: add },
      h('h2', {}, 'Filter by nutrient'),
      field('Nutrient (per serving)', nutrient),
      h('div', { class: 'input-row' }, field('Show recipes with', op), field('Amount', h('div', { class: 'input-unit' }, amount, unit))),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel'),
        h('button', { class: 'btn btn-primary', type: 'submit' }, 'Add filter')));
  });
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

  // Meals the recipe suits (for filtering, and listed first when logging that meal).
  const mealChips = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Meals' });
  const renderMeals = () => mount(mealChips, MEALS.map((m) => {
    const on = (recipe.meals ?? []).includes(m.key);
    return h('button', {
      class: `chip-toggle ${on ? 'on' : ''}`, type: 'button', 'aria-pressed': String(on),
      onClick: () => {
        recipe.meals = on ? recipe.meals.filter((k) => k !== m.key) : [...(recipe.meals ?? []), m.key];
        renderMeals();
        persistSoon();
      },
    }, m.label);
  }));
  renderMeals();

  // Each diet: detected automatically; tapping cycles Auto → Fits → Doesn't fit.
  const dietSlot = h('div', {});
  const cycleDiet = (key) => {
    const overrides = { ...recipe.dietOverrides };
    if (overrides[key] === undefined) overrides[key] = true;
    else if (overrides[key] === true) overrides[key] = false;
    else delete overrides[key];
    recipe.dietOverrides = overrides;
    delete recipe.diet; // replaced by per-diet answers
    renderDiet();
    persistSoon();
  };
  const renderDiet = () => mount(dietSlot, dietList(recipe, cycleDiet));
  renderDiet();

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
    renderDiet();
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
    h('section', { class: 'card form-grid' },
      h('h2', {}, 'Meals & diet'),
      field('Good for', mealChips, 'Used to filter your recipes, and listed first when you add a recipe to that meal.'),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Diets'), dietSlot)),
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

const STATUS = {
  yes: { icon: '✓', text: 'Fits', cls: 'fits' },
  no: { icon: '✗', text: 'Doesn’t fit', cls: 'no' },
  check: { icon: '?', text: 'Check', cls: 'check' },
};

// Every diet with its result and the reason; tap a row to set your own answer.
function dietList(recipe, onCycle) {
  if (!recipe.ingredients?.length) return h('p', { class: 'muted' }, 'Add ingredients to see which diets this recipe fits.');
  const diets = recipeDiets(recipe);
  return h('div', { class: 'diet-explain' },
    h('ul', { class: 'diet-list' }, DIETS.map((d) => {
      const r = diets[d.key];
      const s = STATUS[r.status];
      const det = r.detected;
      const reason = r.source === 'set'
        ? `Set by you · detected: ${STATUS[det.status].text.toLowerCase()}`
        : [
          det.blockedBy.length && `Contains ${[...new Set(det.blockedBy)].join(', ')}`,
          ...det.checkFor.map((c) => `${c.name}: ${c.why}`),
          ...det.notes,
        ].filter(Boolean).join(' · ') || d.note;
      return h('li', {},
        h('button', {
          class: `diet-row ${s.cls}`, type: 'button',
          'aria-label': `${d.label}: ${s.text}${r.source === 'set' ? ', set by you' : ''}. Tap to change.`,
          onClick: () => onCycle(d.key),
        },
        h('span', { class: 'diet-icon', 'aria-hidden': 'true' }, s.icon),
        h('span', { class: 'diet-main' }, h('strong', {}, d.label), h('small', { class: 'muted' }, reason)),
        h('span', { class: `diet-source ${r.source}` }, r.source === 'set' ? 'Yours' : 'Auto')));
    })),
    h('small', { class: 'muted' },
      'Tap a diet to set your own answer: Auto → Fits → Doesn’t fit. Detection reads ingredient names only, so check product labels. Raw diets always need your confirmation. (Flexitarian isn’t listed: it’s about how often you eat meat, not what a dish contains.)'));
}

// Breakfast before 10:30, lunch before 3, dinner before 9, otherwise snacks.
function suggestedMeal(now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 630) return 'breakfast';
  if (minutes < 900) return 'lunch';
  if (minutes < 1260) return 'dinner';
  return 'snacks';
}
