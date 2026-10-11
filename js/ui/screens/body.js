// Body: weekly tape measurements with a guide figure, progress since the measurement baseline,
// body-composition estimates (optional), a chart per measurement and the history.
import { confirmDialog, h, mount, showDialog, toast } from '../dom.js';
import { state } from '../state.js';
import * as repo from '../../data/repo.js';
import { daysBetween, todayStr } from '../../core/dates.js';
import { currentValue } from '../../core/trends.js';
import { lengthFromDisplay, lengthLabel, lengthToDisplay, roundTo } from '../../core/units.js';
import {
  activeFields, bmi, bmiCategory, bodyFatMissing, changesSinceBaseline, estimatesUsing, fieldLabel, latestValues,
  measureLevel, navyBodyFat, totalProgress,
} from '../../core/measurements.js';
import { field, numberInput, readNumber } from '../fields.js';
import { fmt, fmtDate, fmtHeight, fmtLength, fmtWeight, inputNumber } from '../format.js';
import { lineChart } from '../chart.js';
import { bodyFigure, estimateIcon } from '../bodyFigure.js';
import { weightPoints } from '../targetsFlow.js';
import { checkMilestones, pruneMeasureMilestones } from '../milestones.js';

// A change bigger than this from the last measurement is usually a typo (3.5 for 35): ask first.
const UNUSUAL_CHANGE = 0.15;

let editDate = null; // the date the entry form shows (null = today)
let chartKey = null;
let estimateFilter = 'all'; // which boxes the form shows: 'all', 'fat' (body fat) or 'bmi'

export async function renderBody(view) {
  const s = state.settings;
  const today = todayStr();
  const [entries, points] = await Promise.all([repo.listAll('measurements'), weightPoints()]);
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  const rerender = () => renderBody(view);
  const latest = latestValues(entries, today);

  mount(view,
    h('header', { class: 'page-head' }, h('h1', {}, 'Body')),
    dueNotice(entries, today),
    entryCard(entries, points, s, today, rerender),
    progressCard(entries, s, latest),
    s.body.composition && compositionCard(s, latest, points, today),
    chartCard(entries, s, rerender),
    historyCard(entries, s, rerender));
}

function dueNotice(entries, today) {
  if (!entries.length) {
    return h('section', { class: 'notice' },
      h('p', {}, 'Measure once a week, at the same time of day (morning, before eating, works best). ',
        'Your first full set of measurements becomes your baseline.'));
  }
  const days = daysBetween(entries[0].date, today);
  return days >= 7 && h('section', { class: 'notice' },
    h('p', {}, `It’s been ${days} days since you last measured — time for this week’s measurements.`));
}

