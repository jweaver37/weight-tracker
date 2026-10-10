// Importing recipes (pasted from a website, or a file a friend shared) and sharing them.
import { h, infoDialog, mount, showDialog, toast } from './dom.js';
import { field, numberInput, readNumber } from './fields.js';
import * as repo from '../data/repo.js';
import { state } from './state.js';
import { cleanDirections, cleanNotes, cleanPastedLine, parseIngredientList, parseRecipeText, UNITS } from '../core/ingredients.js';
import { pickRecipePhoto } from './imagePick.js';
import { gramsFor, per100g, rankCandidates, scaleTo, searchTerms } from '../core/foodMatch.js';
import { buildRecipeFile, readRecipeFile, recipeFileName } from '../core/recipeShare.js';
import { getFoods, searchFoods, UsdaError } from '../data/usda.js';
import { roundTo } from '../core/units.js';
import { fmt, inputNumber } from './format.js';
import { pickFile, shareOrDownload } from './files.js';
import { lookupsLeft } from './usageMeter.js';

// ---- Sharing ----

export async function shareRecipe(recipe) {
  const customFields = await repo.listAll('customFields');
  const blob = new Blob([JSON.stringify(buildRecipeFile(recipe, customFields), null, 2)], { type: 'application/json' });
  const result = await shareOrDownload(blob, recipeFileName(recipe.name), {
    title: recipe.name,
    text: `Recipe: ${recipe.name}. To add it, open Weight Tracker → Recipes → Import → Open a shared recipe file.`,
  });
  if (result === 'downloaded') toast('Recipe file downloaded — send it to your friend');
}

// ---- Import menu ----

export function openImport() {
  return showDialog((close) =>
    h('div', { class: 'dialog-body' },
      h('h2', {}, 'Import a recipe'),
      h('button', { class: 'choice', type: 'button', onClick: () => { close(); importFromText(); } },
        h('span', {}, h('strong', {}, 'From a website'), h('small', {}, 'Copy the title, ingredients and steps from any recipe site into their own boxes, and add a photo. Nutrition is looked up in the USDA food database.'))),
      h('button', { class: 'choice', type: 'button', onClick: () => { close(); importFromFile(); } },
        h('span', {}, h('strong', {}, 'Open a shared recipe file'), h('small', {}, 'A .recipe.json file a friend sent you from Weight Tracker.'))),
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel'))));
}

async function saveAndOpen(recipe) {
  const saved = await repo.save('recipes', recipe);
  location.hash = `#/recipes/${saved.id}`;
  return saved;
}

// ---- From a shared file ----

async function importFromFile() {
  const file = await pickFile('application/json,.json');
  if (!file) return;
  const text = await file.text();
  let result;
  try {
    result = readRecipeFile(text, await repo.listAll('customFields'));
  } catch (err) {
    await infoDialog(err.message, { title: 'Can’t import' });
    return;
  }

  // The recipe uses custom fields this person doesn't have: let them choose which to add.
  if (result.missingFields.length) {
    const chosen = await chooseFields(result.missingFields, result.recipe.name);
    if (!chosen) return; // cancelled
    for (const f of chosen) await repo.save('customFields', { name: f.name, unit: f.unit, visible: true });
    if (chosen.length) result = readRecipeFile(text, await repo.listAll('customFields'));
  }

  await saveAndOpen(result.recipe);
  toast(`Imported “${result.recipe.name || 'recipe'}”`);
}

// Resolves the fields to add (possibly none), or undefined if the import is cancelled.
function chooseFields(fields, recipeName) {
  return showDialog((close) => {
    const boxes = fields.map((f) => ({ f, box: h('input', { type: 'checkbox', checked: true }) }));
    return h('div', { class: 'dialog-body' },
      h('h2', {}, 'Add custom fields?'),
      h('p', {}, `“${recipeName || 'This recipe'}” tracks ${fields.length === 1 ? 'a custom field' : 'custom fields'} you don’t have yet. Add ${fields.length === 1 ? 'it' : 'them'} to bring those amounts in too.`),
      h('div', {}, boxes.map(({ f, box }) => h('label', { class: 'check' }, box, h('span', {}, `${f.name} (${f.unit})`)))),
      h('p', { class: 'muted' }, 'Added fields appear when you log food and in your totals. You can remove them later in Settings → Custom fields.'),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-left', type: 'button', onClick: () => close() }, 'Cancel'),
        h('button', { class: 'btn', type: 'button', onClick: () => close([]) }, 'Import without them'),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => close(boxes.filter((b) => b.box.checked).map((b) => b.f)) }, 'Add selected and import')));
  });
}

