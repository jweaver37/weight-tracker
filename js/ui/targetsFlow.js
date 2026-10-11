// Calculating targets from the user's data, and the notice shown when they change.
import * as repo from '../data/repo.js';
import { state, saveSettings } from './state.js';
import { dailyValues, currentValue } from '../core/trends.js';
import { applyCalculation, basisWeightFromHistory, calculateFromSettings, CALCULATED_KEYS } from '../core/targets.js';
import { nutrientByKey } from '../core/nutrients.js';
import { todayStr } from '../core/dates.js';
import { h, showDialog } from './dom.js';
import { fmtAmount } from './format.js';

export const weightPoints = async () => dailyValues(await repo.listAll('weights'), 'weightKg');

// The weight calculated targets are based on, from the weigh-in history (see basisWeightFromHistory).
async function historyBasis() {
  const points = await weightPoints();
  return basisWeightFromHistory(points, state.settings.targets.recalcThresholdKg) ?? currentValue(points, todayStr());
}

// Recalculates and saves targets from the given weight (default: the basis from the weigh-in history).
// Returns { oldValues, newValues } or null when the profile is incomplete.
export async function recalculateTargets(weightKg) {
  const today = todayStr();
  const basis = weightKg ?? await historyBasis();
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

// After any weigh-in is added, changed or deleted: work the basis out again from the whole history,
// so targets are always right — including after deleting a mistaken weigh-in. Shows the old and new
// targets when they change.
export async function syncTargetsWithWeights() {
  const s = state.settings;
  if (s.targets.mode !== 'calculated') return;
  const before = s.targets.basisWeightKg;
  const basis = await historyBasis();
  if (basis == null || (before != null && Math.abs(basis - before) < 1e-6)) return;
  const change = await recalculateTargets(basis);
  if (!change || CALCULATED_KEYS.every((k) => change.oldValues?.[k] === change.newValues[k])) return;
  const message = before == null
    ? 'Your targets were calculated from your weigh-ins.'
    : basis < before
      ? 'Your 7-day average weight has dropped, so your targets were recalculated.'
      : 'Your weigh-ins changed (a lower weight was corrected or removed, or your 7-day average rose), so your targets were recalculated.';
  await showTargetChange(change, message);
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
