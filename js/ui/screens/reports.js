// Reports: a printable summary of food, exercise and weight for a chosen date range.
import { h, mount } from '../dom.js';
import { state } from '../state.js';
import * as repo from '../../data/repo.js';
import { addDays, daysBetween, minDate, monthEnd, monthStart, todayStr } from '../../core/dates.js';
import { buildReport, DAILY_TABLE_MAX_DAYS, REPORT_NUTRIENTS } from '../../core/report.js';
import { rollingAverage } from '../../core/trends.js';
import { ageOn, ACTIVITY_LEVELS } from '../../core/targets.js';
import { MEALS } from '../../core/nutrition.js';
import { nutrientByKey } from '../../core/nutrients.js';
import { volumeLabel, volumeToDisplay, weightToDisplay } from '../../core/units.js';
import { field, selectInput } from '../fields.js';
import { fmt, fmtAmount, fmtDate, fmtLength, fmtWeight } from '../format.js';
import { entryAmountText, entryCalories } from '../foodEntry.js';
import { lineChart } from '../chart.js';
import { energyBreakdown, weightPoints } from '../targetsFlow.js';
import { entryNutrients } from '../../core/nutrition.js';

// Longest ranges allowed. Tested with ~13 food items a day: summary and tables run about
// 2 pages for 30 days, but the full food log adds about a third of a page per day.
export const MAX_DAYS = 366;
export const MAX_FOOD_LOG_DAYS = 14;

const SECTIONS = [
  { key: 'weight', label: 'Weight chart & weigh-ins' },
  { key: 'daily', label: `Daily totals (weekly averages for ranges over ${DAILY_TABLE_MAX_DAYS} days)` },
  { key: 'workouts', label: 'Workout log' },
  { key: 'food', label: 'Full food log (every item eaten)' },
];

// Kept while the app is open so returning to the tab shows the same report.
const options = {
  preset: '30',
  from: addDays(todayStr(), -29),
  to: todayStr(),
  month: todayStr().slice(0, 7), // 'YYYY-MM'
  sections: { weight: true, daily: true, workouts: true, food: false },
};

function presetRange(preset, today) {
  if (preset === 'this-month') return { start: monthStart(today), end: today };
  if (preset === 'month') {
    const start = `${options.month}-01`;
    return { start, end: minDate(monthEnd(start), today) };
  }
  if (preset === 'last-month') {
    const last = addDays(monthStart(today), -1);
    return { start: monthStart(last), end: monthEnd(last) };
  }
  if (preset === 'custom') return { start: options.from, end: options.to };
  return { start: addDays(today, -(Number(preset) - 1)), end: today };
}

export async function renderReports(view) {
  const today = todayStr();
  const rerender = () => renderReports(view);
  const { start, end } = presetRange(options.preset, today);
  const dayCount = start <= end ? daysBetween(start, end) + 1 : 0;
  const problems = [];
  if (dayCount <= 0) problems.push('The start date must be on or before the end date.');
  if (dayCount > MAX_DAYS) problems.push(`Reports can cover up to ${MAX_DAYS} days. Choose a shorter range.`);
  const foodLogTooLong = options.sections.food && dayCount > MAX_FOOD_LOG_DAYS;

  const preview = h('div', { class: 'report-preview' });
  const estimate = h('p', { class: 'muted' });
  const printBtn = h('button', { class: 'btn btn-primary btn-block', type: 'button', onClick: () => window.print() }, 'Print or save as PDF');

  mount(view,
    h('header', { class: 'page-head no-print' }, h('h1', {}, 'Reports')),
    optionsCard(today, rerender, foodLogTooLong),
    problems.length
      ? h('div', { class: 'errors no-print' }, problems.map((p) => h('p', {}, p)))
      : [h('section', { class: 'card no-print' }, estimate, printBtn,
        h('small', { class: 'muted' }, 'On a phone, choose “Save as PDF” in the print screen to keep a copy or share it.')),
      preview]);

  if (problems.length) return;
  const sections = { ...options.sections, food: options.sections.food && !foodLogTooLong };
  const [entries, workouts, water, points, breakdown] = await Promise.all([
    repo.listRange('logEntries', start, end),
    repo.listRange('workouts', start, end),
    repo.listRange('water', start, end),
    weightPoints(),
    energyBreakdown(),
  ]);
  const report = buildReport({ start, end, entries, workouts, water, points, settings: state.settings });
  mount(preview, reportDocument(report, points, sections, breakdown));
  estimate.textContent = `${dayCount} days · about ${estimatePages(preview.firstChild)} printed pages.`;
  fitPreview(preview);
}

