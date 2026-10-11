// Form field builders and readers.
import { h } from './dom.js';
import { parseAmount } from '../core/nutrition.js';
import { cmToIn, inToCm, roundTo, weightFromDisplay, weightToDisplay } from '../core/units.js';
import { fmt, inputNumber, unitFor } from './format.js';

export const field = (label, control, hint) =>
  h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint && h('small', { class: 'field-hint' }, hint));

export const numberInput = (value, attrs = {}) =>
  h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: value ?? '', ...attrs });

export function selectInput(options, value, attrs = {}) {
  return h('select', attrs, options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
}

// Reads a numeric input. Blank → { empty: true }. Invalid → { value: null } and the input is flagged.
export function readNumber(input) {
  const text = input.value.trim();
  input.classList.remove('invalid');
  if (text === '') return { empty: true, value: null };
  const value = parseAmount(text);
  if (value == null) input.classList.add('invalid');
  return { empty: false, value };
}

// Preset choices plus "Custom…", which reveals a number box. read() → number, or null when invalid.
// unit: a word ('weeks', 'lb') or a [singular, plural] pair (['day', 'days']), chosen by each number
// so 1 reads "1 day" and others "7 days". "lb" becomes "lbs" except for exactly 1.
export function presetPicker(presets, value, { unit = '', min, max } = {}) {
  const CUSTOM = '__custom';
  const unitText = (n) => (Array.isArray(unit) ? unit[n === 1 ? 0 : 1] : unitFor(n, unit));
  const plural = unitText(2);
  const match = presets.find((p) => Math.abs(p - value) < 1e-6);
  const select = h('select', { 'aria-label': plural || 'Choice' },
    presets.map((p) => h('option', { value: String(p), selected: p === match }, `${fmt(p, 2)} ${unitText(p)}`.trim())),
    h('option', { value: CUSTOM, selected: match == null }, 'Custom…'));
  const custom = numberInput(match == null ? inputNumber(value, 1) : '', { 'aria-label': `Custom ${plural}`.trim() });
  const customWrap = h('div', { class: 'input-unit', hidden: match != null }, custom, plural && h('span', {}, plural));
  select.addEventListener('change', () => {
    customWrap.hidden = select.value !== CUSTOM;
    if (!customWrap.hidden) custom.focus();
  });
  const read = () => {
    const isCustom = select.value === CUSTOM;
    const v = isCustom ? readNumber(custom).value : Number(select.value);
    const ok = v != null && v > 0 && (min == null || v >= min) && (max == null || v <= max);
    custom.classList.toggle('invalid', isCustom && custom.value.trim() !== '' && !ok);
    return ok ? v : null;
  };
  return { el: h('div', { class: 'preset-picker' }, select, customWrap), read };
}

// Weight input in the user's unit; read() returns kg (or null when blank/invalid).
export function weightInput(kg, unit, attrs = {}) {
  const input = numberInput(kg == null ? '' : inputNumber(weightToDisplay(kg, unit), 1), attrs);
  const el = h('div', { class: 'input-unit' }, input, h('span', {}, unitFor(2, unit)));
  return {
    el,
    input,
    read: () => {
      const { value } = readNumber(input);
      return value == null ? null : weightFromDisplay(value, unit);
    },
  };
}

// Height input: feet + inches for imperial, cm for metric. read() returns cm (or null).
export function heightInput(cm, unit) {
  if (unit === 'cm') {
    const input = numberInput(cm == null ? '' : inputNumber(cm, 1));
    return {
      el: h('div', { class: 'input-unit' }, input, h('span', {}, 'cm')),
      read: () => readNumber(input).value,
    };
  }
  const totalIn = cm == null ? null : cmToIn(cm);
  let ft = totalIn == null ? '' : Math.floor(totalIn / 12);
  let inches = totalIn == null ? '' : roundTo(totalIn - ft * 12, 1);
  if (inches === 12) { ft += 1; inches = 0; }
  const ftInput = numberInput(ft, { inputmode: 'numeric' });
  const inInput = numberInput(inches);
  return {
    el: h('div', { class: 'input-row' },
      h('div', { class: 'input-unit' }, ftInput, h('span', {}, 'ft')),
      h('div', { class: 'input-unit' }, inInput, h('span', {}, 'in'))),
    read: () => {
      const f = readNumber(ftInput);
      const i = readNumber(inInput);
      if (f.empty && i.empty) return null;
      if (f.value == null && !f.empty) return null;
      if (i.value == null && !i.empty) return null;
      return inToCm((f.value ?? 0) * 12 + (i.value ?? 0));
    },
  };
}
