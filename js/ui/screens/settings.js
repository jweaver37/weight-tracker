// Settings: profile, targets, nutrients shown, custom fields, backup and the health disclaimer.
import { confirmDialog, h, toast, mount } from '../dom.js';
import { state, saveSettings } from '../state.js';
import * as repo from '../../data/repo.js';
import { CUSTOM_FIELD_UNITS, NUTRIENTS, nutrientByKey } from '../../core/nutrients.js';
import { canCalculate, CALCULATED_KEYS } from '../../core/targets.js';
import { field, numberInput, presetPicker, readNumber, selectInput } from '../fields.js';
import { profileForm, targetsForm } from '../profileForm.js';
import { energyBreakdown, recalculateTargets, showTargetChange, weightPoints } from '../targetsFlow.js';
import { exportBackup, importBackup } from '../backupActions.js';
import { DISCLAIMER_TEXT, DISCLAIMER_TITLE } from '../disclaimer.js';
import { fmt, fmtAmount, fmtDate, fmtWeight } from '../format.js';
import { roundTo, volumeFromDisplay, volumeLabel, volumeToDisplay, weightFromDisplay, weightToDisplay } from '../../core/units.js';
import { checkMilestones } from '../milestones.js';
import { looksLikeApiKey } from '../../data/usda.js';

// `focus` scrolls to a section, e.g. #/settings/bmr from the Today screen.
export async function renderSettings(view, { onDataReplaced, focus }) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const [customFields, activities, points, breakdown] = await Promise.all([
    repo.listAll('customFields'), repo.listAll('activities'), weightPoints(), energyBreakdown(),
  ]);
  customFields.sort(byName);
  activities.sort(byName);
  const rerender = () => renderSettings(view, { onDataReplaced });
  mount(view,
    h('header', { class: 'page-head' }, h('h1', {}, 'Settings')),
    profileSection(rerender, breakdown),
    waterSection(),
    goalsSection(points[0]),
    nutrientsSection(),
    customFieldsSection(customFields, rerender),
    activitiesSection(activities, rerender),
    foodDatabaseSection(rerender),
    backupSection(rerender, onDataReplaced),
    disclaimerSection(),
  );
  // After the router's scroll-to-top.
  if (focus) setTimeout(() => document.getElementById(focus)?.scrollIntoView({ block: 'start' }), 0);
}

