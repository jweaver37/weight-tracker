// Profile and targets forms, shared by first-time setup and Settings.
import { h } from './dom.js';
import { field, heightInput, numberInput, readNumber, selectInput, weightInput } from './fields.js';
import { ACTIVITY_LEVELS, CALCULATED_KEYS, DEFAULT_MIN_CALORIES, LOSS_RATES_LB, profileAge } from '../core/targets.js';
import { nutrientByKey } from '../core/nutrients.js';
import { lbToKg, roundTo } from '../core/units.js';
import { todayStr } from '../core/dates.js';
import { fmtDate, fmtWeight, inputNumber } from './format.js';

const WEIGHT_UNITS = [{ value: 'lb', label: 'lb' }, { value: 'kg', label: 'kg' }];
const LENGTH_UNITS = [{ value: 'in', label: 'inches' }, { value: 'cm', label: 'cm' }];
const VOLUME_UNITS = [{ value: 'floz', label: 'fl oz' }, { value: 'ml', label: 'ml' }];
const SEXES = [{ value: '', label: 'Choose…' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }];

const AGE_MODES = [
  { value: 'age', label: 'Just my age' },
  { value: 'month', label: 'Birth month & year' },
  { value: 'date', label: 'Full birth date' },
];

// Age as just a number, a birth month & year, or a full birth date. Only the chosen one is kept:
// switching to a less detailed option removes the more detailed one from the device.
function ageField(p) {
  const today = todayStr();
  const known = profileAge(p, today);
  const mode = selectInput(AGE_MODES, p.birthMode ?? (p.birthDate ? 'date' : 'age'), { 'aria-label': 'How to enter your age' });
  const ageInput = numberInput(known ?? '', { inputmode: 'numeric', placeholder: 'e.g. 47', 'aria-label': 'Age in years' });
  const month = h('input', { type: 'month', value: p.birthMonth ?? (p.birthDate ? p.birthDate.slice(0, 7) : ''), max: today.slice(0, 7), placeholder: 'YYYY-MM', 'aria-label': 'Birth month and year' });
  const date = h('input', { type: 'date', value: p.birthDate ?? '', max: today, 'aria-label': 'Birth date' });
  const ageRow = h('div', { class: 'input-unit' }, ageInput, h('span', {}, 'years'));
  // Explains that the age keeps itself up to date, from the day it was entered.
  const asOf = p.birthMode === 'age' && p.ageAsOf ? p.ageAsOf : today;
  const ageNote = h('small', { class: 'field-hint' },
    `The app remembers that you entered this on ${fmtDate(asOf, { month: 'long', day: 'numeric', year: 'numeric' })} and adds a year every year after that, so you don’t need to update it. If you change the number, it counts from the day you change it.`);
  const sync = () => {
    ageRow.hidden = mode.value !== 'age';
    ageNote.hidden = mode.value !== 'age';
    month.hidden = mode.value !== 'month';
    date.hidden = mode.value !== 'date';
  };
  mode.addEventListener('change', () => {
    // Carry the age over so switching doesn't lose it.
    if (mode.value === 'age' && !ageInput.value) ageInput.value = known ?? '';
    sync();
  });
  sync();
  return {
    el: h('div', { class: 'form-grid' }, mode, ageRow, ageNote, month, date),
    read: () => {
      if (mode.value === 'age') {
        const { value } = readNumber(ageInput);
        const years = value != null && value >= 13 && value <= 120 ? Math.round(value) : null;
        ageInput.classList.toggle('invalid', ageInput.value.trim() !== '' && years == null);
        // Keep the original "as of" date while the age hasn't been changed, so it keeps counting up.
        const unchanged = years != null && years === known && p.birthMode === 'age' && p.ageAsOf;
        return { birthMode: 'age', age: years, ageAsOf: years == null ? null : unchanged ? p.ageAsOf : today, birthMonth: null, birthDate: null };
      }
      if (mode.value === 'month') {
        const ok = /^\d{4}-\d{2}$/.test(month.value);
        return { birthMode: 'month', birthMonth: ok ? month.value : null, age: null, ageAsOf: null, birthDate: null };
      }
      return { birthMode: 'date', birthDate: date.value || null, birthMonth: null, age: null, ageAsOf: null };
    },
  };
}

// read() → { units, profile, currentWeightKg }
export function profileForm(settings, { currentWeightKg, askCurrentWeight = false } = {}) {
  const p = settings.profile;
  const name = h('input', { type: 'text', value: p.name, autocomplete: 'given-name' });
  const weightUnit = selectInput(WEIGHT_UNITS, settings.units.weight);
  const lengthUnit = selectInput(LENGTH_UNITS, settings.units.length);
  const volumeUnit = selectInput(VOLUME_UNITS, settings.units.volume);
  const sex = selectInput(SEXES, p.sex ?? '');
  const age = ageField(p);
  const activity =selectInput(ACTIVITY_LEVELS.map((a) => ({ value: a.key, label: a.label })), p.activity);

  let height = heightInput(p.heightCm, settings.units.length);
  let goal = weightInput(p.goalWeightKg, settings.units.weight);
  let current = askCurrentWeight ? weightInput(currentWeightKg, settings.units.weight) : null;
  const heightSlot = h('div', {}, height.el);
  const goalSlot = h('div', {}, goal.el);
  const currentSlot = h('div', {}, current?.el);

  // Switching units converts what's already typed.
  weightUnit.addEventListener('change', () => {
    goal = weightInput(goal.read(), weightUnit.value);
    goalSlot.replaceChildren(goal.el);
    if (current) {
      current = weightInput(current.read(), weightUnit.value);
      currentSlot.replaceChildren(current.el);
    }
  });
  lengthUnit.addEventListener('change', () => {
    height = heightInput(height.read(), lengthUnit.value);
    heightSlot.replaceChildren(height.el);
  });

  const el = h('div', { class: 'form-grid' },
    field('Name', name),
    h('div', { class: 'input-row' }, field('Weight', weightUnit), field('Height & body', lengthUnit), field('Drinks', volumeUnit)),
    field('Sex', sex, 'Used by the calorie formula.'),
    field('Age', age.el, 'Used by the calorie formula, in whole years. Share only what you’re comfortable with — it stays on this device.'),
    field('Height', heightSlot),
    current && field('Current weight', currentSlot),
    field('Goal weight', goalSlot),
    field('Everyday activity level', activity, 'Leave out exercise — workouts you log are added to your day separately.'),
  );

  return {
    el,
    weightUnit: () => weightUnit.value,
    read: () => ({
      units: { weight: weightUnit.value, length: lengthUnit.value, volume: volumeUnit.value },
      profile: {
        ...p,
        name: name.value.trim(),
        sex: sex.value || null,
        ...age.read(),
        heightCm: height.read(),
        goalWeightKg: goal.read(),
        activity: activity.value,
      },
      currentWeightKg: current?.read() ?? null,
    }),
  };
}

