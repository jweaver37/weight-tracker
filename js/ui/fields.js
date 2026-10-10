// Form field builders and readers.
import { h } from './dom.js';
import { parseAmount } from '../core/nutrition.js';
import { cmToIn, inToCm, roundTo, weightFromDisplay, weightToDisplay } from '../core/units.js';
import { inputNumber } from './format.js';

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

// Weight input in the user's unit; read() returns kg (or null when blank/invalid).
export function weightInput(kg, unit, attrs = {}) {
  const input = numberInput(kg == null ? '' : inputNumber(weightToDisplay(kg, unit), 1), attrs);
  const el = h('div', { class: 'input-unit' }, input, h('span', {}, unit));
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
