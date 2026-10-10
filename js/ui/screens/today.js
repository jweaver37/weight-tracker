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
import { addRecipeToDay, openRecipeEntry } from '../recipeLog.js';
import { ingredientShare } from '../../core/recipes.js';

let currentDate = todayStr();

export async function renderToday(view) {
  const s = state.settings;
  const [entries, customFields] = await Promise.all([repo.listForDate('logEntries', currentDate), repo.listAll('customFields')]);
  entries.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const totals = sumEntries(entries);
  const meals = groupByMeal(entries);
  const rerender = () => renderToday(view);

  const actions = {
    addFood: async (meal) => { if (await openFoodEntry({ date: currentDate, meal, customFields })) rerender(); },
    addRecipe: async (meal) => { if (await addRecipeToDay({ date: currentDate, meal })) rerender(); },
    edit: async (entry) => {
      const result = entry.kind === 'recipe'
        ? await openRecipeEntry({ entry, customFields })
        : await openFoodEntry({ entry, date: currentDate, customFields });
      if (result) rerender();
    },
    toggle: (entry) => {
      if (expanded.has(entry.id)) expanded.delete(entry.id);
      else expanded.add(entry.id);
      rerender();
    },
  };

  mount(view,
    dateNav(rerender),
    backupBanner(s, rerender),
    calorieCard(totals.nutrients.calories ?? 0, s.targets.values.calories),
    nutrientCard(totals, s, customFields),
    MEALS.map((m) => mealSection(m, meals[m.key], actions)),
  );
}

// Logged recipes whose ingredient list is shown.
const expanded = new Set();

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

function mealSection(meal, entries, actions) {
  const kcal = entries.reduce((sum, e) => sum + entryCalories(e), 0);
  return h('section', { class: 'card meal' },
    h('div', { class: 'meal-head' },
      h('h2', {}, meal.label),
      h('span', { class: 'muted' }, entries.length ? `${fmt(kcal)} kcal` : '')),
    entries.length > 0 && h('ul', { class: 'entry-list' }, entries.map((e) => entryItem(e, actions))),
    h('div', { class: 'meal-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => actions.addFood(meal.key) }, '+ Food'),
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => actions.addRecipe(meal.key) }, '+ Recipe')));
}

function entryItem(e, actions) {
  const isRecipe = e.kind === 'recipe';
  const open = isRecipe && expanded.has(e.id);
  const details = isRecipe ? ['Recipe', entryAmountText(e)] : [e.brand, entryAmountText(e)];
  return h('li', {},
    h('div', { class: 'entry-row' },
      isRecipe && h('button', {
        class: `icon-btn small expand ${open ? 'open' : ''}`, type: 'button',
        'aria-expanded': String(open), 'aria-label': `${open ? 'Hide' : 'Show'} ingredients of ${e.name}`,
        onClick: () => actions.toggle(e),
      }, '›'),
      h('button', { class: 'entry', type: 'button', onClick: () => actions.edit(e) },
        h('span', { class: 'entry-main' },
          h('span', { class: 'entry-name' }, e.name),
          h('small', { class: 'muted' }, details.filter(Boolean).join(' · '))),
        h('span', { class: 'entry-kcal' }, fmt(entryCalories(e))))),
    open && h('ul', { class: 'ingredient-breakdown' }, (e.ingredients ?? []).map((ing) =>
      h('li', {},
        h('span', {}, ing.name),
        h('span', { class: 'muted' }, `${fmt(ingredientShare(ing, e.servings, e.recipeYield).nutrients.calories ?? 0)} kcal`)))));
}