function entryCard(entries, points, s, today, rerender) {
  const unit = s.units.length;
  const fields = activeFields(s.body, s.profile.sex);
  const figure = bodyFigure();
  const caption = h('p', { class: 'figure-caption muted' }, 'Tap a box to see where to measure.');
  const date = h('input', { type: 'date', value: editDate ?? today, max: today });
  const inputs = new Map();

  const fill = () => {
    const existing = entries.find((e) => e.date === date.value);
    for (const [key, input] of inputs) {
      const v = existing?.values?.[key];
      input.value = v ? inputNumber(lengthToDisplay(v, unit), 2) : '';
      input.classList.remove('invalid');
    }
  };
  date.addEventListener('change', fill);

  // With estimates on, colored icons mark what body fat and BMI use, and a filter can show just those.
  const estimates = s.body.composition;
  const sex = s.profile.sex;
  const icons = (key) => (estimates ? estimatesUsing(key, sex).map(estimateIcon) : []);
  const labelled = (text, key) => h('span', { class: 'label-with-icons' }, text, icons(key));
  const filterable = []; // [element, key]

  const boxes = fields.map((f) => {
    const input = numberInput('', { 'aria-label': `${f.label} (${lengthLabel(unit)})` });
    input.addEventListener('focus', () => {
      figure.show(f.key);
      caption.replaceChildren(h('strong', {}, `${f.label}: `), f.hint);
    });
    inputs.set(f.key, input);
    const el = field(labelled(f.label, f.key), h('div', { class: 'input-unit' }, input, h('span', {}, lengthLabel(unit))));
    filterable.push([el, f.key]);
    return el;
  });
  fill();

  // Height and weight aren't measured here, but the estimates use them: shown read-only.
  const weightKg = currentValue(points, today);
  const infoRow = (key, label, value, note) => {
    const el = h('div', { class: 'field info-field' },
      h('span', { class: 'field-label' }, labelled(label, key)),
      h('p', {}, h('strong', {}, value), ' ', h('small', { class: 'muted' }, note)));
    filterable.push([el, key]);
    return el;
  };
  const infoRows = estimates && [
    infoRow('height', 'Height', fmtHeight(s.profile.heightCm, unit), s.profile.heightCm ? 'from your profile' : 'add it in Settings'),
    infoRow('weight', 'Weight', weightKg == null ? '–' : fmtWeight(weightKg, s.units.weight), weightKg == null ? 'log a weigh-in' : '7-day average'),
  ];
  const bmiNote = h('p', { class: 'muted info-note' }, 'BMI needs no tape measurements: just your weight and height.');

  const applyFilter = () => {
    for (const [el, key] of filterable) {
      el.hidden = estimateFilter !== 'all' && !estimatesUsing(key, sex).includes(estimateFilter);
    }
    bmiNote.hidden = estimateFilter !== 'bmi';
  };
  const filter = estimates && h('select', {
    'aria-label': 'Show measurements for',
    onChange: (e) => { estimateFilter = e.target.value; applyFilter(); },
  },
  h('option', { value: 'all', selected: estimateFilter === 'all' }, 'All'),
  h('option', { value: 'fat', selected: estimateFilter === 'fat' }, 'Body fat'),
  h('option', { value: 'bmi', selected: estimateFilter === 'bmi' }, 'BMI'));
  const legend = estimates && h('ul', { class: 'estimate-legend' },
    h('li', {}, estimateIcon('fat'), 'Body fat'),
    h('li', {}, estimateIcon('bmi'), 'BMI'));
  if (!estimates) estimateFilter = 'all';
  applyFilter();

  const save = async (ev) => {
    ev.preventDefault();
    const existing = entries.find((e) => e.date === date.value);
    const values = { ...existing?.values };
    let bad = false;
    for (const [key, input] of inputs) {
      const r = readNumber(input);
      if (r.empty) delete values[key];
      else if (r.value == null || r.value <= 0) { input.classList.add('invalid'); bad = true; }
      else values[key] = lengthFromDisplay(r.value, unit);
    }
    if (bad || !date.value) return;
    if (!Object.keys(values).length) { toast('Enter at least one measurement'); return; }

    const odd = unusualChanges(entries, date.value, values);
    if (odd.length && !(await confirmUnusual(odd, unit))) return;

    await repo.save('measurements', { ...existing, date: date.value, values });
    toast(existing ? 'Measurements updated' : 'Measurements saved');
    editDate = null;
    await pruneMeasureMilestones();
    await checkMilestones();
    rerender();
  };

  return h('form', { class: 'card', onSubmit: save },
    h('h2', {}, 'Measure'),
    h('div', { class: 'measure-layout' },
      h('div', { class: 'measure-figure' }, figure.el,
        estimates && field('Show', filter), legend, caption),
      h('div', { class: 'measure-fields' }, field('Date', date), boxes, infoRows, bmiNote)),
    h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Save Measurements'));
}

// Measurements that differ a lot from the closest earlier one: [{ key, value, previous }].
function unusualChanges(entries, date, values) {
  const out = [];
  for (const [key, value] of Object.entries(values)) {
    const prev = entries.find((e) => e.date < date && e.values?.[key] > 0);
    if (prev && Math.abs(value - prev.values[key]) > prev.values[key] * UNUSUAL_CHANGE) {
      out.push({ key, value, previous: prev.values[key], date: prev.date });
    }
  }
  return out;
}

function confirmUnusual(odd, unit) {
  return showDialog((close) =>
    h('div', { class: 'dialog-body' },
      h('h2', {}, 'Are these right?'),
      h('p', {}, 'These are quite different from your last measurement:'),
      h('ul', {}, odd.map((o) => h('li', {},
        h('strong', {}, `${fieldLabel(o.key)}: ${fmtLength(o.value, unit)}`),
        ` (was ${fmtLength(o.previous, unit)} on ${fmtDate(o.date, { month: 'short', day: 'numeric' })})`))),
      h('p', { class: 'muted' }, 'If one is a typo, fix it before saving so your progress stays accurate.'),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => close(true) }, 'Yes, save'),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => close(false) }, 'Fix it'))),
  ).then(Boolean);
}

