// The food form (every Nutrition Facts field plus custom fields), used for log entries and
// recipe ingredients.
import { h, showDialog, confirmDialog } from './dom.js';
import { field, numberInput, readNumber, selectInput } from './fields.js';
import { NUTRIENTS } from '../core/nutrients.js';
import { MEALS, entryNutrients, parseAmount } from '../core/nutrition.js';
import * as repo from '../data/repo.js';
import { fmt, inputNumber } from './format.js';
import { state } from './state.js';
import { volumeFromDisplay, volumeLabel, volumeToDisplay } from '../core/units.js';

// Edits a food without saving it. `meal` shows a meal picker when given.
// Resolves { action: 'save', food }, { action: 'delete' } or undefined (cancelled).
export function editFood({ food, customFields, meal, title, amountLabel = 'Servings', allowDelete = false, deleteMessage }) {
  const f = food ?? { servings: 1, nutrients: {}, custom: {} };

  const name = h('input', { type: 'text', value: f.name ?? '', placeholder: 'e.g. Greek yogurt', required: true });
  const brand = h('input', { type: 'text', value: f.brand ?? '', placeholder: 'Optional' });
  const mealSelect = meal && selectInput(MEALS.map((m) => ({ value: m.key, label: m.label })), meal);
  const servings = numberInput(inputNumber(f.servings, 3), { placeholder: '1' });
  const servingSize = h('input', { type: 'text', value: f.servingSize ?? '', placeholder: 'e.g. 2/3 cup (55 g)' });

  // Drinks also record volume, which can count toward the water goal.
  const volumeUnit = state.settings.units.volume;
  const volume = numberInput(f.volumeMl != null ? inputNumber(volumeToDisplay(f.volumeMl, volumeUnit), 1) : '', { 'aria-label': 'Volume per serving' });
  const countsAsWater = h('input', { type: 'checkbox', checked: f.countsAsWater ?? true });
  const drinkFields = h('div', { class: 'form-grid sub-form' },
    field('Volume per serving', h('div', { class: 'input-unit' }, volume, h('span', {}, volumeLabel(volumeUnit)))),
    h('label', { class: 'check' }, countsAsWater, h('span', {}, 'Counts toward water')));
  const isDrink = () => mealSelect?.value === 'drinks';
  const syncDrink = () => {
    drinkFields.hidden = !isDrink();
    name.placeholder = isDrink() ? 'e.g. Iced coffee' : 'e.g. Greek yogurt';
  };
  mealSelect?.addEventListener('change', syncDrink);
  syncDrink();

  const nutrientInputs = new Map();
  const nutrientRow = (key, label, unit, value, indent = 0) => {
    const input = numberInput(inputNumber(value, 2), { 'aria-label': label });
    nutrientInputs.set(key, input);
    return h('label', { class: `nutrient-row indent-${indent}` },
      h('span', {}, label), h('div', { class: 'input-unit' }, input, h('span', {}, unit)));
  };

  const labelRows = NUTRIENTS.filter((n) => n.group === 'label').map((n) => nutrientRow(n.key, n.label, n.unit, f.nutrients[n.key], n.indent));
  const microRows = NUTRIENTS.filter((n) => n.group === 'micro').map((n) => nutrientRow(n.key, n.label, n.unit, f.nutrients[n.key]));
  const microFilled = NUTRIENTS.some((n) => n.group === 'micro' && f.nutrients[n.key] != null);
  const customRows = customFields.map((c) => nutrientRow(`custom:${c.id}`, c.name, c.unit, f.custom?.[c.id]));

  const preview = h('p', { class: 'entry-preview' });
  const updatePreview = () => {
    const n = parseAmount(servings.value.trim() || '1') ?? 0;
    const per = (key) => parseAmount(nutrientInputs.get(key).value.trim()) ?? 0;
    preview.textContent = `Total for ${fmt(n, 2)} serving${n === 1 ? '' : 's'}: ${fmt(per('calories') * n)} kcal · ` +
      `P ${fmt(per('protein') * n, 1)} g · C ${fmt(per('carbs') * n, 1)} g · F ${fmt(per('fat') * n, 1)} g`;
  };

  const errorBox = h('div', { class: 'errors', role: 'alert' });

  return showDialog((close) => {
    const save = () => {
      const errors = [];
      if (!name.value.trim()) errors.push('Enter a name.');
      const s = readNumber(servings);
      const servingsValue = s.empty ? 1 : s.value;
      if (servingsValue == null || servingsValue <= 0) errors.push(`${amountLabel} must be a number above 0, like 1, 1.5 or 1 1/2.`);
      const nutrients = {};
      const custom = {};
      for (const [key, input] of nutrientInputs) {
        const r = readNumber(input);
        if (r.empty) continue;
        if (r.value == null) { errors.push('Nutrient amounts must be numbers (fields marked in red).'); continue; }
        if (key.startsWith('custom:')) custom[key.slice(7)] = r.value;
        else nutrients[key] = r.value;
      }
      if (nutrients.calories == null) errors.push('Enter calories (0 is fine).');
      const vol = readNumber(volume);
      if (isDrink() && !vol.empty && vol.value == null) errors.push('Volume must be a number.');
      const drink = isDrink() && vol.value
        ? { volumeMl: volumeFromDisplay(vol.value, volumeUnit), countsAsWater: countsAsWater.checked }
        : { volumeMl: null, countsAsWater: false };
      if (errors.length) {
        errorBox.replaceChildren(...[...new Set(errors)].map((msg) => h('p', {}, msg)));
        return;
      }
      close({
        action: 'save',
        food: {
          ...f,
          kind: 'food',
          name: name.value.trim(),
          brand: brand.value.trim() || null,
          ...(mealSelect && { meal: mealSelect.value }),
          servings: servingsValue,
          servingSize: servingSize.value.trim() || null,
          nutrients,
          custom,
          ...(mealSelect && drink),
        },
      });
    };

    const remove = async () => {
      if (await confirmDialog(deleteMessage ?? `Delete “${f.name}”?`, { okLabel: 'Delete', danger: true })) close({ action: 'delete' });
    };

    const form = h('form', { class: 'dialog-body', onSubmit: (ev) => { ev.preventDefault(); save(); }, onInput: updatePreview },
      h('h2', {}, title),
      field('Food name', name),
      field('Brand', brand),
      h('div', { class: 'input-row' }, mealSelect && field('Meal', mealSelect), field(amountLabel, servings)),
      field('Serving size', servingSize, 'As printed on the label. Amounts below are per serving.'),
      drinkFields,
      h('h3', {}, 'Nutrition Facts (per serving)'),
      h('div', { class: 'nutrient-list' }, labelRows),
      h('details', { open: microFilled }, h('summary', {}, 'Vitamins & minerals'), h('div', { class: 'nutrient-list' }, microRows)),
      customRows.length > 0 && h('div', {}, h('h3', {}, 'Custom fields'), h('div', { class: 'nutrient-list' }, customRows)),
      preview,
      errorBox,
      h('div', { class: 'dialog-actions' },
        allowDelete && h('button', { class: 'btn btn-danger btn-left', type: 'button', onClick: remove }, 'Delete'),
        h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel'),
        h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save')));
    updatePreview();
    if (!food) setTimeout(() => name.focus(), 0);
    return form;
  });
}

// Add / edit a food on the day's log. Resolves 'saved', 'deleted' or undefined (cancelled).
export async function openFoodEntry({ entry, date, meal, customFields }) {
  const result = await editFood({
    food: entry,
    customFields,
    meal: entry?.meal ?? meal,
    title: entry ? 'Edit food' : 'Add food',
    allowDelete: Boolean(entry),
    deleteMessage: entry && `Delete “${entry.name}” from this day?`,
  });
  if (result?.action === 'save') {
    await repo.save('logEntries', { date, ...result.food });
    return 'saved';
  }
  if (result?.action === 'delete') {
    await repo.remove('logEntries', entry.id);
    return 'deleted';
  }
  return undefined;
}

// One line describing an entry's amount, e.g. "1.5 × 2/3 cup (55 g)" or "2 of 6 servings".
export function entryAmountText(entry) {
  const n = fmt(entry.servings, 2);
  if (entry.kind === 'recipe') return `${n} of ${fmt(entry.recipeYield, 2)} servings`;
  if (entry.volumeMl) {
    const unit = state.settings.units.volume;
    const volume = `${fmt(volumeToDisplay(entry.volumeMl, unit), 1)} ${volumeLabel(unit)}`;
    const amount = entry.servings === 1 ? volume : `${n} × ${volume}`;
    return entry.countsAsWater ? amount : `${amount} · not counted as water`;
  }
  if (entry.servingSize) return entry.servings === 1 ? entry.servingSize : `${n} × ${entry.servingSize}`;
  return `${n} serving${entry.servings === 1 ? '' : 's'}`;
}

export const entryCalories = (entry) => entryNutrients(entry).calories ?? 0;
