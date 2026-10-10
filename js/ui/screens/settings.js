// Settings: profile, targets, nutrients shown, custom fields, backup and the health disclaimer.
import { confirmDialog, h, toast, mount } from '../dom.js';
import { state, saveSettings } from '../state.js';
import * as repo from '../../data/repo.js';
import { CUSTOM_FIELD_UNITS, NUTRIENTS, nutrientByKey } from '../../core/nutrients.js';
import { canCalculate, CALCULATED_KEYS } from '../../core/targets.js';
import { field, selectInput } from '../fields.js';
import { profileForm, targetsForm } from '../profileForm.js';
import { recalculateTargets, showTargetChange } from '../targetsFlow.js';
import { exportBackup, importBackup } from '../backupActions.js';
import { DISCLAIMER_TEXT, DISCLAIMER_TITLE } from '../disclaimer.js';
import { fmtAmount, fmtWeight } from '../format.js';

export async function renderSettings(view, { onDataReplaced }) {
  const customFields = (await repo.listAll('customFields')).sort((a, b) => a.name.localeCompare(b.name));
  const rerender = () => renderSettings(view, { onDataReplaced });
  mount(view, 
    h('header', { class: 'page-head' }, h('h1', {}, 'Settings')),
    profileSection(rerender),
    nutrientsSection(),
    customFieldsSection(customFields, rerender),
    backupSection(rerender, onDataReplaced),
    disclaimerSection(),
  );
}

function profileSection(rerender) {
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
    await saveSettings({ ...s, units, profile: p, targets: t });
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
    h('h2', {}, 'Daily targets'),
    currentTargets(s),
    targets.el,
    errorBox,
    h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Save profile & targets'));
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
