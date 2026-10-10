// Add / edit a manually entered food on the log.
import { h, showDialog, confirmDialog } from './dom.js';
import { field, numberInput, readNumber, selectInput } from './fields.js';
import { NUTRIENTS } from '../core/nutrients.js';
import { MEALS, entryNutrients, parseAmount } from '../core/nutrition.js';
import * as repo from '../data/repo.js';
import { fmt, inputNumber } from './format.js';

// Resolves 'saved', 'deleted' or undefined (cancelled).
export function openFoodEntry({ entry, date, meal, customFields }) {
  const editing = Boolean(entry);
  const e = entry ?? { date, meal, servings: 1, nutrients: {}, custom: {} };

  const name = h('input', { type: 'text', value: e.name ?? '', placeholder: 'e.g. Greek yogurt', required: true });
  const brand = h('input', { type: 'text', value: e.brand ?? '', placeholder: 'Optional' });
  const mealSelect = selectInput(MEALS.map((m) => ({ value: m.key, label: m.label })), e.meal);
  const servings = numberInput(inputNumber(e.servings, 3), { placeholder: '1' });
  const servingSize = h('input', { type: 'text', value: e.servingSize ?? '', placeholder: 'e.g. 2/3 cup (55 g)' });

  const nutrientInputs = new Map();
  const nutrientRow = (key, label, unit, value, indent = 0) => {
    const input = numberInput(inputNumber(value, 2), { 'aria-label': label });
    nutrientInputs.set(key, input);
    return h('label', { class: `nutrient-row indent-${indent}` },
      h('span', {}, label), h('div', { class: 'input-unit' }, input, h('span', {}, unit)));
  };

  const labelRows = NUTRIENTS.filter((n) => n.group === 'label').map((n) => nutrientRow(n.key, n.label, n.unit, e.nutrients[n.key], n.indent));
  const microRows = NUTRIENTS.filter((n) => n.group === 'micro').map((n) => nutrientRow(n.key, n.label, n.unit, e.nutrients[n.key]));
  const microFilled = NUTRIENTS.some((n) => n.group === 'micro' && e.nutrients[n.key] != null);
  const customRows = customFields.map((f) => nutrientRow(`custom:${f.id}`, f.name, f.unit, e.custom?.[f.id]));

  const preview = h('p', { class: 'entry-preview' });
  const updatePreview = () => {
    const n = parseAmount(servings.value.trim() || '1') ?? 0;
    const per = (key) => parseAmount(nutrientInputs.get(key).value.trim()) ?? 0;
    preview.textContent = `Total for ${fmt(n, 2)} serving${n === 1 ? '' : 's'}: ${fmt(per('calories') * n)} kcal · ` +
      `P ${fmt(per('protein') * n, 1)} g · C ${fmt(per('carbs') * n, 1)} g · F ${fmt(per('fat') * n, 1)} g`;
  };

  const errorBox = h('div', { class: 'errors', role: 'alert' });

  return showDialog((close) => {
    const save = async () => {
      const errors = [];
      if (!name.value.trim()) errors.push('Enter a name.');
      const s = readNumber(servings);
      const servingsValue = s.empty ? 1 : s.value;
      if (servingsValue == null || servingsValue <= 0) errors.push('Servings must be a number above 0, like 1, 1.5 or 1 1/2.');
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
      if (errors.length) {
        errorBox.replaceChildren(...[...new Set(errors)].map((msg) => h('p', {}, msg)));
        return;
      }
      await repo.save('logEntries', {
        ...e,
        kind: 'food',
        name: name.value.trim(),
        brand: brand.value.trim() || null,
        meal: mealSelect.value,
        servings: servingsValue,
        servingSize: servingSize.value.trim() || null,
        nutrients,
        custom,
      });
      close('saved');
    };

    const remove = async () => {
      if (await confirmDialog(`Delete “${e.name}” from this day?`, { okLabel: 'Delete', danger: true })) {
        await repo.remove('logEntries', e.id);
        close('deleted');
      }
    };

    const form = h('form', { class: 'dialog-body', onSubmit: (ev) => { ev.preventDefault(); save(); }, onInput: updatePreview },
      h('h2', {}, editing ? 'Edit food' : 'Add food'),
      field('Food name', name),
      field('Brand', brand),
      h('div', { class: 'input-row' }, field('Meal', mealSelect), field('Servings', servings)),
      field('Serving size', servingSize, 'As printed on the label. Amounts below are per serving.'),
      h('h3', {}, 'Nutrition Facts (per serving)'),
      h('div', { class: 'nutrient-list' }, labelRows),
      h('details', { open: microFilled }, h('summary', {}, 'Vitamins & minerals'), h('div', { class: 'nutrient-list' }, microRows)),
      customRows.length > 0 && h('div', {}, h('h3', {}, 'Custom fields'), h('div', { class: 'nutrient-list' }, customRows)),
      preview,
      errorBox,
      h('div', { class: 'dialog-actions' },
        editing && h('button', { class: 'btn btn-danger btn-left', type: 'button', onClick: remove }, 'Delete'),
        h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel'),
        h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save')));
    updatePreview();
    if (!editing) setTimeout(() => name.focus(), 0);
    return form;
  });
}

// One line describing an entry's amount, e.g. "1.5 × 2/3 cup (55 g)".
export function entryAmountText(entry) {
  const servings = `${fmt(entry.servings, 2)} serving${entry.servings === 1 ? '' : 's'}`;
  return entry.servingSize ? `${fmt(entry.servings, 2)} × ${entry.servingSize}` : servings;
}

export const entryCalories = (entry) => entryNutrients(entry).calories ?? 0;