const signed = (cm, unit) => `${cm > 0.004 ? '+' : cm < -0.004 ? '−' : ''}${fmtLength(Math.abs(cm), unit)}`;

function progressCard(entries, s, latest) {
  const unit = s.units.length;
  const baseline = s.measureBaseline;
  if (!baseline) {
    if (!entries.length) return null;
    const needed = activeFields(s.body, s.profile.sex).map((f) => f.label);
    return h('section', { class: 'card' },
      h('h2', {}, 'Baseline'),
      h('p', {}, `Your baseline is set from your first entry${s.baselineFrom ? ` on or after ${fmtDate(s.baselineFrom, { month: 'short', day: 'numeric' })} (when you started a new baseline)` : ''} with every measurement filled in: `,
        needed.join(', '), '.'));
  }
  const changes = changesSinceBaseline(baseline, latest);
  const lost = totalProgress(changes, 'lose');
  const goal = s.goals.measurements;
  let next = null;
  if (goal.enabled) {
    const total = totalProgress(changes, goal.mode);
    const nextAt = (measureLevel(total, goal.stepCm) + 1) * goal.stepCm;
    next = `${fmtLength(nextAt, unit)} ${goal.mode === 'gain' ? 'gained (chest, arms, thighs, calves)' : 'lost in total'}: ${fmtLength(Math.max(0, nextAt - total), unit)} to go`;
  }
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', {}, 'Since Your Baseline'),
      h('small', { class: 'muted' }, fmtDate(baseline.date, { month: 'short', day: 'numeric', year: 'numeric' }))),
    h('table', { class: 'measure-table' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Baseline'), h('th', {}, 'Latest'), h('th', {}, 'Change'))),
      h('tbody', {}, Object.keys(baseline.values).map((k) => h('tr', {},
        h('th', { scope: 'row' }, fieldLabel(k)),
        h('td', {}, fmtLength(baseline.values[k], unit)),
        h('td', {}, latest[k] ? fmtLength(latest[k].value, unit) : '–'),
        h('td', { class: changes[k] < 0 ? 'good' : '' }, changes[k] == null ? '–' : signed(changes[k], unit))))),
      h('tfoot', {}, h('tr', {},
        h('th', { scope: 'row', colspan: 3 }, lost >= 0 ? 'Total lost' : 'Total gained'),
        h('td', {}, h('strong', {}, fmtLength(Math.abs(lost), unit)))))),
    next && h('p', { class: 'muted' }, 'Next milestone: ', next));
}

