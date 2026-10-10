// Importing recipes (pasted from a website, or a file a friend shared) and sharing them.
import { h, infoDialog, mount, showDialog, toast } from './dom.js';
import { field, numberInput, readNumber } from './fields.js';
import * as repo from '../data/repo.js';
import { state } from './state.js';
import { parseRecipeText } from '../core/ingredients.js';
import { gramsFor, per100g, rankCandidates, scaleTo, searchTerms } from '../core/foodMatch.js';
import { buildRecipeFile, readRecipeFile, recipeFileName } from '../core/recipeShare.js';
import { getFoods, searchFoods, UsdaError } from '../data/usda.js';
import { roundTo } from '../core/units.js';
import { fmt, inputNumber } from './format.js';
import { pickFile, shareOrDownload } from './files.js';

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
        h('span', {}, h('strong', {}, 'Paste a recipe'), h('small', {}, 'Copy a recipe from any website and paste it. Nutrition is looked up in the USDA food database.'))),
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

function importFromText() {
  return showDialog((close) => {
    const text = h('textarea', { rows: 12, placeholder: 'Paste the recipe here: its name, servings, ingredient list and steps.' });
    const body = h('form', { class: 'dialog-body' });
    const read = (ev) => {
      ev.preventDefault();
      const parsed = parseRecipeText(text.value);
      if (!parsed.ingredients.length) {
        text.classList.add('invalid');
        errorLine.textContent = 'No ingredients found. Make sure the ingredient list (lines like “1 cup rice”) is included.';
        return;
      }
      reviewStep(body, parsed, close);
    };
    const errorLine = h('p', { class: 'errors' });
    mount(body,
      h('h2', {}, 'Paste a recipe'),
      h('p', { class: 'muted' }, 'On the recipe’s web page, select from the title down to the end of the steps, copy, and paste below.'),
      text,
      errorLine,
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel'),
        h('button', { class: 'btn btn-primary', type: 'submit' }, 'Read recipe')));
    body.onsubmit = read; // the review step replaces this with its own handler
    setTimeout(() => text.focus(), 0);
    return body;
  });
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// "medium onion" → "Onion": the size is already in the amount line.
const ingredientName = (name) => capitalize(name.replace(/\b(extra large|large|medium|small)\b/gi, '').replace(/\s+/g, ' ').trim() || name);

const METHOD_NOTES = {
  stated: 'Weight from the recipe',
  portion: 'Converted with a USDA measure',
  estimate: 'Estimated — check the grams',
  none: 'No amount given — not counted',
  unknown: 'Enter the grams',
};

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
        if (r.value != null) { row.grams = r.value; row.method = 'stated'; render(); updateTotals(); }
      });
      mount(li,
        h('div', { class: 'import-line' }, row.ing.original),
        h('div', { class: 'import-match' },
          select,
          row.fdcId && h('div', { class: 'input-unit grams' }, grams, h('span', {}, 'g')),
          row.fdcId && h('strong', { class: 'import-kcal' }, kcal == null ? '–' : `${fmt(kcal)} kcal`)),
        row.fdcId && row.method && h('small', { class: row.method === 'estimate' || row.method === 'unknown' ? 'warn-text' : 'muted' }, METHOD_NOTES[row.method]));
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
        row.candidates = rankCandidates(terms, await searchFoods(terms, apiKey)).slice(0, 6);
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
