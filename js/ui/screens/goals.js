// Goals: rings for the day, week and month, built from the targets and goals set in Settings.
import { h, mount } from '../dom.js';
import { state } from '../state.js';
import * as repo from '../../data/repo.js';
import { addDays, todayStr } from '../../core/dates.js';
import { buildDaySummaries, dataRange, evaluatePeriod } from '../../core/rings.js';
import { volumeLabel, volumeToDisplay } from '../../core/units.js';
import { fmt, fmtDate, fmtWeight } from '../format.js';
import { ringChart } from '../ringChart.js';
import { weightPoints } from '../targetsFlow.js';
import { averageOver, currentValue } from '../../core/trends.js';
import { BASELINE_WEIGH_INS, baselineProgress, fromEarlierBaseline } from '../../core/baseline.js';
import { weightLossLevel } from '../../core/goals.js';
import { describeMilestone, trophyBadge } from '../milestones.js';
import { BASELINE_REMINDER } from '../baselineText.js';

let anchor = todayStr();

export async function renderGoals(view) {
  const s = state.settings;
  const today = todayStr();
  if (anchor > today) anchor = today;
  const range = dataRange(anchor, today);
  const [entries, workouts, water, points, trophies] = await Promise.all([
    repo.listRange('logEntries', range.start, range.end),
    repo.listRange('workouts', range.start, range.end),
    repo.listRange('water', range.start, range.end),
    weightPoints(),
    repo.listAll('milestones'),
  ]);
  const days = buildDaySummaries({ entries, workouts, water });
  const data = { anchor, today, days, points };
  const rerender = () => renderGoals(view);

  mount(view,
    dateNav(today, rerender),
    weightCard(points, s, today),
    ['day', 'week', 'month'].map((period) => periodCard(evaluatePeriod(s, period, data), today, s)),
    h('p', { class: 'muted center' },
      'Rings come from your targets and goals. ', h('a', { href: '#/settings' }, 'Change them in Settings'), '.'),
    trophyRoom(trophies, s));
}

// Baseline and rolling 7-day average. Until the baseline is set, shows how it's coming along.
function weightCard(points, s, today) {
  const unit = s.units.weight;
  const w = (kg) => fmtWeight(kg, unit);
  const short = (d) => fmtDate(d, { month: 'short', day: 'numeric' });
  const baseline = s.baseline;

  if (!baseline) {
    const b = baselineProgress(points, today, s.baselineFrom);
    const count = b?.weighIns ?? 0;
    const avg = averageOver(points, today, 7);
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Setting Your Baseline'), h('span', { class: 'muted' }, `${count} of ${BASELINE_WEIGH_INS}`)),
      h('div', { class: 'baseline-dots', role: 'img', 'aria-label': `${count} of ${BASELINE_WEIGH_INS} weigh-ins` },
        Array.from({ length: BASELINE_WEIGH_INS }, (_, i) => h('span', { class: i < count ? 'on' : '' }))),
      b
        ? h('p', {}, `Average so far: `, h('strong', {}, w(b.weightKg)), ` · Window ends ${short(b.endDate)}`)
        : h('p', {}, h('a', { href: '#/weight' }, 'Log a weigh-in'), ' to start.'),
      avg != null && h('p', {}, '7-day average: ', h('strong', {}, w(avg))),
      h('p', { class: 'muted' }, BASELINE_REMINDER));
  }

  const avg = averageOver(points, today, 7);
  const recent = points.filter((p) => p.date > addDays(today, -7) && p.date <= today).length;
  const current = avg ?? currentValue(points, today);
  const change = current == null ? null : current - baseline.weightKg;
  const wl = s.goals.weightLoss;
  let next = null;
  if (wl.enabled && current != null) {
    const nextLost = (weightLossLevel(baseline.weightKg, current, wl.stepKg) + 1) * wl.stepKg;
    const at = baseline.weightKg - nextLost;
    next = `${w(nextLost)} lost, at ${w(at)} (${w(Math.max(0, current - at))} to go)`;
  }
  return h('section', { class: 'card' },
    h('h2', {}, 'Your Weight'),
    h('dl', { class: 'weight-facts' },
      fact('Baseline', w(baseline.weightKg), `Set ${fmtDate(baseline.setOn, { month: 'short', day: 'numeric', year: 'numeric' })} from ${baseline.weighIns} weigh-in${baseline.weighIns === 1 ? '' : 's'}`),
      fact('7-day average', current == null ? '–' : w(current),
        avg == null ? 'No weigh-ins in the last 7 days; showing your latest' : `From ${recent} weigh-in${recent === 1 ? '' : 's'} in the last 7 days`),
      change != null && fact(change > 0 ? 'Gained since baseline' : 'Lost since baseline', w(Math.abs(change))),
      next && fact('Next milestone', next)));
}

const fact = (label, value, note) =>
  h('div', {}, h('dt', {}, label), h('dd', {}, h('strong', {}, value), note && h('small', { class: 'muted' }, note)));

