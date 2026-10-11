// A front-view body outline that shows a tape where to measure. The figure faces you, so the
// person's left side is on the right of the drawing. show(key) moves the tape; show(null) hides it.
import { svg, h } from './dom.js';

// Tape bands: centre x, y, half-width, tilt (degrees). Keys match measurements.activeFields().
const TAPES = {
  neck: { x: 100, y: 64, rx: 11 },
  chest: { x: 100, y: 110, rx: 41 },
  waist: { x: 100, y: 178, rx: 29 },
  hips: { x: 100, y: 222, rx: 39 },
  armRight: { x: 54, y: 128, rx: 12, tilt: 12 },
  armLeft: { x: 146, y: 128, rx: 12, tilt: -12 },
  thighRight: { x: 81, y: 266, rx: 18 },
  thighLeft: { x: 119, y: 266, rx: 18 },
  calfRight: { x: 80, y: 350, rx: 15 },
  calfLeft: { x: 120, y: 350, rx: 15 },
};

// A small colored body icon marking what an estimate uses: 'fat' (light blue) or 'bmi' (light purple).
export const ESTIMATE_LABELS = { fat: 'Body fat', bmi: 'BMI' };

export const estimateIcon = (kind) =>
  svg('svg', { class: `estimate-icon estimate-${kind}`, viewBox: '0 0 16 16', role: 'img', 'aria-label': `Used for ${ESTIMATE_LABELS[kind]}` },
    svg('title', {}, `Used for ${ESTIMATE_LABELS[kind]}`),
    svg('circle', { cx: 8, cy: 3.4, r: 2.5 }),
    svg('path', { d: 'M8 6.6c-2.6 0-4.1 1.2-4.1 3.2v1.6h2.1v4h4v-4h2.1V9.8c0-2-1.5-3.2-4.1-3.2Z' }));

export function bodyFigure() {
  const limb = (points, width) => svg('polyline', { class: 'figure-limb', points, 'stroke-width': width });
  const tape = svg('g', { class: 'figure-tape', hidden: true },
    svg('ellipse', { class: 'tape-band', cx: 0, cy: 0, rx: 10, ry: 4 }),
    svg('ellipse', { class: 'tape-ticks', cx: 0, cy: 0, rx: 10, ry: 4 }));
  const [band, ticks] = tape.children;

  const el = svg('svg', { class: 'body-figure', viewBox: '0 0 200 420', role: 'img', 'aria-label': 'Where to measure' },
    svg('g', { class: 'figure-body' },
      svg('circle', { cx: 100, cy: 34, r: 20 }),
      limb('100,50 100,74', 20),
      svg('path', { d: 'M66,78 Q100,68 134,78 L139,98 Q137,132 129,160 Q124,180 129,198 Q139,216 137,238 L63,238 Q61,216 71,198 Q76,180 71,160 Q63,132 61,98 Z' }),
      limb('63,88 50,160 44,234', 18),
      limb('137,88 150,160 156,234', 18),
      limb('82,232 80,322 82,402', 30),
      limb('118,232 120,322 118,402', 30)),
    tape,
    svg('text', { class: 'figure-side', x: 36, y: 416, 'text-anchor': 'middle' }, 'R'),
    svg('text', { class: 'figure-side', x: 164, y: 416, 'text-anchor': 'middle' }, 'L'));

  const show = (key) => {
    const t = TAPES[key];
    tape.toggleAttribute('hidden', !t);
    if (!t) return;
    tape.setAttribute('transform', `translate(${t.x} ${t.y}) rotate(${t.tilt ?? 0})`);
    for (const e of [band, ticks]) { e.setAttribute('rx', t.rx + 2); e.setAttribute('ry', Math.max(3, t.rx * 0.22)); }
  };
  return { el: h('div', { class: 'figure-wrap' }, el), show };
}