function profileSection(rerender, breakdown) {
  const s = state.settings;
  const profile = profileForm(s);
  const targets = targetsForm(s, { weightUnit: profile.weightUnit, advanced: true });
  profile.el.addEventListener('change', (e) => {
    if (e.target.tagName === 'SELECT') targets.refreshUnits();
  });
  const errorBox = h('div', { class: 'errors', role: 'alert' });

  const save = async (ev) => {
    ev.preventDefault();
    const { units, profile: p } = profile.read();
    const { targets: t, errors } = targets.read();
    if (t.mode === 'calculated' && !canCalculate(p)) errors.unshift('Calculated targets need your sex, birth date and height.');
    if (errors.length) {
      errorBox.replaceChildren(...errors.map((e) => h('p', {}, e)));
      return;
    }
    errorBox.replaceChildren();
    const before = s.targets.values;
    // Start from the latest settings: other sections on this page save on their own.
    await saveSettings({ ...state.settings, units, profile: p, targets: t });
    if (t.mode === 'calculated') {
      const change = await recalculateTargets();
      if (change && CALCULATED_KEYS.some((k) => change.newValues[k] !== before[k])) {
        await showTargetChange(change, 'Your profile changed, so your targets were recalculated.');
      }
    }
    toast('Settings saved');
    rerender();
  };

  return h('form', { class: 'card', onSubmit: save },
    h('h2', {}, 'Profile'),
    profile.el,
    h('h2', { id: 'bmr' }, 'Daily targets'),
    calorieBreakdown(s, breakdown),
    currentTargets(s),
    targets.el,
    errorBox,
    h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Save profile & targets'));
}

// How the calorie target is reached: BMR × activity = maintenance, minus the weight-loss deficit.
function calorieBreakdown(s, b) {
  if (!b) {
    return h('p', { class: 'notice' }, 'Add your sex, birth date and height below (and a weigh-in) to see your BMR — the calories your body burns at rest — and how your calorie target is worked out.');
  }
  const kcal = (v) => `${fmt(v)} kcal`;
  const step = (label, value, note, cls = '') => h('li', { class: cls },
    h('div', { class: 'breakdown-row' }, h('span', {}, label), h('strong', {}, value)),
    note && h('small', { class: 'muted' }, note));
  const manual = s.targets.mode === 'manual';
  const target = s.targets.values.calories;
  const unit = s.units.weight;
  const weight = fmtWeight(b.weightKg, unit);
  const pace = fmtWeight(s.targets.lossRateKgPerWeek, unit, unit === 'kg' ? 2 : 1);
  return h('section', { class: 'breakdown', 'aria-label': 'How your calorie target is calculated' },
    h('h3', {}, 'How your calorie target is calculated'),
    h('ol', {},
      step('BMR (basal metabolic rate)', kcal(b.bmr),
        `Calories your body burns at complete rest. Mifflin-St Jeor formula, using your weight (${weight}), height, age and sex.`),
      step(`× Activity level (${b.activityFactor})`, `= ${kcal(b.maintenance)}`,
        `Maintenance: about what you burn on a normal day without logged workouts (${b.activityLabel.split(' (')[0].toLowerCase()}). Eating this much keeps your weight steady.`),
      manual
        ? step('Your target', target ? kcal(target) : '–', 'You entered your own targets, so the steps above are for reference only.', 'total')
        : [
          step(`− Weight-loss pace (${pace} a week)`, `− ${kcal(b.deficit)}`, 'A pound of body weight is about 3,500 kcal (7,700 per kg), spread over the 7 days.'),
          step('= Daily calorie target', kcal(b.values.calories),
            b.floorApplied
              ? `Raised to your minimum of ${kcal(b.floor)} — calories are never set lower than that.`
              : 'Calories from workouts you log are added on top, on the Today screen.',
            'total'),
        ]));
}

function currentTargets(s) {
  const keys = Object.keys(s.targets.values).filter((k) => nutrientByKey(k));
  if (!keys.length) return null;
  const basis = s.targets.mode === 'calculated' && s.targets.basisWeightKg
    ? `Calculated from ${fmtWeight(s.targets.basisWeightKg, s.units.weight)}.`
    : null;
  return h('div', { class: 'target-summary' },
    h('ul', {}, keys.map((k) => {
      const n = nutrientByKey(k);
      return h('li', {}, h('span', {}, n.label), h('strong', {}, fmtAmount(s.targets.values[k], n.unit)));
    })),
    basis && h('small', { class: 'muted' }, basis));
}

function nutrientsSection() {
  const visible = new Set(state.settings.visibleNutrients);
  const onChange = async (key, checked) => {
    if (checked) visible.add(key);
    else visible.delete(key);
    // Keep label order rather than click order.
    await saveSettings({ ...state.settings, visibleNutrients: NUTRIENTS.map((n) => n.key).filter((k) => visible.has(k)) });
  };
  const box = (n) => h('label', { class: `check indent-${n.indent ?? 0}` },
    h('input', { type: 'checkbox', checked: visible.has(n.key), onChange: (e) => onChange(n.key, e.target.checked) }),
    h('span', {}, n.label));
  return h('section', { class: 'card' },
    h('h2', {}, 'Nutrients shown on Today'),
    h('p', { class: 'muted' }, 'Every nutrient you enter is saved; this only controls what is shown.'),
    h('div', { class: 'check-grid' }, NUTRIENTS.filter((n) => n.group === 'label').map(box)),
    h('details', {}, h('summary', {}, 'Vitamins & minerals'), h('div', { class: 'check-grid' }, NUTRIENTS.filter((n) => n.group === 'micro').map(box))));
}

function foodDatabaseSection(rerender) {
  const saved = state.settings.usda?.apiKey ?? '';
  // Shown as dots so it can't be read off the screen or a screenshot; "Show" reveals it briefly.
  const key = h('input', {
    type: 'password', value: saved, placeholder: saved ? '' : 'Paste your key here',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'USDA API key',
  });
  const show = h('button', { class: 'btn btn-small', type: 'button' }, 'Show');
  show.addEventListener('click', () => {
    const hidden = key.type === 'password';
    key.type = hidden ? 'text' : 'password';
    show.textContent = hidden ? 'Hide' : 'Show';
  });
  const errorLine = h('p', { class: 'errors' });
  const save = async (value) => {
    await saveSettings({ ...state.settings, usda: { ...state.settings.usda, apiKey: value } });
    toast(value ? 'API key saved' : 'Key removed — using the shared demo key');
    rerender();
  };
  key.addEventListener('change', () => {
    const value = key.value.trim();
    if (value && !looksLikeApiKey(value)) {
      key.classList.add('invalid');
      errorLine.textContent = 'That doesn’t look like a USDA key. It should be 40 letters and numbers, from the email USDA sent you.';
      return;
    }
    errorLine.textContent = '';
    save(value);
  });

  return h('section', { class: 'card' },
    h('h2', {}, 'Food database'),
    h('p', { class: 'muted' },
      'Importing a recipe looks up each ingredient in the USDA FoodData Central database. Without your own key the app uses a shared demo key that allows at most about 30 lookups an hour (one per ingredient, so only 2–3 recipes) and can run out sooner. A free personal key allows 1,000 an hour.'),
    field('USDA API key', h('div', { class: 'input-row align-center' }, key, show)),
    errorLine,
    saved
      ? h('p', {}, h('span', { class: 'muted' }, `Key saved (ends in …${saved.slice(-4)}). `),
        h('button', { class: 'link-btn', type: 'button', onClick: () => save('') }, 'Remove key'))
      : h('p', {}, h('a', { href: 'https://fdc.nal.usda.gov/api-key-signup.html', target: '_blank', rel: 'noopener' }, 'Get a free key from USDA'), ' — it arrives by email in a minute or two.'),
    h('p', { class: 'muted' },
      'Your key is stored only on this device. It is never included in backups or shared recipes, and is sent only to USDA.'));
}

function waterSection() {
  const unit = state.settings.units.volume;
  const presets = unit === 'ml' ? [2000, 2500, 3000] : [64, 80, 100];
  const target = presetPicker(presets, roundTo(volumeToDisplay(state.settings.water.targetMl, unit), 1), { unit: volumeLabel(unit), max: unit === 'ml' ? 10000 : 340 });
  target.el.addEventListener('change', async () => {
    const value = target.read();
    if (value) await saveSettings({ ...state.settings, water: { ...state.settings.water, targetMl: volumeFromDisplay(value, unit) } });
  });
  return h('section', { class: 'card' },
    h('h2', {}, 'Water'),
    h('p', { class: 'muted' }, 'Your daily water goal. Plain water plus any drinks marked “counts toward water” go toward it.'),
    field('Daily goal', target.el));
}

function goalsSection(firstWeighIn) {
  const s = state.settings;
  const unit = s.units.weight;

  const commit = async (key, patch) => {
    await saveSettings({ ...state.settings, goals: { ...state.settings.goals, [key]: { ...state.settings.goals[key], ...patch } } });
    checkMilestones();
  };

  // A checkbox that turns the goal on, with its options shown underneath while it is on.
  const goal = (key, title, description, options, readOptions) => {
    const box = h('input', { type: 'checkbox', checked: s.goals[key].enabled });
    const optionsEl = h('div', { class: 'goal-options', hidden: !s.goals[key].enabled }, options);
    const save = () => {
      const values = readOptions();
      if (values) commit(key, { ...values, enabled: box.checked });
    };
    box.addEventListener('change', () => {
      optionsEl.hidden = !box.checked;
      save();
    });
    optionsEl.addEventListener('change', save);
    return h('div', { class: 'goal' },
      h('label', { class: 'choice' }, box, h('span', {}, h('strong', {}, title), h('small', {}, description))),
      optionsEl);
  };

  const stepPresets = unit === 'kg' ? [1, 2, 5] : [2, 5, 10];
  const step = presetPicker(stepPresets, roundTo(weightToDisplay(s.goals.weightLoss.stepKg, unit), 2), { unit, max: unit === 'kg' ? 50 : 100 });
  const streakDays = presetPicker([7, 14, 30], s.goals.loggingStreak.days, { unit: 'days', min: 2, max: 365 });
  const waterDays = presetPicker([3, 7, 14, 30], s.goals.waterStreak.days, { unit: 'days', min: 2, max: 365 });
  const perWeek = presetPicker([2, 3, 4, 5], s.goals.workoutsPerWeek.perWeek, { unit: 'a week', max: 14 });
  const weeks = presetPicker([2, 4, 8], s.goals.workoutsPerWeek.weeks, { unit: 'weeks', max: 52 });
  const nutrientKeys = Object.keys(s.targets.values).filter((k) => nutrientByKey(k));
  const nutrient = selectInput(nutrientKeys.map((k) => ({ value: k, label: nutrientByKey(k).label })), s.goals.nutrition.nutrient);
  const nutritionDays = presetPicker([4, 5, 6, 7], s.goals.nutrition.days, { unit: 'of 7 days', max: 7 });
  const ringDays = presetPicker([4, 5, 6, 7], s.rings.daysPerWeek, { unit: 'of 7 days', max: 7 });
  ringDays.el.addEventListener('change', async () => {
    const v = ringDays.read();
    if (v) await saveSettings({ ...state.settings, rings: { ...state.settings.rings, daysPerWeek: Math.round(v) } });
  });

  return h('section', { class: 'card' },
    h('h2', {}, 'Goals & milestones'),
    h('p', { class: 'muted' }, 'Turn on a goal to track it. When you reach a milestone you’ll get a message showing what changed.'),
    h('div', { class: 'form-grid' },
      goal('weightLoss', 'Weight loss', firstWeighIn
        ? `A milestone each time your 7-day average drops by this much from your first weigh-in (${fmtWeight(firstWeighIn.value, unit)} on ${fmtDate(firstWeighIn.date)}).`
        : 'A milestone each time your 7-day average drops by this much from your first weigh-in.',
      field('Every', step.el),
      () => { const v = step.read(); return v && { stepKg: weightFromDisplay(v, unit) }; }),
      goal('loggingStreak', 'Logging streak', 'Log food every day for this many days in a row.',
        field('Streak length', streakDays.el),
        () => { const v = streakDays.read(); return v && { days: Math.round(v) }; }),
      goal('waterStreak', 'Water streak', 'Reach your daily water goal (set above) this many days in a row.',
        field('Streak length', waterDays.el),
        () => { const v = waterDays.read(); return v && { days: Math.round(v) }; }),
      goal('workoutsPerWeek', 'Workouts per week', 'Hit a number of workouts a week for several weeks running. Weeks start on Sunday.',
        h('div', { class: 'input-row' }, field('Workouts', perWeek.el), field('For', weeks.el)),
        () => { const p = perWeek.read(); const w = weeks.read(); return p && w && { perWeek: Math.round(p), weeks: Math.round(w) }; }),
      goal('nutrition', 'Nutrition consistency', 'Hit a nutrient target on most days of the week. Counts the last 7 finished days.',
        nutrientKeys.length
          ? h('div', { class: 'input-row' }, field('Target', nutrient), field('On at least', nutritionDays.el))
          : h('p', { class: 'muted' }, 'Set nutrient targets above first.'),
        () => { const d = nutritionDays.read(); return nutrientKeys.length && d && { nutrient: nutrient.value, days: Math.round(d) }; })),
    field('Weekly rings: days on target', ringDays.el,
      'On the Goals tab, the weekly “Calorie days” and “Water days” rings ask for this many days a week.'));
}

function activitiesSection(activities, rerender) {
  const name = h('input', { type: 'text', placeholder: 'e.g. Kayaking' });
  const met = numberInput('', { placeholder: 'e.g. 5', 'aria-label': 'MET value' });
  const add = async (ev) => {
    ev.preventDefault();
    const n = name.value.trim();
    const { value } = readNumber(met);
    if (!n) return;
    if (!value || value <= 1 || value > 25) { met.classList.add('invalid'); return; }
    await repo.save('activities', { name: n, met: value });
    rerender();
  };
  const remove = async (a) => {
    const ok = await confirmDialog(`Remove “${a.name}”? Workouts already logged keep their calories.`, { okLabel: 'Remove', danger: true });
    if (ok) {
      await repo.remove('activities', a.id);
      rerender();
    }
  };
  return h('section', { class: 'card' },
    h('h2', {}, 'My activities'),
    h('p', { class: 'muted' },
      'Activities you add appear at the top of the workout list. MET is how hard an activity is compared with sitting still (1); walking is about 3.5 and running about 10.'),
    activities.length > 0 && h('ul', { class: 'history-list' }, activities.map((a) => h('li', {},
      h('span', {}, a.name), h('span', { class: 'muted' }, `MET ${a.met}`),
      h('button', { class: 'icon-btn small', type: 'button', 'aria-label': `Remove ${a.name}`, onClick: () => remove(a) }, '×')))),
    h('form', { class: 'input-row align-end', onSubmit: add },
      field('Activity', name), field('MET', met), h('button', { class: 'btn', type: 'submit' }, 'Add')));
}

const CUSTOM_UNIT = '__custom';

function customFieldsSection(customFields, rerender) {
  const name = h('input', { type: 'text', placeholder: 'e.g. Omega-3 or Vegetables' });
  const unit = h('select', {},
    CUSTOM_FIELD_UNITS.map((g) => h('optgroup', { label: g.label }, g.units.map((u) => h('option', { value: u }, u)))),
    h('option', { value: CUSTOM_UNIT }, 'Custom…'));
  const customUnit = h('input', { type: 'text', maxlength: 12, placeholder: 'e.g. scoops' });
  const customUnitField = field('Your unit', customUnit, 'Up to 12 characters.');
  customUnitField.hidden = true;
  unit.addEventListener('change', () => {
    customUnitField.hidden = unit.value !== CUSTOM_UNIT;
    if (!customUnitField.hidden) customUnit.focus();
  });

  const add = async (ev) => {
    ev.preventDefault();
    const n = name.value.trim();
    if (!n) return;
    if (customFields.some((f) => f.name.toLowerCase() === n.toLowerCase()) || NUTRIENTS.some((f) => f.label.toLowerCase() === n.toLowerCase())) {
      toast(`“${n}” already exists`);
      return;
    }
    const u = unit.value === CUSTOM_UNIT ? customUnit.value.trim() : unit.value;
    if (!u) {
      customUnit.classList.add('invalid');
      return;
    }
    await repo.save('customFields', { name: n, unit: u, visible: true });
    rerender();
  };
  const toggle = async (f, visible) => repo.save('customFields', { ...f, visible });
  const remove = async (f) => {
    const ok = await confirmDialog(`Remove “${f.name}”? Amounts already logged stay in your history but are no longer shown.`, { okLabel: 'Remove', danger: true });
    if (ok) {
      await repo.remove('customFields', f.id);
      rerender();
    }
  };

  return h('section', { class: 'card' },
    h('h2', {}, 'Custom fields'),
    h('p', { class: 'muted' }, 'Track anything not built in. Custom fields appear when adding food and in your totals.'),
    customFields.length > 0 && h('ul', { class: 'history-list' }, customFields.map((f) => h('li', {},
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: f.visible !== false, onChange: (e) => toggle(f, e.target.checked) }),
        h('span', {}, `${f.name} (${f.unit})`)),
      h('button', { class: 'icon-btn small', type: 'button', 'aria-label': `Remove ${f.name}`, onClick: () => remove(f) }, '×')))),
    h('form', { class: 'form-grid', onSubmit: add },
      h('div', { class: 'input-row' }, field('Name', name), field('Unit', unit)),
      customUnitField,
      h('button', { class: 'btn', type: 'submit' }, 'Add field')),
    h('p', { class: 'muted' }, 'Amounts accept fractions, so a “cups” field covers ¼ cup (type 1/4), 1½ cups (1 1/2) and so on.'));
}