// read() → { targets, errors }. `weightUnit()` labels the loss-rate options in the chosen unit.
export function targetsForm(settings, { weightUnit, advanced = false } = {}) {
  const t = settings.targets;
  const modeName = `target-mode-${Math.random().toString(36).slice(2)}`;
  const radio = (value, label, hint) =>
    h('label', { class: 'choice' },
      h('input', { type: 'radio', name: modeName, value, checked: t.mode === value }),
      h('span', {}, h('strong', {}, label), h('small', {}, hint)));

  const rateOptions = () => LOSS_RATES_LB.map((lb) => ({
    value: String(lb),
    label: `${fmtWeight(lbToKg(lb), weightUnit(), weightUnit() === 'kg' ? 2 : 1)} per week`,
  }));
  const currentRateLb = String(roundTo(t.lossRateKgPerWeek / lbToKg(1), 1));
  const rate = selectInput(rateOptions(), currentRateLb);
  const minCalories = numberInput(t.minCalories ?? '', { inputmode: 'numeric', placeholder: `${DEFAULT_MIN_CALORIES.female} (women) / ${DEFAULT_MIN_CALORIES.male} (men)` });
  const protein = numberInput(inputNumber(t.proteinGPerKg, 2));
  let threshold = weightInput(t.recalcThresholdKg, weightUnit());
  const thresholdSlot = h('div', {}, threshold.el);

  const calculated = h('div', { class: 'form-grid' },
    field('Weight-loss pace', rate),
    advanced && field('Minimum daily calories', minCalories, 'Calculated calories never go below this. Leave blank for the standard minimum.'),
    advanced && field('Protein (grams per kg of body weight)', protein, 'Uses goal weight when it is lower than current weight.'),
    advanced && field('Recalculate when 7-day average drops by', thresholdSlot));

  const manualInputs = new Map(CALCULATED_KEYS.map((key) => [key, numberInput(inputNumber(t.values[key], 1))]));
  const manual = h('div', { class: 'form-grid two-col' },
    [...manualInputs].map(([key, input]) => {
      const n = nutrientByKey(key);
      return field(n.label, h('div', { class: 'input-unit' }, input, h('span', {}, n.unit)));
    }));

  const el = h('div', { class: 'form-grid' },
    radio('calculated', 'Calculate for me', 'From standard recommendations; updates as your weight drops.'),
    radio('manual', 'Enter my own', 'For example, targets from your doctor or dietitian.'),
    calculated, manual);

  const mode = () => el.querySelector(`input[name="${modeName}"]:checked`).value;
  const sync = () => {
    calculated.hidden = mode() !== 'calculated';
    manual.hidden = mode() !== 'manual';
  };
  el.addEventListener('change', (e) => {
    if (e.target.type === 'radio') sync();
  });
  sync();

  return {
    el,
    refreshUnits: () => {
      const selected = rate.value;
      rate.replaceChildren(...rateOptions().map((o) => h('option', { value: o.value, selected: o.value === selected }, o.label)));
      threshold = weightInput(threshold.read(), weightUnit());
      thresholdSlot.replaceChildren(threshold.el);
    },
    read: () => {
      const errors = [];
      const next = { ...t, mode: mode(), lossRateKgPerWeek: lbToKg(Number(rate.value)) };
      if (advanced) {
        const min = readNumber(minCalories);
        if (!min.empty && min.value == null) errors.push('Minimum calories must be a number.');
        next.minCalories = min.empty ? null : min.value;
        const pro = readNumber(protein);
        if (pro.value == null) errors.push('Protein per kg must be a number.');
        else next.proteinGPerKg = pro.value;
        const thr = threshold.read();
        if (thr == null || thr <= 0) errors.push('The recalculation amount must be more than 0.');
        else next.recalcThresholdKg = thr;
      }
      if (next.mode === 'manual') {
        const values = { ...t.values };
        for (const [key, input] of manualInputs) {
          const r = readNumber(input);
          if (!r.empty && r.value == null) errors.push(`${nutrientByKey(key).label} target must be a number.`);
          if (r.empty) delete values[key];
          else if (r.value != null) values[key] = r.value;
        }
        if (values.calories == null) errors.push('Enter a calorie target.');
        next.values = values;
      }
      return { targets: next, errors };
    },
  };
}
