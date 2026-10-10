// Counting API requests against rolling limits, e.g. 1,000 per hour.
// Requests are timestamps (ms since 1970); limits are { max, windowMs }.

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

// USDA FoodData Central keys are issued by api.data.gov. A personal key allows 1,000 requests in any
// rolling hour; the shared DEMO_KEY allows 30 an hour and 50 a day per internet connection.
export const USDA_LIMITS = {
  personal: [{ label: 'hour', max: 1000, windowMs: HOUR_MS }],
  demo: [{ label: 'hour', max: 30, windowMs: HOUR_MS }, { label: 'day', max: 50, windowMs: DAY_MS }],
};

// For each limit: { label, max, used, remaining, freesAt } where freesAt is when the oldest counted
// request leaves the window (null when nothing is counted).
export function usage(timestamps, limits, now) {
  return limits.map(({ label, max, windowMs }) => {
    const inWindow = timestamps.filter((t) => t > now - windowMs).sort((a, b) => a - b);
    return {
      label,
      max,
      used: inWindow.length,
      remaining: Math.max(0, max - inWindow.length),
      freesAt: inWindow.length ? inWindow[0] + windowMs : null,
    };
  });
}

// Only the longest window's worth of history is needed.
export const prune = (timestamps, limits, now) => {
  const longest = Math.max(...limits.map((l) => l.windowMs));
  return timestamps.filter((t) => t > now - longest);
};
