// Checks goals for new milestones and shows each one; they must be acknowledged to continue.
// Every milestone is kept as a trophy (see the Trophy Room on the Goals tab).
import { h, showDialog } from './dom.js';
import * as repo from '../data/repo.js';
import { state, saveSettings } from './state.js';
import { addDays, todayStr } from '../core/dates.js';
import { evaluateGoals } from '../core/goals.js';
import { baselineMilestone, baselineProgress } from '../core/baseline.js';
import { entryNutrients, waterMl } from '../core/nutrition.js';
import { currentValue } from '../core/trends.js';
import { nutrientByKey } from '../core/nutrients.js';
import { fmt, fmtWeight } from './format.js';
import { weightPoints } from './targetsFlow.js';

// History needed to measure the longest goals (a 30-day streak, several weeks of workouts).
const LOOKBACK_DAYS = 400;

let running = false;

// After a weigh-in is deleted or corrected: remove weight-loss milestones the weigh-ins no longer
// support (e.g. "lost 100 lb" from a typo), so real ones can be earned when reached.
export async function pruneWeightMilestones() {
  const points = await weightPoints();
  const baseline = state.settings.baseline;
  const start = baseline?.weightKg ?? null;
  const current = currentValue(points, todayStr());
  for (const m of await repo.listAll('milestones')) {
    // Milestones from an earlier baseline stay as trophies.
    if (m.type !== 'weightLoss' || m.baselineStart !== baseline?.startDate) continue;
    const stepKg = m.lostKg / m.level;
    const level = start != null && current != null ? Math.floor((start - current) / stepKg + 1e-9) : 0;
    if (m.level > level) await repo.remove('milestones', m.id);
  }
}

// Sets the baseline once its weigh-ins are in; returns its milestone, or null.
async function establishBaseline(points, today) {
  if (state.settings.baseline) return null;
  const b = baselineProgress(points, today, state.settings.baselineFrom);
  if (!b?.ready) return null;
  const { weightKg, weighIns, startDate, setOn } = b;
  await saveSettings({ ...state.settings, baseline: { weightKg, weighIns, startDate, setOn } });
  return baselineMilestone(b);
}

// Returns how many milestones were shown.
export async function checkMilestones() {
  if (running) return 0;
  running = true;
  try {
    const today = todayStr();
    const from = addDays(today, -LOOKBACK_DAYS);
    const goals = state.settings.goals;
    const [points, entries, workouts, waterRecords, achieved] = await Promise.all([
      weightPoints(),
      repo.listRange('logEntries', from, today),
      repo.listRange('workouts', from, today),
      repo.listRange('water', from, today),
      repo.listAll('milestones'),
    ]);

    const dailyTotals = new Map();
    const entriesByDate = new Map();
    for (const e of entries) {
      const totals = dailyTotals.get(e.date) ?? {};
      for (const [k, v] of Object.entries(entryNutrients(e))) totals[k] = (totals[k] ?? 0) + v;
      dailyTotals.set(e.date, totals);
      if (!entriesByDate.has(e.date)) entriesByDate.set(e.date, []);
      entriesByDate.get(e.date).push(e);
    }

    // Days the water goal was reached: plain water plus drinks that count toward it.
    const targetMl = state.settings.water.targetMl;
    const plainByDate = new Map(waterRecords.map((w) => [w.date, w.ml]));
    const waterGoalDates = new Set(
      [...new Set([...plainByDate.keys(), ...entriesByDate.keys()])]
        .filter((date) => targetMl > 0 && waterMl(entriesByDate.get(date) ?? [], plainByDate.get(date) ?? 0) >= targetMl),
    );

    const newBaseline = await establishBaseline(points, today);
    const found = evaluateGoals({
      goals,
      targets: state.settings.targets,
      today,
      weights: {
        start: state.settings.baseline?.weightKg ?? null,
        baselineStart: state.settings.baseline?.startDate ?? null,
        current: currentValue(points, today),
      },
      loggedDates: new Set(entries.map((e) => e.date)),
      waterGoalDates,
      workoutDates: workouts.map((w) => w.date),
      dailyTotals,
      achieved,
    });
    if (newBaseline && !achieved.some((m) => m.key === newBaseline.key)) found.unshift(newBaseline);

    // Recorded before showing, so one closed mid-message (app shut) is shown again next time.
    const pending = achieved.filter((m) => !m.acknowledgedAt);
    for (const milestone of found) {
      pending.push(await repo.save('milestones', { ...milestone, achievedOn: today, acknowledgedAt: null }));
    }
    for (const milestone of pending) {
      await showMilestone(milestone);
      await repo.save('milestones', { ...milestone, acknowledgedAt: new Date().toISOString() });
    }
    return pending.length;
  } finally {
    running = false;
  }
}

// Trophy titles are in Title Case; "lb" / "lbs" stay lowercase.
export function describeMilestone(m) {
  const unit = state.settings.units.weight;
  switch (m.type) {
    case 'baseline':
      return {
        title: `Baseline Set: ${fmtWeight(m.weightKg, unit)}`,
        body: `This is the average of your first ${m.weighIns} weigh-in${m.weighIns === 1 ? '' : 's'}. Your weight-loss milestones are measured from it, using your 7-day average weight.`,
      };
    case 'weightLoss':
      return {
        title: `You’ve Lost ${fmtWeight(m.lostKg, unit, unit === 'kg' ? 1 : 0)}!`,
        body: `Your 7-day average weight went from ${fmtWeight(m.startKg, unit)} to ${fmtWeight(m.currentKg, unit)}.`,
      };
    case 'loggingStreak':
      return {
        title: `${m.days}-Day Logging Streak!`,
        body: `You logged your food every day for ${m.days} days in a row.`,
      };
    case 'waterStreak':
      return {
        title: `${m.days}-Day Water Streak!`,
        body: `You reached your water goal every day for ${m.days} days in a row.`,
      };
    case 'workoutsPerWeek':
      return {
        title: `${m.weeks} Strong Weeks!`,
        body: `You did ${m.perWeek} or more workouts a week for ${m.weeks} weeks in a row.`,
      };
    case 'nutrition': {
      const label = nutrientByKey(m.nutrient)?.label ?? m.nutrient;
      return {
        title: `${label} on Target!`,
        body: `You hit your ${label.toLowerCase()} target on ${fmt(m.hits)} of 7 days.`,
      };
    }
    default:
      return { title: 'Milestone Reached!', body: '' };
  }
}

export const trophyBadge = (small) =>
  h('div', { class: `milestone-badge${small ? ' small' : ''}`, 'aria-hidden': 'true' }, '🏆');

function showMilestone(m) {
  const { title, body } = describeMilestone(m);
  return showDialog((close) =>
    h('div', { class: 'dialog-body milestone' },
      trophyBadge(),
      h('h2', {}, title),
      h('p', {}, body),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-primary btn-block', type: 'button', onClick: () => close() }, 'Got it'))),
  { required: true });
}
