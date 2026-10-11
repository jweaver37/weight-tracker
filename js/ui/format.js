// Display formatting.
import { roundTo, weightToDisplay, lengthLabel, lengthToDisplay } from '../core/units.js';
import { parseDateStr } from '../core/dates.js';

export function fmt(value, decimals = 0) {
  if (value == null || !Number.isFinite(value)) return '–';
  return roundTo(value, decimals).toLocaleString(undefined, { maximumFractionDigits: decimals });
}

// "1 lb" but "0.5 lbs", "5 lbs". Other unit symbols (kg, g, ml, fl oz) never take an "s".
export const unitFor = (value, unit) => (unit === 'lb' && value !== 1 ? 'lbs' : unit);

export function fmtWeight(kg, unit, decimals = 1) {
  if (kg == null) return '–';
  const shown = roundTo(weightToDisplay(kg, unit), decimals);
  return `${fmt(shown, decimals)} ${unitFor(Math.abs(shown), unit)}`;
}

export const fmtLength = (cm, unit, decimals = 1) =>
  cm == null ? '–' : `${fmt(lengthToDisplay(cm, unit), decimals)} ${lengthLabel(unit)}`;

// Small gram amounts keep one decimal; everything else is whole numbers.
export function fmtAmount(value, unit) {
  const decimals = unit === 'kcal' || Math.abs(value) >= 10 ? 0 : 1;
  return `${fmt(value, decimals)} ${unit}`;
}

// Inputs show plain numbers without grouping commas so they can be edited and parsed back.
export const inputNumber = (value, decimals = 2) => (value == null || !Number.isFinite(value) ? '' : String(roundTo(value, decimals)));

// Title Case for dropdown options: "lightly active (on your feet)" → "Lightly Active (On Your Feet)".
// Small words stay lowercase unless first; units ("fl oz", "kg"), numbers and acronyms are kept as written.
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'with', 'without']);
const KEEP_AS_IS = new Set(['g', 'mg', 'mcg', 'kg', 'lb', 'lbs', 'oz', 'fl', 'ml', 'l', 'kcal', 'tsp', 'tbsp', 'min', 'mph', 'e.g', 'i.e', 'x']);

function titleWord(token, isFirst) {
  const bare = token.replace(/^[("'“‘[]+|[)"'”’\],.:;!?…]+$/g, '').toLowerCase();
  if (!bare || KEEP_AS_IS.has(bare) || /\d/.test(token) || /[A-Z].*[A-Z]/.test(token)) return token;
  if (!isFirst && SMALL_WORDS.has(bare) && !/^[("“]/.test(token)) return token.toLowerCase();
  // Capitalize each part: "lacto-ovo" → "Lacto-Ovo", "(raw" → "(Raw"; small words inside
  // hyphenated words stay lowercase: "ready-to-serve" → "Ready-to-Serve".
  return token.split('-').map((part, i) => (i > 0 && SMALL_WORDS.has(part.toLowerCase())
    ? part.toLowerCase()
    : part.replace(/(^|[/("“‘[])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase()))).join('-');
}

export function titleCase(text) {
  let first = true;
  return String(text).split(/(\s+)/).map((token) => {
    if (!token.trim()) return token;
    const out = titleWord(token, first);
    // A leading number counts as the first word: "5 of 7 days" → "5 of 7 Days".
    if (/[\p{L}\d]/u.test(token)) first = false;
    return out;
  }).join('');
}

export const fmtDate =(dateStr, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  parseDateStr(dateStr).toLocaleDateString(undefined, opts);
