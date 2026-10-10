// Add / edit a workout on a day.
import { confirmDialog, h, infoDialog, showDialog } from './dom.js';
import { field, numberInput, readNumber } from './fields.js';
import * as repo from '../data/repo.js';
import { STARTER_ACTIVITIES, caloriesBurned, customRef, findActivity, starterRef } from '../core/workouts.js';
import { currentValue } from '../core/trends.js';
import { parseAmount } from '../core/nutrition.js';
import { fmt, fmtWeight, inputNumber } from './format.js';
import { weightPoints } from './targetsFlow.js';
import { state } from './state.js';

const NEW_ACTIVITY = '__new';

// Body weight used for a workout: the 7-day average as of that date, else the nearest weigh-in.
async function weightOn(date) {
  const points = await weightPoints();
  return currentValue(points, date) ?? points[0]?.value ?? null;
}

// Resolves 'saved', 'deleted' or undefined.
export async function openWorkoutEntry({ entry, date }) {
  const customActivities = (await repo.listAll('activities')).sort((a, b) => a.name.localeCompare(b.name));
  const weightKg = await weightOn(entry?.date ?? date);
  const unit = state.settings.units.weight;

  if (!weightKg) {
    await infoDialog('Calories burned are based on your body weight. Log a weigh-in on the Weight tab first.', { title: 'Weight needed' });
    return undefined;
  }

  // A workout whose custom activity was later deleted still shows under its saved name.
  const missingRef = entry && !findActivity(entry.activityRef, customActivities);
  const activity = h('select', { 'aria-label': 'Activity' },
    missingRef && h('option', { value: entry.activityRef }, `${entry.name} (MET ${entry.met})`),
    customActivities.length > 0 && h('optgroup', { label: 'My activities' },
      customActivities.map((a) => h('option', { value: customRef(a.id) }, `${a.name} (MET ${a.met})`))),
    groupBy(STARTER_ACTIVITIES, 'category').map(([category, list]) =>
      h('optgroup', { label: category }, list.map((a) => h('option', { value: starterRef(a.key) }, a.name)))),
    h('option', { value: NEW_ACTIVITY }, '+ Add your own activity…'));
  activity.value = entry?.activityRef ?? starterRef('walk-moderate');

  const newName = h('input', { type: 'text', placeholder: 'e.g. Kayaking' });
  const newMet = numberInput('', { placeholder: 'e.g. 5' });
  const newActivity = h('div', { class: 'form-grid sub-form' },
    field('Activity name', newName),
    field('MET value', newMet, 'How hard it is compared with sitting still (1). Walking is about 3.5, running about 10. The Compendium of Physical Activities lists most activities.'));

  const minutes = numberInput(inputNumber(entry?.minutes, 1), { inputmode: 'numeric', placeholder: '30' });
  const notes = h('input', { type: 'text', value: entry?.notes ?? '', placeholder: 'Optional' });
  const preview = h('p', { class: 'entry-preview' });
  const errorBox = h('div', { class: 'errors', role: 'alert' });

  const selectedMet = () => {
    if (activity.value === NEW_ACTIVITY) return parseAmount(newMet.value.trim());
    if (missingRef && activity.value === entry.activityRef) return entry.met;
    return findActivity(activity.value, customActivities)?.met ?? null;
  };
  const update = () => {
    newActivity.hidden = activity.value !== NEW_ACTIVITY;
    const met = selectedMet();
    const mins = parseAmount(minutes.value.trim());
    preview.textContent = met && mins
      ? `≈ ${fmt(caloriesBurned(met, weightKg, mins))} kcal burned above resting: (${fmt(met, 1)} MET − 1 resting) × ${fmtWeight(weightKg, unit)} × ${fmt(mins)} min`
      : `Based on your weight of ${fmtWeight(weightKg, unit)}.`;
  };
  update();

  return showDialog((close) => {
    const save = async (ev) => {
      ev.preventDefault();
      const errors = [];
      const mins = readNumber(minutes).value;
      if (!mins || mins <= 0) errors.push('Enter how many minutes.');
      let chosen;
      if (activity.value === NEW_ACTIVITY) {
        const met = readNumber(newMet).value;
        if (!newName.value.trim()) errors.push('Name your activity.');
        if (!met || met <= 1 || met > 25) errors.push('MET must be a number above 1 and up to 25.');
        if (!errors.length) {
          const saved = await repo.save('activities', { name: newName.value.trim(), met });
          chosen = { ref: customRef(saved.id), name: saved.name, met: saved.met };
        }
      } else if (missingRef && activity.value === entry.activityRef) {
        chosen = { ref: entry.activityRef, name: entry.name, met: entry.met };
      } else {
        chosen = findActivity(activity.value, customActivities);
      }
      if (errors.length) {
        errorBox.replaceChildren(...errors.map((e) => h('p', {}, e)));
        return;
      }
      await repo.save('workouts', {
        ...entry,
        date: entry?.date ?? date,
        activityRef: chosen.ref,
        name: chosen.name,
        met: chosen.met,
        minutes: mins,
        weightKg,
        calories: Math.round(caloriesBurned(chosen.met, weightKg, mins)),
        notes: notes.value.trim() || null,
      });
      close('saved');
    };
    const remove = async () => {
      if (await confirmDialog(`Delete “${entry.name}” from this day?`, { okLabel: 'Delete', danger: true })) {
        await repo.remove('workouts', entry.id);
        close('deleted');
      }
    };
    return h('form', { class: 'dialog-body', onSubmit: save, onInput: update, onChange: update },
      h('h2', {}, entry ? 'Edit workout' : 'Add workout'),
      field('Activity', activity),
      newActivity,
      field('Minutes', minutes),
      field('Notes', notes),
      preview,
      errorBox,
      h('div', { class: 'dialog-actions' },
        entry && h('button', { class: 'btn btn-danger btn-left', type: 'button', onClick: remove }, 'Delete'),
        h('button', { class: 'btn', type: 'button', onClick: () => close() }, 'Cancel'),
        h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save')));
  });
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item[key])) groups.set(item[key], []);
    groups.get(item[key]).push(item);
  }
  return [...groups];
}