function compositionCard(s, latest, points, today) {
  const p = s.profile;
  const v = (k) => latest[k]?.value ?? null;
  const input = { sex: p.sex, heightCm: p.heightCm, waistCm: v('waist'), neckCm: v('neck'), hipsCm: v('hips') };
  const bf = navyBodyFat(input);
  const missing = bodyFatMissing(input);
  const base = s.measureBaseline?.values;
  const bfBase = base && navyBodyFat({ ...input, waistCm: base.waist, neckCm: base.neck, hipsCm: base.hips });
  const weightKg = currentValue(points, today);
  const bmiValue = bmi(weightKg, p.heightCm);

  return h('section', { class: 'card' },
    h('h2', {}, 'Body Composition'),
    h('div', { class: 'stats-row' },
      h('div', { class: 'stat' },
        h('strong', {}, bf == null ? '–' : `${fmt(bf, 1)}%`),
        h('small', { class: 'label-with-icons' }, estimateIcon('fat'), 'Est. body fat'),
        bf != null && bfBase != null && h('small', { class: 'muted' }, Math.abs(bf - bfBase) < 0.05
          ? 'Same as baseline'
          : `${bf > bfBase ? '+' : '−'}${fmt(Math.abs(bf - bfBase), 1)}% since baseline`)),
      h('div', { class: 'stat' },
        h('strong', {}, bmiValue == null ? '–' : fmt(bmiValue, 1)),
        h('small', { class: 'label-with-icons' }, estimateIcon('bmi'), 'BMI'),
        bmiValue != null && h('small', { class: 'muted' }, bmiCategory(bmiValue)))),
    bf == null && missing.length > 0 && h('p', {}, 'To estimate body fat, add: ', missing.join(', '), '.'),
    bmiValue == null && h('p', {}, 'BMI needs your height (in your profile) and a weigh-in.'),
    h('p', { class: 'muted' },
      'Estimates only. Body fat uses the U.S. Navy method: waist, neck and height for men, plus hips for women. ',
      'It can differ from clinical tests by a few percent. BMI uses only weight and height, so it can’t tell muscle from fat.'));
}

function chartCard(entries, s, rerender) {
  const unit = s.units.length;
  const keys = [...new Set(entries.flatMap((e) => Object.keys(e.values ?? {})))]
    .filter((k) => entries.filter((e) => e.values[k] > 0).length >= 2);
  if (!keys.length) return null;
  if (!keys.includes(chartKey)) chartKey = keys.includes('waist') ? 'waist' : keys[0];
  const select = h('select', { 'aria-label': 'Measurement', onChange: (e) => { chartKey = e.target.value; rerender(); } },
    keys.map((k) => h('option', { value: k, selected: k === chartKey }, fieldLabel(k))));
  const pts = entries.filter((e) => e.values[chartKey] > 0)
    .map((e) => ({ date: e.date, value: roundTo(lengthToDisplay(e.values[chartKey], unit), 2) }))
    .reverse();
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Trend'), select),
    lineChart({ points: pts, line: pts, label: `${fieldLabel(chartKey)} chart in ${lengthLabel(unit)}` }));
}

function historyCard(entries, s, rerender) {
  if (!entries.length) return null;
  const unit = s.units.length;
  const remove = async (e) => {
    if (await confirmDialog(`Delete the measurements from ${fmtDate(e.date)}?`, { okLabel: 'Delete', danger: true })) {
      await repo.remove('measurements', e.id);
      await pruneMeasureMilestones();
      rerender();
    }
  };
  const edit = (e) => { editDate = e.date; rerender(); };
  return h('section', { class: 'card' },
    h('h2', {}, 'History'),
    h('ul', { class: 'history-list measure-history' },
      entries.map((e) => h('li', {},
        h('div', {},
          h('strong', {}, fmtDate(e.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })),
          h('small', { class: 'muted' }, Object.entries(e.values).map(([k, v]) => `${fieldLabel(k)} ${fmtLength(v, unit)}`).join(' · '))),
        h('button', { class: 'btn btn-small', type: 'button', onClick: () => edit(e) }, 'Edit'),
        h('button', { class: 'icon-btn small', type: 'button', 'aria-label': `Delete ${fmtDate(e.date)}`, onClick: () => remove(e) }, '×')))));
}
