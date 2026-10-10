// Display formatting.
import { roundTo, weightToDisplay, lengthToDisplay } from '../core/units.js';
import { parseDateStr } from '../core/dates.js';

export function fmt(value, decimals = 0) {
  if (value == null || !Number.isFinite(value)) return '–';
  return roundTo(value, decimals).toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export const fmtWeight = (kg, unit, decimals = 1) =>
  kg == null ? '–' : `${fmt(weightToDisplay(kg, unit), decimals)} ${unit}`;

export const fmtLength = (cm, unit, decimals = 1) =>
  cm == null ? '–' : `${fmt(lengthToDisplay(cm, unit), decimals)} ${unit}`;

// Small gram amounts keep one decimal; everything else is whole numbers.
export function fmtAmount(value, unit) {
  const decimals = unit === 'kcal' || Math.abs(value) >= 10 ? 0 : 1;
  return `${fmt(value, decimals)} ${unit}`;
}

// Inputs show plain numbers without grouping commas so they can be edited and parsed back.
export const inputNumber = (value, decimals = 2) => (value == null || !Number.isFinite(value) ? '' : String(roundTo(value, decimals)));

export const fmtDate = (dateStr, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  parseDateStr(dateStr).toLocaleDateString(undefined, opts);
