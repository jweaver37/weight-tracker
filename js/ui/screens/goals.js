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

let anchor = todayStr();

export async function renderGoals(view) {
  const s = state.settings;
  const today = todayStr();
  if (anchor > today) anchor = today;
  const range = dataRange(anchor, today);
  const [entries, workouts, water, points] = await Promise.all([
    repo.listRange('logEntries', range.start, range.end),
    repo.listRange('workouts', range.start, range.end),
    repo.listRange('water', range.start, range.end),
    weightPoints(),
  ]);
  const days = buildDaySummaries({ entries, workouts, water });
  const data = { anchor, today, days, points };
  const rerender = () => renderGoals(view);

  mount(view,
    dateNav(today, rerender),
    ['day', 'week', 'month'].map((period) => periodCard(evaluatePeriod(s, period, data), today, s)),
    h('p', { class: 'muted center' },
      'Rings come from your targets and goals. ', h('a', { href: '#/settings' }, 'Change them in Settings'), '.'));
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
