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

export function roundTo(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