// Shrinks the page-sized preview to fit narrow screens, like a print preview. Printing ignores this.
function fitPreview(preview) {
  const paper = preview.firstChild;
  paper.style.transform = '';
  preview.style.height = '';
  const scale = Math.min(1, preview.clientWidth / paper.offsetWidth);
  if (scale < 1) {
    paper.style.transform = `scale(${scale})`;
    preview.style.height = `${paper.offsetHeight * scale}px`;
  }
}

function optionsCard(today, rerender, foodLogTooLong) {
  const preset = selectInput([
    { value: '7', label: 'Last 7 days' },
    { value: '14', label: 'Last 14 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
    { value: 'this-month', label: 'This month' },
    { value: 'last-month', label: 'Last month' },
    { value: 'month', label: 'Pick a month…' },
    { value: 'custom', label: 'Custom dates…' },
  ], options.preset);
  preset.addEventListener('change', () => { options.preset = preset.value; rerender(); });

  // Browsers without a month picker show a text box; YYYY-MM typed there works too.
  const month = h('input', { type: 'month', value: options.month, max: today.slice(0, 7), placeholder: 'YYYY-MM' });
  month.addEventListener('change', () => {
    if (/^\d{4}-\d{2}$/.test(month.value)) { options.month = month.value; rerender(); }
  });

  const from = h('input', { type: 'date', value: options.from, max: today });
  const to = h('input', { type: 'date', value: options.to, max: today });
  from.addEventListener('change', () => { options.from = from.value; rerender(); });
  to.addEventListener('change', () => { options.to = to.value; rerender(); });

  const boxes = SECTIONS.map((sec) => h('label', { class: 'check' },
    h('input', {
      type: 'checkbox', checked: options.sections[sec.key],
      onChange: (e) => { options.sections[sec.key] = e.target.checked; rerender(); },
    }),
    h('span', {}, sec.label)));

  return h('section', { class: 'card form-grid no-print' },
    field('Date range', preset),
    options.preset === 'month' && field('Month', month),
    options.preset === 'custom' && h('div', { class: 'input-row' }, field('From', from), field('To', to)),
    h('div', {}, h('span', { class: 'field-label' }, 'Include'), h('div', {}, boxes),
      h('small', { class: 'muted' }, 'Your profile, targets and a summary are always included.')),
    foodLogTooLong && h('p', { class: 'notice' },
      `The full food log is limited to ${MAX_FOOD_LOG_DAYS} days to keep the report a manageable length. It is left out of this report; choose ${MAX_FOOD_LOG_DAYS} days or fewer to include it.`));
}

// Printed page = 10 in of content height (US Letter with half-inch margins) at 96 px per inch.
// The on-screen preview adds 0.35 in of padding top and bottom, which doesn't print.
const PAGE_HEIGHT_PX = 960;
const PREVIEW_PADDING_PX = 2 * 0.35 * 96;
const estimatePages = (el) => Math.max(1, Math.ceil((el.scrollHeight - PREVIEW_PADDING_PX) / PAGE_HEIGHT_PX));

// ---- The report itself ----

function reportDocument(report, points, sections, breakdown) {
  const s = state.settings;
  const range = `${fmtDate(report.start, { month: 'short', day: 'numeric', year: 'numeric' })} – ${fmtDate(report.end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  return h('article', { class: 'report' },
    h('header', { class: 'report-head' },
      h('div', {},
        h('h1', {}, 'Food, Exercise & Weight Report'),
        h('p', {}, h('strong', {}, s.profile.name || 'Patient'), ` · ${range} (${report.summary.dayCount} days)`)),
      h('p', { class: 'report-meta' }, `Prepared ${fmtDate(todayStr(), { month: 'short', day: 'numeric', year: 'numeric' })}`)),
    h('p', { class: 'report-note' },
      'Self-reported data recorded in the Weight Tracker app. Calories burned and calculated targets are estimates.'),
    profileBlock(s, breakdown),
    summaryBlock(report, s),
    sections.weight && weightBlock(report, points, s),
    sections.daily && (report.summary.dayCount > DAILY_TABLE_MAX_DAYS ? weeklyBlock(report, s) : dailyBlock(report, s)),
    sections.workouts && workoutBlock(report),
    sections.food && foodBlock(report));
}

function profileBlock(s, breakdown) {
  const p = s.profile;
  const today = todayStr();
  const facts = [
    ['Age', p.birthDate ? `${ageOn(p.birthDate, today)}` : '–'],
    ['Sex', p.sex ? p.sex[0].toUpperCase() + p.sex.slice(1) : '–'],
    ['Height', p.heightCm ? fmtHeight(p.heightCm, s.units.length) : '–'],
    ['Goal weight', fmtWeight(p.goalWeightKg, s.units.weight)],
    ['Activity', ACTIVITY_LEVELS.find((a) => a.key === p.activity)?.label.split(' (')[0] ?? '–'],
  ];
  const targets = Object.entries(s.targets.values)
    .filter(([k]) => nutrientByKey(k))
    .map(([k, v]) => [nutrientByKey(k).label, fmtAmount(v, nutrientByKey(k).unit)]);
  if (s.water.targetMl) targets.push(['Water', `${fmt(volumeToDisplay(s.water.targetMl, s.units.volume))} ${volumeLabel(s.units.volume)}`]);
  // Resting and maintenance calories behind the calorie target (Mifflin-St Jeor).
  if (breakdown) {
    facts.push(['BMR (at rest)', `${fmt(breakdown.bmr)} kcal/day`]);
    facts.push(['Maintenance', `${fmt(breakdown.maintenance)} kcal/day (BMR × ${breakdown.activityFactor})`]);
  }
  return h('section', { class: 'report-section report-columns' },
    h('div', {}, h('h2', {}, 'Profile'), factList(facts),
      breakdown && h('p', { class: 'report-note' }, `BMR from the Mifflin-St Jeor equation at ${fmtWeight(breakdown.weightKg, s.units.weight)}.`)),
    h('div', {}, h('h2', {}, `Daily targets (${s.targets.mode === 'manual' ? 'entered by user' : 'calculated from BMR'})`), factList(targets)));
}

const factList = (rows) => h('dl', { class: 'fact-list' }, rows.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));

function fmtHeight(cm, unit) {
  if (unit === 'cm') return fmtLength(cm, 'cm', 0);
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)} ft ${inches % 12} in`;
}

function summaryBlock(report, s) {
  const sum = report.summary;
  const unit = s.units.weight;
  const avg = (k) => (sum.averages[k] == null ? '–' : fmtAmount(sum.averages[k], nutrientByKey(k).unit));
  const change = sum.weightChange == null ? '–' : `${sum.weightChange > 0 ? '+' : sum.weightChange < 0 ? '−' : ''}${fmtWeight(Math.abs(sum.weightChange), unit)}`;
  const rows = [
    ['Days with food logged', `${sum.daysLogged} of ${sum.dayCount}`],
    ['Average calories', `${avg('calories')}${s.targets.values.calories ? ` (target ${fmt(s.targets.values.calories)} + exercise)` : ''}`],
    sum.daysOnCalorieTarget != null && ['Days within 10% of calorie budget', `${sum.daysOnCalorieTarget} of ${sum.daysLogged}`],
    ['Average protein / carbs / fat', `${avg('protein')} / ${avg('carbs')} / ${avg('fat')}`],
    ['Average fiber / sugars / sodium', `${avg('fiber')} / ${avg('sugars')} / ${avg('sodium')}`],
    ['Average water', sum.averageWaterMl == null ? '–' : `${fmt(volumeToDisplay(sum.averageWaterMl, s.units.volume))} ${volumeLabel(s.units.volume)}`],
    ['Workouts', `${sum.workoutCount} · ${fmt(sum.workoutMinutes)} min · ${fmt(sum.workoutCalories)} kcal burned (est.)`],
    ['Weight (7-day average)', sum.weightStart == null ? 'No weigh-ins in this period' : `${fmtWeight(sum.weightStart, unit)} → ${fmtWeight(sum.weightEnd, unit)} (${change})`],
  ].filter(Boolean);
  return h('section', { class: 'report-section' },
    h('h2', {}, 'Summary'),
    h('p', { class: 'report-note' }, 'Food averages are per day, over days with food logged.'),
    factList(rows));
}

function weightBlock(report, points, s) {
  const unit = s.units.weight;
  const inRange = (p) => p.date >= report.start && p.date <= report.end;
  const shown = points.filter(inRange);
  const toDisplay = (list) => list.map((p) => ({ date: p.date, value: weightToDisplay(p.value, unit) }));
  return h('section', { class: 'report-section keep-together' },
    h('h2', {}, 'Weight'),
    shown.length >= 2
      ? lineChart({ points: toDisplay(shown), line: toDisplay(rollingAverage(points).filter(inRange)), label: `Weight in ${unit}` })
      : h('p', {}, shown.length ? 'Only one weigh-in in this period.' : 'No weigh-ins in this period.'),
    // Long ranges rely on the chart and the weekly table instead of listing every weigh-in.
    shown.length > 0 && report.summary.dayCount <= DAILY_TABLE_MAX_DAYS && h('ul', { class: 'weigh-in-grid' }, shown.map((p) =>
      h('li', {}, h('span', {}, fmtDate(p.date, { month: 'short', day: 'numeric' })), h('strong', {}, fmtWeight(p.value, unit))))));
}

function dailyBlock(report, s) {
  const unit = s.units.volume;
  const cols = REPORT_NUTRIENTS.filter((k) => k !== 'sugars');
  return h('section', { class: 'report-section' },
    h('h2', {}, 'Daily totals'),
    h('table', { class: 'report-table' },
      h('thead', {}, h('tr', {},
        h('th', {}, 'Date'),
        cols.map((k) => h('th', {}, `${shortLabel(k)} (${nutrientByKey(k).unit})`)),
        h('th', {}, `Water (${volumeLabel(unit)})`),
        h('th', {}, 'Exercise'),
        h('th', {}, `Weight (${s.units.weight})`))),
      h('tbody', {}, report.days.map((d) => h('tr', { class: d.logged ? '' : 'not-logged' },
        h('td', {}, fmtDate(d.date, { weekday: 'short', month: 'numeric', day: 'numeric' })),
        cols.map((k) => h('td', {}, d.logged ? fmt(d.totals[k] ?? 0) : '–')),
        h('td', {}, d.waterMl ? fmt(volumeToDisplay(d.waterMl, unit)) : '–'),
        h('td', {}, d.minutes ? `${fmt(d.minutes)} min` : '–'),
        h('td', {}, d.weightKg ? fmt(weightToDisplay(d.weightKg, s.units.weight), 1) : '–'))))),
    h('p', { class: 'report-note' }, '“–” in the food columns means nothing was logged that day.'));
}

function weeklyBlock(report, s) {
  const unit = s.units.volume;
  const cols = REPORT_NUTRIENTS.filter((k) => k !== 'sugars');
  const short = (d) => fmtDate(d, { month: 'numeric', day: 'numeric' });
  return h('section', { class: 'report-section' },
    h('h2', {}, 'Weekly averages'),
    h('table', { class: 'report-table' },
      h('thead', {}, h('tr', {},
        h('th', {}, 'Week'),
        h('th', {}, 'Days logged'),
        cols.map((k) => h('th', {}, `${shortLabel(k)} (${nutrientByKey(k).unit})`)),
        h('th', {}, `Water (${volumeLabel(unit)})`),
        h('th', {}, 'Exercise'),
        h('th', {}, `Avg weight (${s.units.weight})`))),
      h('tbody', {}, report.weekly.map((w) => h('tr', { class: w.daysLogged ? '' : 'not-logged' },
        h('td', {}, `${short(w.start)}–${short(w.end)}`),
        h('td', {}, `${w.daysLogged}/${w.dayCount}`),
        cols.map((k) => h('td', {}, w.averages[k] == null ? '–' : fmt(w.averages[k]))),
        h('td', {}, w.averageWaterMl ? fmt(volumeToDisplay(w.averageWaterMl, unit)) : '–'),
        h('td', {}, w.workoutMinutes ? `${fmt(w.workoutMinutes)} min` : '–'),
        h('td', {}, w.averageWeightKg ? fmt(weightToDisplay(w.averageWeightKg, s.units.weight), 1) : '–'))))),
    h('p', { class: 'report-note' }, 'Food and water are daily averages over the days logged that week. Exercise is the week’s total.'));
}

const SHORT = { calories: 'Cal', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', fiber: 'Fiber', sodium: 'Sodium' };
const shortLabel = (k) => SHORT[k] ?? nutrientByKey(k).label;

function workoutBlock(report) {
  const rows = report.days.flatMap((d) => d.workouts.map((w) => ({ ...w, date: d.date })));
  if (rows.length && report.summary.dayCount > DAILY_TABLE_MAX_DAYS) return workoutSummaryBlock(rows);
  return h('section', { class: 'report-section' },
    h('h2', {}, 'Workouts'),
    rows.length
      ? h('table', { class: 'report-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Activity'), h('th', {}, 'Minutes'), h('th', {}, 'Calories (est.)'), h('th', {}, 'Notes'))),
        h('tbody', {}, rows.map((w) => h('tr', {},
          h('td', {}, fmtDate(w.date, { weekday: 'short', month: 'numeric', day: 'numeric' })),
          h('td', { class: 'text' }, w.name),
          h('td', {}, fmt(w.minutes)),
          h('td', {}, fmt(w.calories)),
          h('td', { class: 'text' }, w.notes ?? '')))))
      : h('p', {}, 'No workouts logged in this period.'));
}

