// Unit conversions. Data is always stored in metric (kg, cm); these convert for display and input.

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const lbToKg = (lb) => lb * KG_PER_LB;
export const kgToLb = (kg) => kg / KG_PER_LB;
export const inToCm = (inches) => inches * CM_PER_IN;
export const cmToIn = (cm) => cm / CM_PER_IN;

export const weightToDisplay = (kg, unit) => (unit === 'kg' ? kg : kgToLb(kg));
export const weightFromDisplay = (value, unit) => (unit === 'kg' ? value : lbToKg(value));
export const lengthToDisplay = (cm, unit) => (unit === 'cm' ? cm : cmToIn(cm));
export const lengthFromDisplay = (value, unit) => (unit === 'cm' ? value : inToCm(value));
// Inches are written "in." (with a period) so they don't read as the word "in".
export const lengthLabel = (unit) => (unit === 'cm' ? 'cm' : 'in.');

// Drinks: stored in ml, shown in US fluid ounces ('floz') or ml.
export const ML_PER_FLOZ = 29.5735295625;
export const volumeToDisplay = (ml, unit) => (unit === 'ml' ? ml : ml / ML_PER_FLOZ);
export const volumeFromDisplay = (value, unit) => (unit === 'ml' ? value : value * ML_PER_FLOZ);
export const volumeLabel = (unit) => (unit === 'ml' ? 'ml' : 'fl oz');

export function roundTo(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
