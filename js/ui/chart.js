// Minimal SVG line chart: daily points, a smoothed line and an optional goal line.
import { svg } from './dom.js';
import { daysBetween } from '../core/dates.js';
import { fmt, fmtDate } from './format.js';

const W = 360;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

// series: { points: [{date, value}], line: [{date, value}], goal?: number }, values already in display units.
export function lineChart({ points, line, goal, label }) {
  const all = [...points.map((p) => p.value), ...line.map((p) => p.value)];
  if (goal != null) all.push(goal);
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (max - min < 2) { min -= 1; max += 1; }
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;

  const first = points[0].date;
  const span = Math.max(1, daysBetween(first, points[points.length - 1].date));
  const x = (date) => PAD.left + (daysBetween(first, date) / span) * (W - PAD.left - PAD.right);
  const y = (value) => PAD.top + (1 - (value - min) / (max - min)) * (H - PAD.top - PAD.bottom);

  const ticks = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3);
  const grid = ticks.map((t) => [
    svg('line', { class: 'chart-grid', x1: PAD.left, x2: W - PAD.right, y1: y(t), y2: y(t) }),
    svg('text', { class: 'chart-label', x: PAD.left - 6, y: y(t) + 4, 'text-anchor': 'end' }, fmt(t)),
  ]);
  const xLabels = [
    svg('text', { class: 'chart-label', x: PAD.left, y: H - 6, 'text-anchor': 'start' }, fmtDate(first, { month: 'short', day: 'numeric' })),
    span > 0 && points.length > 1 &&
      svg('text', { class: 'chart-label', x: W - PAD.right, y: H - 6, 'text-anchor': 'end' }, fmtDate(points[points.length - 1].date, { month: 'short', day: 'numeric' })),
  ];
  const path = line.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  return svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label },
    grid,
    goal != null && svg('line', { class: 'chart-goal', x1: PAD.left, x2: W - PAD.right, y1: y(goal), y2: y(goal) }),
    points.map((p) => svg('circle', { class: 'chart-point', cx: x(p.date), cy: y(p.value), r: 2.5 })),
    line.length > 1 && svg('path', { class: 'chart-line', d: path }),
    xLabels);
}
