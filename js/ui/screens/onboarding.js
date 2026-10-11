// First-run setup: health disclaimer, then profile and targets.
import { h, mount } from '../dom.js';
import { state, saveSettings } from '../state.js';
import * as repo from '../../data/repo.js';
import { canCalculate } from '../../core/targets.js';
import { todayStr } from '../../core/dates.js';
import { profileForm, targetsForm } from '../profileForm.js';
import { recalculateTargets } from '../targetsFlow.js';
import { DISCLAIMER_TEXT, DISCLAIMER_TITLE } from '../disclaimer.js';
import { importBackup } from '../backupActions.js';
import { BASELINE_INTRO, BASELINE_REMINDER } from '../baselineText.js';

export function renderOnboarding(view, onDone) {
  if (!state.settings.disclaimerAcceptedAt) renderDisclaimer(view, onDone);
  else renderSetup(view, onDone);
}

function renderDisclaimer(view, onDone) {
  const agree = h('input', { type: 'checkbox' });
  const next = h('button', { class: 'btn btn-primary btn-block', type: 'button', disabled: true }, 'Continue');
  agree.addEventListener('change', () => { next.disabled = !agree.checked; });
  next.addEventListener('click', async () => {
    await saveSettings({ ...state.settings, disclaimerAcceptedAt: new Date().toISOString() });
    renderSetup(view, onDone);
  });

  mount(view, 
    h('section', { class: 'card onboarding' },
      h('h1', {}, 'Welcome'),
      h('h2', {}, DISCLAIMER_TITLE),
      DISCLAIMER_TEXT.map((p) => h('p', {}, p)),
      h('label', { class: 'check' }, agree, h('span', {}, 'I understand and will consult my doctor.')),
      next),
  );
}

function renderSetup(view, onDone) {
  const settings = state.settings;
  const profile = profileForm(settings, { askCurrentWeight: true });
  const targets = targetsForm(settings, { weightUnit: profile.weightUnit });
  profile.el.addEventListener('change', (e) => {
    if (e.target.tagName === 'SELECT') targets.refreshUnits();
  });
  const errorBox = h('div', { class: 'errors', role: 'alert' });

  const finish = async () => {
    const { units, profile: p, currentWeightKg } = profile.read();
    const { targets: t, errors } = targets.read();
    if (!currentWeightKg) errors.unshift('Enter your current weight.');
    if (t.mode === 'calculated' && !canCalculate(p)) errors.unshift('Calculated targets need your sex, age and height.');
    if (errors.length) {
      errorBox.replaceChildren(...errors.map((e) => h('p', {}, e)));
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    await repo.save('weights', { date: todayStr(), weightKg: currentWeightKg });
    await saveSettings({ ...state.settings, units, profile: p, targets: t });
    if (t.mode === 'calculated') await recalculateTargets(currentWeightKg);
    await saveSettings({ ...state.settings, setupCompletedAt: new Date().toISOString() });
    onDone();
  };

  const restore = async () => {
    if (await importBackup()) onDone();
  };

  mount(view, 
    h('section', { class: 'card onboarding' },
      h('h1', {}, 'Set up your profile'),
      h('p', { class: 'muted' }, 'You can change any of this later in Settings.'),
      profile.el),
    h('section', { class: 'card' }, h('h2', {}, 'Daily targets'), targets.el),
    h('section', { class: 'card' },
      h('h2', {}, 'Your first week'),
      h('p', {}, BASELINE_INTRO),
      h('p', { class: 'muted' }, BASELINE_REMINDER)),
    errorBox,
    h('button', { class: 'btn btn-primary btn-block', type: 'button', onClick: finish }, 'Finish setup'),
    h('button', { class: 'btn btn-link btn-block', type: 'button', onClick: restore }, 'Moving from another device? Import a backup'),
  );
}