// ---- From pasted text ----

// One box per part of the recipe: every site lays its page out differently, so the person copies
// each part into its own box. A whole-page paste can still fill the boxes in, for checking.
function importFromText() {
  return showDialog((close) => {
    const body = h('form', { class: 'dialog-body import-form' });
    const title = h('input', { type: 'text', placeholder: 'e.g. Best Vegetable Lasagna', 'aria-label': 'Recipe title' });
    const servings = numberInput('', { inputmode: 'numeric', placeholder: '4', 'aria-label': 'Servings' });
    const prep = numberInput('', { inputmode: 'numeric', 'aria-label': 'Prep time in minutes' });
    const cook = numberInput('', { inputmode: 'numeric', 'aria-label': 'Cook time in minutes' });
    const ingredients = h('textarea', { rows: 8, placeholder: '2 cups white sugar\n1 ¾ cups all-purpose flour\n2 large eggs\n…' });
    const directions = h('textarea', { rows: 6, placeholder: '1. Preheat the oven to 350°F.\n2. Stir the dry ingredients together.\n…' });
    const notes = h('textarea', { rows: 3, placeholder: 'Tips, substitutions… (optional)' });
    const errorLine = h('p', { class: 'errors' });

    // Photo
    let image = null;
    const photoSlot = h('div', { class: 'photo-field' });
    const renderPhoto = () => mount(photoSlot,
      image && h('img', { class: 'photo-preview', src: image, alt: 'Recipe photo' }),
      h('div', { class: 'button-row tight' },
        h('button', { class: 'btn btn-small', type: 'button', onClick: async () => { const img = await pickRecipePhoto(); if (img) { image = img; renderPhoto(); } } }, image ? 'Change photo' : '+ Add photo'),
        image && h('button', { class: 'link-btn', type: 'button', onClick: () => { image = null; renderPhoto(); } }, 'Remove')));
    renderPhoto();

    // Whole-page shortcut: fills the boxes, which the person then checks.
    const wholePage = h('textarea', { rows: 6, placeholder: 'Paste everything copied from the recipe page…' });
    const fillNote = h('p', { class: 'muted', role: 'status' });
    const fill = () => {
      const p = parseRecipeText(wholePage.value);
      if (p.name) title.value = p.name;
      if (p.yieldServings) servings.value = p.yieldServings;
      if (p.prepMinutes != null) prep.value = p.prepMinutes;
      if (p.cookMinutes != null) cook.value = p.cookMinutes;
      ingredients.value = p.ingredientsText;
      directions.value = p.instructions;
      notes.value = p.notes;
      fillNote.textContent = p.ingredients.length
        ? `Filled in ${p.ingredients.length} ingredients. Check each box above — remove anything that isn’t part of the recipe.`
        : 'Couldn’t find an ingredient list in that text. Copy just the ingredients into the Ingredients box instead.';
      body.scrollTop = 0;
    };

    const next = (ev) => {
      ev.preventDefault();
      const parsedIngredients = parseIngredientList(ingredients.value);
      if (!parsedIngredients.length) {
        ingredients.classList.add('invalid');
        errorLine.textContent = 'Add the ingredients, one per line (like “1 cup rice”).';
        ingredients.focus();
        return;
      }
      const minutes = (input) => readNumber(input).value;
      reviewStep(body, {
        name: cleanPastedLine(title.value),
        yieldServings: readNumber(servings).value,
        prepMinutes: minutes(prep),
        cookMinutes: minutes(cook),
        ingredients: parsedIngredients,
        instructions: cleanDirections(directions.value),
        notes: cleanNotes(notes.value),
        image,
      }, close);
    };

    mount(body,
      h('h2', {}, 'Import a recipe'),
      h('p', { class: 'muted' }, 'Copy each part of the recipe from the website into its box. Only Ingredients is required.'),
      field('Title', title),
      h('div', { class: 'input-row three' },
        field('Servings', servings),
        field('Prep (min)', prep),
        field('Cook (min)', cook)),
      field('Ingredients', ingredients, 'One ingredient per line, with its amount. Section headings and links are ignored.'),
      field('Directions', directions, 'Optional. Ads and links pasted along with the steps are removed.'),
      field('Notes', notes),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Photo'), photoSlot,
        h('small', { class: 'field-hint' }, 'Optional. Save the picture from the recipe page, or take your own, then choose it here.')),
      h('details', { class: 'whole-page' },
        h('summary', {}, 'Or paste the whole page to fill these in'),
        h('p', { class: 'muted' }, 'Works on many sites, but every site is laid out differently — always check the boxes afterwards.'),
        wholePage,
        h('button', { class: 'btn btn-small', type: 'button', onClick: fill }, 'Fill in the boxes'),
        fillNote),
      errorLine,
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel'),
        h('button', { class: 'btn btn-primary', type: 'submit' }, 'Look up nutrition')));
    body.onsubmit = next; // the review step replaces this with its own handler
    setTimeout(() => title.focus(), 0);
    return body;
  });
}