// Every milestone reached, newest first. Ones measured from an earlier baseline (before "Start a
// New Baseline") are kept in their own, greyed group, to look back on and earn again.
function trophyRoom(trophies, s) {
  const longDate = (d) => fmtDate(d, { month: 'short', day: 'numeric', year: 'numeric' });
  const shown = trophies.filter((m) => m.acknowledgedAt)
    .sort((a, b) => (a.achievedOn === b.achievedOn ? (a.createdAt < b.createdAt ? 1 : -1) : a.achievedOn < b.achievedOn ? 1 : -1));
  const earlier = shown.filter((m) => fromEarlierBaseline(m, s.baseline));
  const current = shown.filter((m) => !earlier.includes(m));

  const item = (m, old) => {
    const { title, body } = describeMilestone(m);
    const from = m.type === 'baseline' ? null : m.startKg;
    return h('li', { class: old ? 'earlier' : '' },
      trophyBadge(true),
      h('div', {},
        h('strong', {}, title),
        h('small', { class: 'muted' }, longDate(m.achievedOn)),
        old && h('span', { class: 'chip earlier-tag' },
          from != null ? `Earlier Baseline · ${fmtWeight(from, s.units.weight)}` : 'Earlier Baseline'),
        h('p', {}, body)));
  };

  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Trophy Room'), shown.length > 0 && h('span', { class: 'muted' }, String(shown.length))),
    current.length
      ? h('ul', { class: 'trophy-list' }, current.map((m) => item(m, false)))
      : h('p', { class: 'muted' }, earlier.length
        ? 'Trophies you earn under your new baseline go here.'
        : 'Trophies you earn are kept here. Your first comes when your baseline is set.'),
    earlier.length > 0 && h('div', { class: 'trophy-earlier' },
      h('h3', {}, 'From Earlier Baselines'),
      h('p', { class: 'muted' }, 'What you achieved before starting over. Earn these again under your new baseline.'),
      h('ul', { class: 'trophy-list' }, earlier.map((m) => item(m, true)))));
}

function dateNav(today, rerender) {
  const isToday = anchor === today;
  const go = (days) => { anchor = addDays(anchor, days); rerender(); };
  return h('header', { class: 'date-nav' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous day', onClick: () => go(-1) }, '‹'),
    h('div', { class: 'date-title' },
      h('h1', {}, 'Goals'),
      h('span', { class: 'muted' }, isToday ? 'Today' : fmtDate(anchor, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }))),
    isToday
      ? h('span', { class: 'icon-btn placeholder' })
      : h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next day', onClick: () => go(1) }, '›'),
    !isToday && h('button', { class: 'chip', type: 'button', onClick: () => { anchor = today; rerender(); } }, 'Back to today'));
}

function periodTitle({ period, range }, today) {
  const short = (d) => fmtDate(d, { month: 'short', day: 'numeric' });
  if (period === 'day') return [range.start === today ? 'Today' : fmtDate(range.start, { weekday: 'long' }), fmtDate(range.start, { month: 'long', day: 'numeric' })];
  if (period === 'week') return [today >= range.start && today <= range.end ? 'This week' : 'Week', `${short(range.start)} – ${short(range.end)}`];
  const name = fmtDate(range.start, { month: 'long', year: 'numeric' });
  return [today >= range.start && today <= range.end ? 'This month' : name, name];
}

const EMPTY_MESSAGES = {
  day: 'Set calorie, protein or water targets in Settings to get daily rings.',
  week: 'Turn on a workouts or nutrition goal, or set calorie or water targets, to get weekly rings.',
  month: 'Set a goal weight in Settings to get monthly rings.',
};

function periodCard(result, today, s) {
  const [title, subtitle] = periodTitle(result, today);
  const done = result.rings.filter((r) => r.complete).length;
  const summary = result.allComplete ? 'All goals reached!' : `${done} of ${result.rings.length} reached`;
  return h('section', { class: `card ring-card ${result.allComplete ? 'all-done' : ''}` },
    h('div', { class: 'card-head' },
      h('div', {}, h('h2', {}, title), h('small', { class: 'muted' }, subtitle)),
      result.rings.length > 0 && h('span', { class: result.allComplete ? 'chip lit' : 'muted' }, summary)),
    result.rings.length
      ? h('div', { class: 'ring-layout' },
        ringChart(result.rings, result.allComplete, `${title}: ${summary}`),
        h('ul', { class: 'ring-legend' }, result.rings.map((r) =>
          h('li', {},
            h('span', { class: `legend-dot ring-${r.over ? 'over' : r.color}`, 'aria-hidden': 'true' }),
            h('span', { class: 'legend-text' },
              h('strong', {}, r.label),
              h('small', { class: 'muted' }, ringDetail(r, s))),
            r.complete && h('span', { class: 'legend-check', 'aria-label': 'Reached' }, '✓')))))
      : h('p', { class: 'muted' }, EMPTY_MESSAGES[result.period]));
}

function ringDetail(r, s) {
  switch (r.display) {
    case 'kcal': return `${fmt(r.value)} / ${fmt(r.target)} kcal${r.over ? ' · over' : ''}`;
    case 'g': return `${fmt(r.value)} / ${fmt(r.target)} g`;
    case 'volume': {
      const unit = s.units.volume;
      return `${fmt(volumeToDisplay(r.value, unit))} / ${fmt(volumeToDisplay(r.target, unit))} ${volumeLabel(unit)}`;
    }
    case 'weight': return `${fmtWeight(r.value, s.units.weight)} of ${fmtWeight(r.target, s.units.weight)} lost`;
    default: return `${fmt(r.value)} of ${fmt(r.target)} ${r.display}`;
  }
}
