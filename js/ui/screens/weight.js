// Weight log: weigh-in entry, chart with 7-day average, and history.
import { confirmDialog, h, toast, mount } from '../dom.js';
import { state } from '../state.js';
import * as repo from '../../data/repo.js';
import { addDays, todayStr } from '../../core/dates.js';
import { dailyValues, rollingAverage, currentValue } from '../../core/trends.js';
import { weightToDisplay } from '../../core/units.js';
import { field, weightInput } from '../fields.js';
import { lineChart } from '../chart.js';
import { fmtDate, fmtWeight } from '../format.js';
import { checkAutoRecalc } from '../targetsFlow.js';

const RANGES = [
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'all', label: 'All', days: null },
];
let range = '3m';

export async function renderWeight(view) {
  const s = state.settings;
  const unit = s.units.weight;
  const records = (await repo.listAll('weights')).sort((a, b) => (a.date < b.date ? 1 : -1));
  const points = dailyValues(records, 'weightKg');
  const today = todayStr();
  const rerender = () => renderWeight(view);

  mount(view, 
    h('header', { class: 'page-head' }, h('h1', {}, 'Weight')),
    entryCard(records, unit, rerender),
    summaryCard(points, s, today),
    chartCard(points, s, today, rerender),
    historyCard(records, unit, rerender),
  );
}

function entryCard(records, unit, rerender) {
  const date = h('input', { type: 'date', value: todayStr(), max: todayStr() });
  const weight = weightInput(null, unit, { placeholder: unit === 'kg' ? '85.2' : '187.4' });
  const save = async (ev) => {
    ev.preventDefault();
    const kg = weight.read();
    if (!kg || kg <= 0 || !date.value) {
      weight.input.classList.add('invalid');
      return;
    }
    // One weigh-in per day: a second entry for the same date replaces the first.
    const existing = records.find((r) => r.date === date.value);
    await repo.save('weights', { ...existing, date: date.value, weightKg: kg });
    toast(existing ? 'Weigh-in updated' : 'Weigh-in saved');
    await checkAutoRecalc();
    rerender();
  };
  return h('form', { class: 'card', onSubmit: save },
    h('div', { class: 'input-row align-end' },
      field('Date', date),
      field('Weight', weight.el),
      h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save')));
}

function summaryCard(points, s, today) {
  if (!points.length) return null;
  const unit = s.units.weight;
  const current = currentValue(points, today);
  const start = points[0].value;
  const goal = s.profile.goalWeightKg;
  const change = current - start;
  return h('section', { class: 'card stats-row' },
    statBlock(fmtWeight(current, unit), '7-day average'),
    statBlock(`${change > 0 ? '+' : change < 0 ? '−' : ''}${fmtWeight(Math.abs(change), unit)}`, 'Since start'),
    goal ? statBlock(current > goal ? fmtWeight(current - goal, unit) : 'Reached!', 'To goal') : null);
}

const statBlock = (value, label) => h('div', { class: 'stat' }, h('strong', {}, value), h('small', {}, label));

function chartCard(points, s, today, rerender) {
  const unit = s.units.weight;
  const days = RANGES.find((r) => r.key === range).days;
  const from = days ? addDays(today, -(days - 1)) : '0000-00-00';
  // Average is computed over all data so the first days in the range still use the prior week.
  const avg = rollingAverage(points).filter((p) => p.date >= from);
  const shown = points.filter((p) => p.date >= from);
  const toDisplay = (list) => list.map((p) => ({ date: p.date, value: weightToDisplay(p.value, unit) }));

  const tabs = h('div', { class: 'segmented', role: 'tablist' },
    RANGES.map((r) => h('button', {
      class: r.key === range ? 'active' : '', type: 'button', role: 'tab', 'aria-selected': String(r.key === range),
      onClick: () => { range = r.key; rerender(); },
    }, r.label)));

  const body = shown.length >= 2
    ? lineChart({
      points: toDisplay(shown),
      line: toDisplay(avg),
      goal: s.profile.goalWeightKg ? weightToDisplay(s.profile.goalWeightKg, unit) : null,
      label: `Weight chart in ${unit}`,
    })
    : h('p', { class: 'muted empty' }, 'Log at least two weigh-ins in this range to see a chart.');

  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Trend'), tabs),
    body,
    shown.length >= 2 && h('div', { class: 'legend' },
      h('span', { class: 'legend-point' }, 'Daily weigh-in'),
      h('span', { class: 'legend-line' }, '7-day average'),
      s.profile.goalWeightKg && h('span', { class: 'legend-goal' }, 'Goal')));
}

function historyCard(records, unit, rerender) {
  if (!records.length) return null;
  const remove = async (r) => {
    if (await confirmDialog(`Delete the weigh-in from ${fmtDate(r.date)}?`, { okLabel: 'Delete', danger: true })) {
      await repo.remove('weights', r.id);
      rerender();
    }
  };
  return h('section', { class: 'card' },
    h('h2', {}, 'History'),
    h('ul', { class: 'history-list' },
      records.map((r) => h('li', {},
        h('span', {}, fmtDate(r.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })),
        h('strong', {}, fmtWeight(r.weightKg, unit)),
        h('button', { class: 'icon-btn small', type: 'button', 'aria-label': `Delete ${fmtDate(r.date)}`, onClick: () => remove(r) }, '×')))));
}