// Long ranges: one row per activity instead of one per session.
function workoutSummaryBlock(rows) {
  const byActivity = new Map();
  for (const w of rows) {
    const a = byActivity.get(w.name) ?? { name: w.name, sessions: 0, minutes: 0, calories: 0 };
    a.sessions += 1;
    a.minutes += w.minutes ?? 0;
    a.calories += w.calories ?? 0;
    byActivity.set(w.name, a);
  }
  const activities = [...byActivity.values()].sort((a, b) => b.minutes - a.minutes);
  return h('section', { class: 'report-section' },
    h('h2', {}, 'Workouts by activity'),
    h('table', { class: 'report-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Activity'), h('th', {}, 'Sessions'), h('th', {}, 'Total minutes'), h('th', {}, 'Avg minutes'), h('th', {}, 'Calories (est.)'))),
      h('tbody', {}, activities.map((a) => h('tr', {},
        h('td', { class: 'text' }, a.name),
        h('td', {}, fmt(a.sessions)),
        h('td', {}, fmt(a.minutes)),
        h('td', {}, fmt(a.minutes / a.sessions)),
        h('td', {}, fmt(a.calories)))))),
    h('p', { class: 'report-note' }, `Summarized by activity for ranges over ${DAILY_TABLE_MAX_DAYS} days. Choose ${DAILY_TABLE_MAX_DAYS} days or fewer to list each workout.`));
}

