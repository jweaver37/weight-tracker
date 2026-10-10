// Checks goals for new milestones and shows each one; they must be acknowledged to continue.
import { h, showDialog } from './dom.js';
import * as repo from '../data/repo.js';
import { state } from './state.js';
import { addDays, todayStr } from '../core/dates.js';
import { evaluateGoals } from '../core/goals.js';
import { entryNutrients } from '../core/nutrition.js';
import { currentValue } from '../core/trends.js';
import { nutrientByKey } from '../core/nutrients.js';
import { fmt, fmtWeight } from './format.js';
import { weightPoints } from './targetsFlow.js';

// History needed to measure the longest goals (a 30-day streak, several weeks of workouts).
const LOOKBACK_DAYS = 400;

let running = false;

export async function checkMilestones() {
  const goals = state.settings.goals;
  if (running || !Object.values(goals).some((g) => g.enabled)) return;
  running = true;
  try {
    const today = todayStr();
    const from = addDays(today, -LOOKBACK_DAYS);
    const [points, entries, workouts, achieved] = await Promise.all([
      weightPoints(),
      repo.listRange('logEntries', from, today),
      repo.listRange('workouts', from, today),
      repo.listAll('milestones'),
    ]);

    const dailyTotals = new Map();
    for (const e of entries) {
      const totals = dailyTotals.get(e.date) ?? {};
      for (const [k, v] of Object.entries(entryNutrients(e))) totals[k] = (totals[k] ?? 0) + v;
      dailyTotals.set(e.date, totals);
    }

    const found = evaluateGoals({
      goals,
      targets: state.settings.targets,
      today,
      weights: { start: points[0]?.value ?? null, current: currentValue(points, today) },
      loggedDates: new Set(entries.map((e) => e.date)),
      workoutDates: workouts.map((w) => w.date),
      dailyTotals,
      achieved,
    });

    // Recorded before showing, so one closed mid-message (app shut) is shown again next time.
    const pending = achieved.filter((m) => !m.acknowledgedAt);
    for (const milestone of found) {
      pending.push(await repo.save('milestones', { ...milestone, achievedOn: today, acknowledgedAt: null }));
    }
    for (const milestone of pending) {
      await showMilestone(milestone);
      await repo.save('milestones', { ...milestone, acknowledgedAt: new Date().toISOString() });
    }
  } finally {
    running = false;
  }
}

function describe(m) {
  const unit = state.settings.units.weight;
  switch (m.type) {
    case 'weightLoss':
      return {
        title: `You’ve lost ${fmtWeight(m.lostKg, unit, unit === 'kg' ? 1 : 0)}!`,
        body: `Your 7-day average weight went from ${fmtWeight(m.startKg, unit)} at your first weigh-in to ${fmtWeight(m.currentKg, unit)} now.`,
      };
    case 'loggingStreak':
      return {
        title: `${m.days}-day logging streak!`,
        body: `You’ve logged your food every day for ${m.days} days in a row.`,
      };
    case 'workoutsPerWeek':
      return {
        title: `${m.weeks} strong weeks!`,
        body: `You’ve done ${m.perWeek} or more workouts a week for ${m.weeks} weeks in a row.`,
      };
    case 'nutrition': {
      const label = nutrientByKey(m.nutrient)?.label ?? m.nutrient;
      return {
        title: `${label} on target!`,
        body: `You hit your ${label.toLowerCase()} target on ${fmt(m.hits)} of the last 7 days.`,
      };
    }
    default:
      return { title: 'Milestone reached!', body: '' };
  }
}

function showMilestone(m) {
  const { title, body } = describe(m);
  return showDialog((close) =>
    h('div', { class: 'dialog-body milestone' },
      h('div', { class: 'milestone-badge', 'aria-hidden': 'true' }, '★'),
      h('h2', {}, title),
      h('p', {}, body),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-primary btn-block', type: 'button', onClick: () => close() }, 'Got it'))),
  { required: true });
}