// One search per ingredient with an amount, plus one request for portion weights.
function lookupNote(rows, apiKey) {
  const needed = rows.filter((r) => r.ing.quantity != null || r.ing.grams != null).length + 1;
  const left = lookupsLeft(apiKey);
  return left < needed
    ? h('p', { class: 'notice' }, `This recipe needs about ${needed} lookups, but only ${left} ${left === 1 ? 'is' : 'are'} left this hour on this device. Some ingredients may not be matched — use Try again later.`)
    : h('small', { class: 'muted' }, `Uses about ${needed} of your ${fmt(left)} lookups left this hour.`);
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// "medium onion" → "Onion": the size is already in the amount line.
const ingredientName = (name) => capitalize(name.replace(/\b(extra large|large|medium|small)\b/gi, '').replace(/\s+/g, ' ').trim() || name);

// How the grams were worked out, in the recipe's own units: "2 large eggs × 50 g each".
function amountNote(row) {
  const { ing, method, each } = row;
  const g = (v) => `${fmt(v, v < 10 ? 1 : 0)} g`;
  const times = each && ing.quantity != null ? `${fmt(ing.quantity, 2)} × ${g(each.grams)} ${ing.unit && UNITS[ing.unit]?.kind === 'volume' ? `per ${each.label}` : 'each'}` : '';
  switch (method) {
    case 'stated': return 'Weight from the recipe';
    case 'manual': return 'Grams entered by you';
    case 'portion': return `${times} (USDA measure)`;
    case 'typical': return `${times} (typical ${each.food ? `${each.label} of ${each.food}` : each.label})`;
    case 'estimate': return ing.unit && UNITS[ing.unit]?.kind === 'volume'
      ? `${times} — estimated as the weight of water, so check the grams`
      : `${times} (estimated) — check the grams`;
    case 'none': return 'No amount given — not counted';
    default: return 'This food has no standard size — enter the grams (weigh one, or check the package)';
  }
}
const isRoughNote = (method) => method === 'estimate' || method === 'unknown';

// Step 2: review the recipe and each ingredient's USDA match, then create it.
function reviewStep(body, parsed, close) {
  const apiKey = state.settings.usda?.apiKey ?? '';
  const name = h('input', { type: 'text', value: parsed.name, placeholder: 'Recipe name' });
  const servings = numberInput(parsed.yieldServings ?? '', { placeholder: '4', inputmode: 'numeric' });
  const status = h('p', { class: 'entry-preview', role: 'status' }, 'Looking up nutrition…');
  const errorBox = h('div', { class: 'errors', role: 'alert' });
  const list = h('ul', { class: 'import-list' });
  const createBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Create recipe');

  // One row per ingredient line. `foods` caches USDA details (with portions) by id.
  const foods = new Map();
  const rows = parsed.ingredients.map((ing) => ({ ing, candidates: [], fdcId: null, grams: null, method: null, state: 'pending' }));

  const per100For = (row) => {
    const detail = foods.get(row.fdcId);
    const candidate = row.candidates.find((c) => c.fdcId === row.fdcId);
    return per100g(detail?.foodNutrients ?? candidate?.foodNutrients);
  };
  const applyFood = (row) => {
    const g = gramsFor(row.ing, foods.get(row.fdcId)?.foodPortions ?? []);
    row.grams = g.grams;
    row.method = g.method;
    row.each = g.each ?? null;
  };

  const rowEl = (row) => {
    const li = h('li', { class: 'import-row' });
    const render = () => {
      const per100 = row.fdcId ? per100For(row) : null;
      const kcal = per100 && row.grams ? (per100.calories ?? 0) * row.grams / 100 : null;
      const select = h('select', { 'aria-label': `USDA match for ${row.ing.name}`, disabled: row.state === 'pending' },
        row.candidates.map((c) => h('option', { value: String(c.fdcId), selected: c.fdcId === row.fdcId }, c.description)),
        h('option', { value: '', selected: !row.fdcId }, row.candidates.length ? 'No nutrition (add later)' : {
          pending: 'Looking up…', skipped: 'No amount given — not counted', failed: 'Not looked up',
        }[row.state] ?? 'No match found'));
      select.addEventListener('change', async () => {
        row.fdcId = select.value ? Number(select.value) : null;
        if (row.fdcId && !foods.has(row.fdcId)) {
          try {
            for (const f of await getFoods([row.fdcId], apiKey)) foods.set(f.fdcId, f);
          } catch (err) {
            errorBox.textContent = err.message;
          }
        }
        if (row.fdcId) applyFood(row);
        render();
        updateTotals();
      });
      const grams = numberInput(row.grams == null ? '' : inputNumber(row.grams, 0), { 'aria-label': `Grams of ${row.ing.name}`, inputmode: 'decimal' });
      grams.addEventListener('change', () => {
        const r = readNumber(grams);
        if (r.value != null) { row.grams = r.value; row.method = 'manual'; render(); updateTotals(); }
      });
      mount(li,
        h('div', { class: 'import-line' }, row.ing.original),
        h('div', { class: 'import-match' },
          select,
          row.fdcId && h('div', { class: 'input-unit grams' }, grams, h('span', {}, 'g')),
          row.fdcId && h('strong', { class: 'import-kcal' }, kcal == null ? '–' : `${fmt(kcal)} kcal`)),
        row.fdcId && row.method && h('small', { class: isRoughNote(row.method) ? 'warn-text' : 'muted' }, amountNote(row)));
    };
    row.render = render;
    render();
    return li;
  };

  const updateTotals = () => {
    let total = 0;
    for (const row of rows) {
      if (row.fdcId && row.grams) total += (per100For(row).calories ?? 0) * row.grams / 100;
    }
    const yieldN = readNumber(servings).value || 1;
    const matched = rows.filter((r) => r.fdcId).length;
    if (rows.every((r) => r.state !== 'pending')) {
      status.textContent = `${matched} of ${rows.length} ingredients matched · about ${fmt(total)} kcal total, ${fmt(total / yieldN)} per serving`;
    }
  };
  servings.addEventListener('input', updateTotals);

  // Look up each ingredient not yet matched: one search each, then one request for the chosen
  // foods' portion weights. Safe to run again after an error.
  const retryBtn = h('button', { class: 'btn btn-small', type: 'button', hidden: true }, 'Try again');
  const lookUp = async () => {
    errorBox.textContent = '';
    retryBtn.hidden = true;
    status.textContent = 'Looking up nutrition…';
    const todo = rows.filter((r) => r.state === 'pending' || r.state === 'failed');
    for (const row of todo) { row.state = 'pending'; row.render(); }
    try {
      for (const row of todo) {
        if (row.ing.quantity == null && row.ing.grams == null) { row.state = 'skipped'; row.render(); continue; }
        const terms = searchTerms(row.ing);
        // Cups, spoons and pieces need a household measure; a stated weight doesn't.
        const needsPortion = row.ing.grams == null && UNITS[row.ing.unit]?.kind !== 'mass';
        row.candidates = rankCandidates(terms, await searchFoods(terms, apiKey), { needsPortion }).slice(0, 6);
        row.fdcId = row.candidates[0]?.fdcId ?? null;
        row.state = row.fdcId ? 'matched' : 'nomatch';
        row.render();
      }
      const ids = [...new Set(rows.map((r) => r.fdcId).filter((id) => id && !foods.has(id)))];
      for (const f of await getFoods(ids, apiKey)) foods.set(f.fdcId, f);
    } catch (err) {
      errorBox.textContent = err instanceof UsdaError ? err.message : 'The nutrition lookup failed.';
      retryBtn.hidden = false;
      for (const row of rows) if (row.state === 'pending') row.state = 'failed';
    }
    // Weights stated in the recipe work even when portion details couldn't be fetched.
    for (const row of rows) {
      if (row.fdcId) applyFood(row);
      row.render();
    }
    updateTotals();
    if (rows.every((r) => !r.fdcId)) status.textContent = 'No nutrition found yet. You can still create the recipe and add nutrition to each ingredient later.';
  };
  retryBtn.addEventListener('click', lookUp);

  const create = async (ev) => {
    ev.preventDefault();
    createBtn.disabled = true;
    const ingredients = rows.map((row) => {
      const base = { kind: 'food', name: ingredientName(row.ing.name), brand: null, servings: 1, custom: {} };
      if (!row.fdcId || !row.grams) {
        return { ...base, servingSize: row.ing.original, nutrients: {} };
      }
      const detail = foods.get(row.fdcId);
      const nutrients = Object.fromEntries(Object.entries(scaleTo(per100For(row), row.grams)).map(([k, v]) => [k, roundTo(v, 2)]));
      return {
        ...base,
        servingSize: `${row.ing.original} (${fmt(row.grams)} g)`,
        nutrients,
        source: { type: 'usda', fdcId: row.fdcId, description: detail?.description ?? '', grams: row.grams },
      };
    });
    await saveAndOpen({
      name: name.value.trim(),
      yieldServings: readNumber(servings).value || 4,
      prepMinutes: parsed.prepMinutes,
      cookMinutes: parsed.cookMinutes,
      instructions: parsed.instructions,
      notes: parsed.notes,
      ...(parsed.image && { image: parsed.image }),
      ingredients,
    });
    close();
    toast('Recipe imported — review it below');
  };

  mount(body,
    h('h2', {}, 'Check the recipe'),
    h('div', { class: 'input-row' }, field('Name', name), field('Servings', servings)),
    status,
    h('div', { class: 'errors-row' }, errorBox, retryBtn),
    lookupNote(rows, apiKey),
    !apiKey && h('p', { class: 'notice' },
      'Using the shared USDA demo key, which allows only a few lookups an hour. ',
      h('a', { href: '#/settings', onClick: () => close() }, 'Add your free key in Settings'), ' for reliable imports.'),
    h('p', { class: 'muted' }, 'Each ingredient is matched to the USDA food database. Change a match or the grams if they look wrong. Nutrition is an estimate.'),
    list,
    h('div', { class: 'dialog-actions' },
      h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel'),
      createBtn));
  body.onsubmit = create;
  list.append(...rows.map(rowEl));
  lookUp();
}
