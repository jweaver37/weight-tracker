// Compact nutrition displays shared by recipes and logging dialogs.
import { h } from './dom.js';
import { NUTRIENTS } from '../core/nutrients.js';
import { fmt, fmtAmount } from './format.js';

export const macroLine = (n) =>
  `${fmt(n.calories ?? 0)} kcal · P ${fmt(n.protein ?? 0, 1)} g · C ${fmt(n.carbs ?? 0, 1)} g · F ${fmt(n.fat ?? 0, 1)} g`;

// Expandable list of every nutrient that has a value, plus custom fields.
export function nutrientDetails({ nutrients, custom }, customFields, summary = 'All nutrients') {
  const rows = [
    ...NUTRIENTS.filter((n) => nutrients[n.key] != null).map((n) => [n.label, fmtAmount(nutrients[n.key], n.unit), n.indent]),
    ...customFields.filter((f) => custom?.[f.id] != null).map((f) => [f.name, fmtAmount(custom[f.id], f.unit), 0]),
  ];
  if (!rows.length) return null;
  return h('details', {},
    h('summary', {}, summary),
    h('ul', { class: 'detail-list' }, rows.map(([label, value, indent]) =>
      h('li', { class: `indent-${indent ?? 0}` }, h('span', {}, label), h('strong', {}, value)))));
}
