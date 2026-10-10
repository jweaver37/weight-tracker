// Today: the day's food log by meal, with calorie and nutrient totals against targets.
import { h, mount, showDialog } from '../dom.js';
import { state } from '../state.js';
import * as repo from '../../data/repo.js';
import { addDays, todayStr } from '../../core/dates.js';
import { MEALS, groupByMeal, sumEntries, waterMl } from '../../core/nutrition.js';
import { volumeFromDisplay, volumeLabel, volumeToDisplay } from '../../core/units.js';
import { field, numberInput, readNumber } from '../fields.js';
import { nutrientByKey } from '../../core/nutrients.js';
import { targetKind } from '../../core/targets.js';
import { backupDaysOverdue } from '../../core/settings.js';
import { fmt, fmtAmount, fmtDate } from '../format.js';
import { entryAmountText, entryCalories, openFoodEntry } from '../foodEntry.js';
import { exportBackup } from '../backupActions.js';
import { addRecipeToDay, openRecipeEntry } from '../recipeLog.js';
import { ingredientShare } from '../../core/recipes.js';
import { totalBurned } from '../../core/workouts.js';
import { openWorkoutEntry } from '../workoutEntry.js';
import { checkMilestones } from '../milestones.js';

let currentDate = todayStr();

export async function renderToday(view) {
  const s = state.settings;
  const [entries, customFields, workouts, waterRecords] = await Promise.all([
    repo.listForDate('logEntries', currentDate),
    repo.listAll('customFields'),
    repo.listForDate('workouts', currentDate),
    repo.listForDate('water', currentDate),
  ]);
  const byCreated = (a, b) => (a.createdAt < b.createdAt ? -1 : 1);
  entries.sort(byCreated);
  workouts.sort(byCreated);
  const totals = sumEntries(entries);
  const meals = groupByMeal(entries);
  const rerender = () => renderToday(view);

  // Plain water is one running tally per day; drinks add their own volume on top.
  const plainWater = waterRecords[0] ?? { date: currentDate, ml: 0 };
  const water = { plainMl: plainWater.ml, totalMl: waterMl(entries, plainWater.ml), targetMl: s.water.targetMl };
  const changeWater = async (deltaMl) => {
    await repo.save('water', { ...plainWater, ml: Math.max(0, plainWater.ml + deltaMl) });
    rerender();
  };

  const actions = {
    addFood: async (meal) => { if (await openFoodEntry({ date: currentDate, meal, customFields })) rerender(); },
    addRecipe: async (meal) => { if (await addRecipeToDay({ date: currentDate, meal })) rerender(); },
    edit: async (entry) => {
      const result = entry.kind === 'recipe'
        ? await openRecipeEntry({ entry, customFields })
        : await openFoodEntry({ entry, date: currentDate, customFields });
      if (result) rerender();
    },
    addWater: (ml) => changeWater(ml),
    customWater: async () => {
      const ml = await askWaterAmount(s.units.volume);
      if (ml) changeWater(ml);
    },
    workout: async (workout) => { if (await openWorkoutEntry({ entry: workout, date: currentDate })) rerender(); },
    toggle: (entry) => {
      if (expanded.has(entry.id)) expanded.delete(entry.id);
      else expanded.add(entry.id);
      rerender();
    },
  };

  mount(view,
    dateNav(rerender),
    backupBanner(s, rerender),
    calorieCard(totals.nutrients.calories ?? 0, s.targets.values.calories, totalBurned(workouts)),
    nutrientCard(totals, s, customFields, water),
    MEALS.map((m) => mealSection(m, meals[m.key], actions, m.key === 'drinks' && waterTracker(water, s.units.volume, actions))),
    workoutSection(workouts, actions),
  );
  checkMilestones();
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

// Logged exercise adds to the day's budget: target + exercise − eaten = remaining.
function calorieCard(eaten, target, burned) {
  if (!target) {
    return h('section', { class: 'card calorie-card' },
      h('div', { class: 'big-number' }, fmt(eaten)), h('div', { class: 'muted' }, 'kcal eaten · set a target in Settings'));
  }
  const budget = target + burned;
  const remaining = budget - eaten;
  return h('section', { class: 'card calorie-card' },
    h('div', { class: 'calorie-equation' },
      stat(fmt(target), 'Target'),
      burned > 0 && [h('span', { class: 'op' }, '+'), stat(fmt(burned), 'Exercise')],
      h('span', { class: 'op' }, '−'),
      stat(fmt(eaten), 'Eaten'), h('span', { class: 'op' }, '='),
      stat(fmt(Math.abs(remaining)), remaining >= 0 ? 'Remaining' : 'Over', remaining < 0 ? 'over' : 'ok')),
    progressBar(eaten, budget, 'goal'));
}

function workoutSection(workouts, actions) {
  const burned = totalBurned(workouts);
  return h('section', { class: 'card meal' },
    h('div', { class: 'meal-head' },
      h('h2', {}, 'Workouts'),
      h('span', { class: 'muted' }, workouts.length ? `${fmt(burned)} kcal burned` : '')),
    workouts.length > 0 && h('ul', { class: 'entry-list' }, workouts.map((w) => h('li', {},
      h('button', { class: 'entry', type: 'button', onClick: () => actions.workout(w) },
        h('span', { class: 'entry-main' },
          h('span', { class: 'entry-name' }, w.name),
          h('small', { class: 'muted' }, [`${fmt(w.minutes)} min`, w.notes].filter(Boolean).join(' · '))),
        h('span', { class: 'entry-kcal burn' }, `−${fmt(w.calories)}`))))),
    h('button', { class: 'btn btn-ghost btn-block', type: 'button', onClick: () => actions.workout() }, '+ Workout'));
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

function nutrientCard(totals, s, customFields, water) {
  const rows = s.visibleNutrients
    .filter((key) => key !== 'calories')
    .map((key) => nutrientByKey(key))
    .filter(Boolean)
    .map((n) => nutrientRow(n.label, totals.nutrients[n.key] ?? 0, s.targets.values[n.key], n.unit, targetKind(n.key)));
  const custom = customFields
    .filter((f) => f.visible !== false)
    .map((f) => nutrientRow(f.name, totals.custom[f.id] ?? 0, null, f.unit, 'goal'));
  const unit = s.units.volume;
  const waterRow = nutrientRow('Water', volumeToDisplay(water.totalMl, unit), water.targetMl && volumeToDisplay(water.targetMl, unit), volumeLabel(unit), 'min');
  return h('section', { class: 'card' }, h('div', { class: 'nutrient-totals' }, rows, waterRow, custom));
}

// Quick-add glass sizes in the user's drink unit.
const GLASSES = { floz: [8, 16], ml: [250, 500] };

function waterTracker(water, unit, actions) {
  const [small, large] = GLASSES[unit] ?? GLASSES.floz;
  const label = volumeLabel(unit);
  const fromDrinks = water.totalMl - water.plainMl;
  const target = water.targetMl ? volumeToDisplay(water.targetMl, unit) : null;
  const total = volumeToDisplay(water.totalMl, unit);
  return h('div', { class: 'water' },
    h('div', { class: 'nutrient-total-head' },
      h('strong', {}, 'Water'),
      h('span', { class: 'muted' }, target ? `${fmt(total)} / ${fmt(target)} ${label}` : `${fmt(total)} ${label}`)),
    target && progressBar(total, target, 'min'),
    h('div', { class: 'water-actions' },
      h('button', {
        class: 'btn', type: 'button', disabled: water.plainMl <= 0, 'aria-label': `Remove ${small} ${label} of water`,
        onClick: () => actions.addWater(-Math.min(water.plainMl, volumeFromDisplay(small, unit))),
      }, '−'),
      h('button', { class: 'btn', type: 'button', onClick: () => actions.addWater(volumeFromDisplay(small, unit)) }, `+${small} ${label}`),
      h('button', { class: 'btn', type: 'button', onClick: () => actions.addWater(volumeFromDisplay(large, unit)) }, `+${large} ${label}`),
      h('button', { class: 'btn', type: 'button', onClick: actions.customWater }, 'Custom')),
    fromDrinks > 0 && h('small', { class: 'muted' }, `Includes ${fmt(volumeToDisplay(fromDrinks, unit))} ${label} from drinks below.`));
}

// Resolves an amount of water in ml, or undefined.
function askWaterAmount(unit) {
  const input = numberInput('', { 'aria-label': 'Amount of water' });
  return showDialog((close) => {
    const add = (ev) => {
      ev.preventDefault();
      const { value } = readNumber(input);
      if (!value || value <= 0) { input.classList.add('invalid'); return; }
      close(volumeFromDisplay(value, unit));
    };
    setTimeout(() => input.focus(), 0);
    return h('form', { class: 'dialog-body', onSubmit: add },
      h('h2', {}, 'Add water'),
      field('Amount', h('div', { class: 'input-unit' }, input, h('span', {}, volumeLabel(unit)))),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel'),
        h('button', { class: 'btn btn-primary', type: 'submit' }, 'Add')));
  });
}

function nutrientRow(label, value, target, unit, kind) {
  const prefix = kind === 'max' ? 'limit ' : kind === 'min' ? 'at least ' : '';
  return h('div', { class: 'nutrient-total' },
    h('div', { class: 'nutrient-total-head' },
      h('span', {}, label),
      h('span', { class: 'muted' }, target ? `${fmtAmount(value, unit)} / ${prefix}${fmtAmount(target, unit)}` : fmtAmount(value, unit))),
    target ? progressBar(value, target, kind) : null);
}

function mealSection(meal, entries, actions, extra) {
  const kcal = entries.reduce((sum, e) => sum + entryCalories(e), 0);
  return h('section', { class: 'card meal' },
    h('div', { class: 'meal-head' },
      h('h2', {}, meal.label),
      h('span', { class: 'muted' }, entries.length ? `${fmt(kcal)} kcal` : '')),
    extra,
    entries.length > 0 && h('ul', { class: 'entry-list' }, entries.map((e) => entryItem(e, actions))),
    h('div', { class: 'meal-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => actions.addFood(meal.key) }, meal.key === 'drinks' ? '+ Drink' : '+ Food'),
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
