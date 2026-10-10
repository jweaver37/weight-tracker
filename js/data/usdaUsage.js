// Remembers this device's USDA requests so Settings can show how much of the limit is used.
// USDA doesn't let web pages read its own count, so this counts what this app sent from this device.
// Kept in localStorage: it's a convenience and fine to lose (e.g. if browser data is cleared).
import { DAY_MS, prune, usage, USDA_LIMITS } from '../core/rateLimit.js';

const STORAGE_KEY = 'usdaRequests';

// Demo-key and personal-key requests are counted separately; a new personal key starts fresh.
const bucketFor = (apiKey) => (apiKey ? `key:${apiKey.slice(-4)}` : 'demo');
const limitsFor = (apiKey) => (apiKey ? USDA_LIMITS.personal : USDA_LIMITS.demo);

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function store(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode): the meter just won't remember.
  }
}

export function recordRequest(apiKey, now = Date.now()) {
  const data = load();
  const bucket = bucketFor(apiKey);
  const entry = data[bucket] ?? { requests: [], limitHitAt: null };
  entry.requests = prune([...entry.requests, now], limitsFor(apiKey), now);
  data[bucket] = entry;
  // Drop buckets for old keys once they have nothing recent.
  for (const [k, v] of Object.entries(data)) if (k !== bucket && !v.requests?.some((t) => t > now - DAY_MS)) delete data[k];
  store(data);
}

// Called when USDA answers "too many requests", so the meter can say so even if counts differ
// (for example when the same key is used on another device).
export function recordLimitHit(apiKey, now = Date.now()) {
  const data = load();
  const bucket = bucketFor(apiKey);
  data[bucket] = { requests: data[bucket]?.requests ?? [], limitHitAt: now };
  store(data);
}

// { limits: [{ label, max, used, remaining, freesAt }], limitHitAt }
export function currentUsage(apiKey, now = Date.now()) {
  const entry = load()[bucketFor(apiKey)] ?? { requests: [], limitHitAt: null };
  const limits = limitsFor(apiKey);
  const recentHit = entry.limitHitAt && entry.limitHitAt > now - limits[0].windowMs ? entry.limitHitAt : null;
  return { limits: usage(entry.requests ?? [], limits, now), limitHitAt: recentHit };
}
