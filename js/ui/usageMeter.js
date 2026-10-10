// Shows how much of the USDA lookup limit this device has used.
import { h } from './dom.js';
import { currentUsage } from '../data/usdaUsage.js';
import { fmt } from './format.js';

const time = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export function usageMeter(apiKey) {
  const { limits, limitHitAt } = currentUsage(apiKey);
  return h('div', { class: 'usage-meter' },
    limits.map((l) => {
      const pct = Math.min(100, (l.used / l.max) * 100);
      const tone = l.remaining === 0 ? 'warn' : pct >= 80 ? 'warn' : '';
      return h('div', { class: 'usage-row' },
        h('div', { class: 'nutrient-total-head' },
          h('span', {}, `Lookups in the last ${l.label}`),
          h('span', { class: 'muted' }, `${fmt(l.used)} of ${fmt(l.max)}`)),
        h('div', { class: `bar ${tone}`, role: 'progressbar', 'aria-label': `USDA lookups in the last ${l.label}`, 'aria-valuenow': l.used, 'aria-valuemin': 0, 'aria-valuemax': l.max },
          h('div', { class: 'bar-fill', style: `width:${pct}%` })),
        l.remaining === 0 && l.freesAt && h('small', { class: 'warn-text' }, `Limit reached. Lookups free up again from ${time(l.freesAt)}.`));
    }),
    limitHitAt && h('small', { class: 'warn-text' }, `USDA reported the limit was reached at ${time(limitHitAt)}. Lookups resume within the hour.`),
    h('small', { class: 'muted' },
      apiKey
        ? 'Counted on this device. If the same key is used on another phone, USDA counts both together.'
        : 'Counted on this device. The demo key is shared, so other apps on your network can use it up sooner.'));
}

// Lookups left in the tightest limit, for warnings before an import.
export const lookupsLeft = (apiKey) => Math.min(...currentUsage(apiKey).limits.map((l) => l.remaining));
