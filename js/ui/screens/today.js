// Today: the day's food log by meal, with calorie and nutrient totals against targets.
import { h, mount } from '../dom.js';
import { state } from '../state.js';
import * as repo from '../../data/repo.js';
import { addDays, todayStr } from '../../core/dates.js';
import { MEALS, groupByMeal, sumEntries } from '../../core/nutrition.js';
import { nutrientByKey } from '../../core/nutrients.js';
import { targetKind } from '../../core/targets.js';
import { backupDaysOverdue } from '../../core/settings.js';
import { fmt, fmtAmount, fmtDate } from '../format.js';
import { entryAmountText, entryCalories, openFoodEntry } from '../foodEntry.js';
import { exportBackup } from '../backupActions.js';

let currentDate = todayStr();

export async function renderToday(view) {
  const s = state.settings;
  const [entries, customFields] = await Promise.all([repo.listForDate('logEntries', currentDate), repo.listAll('customFields')]);
  entries.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const totals = sumEntries(entries);
  const meals = groupByMeal(entries);
  const rerender = () => renderToday(view);

  const addFood = async (meal, entry) => {
    const result = await openFoodEntry({ entry, date: currentDate, meal, customFields });
    if (result) rerender();
  };

  mount(view, 
    dateNav(rerender),
    backupBanner(s, rerender),
    calorieCard(totals.nutrients.calories ?? 0, s.targets.values.calories),
    nutrientCard(totals, s, customFields),
    MEALS.map((m) => mealSection(m, meals[m.key], addFood)),
  );
}

function dateNav(rerender) {
  const isToday = currentDate === todayStr();
  const go = (days) => { currentDate = addDays(currentDate, days); rerender(); };
  return h('header', { class: 'date-nav' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous day', onClick: () => go(-1) }, '‹'),
    h('div', { class: 'date-title' },
      h('h1', {}, isToday ? 'Today' : fmtDate(currentDate, { weekday: 'long' })),
      h('span', { class: 'muted' }, fmtDate(currentDate, { month: 'long', day: 'numeric', year: 'numeric' }))),
    isToday
      ? h('span', { class: 'icon-btn placeholder' })
      : h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next day', onClick: () => go(1) }, '›'),
    !isToday && h('button', { class: 'chip', type: 'button', onClick: () => { currentDate = todayStr(); rerender(); } }, 'Back to today'));
}

function backupBanner(s, rerender) {
  const days = backupDaysOverdue(s);
  if (!days) return null;
  return h('div', { class: 'banner' },
    h('span', {}, s.lastBackupAt ? `It’s been ${days} days since your last backup.` : 'You haven’t backed up your data yet.'),
    h('button', { class: 'btn btn-small', type: 'button', onClick: async () => { await exportBackup(); rerender(); } }, 'Back up now'));
}

function calorieCard(eaten, target) {
  if (!target) {
    return h('section', { class: 'card calorie-card' },
      h('div', { class: 'big-number' }, fmt(eaten)), h('div', { class: 'muted' }, 'kcal eaten · set a target in Settings'));
  }
  const remaining = target - eaten;
  return h('section', { class: 'card calorie-card' },
    h('div', { class: 'calorie-equation' },
      stat(fmt(target), 'Target'), h('span', { class: 'op' }, '−'),
      stat(fmt(eaten), 'Eaten'), h('span', { class: 'op' }, '='),
      stat(fmt(Math.abs(remaining)), remaining >= 0 ? 'Remaining' : 'Over', remaining < 0 ? 'over' : 'ok')),
    progressBar(eaten, target, 'goal'));
}

const stat = (value, label, tone) =>
  h('div', { class: `stat ${tone ? `stat-${tone}` : ''}` }, h('strong', {}, value), h('small', {}, label));

function progressBar(value, target, kind) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = value > target;
  const tone = kind === 'min' ? (value >= target ? 'good' : '') : over ? 'warn' : '';
  return h('div', { class: `bar ${tone}`, role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('div', { class: 'bar-fill', style: `width:${pct}%` }));
}

function nutrientCard(totals, s, customFields) {
  const rows = s.visibleNutrients
    .filter((key) => key !== 'calories')
    .map((key) => nutrientByKey(key))
    .filter(Boolean)
    .map((n) => nutrientRow(n.label, totals.nutrients[n.key] ?? 0, s.targets.values[n.key], n.unit, targetKind(n.key)));
  const custom = customFields
    .filter((f) => f.visible !== false)
    .map((f) => nutrientRow(f.name, totals.custom[f.id] ?? 0, null, f.unit, 'goal'));
  if (!rows.length && !custom.length) return null;
  return h('section', { class: 'card' }, h('div', { class: 'nutrient-totals' }, rows, custom));
}

function nutrientRow(label, value, target, unit, kind) {
  const prefix = kind === 'max' ? 'limit ' : kind === 'min' ? 'at least ' : '';
  return h('div', { class: 'nutrient-total' },
    h('div', { class: 'nutrient-total-head' },
      h('span', {}, label),
      h('span', { class: 'muted' }, target ? `${fmtAmount(value, unit)} / ${prefix}${fmtAmount(target, unit)}` : fmtAmount(value, unit))),
    target ? progressBar(value, target, kind) : null);
}

function mealSection(meal, entries, addFood) {
  const kcal = entries.reduce((sum, e) => sum + entryCalories(e), 0);
  return h('section', { class: 'card meal' },
    h('div', { class: 'meal-head' },
      h('h2', {}, meal.label),
      h('span', { class: 'muted' }, entries.length ? `${fmt(kcal)} kcal` : '')),
    entries.length > 0 && h('ul', { class: 'entry-list' },
      entries.map((e) => h('li', {},
        h('button', { class: 'entry', type: 'button', onClick: () => addFood(meal.key, e) },
          h('span', { class: 'entry-main' }, h('span', { class: 'entry-name' }, e.name), h('small', { class: 'muted' }, [e.brand, entryAmountText(e)].filter(Boolean).join(' · '))),
          h('span', { class: 'entry-kcal' }, fmt(entryCalories(e))))))),
    h('button', { class: 'btn btn-ghost btn-block', type: 'button', onClick: () => addFood(meal.key) }, `+ Add to ${meal.label.toLowerCase()}`));
}
