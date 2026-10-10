// Concentric goal rings with a star in the middle that lights up when every ring is complete.
import { svg } from './dom.js';

const SIZE = 160;
const C = SIZE / 2;

// rings: [{ color, progress (0–1), complete, over, label }], outermost first.
export function ringChart(rings, allComplete, label) {
  const width = rings.length <= 3 ? 14 : 12;
  const gap = 3;
  const radius = (i) => C - 4 - width / 2 - i * (width + gap);

  const ringEls = rings.map((ring, i) => {
    const r = radius(i);
    const circumference = 2 * Math.PI * r;
    const colorClass = ring.over ? 'ring-over' : `ring-${ring.color}`;
    return svg('g', { class: colorClass },
      svg('circle', { class: 'ring-track', cx: C, cy: C, r, 'stroke-width': width }),
      ring.progress > 0 && svg('circle', {
        class: 'ring-fill',
        cx: C, cy: C, r,
        'stroke-width': width,
        'stroke-dasharray': ring.progress >= 1 ? null : `${ring.progress * circumference} ${circumference}`,
        transform: `rotate(-90 ${C} ${C})`,
      }));
  });

  // The star fills the space inside the innermost ring.
  const inner = rings.length ? radius(rings.length - 1) - width / 2 - 4 : C - 8;
  const starRadius = Math.max(12, Math.min(inner, 44));

  return svg('svg', { class: 'ring-chart', viewBox: `0 0 ${SIZE} ${SIZE}`, role: 'img', 'aria-label': label },
    ringEls,
    svg('path', { class: allComplete ? 'ring-star lit' : 'ring-star', d: starPath(C, C, starRadius, starRadius * 0.45) }));
}

function starPath(cx, cy, outer, inner) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const angle = (-90 + i * 36) * (Math.PI / 180);
    const r = i % 2 === 0 ? outer : inner;
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join(' L')} Z`;
}