function backupSection(rerender, onDataReplaced) {
  const s = state.settings;
  const reminder = selectInput([3, 7, 14, 30].map((d) => ({ value: String(d), label: `Every ${d} days` })), String(s.backupReminderDays));
  reminder.addEventListener('change', () => saveSettings({ ...state.settings, backupReminderDays: Number(reminder.value) }));
  return h('section', { class: 'card' },
    h('h2', {}, 'Backup'),
    h('p', { class: 'muted' },
      'Your data is stored only in this browser on this device. Clearing browser data erases it, so export a backup regularly. ',
      'To move to another device, export here and import there.'),
    h('p', {}, s.lastBackupAt ? `Last backup: ${new Date(s.lastBackupAt).toLocaleString()}` : 'No backup yet.'),
    h('div', { class: 'button-row' },
      h('button', { class: 'btn btn-primary', type: 'button', onClick: async () => { await exportBackup(); rerender(); } }, 'Export backup'),
      h('button', { class: 'btn', type: 'button', onClick: async () => { if (await importBackup()) onDataReplaced(); } }, 'Import backup')),
    field('Backup reminder', reminder));
}

function disclaimerSection() {
  const accepted = state.settings.disclaimerAcceptedAt;
  return h('section', { class: 'card disclaimer' },
    h('h2', {}, DISCLAIMER_TITLE),
    DISCLAIMER_TEXT.map((p) => h('p', {}, p)),
    accepted && h('small', { class: 'muted' }, `Acknowledged ${new Date(accepted).toLocaleDateString()}.`));
}
