// Calculating targets from the user's data, and the notice shown when they change.
import * as repo from '../data/repo.js';
import { state, saveSettings } from './state.js';
import { dailyValues, averageOver, currentValue } from '../core/trends.js';
import { applyCalculation, calculateFromSettings, CALCULATED_KEYS, shouldRecalculate } from '../core/targets.js';
import { nutrientByKey } from '../core/nutrients.js';
import { todayStr } from '../core/dates.js';
import { h, showDialog } from './dom.js';
import { fmtAmount } from './format.js';

export const weightPoints = async () => dailyValues(await repo.listAll('weights'), 'weightKg');

// Recalculates and saves targets from the given weight (default: current 7-day average).
// Returns { oldValues, newValues } or null when the profile is incomplete.
export async function recalculateTargets(weightKg) {
  const today = todayStr();
  const basis = weightKg ?? currentValue(await weightPoints(), today);
  const s = state.settings;
  const result = calculateFromSettings(s, basis, today);
  if (!result) return null;
  const oldValues = s.targets.values;
  await saveSettings({ ...s, targets: applyCalculation(s.targets, result, basis, new Date().toISOString()) });
  return { oldValues, newValues: result.values, floorApplied: result.floorApplied };
}

// The BMR → maintenance → target steps behind the calorie target, or null when the profile lacks
// sex, birth date or height (or there is no weight yet). Calculated targets use the weight they were
// last calculated from, so the steps add up to the target shown; manual targets use current weight.
export async function energyBreakdown() {
  const s = state.settings;
  const today = todayStr();
  const weightKg = s.targets.mode === 'calculated' && s.targets.basisWeightKg
    ? s.targets.basisWeightKg
    : currentValue(await weightPoints(), today);
  const result = calculateFromSettings(s, weightKg, today);
  return result && { ...result, weightKg };
}

// After a weigh-in: recalculate once the 7-day average has dropped by the threshold, and show the change.
export async function checkAutoRecalc() {
  const avg = averageOver(await weightPoints(), todayStr(), 7);
  if (!shouldRecalculate(state.settings.targets, avg)) return;
  const change = await recalculateTargets(avg);
  if (change) await showTargetChange(change, 'Your 7-day average weight has dropped, so your targets were recalculated.');
}

export function showTargetChange({ oldValues, newValues, floorApplied }, message) {
  const rows = CALCULATED_KEYS.map((key) => {
    const n = nutrientByKey(key);
    const before = oldValues?.[key];
    return h('tr', {},
      h('th', { scope: 'row' }, n.label),
      h('td', {}, before == null ? '–' : fmtAmount(before, n.unit)),
      h('td', {}, fmtAmount(newValues[key], n.unit)));
  });
  return showDialog((close) =>
    h('div', { class: 'dialog-body' },
      h('h2', {}, 'Targets updated'),
      h('p', {}, message),
      h('table', { class: 'compare-table' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Old'), h('th', {}, 'New'))),
        h('tbody', {}, rows)),
      floorApplied && h('p', { class: 'muted' }, 'Calories are at your minimum, so they will not go lower.'),
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-primary', type: 'button', onClick: () => close() }, 'OK'))));
}