const MEAL_LABEL =Object.fromEntries(MEALS.map((m) => [m.key, m.label]));

function foodBlock(report) {
  const days = report.days.filter((d) => d.logged);
  return h('section', { class: 'report-section' },
    h('h2', {}, 'Food log'),
    days.length === 0 && h('p', {}, 'No food logged in this period.'),
    days.map((d) => h('div', { class: 'food-day' },
      h('h3', {}, `${fmtDate(d.date, { weekday: 'long', month: 'short', day: 'numeric' })} · ${fmt(d.totals.calories ?? 0)} kcal`),
      h('table', { class: 'report-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Meal'), h('th', {}, 'Food'), h('th', {}, 'Amount'), h('th', {}, 'Cal'), h('th', {}, 'P'), h('th', {}, 'C'), h('th', {}, 'F'))),
        h('tbody', {}, d.entries.map((e) => {
          const n = entryNutrients(e);
          return h('tr', {},
            h('td', { class: 'text' }, MEAL_LABEL[e.meal] ?? ''),
            h('td', { class: 'text' }, e.kind === 'recipe' ? `${e.name} (recipe)` : [e.name, e.brand].filter(Boolean).join(', ')),
            h('td', { class: 'text' }, entryAmountText(e)),
            h('td', {}, fmt(entryCalories(e))),
            h('td', {}, fmt(n.protein ?? 0)),
            h('td', {}, fmt(n.carbs ?? 0)),
            h('td', {}, fmt(n.fat ?? 0)));
        }))))));
}
