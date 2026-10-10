// USDA FoodData Central API (https://fdc.nal.usda.gov). Free; a personal key allows ~1,000 requests an hour,
// the shared DEMO_KEY only ~30.
import { recordLimitHit, recordRequest } from './usdaUsage.js';

const BASE = 'https://api.nal.usda.gov/fdc/v1';
export const DEMO_KEY = 'DEMO_KEY';
// Generic foods with portion weights; branded foods come in Phase 2 with barcode scanning.
const DATA_TYPES = 'Foundation,SR Legacy';

export class UsdaError extends Error {}

// api.data.gov keys are 40 letters and digits; this catches pasting the wrong thing.
export const looksLikeApiKey = (key) => /^[A-Za-z0-9]{32,64}$/.test(key);

// USDA's service sometimes fails to answer for a moment. When it does, the browser reports only a
// generic network error (the failed reply carries no CORS headers), so these are retried.
const RETRY_DELAYS_MS = [700, 2000];
const RETRYABLE_STATUS = new Set([408, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, apiKey) {
  for (let attempt = 0; ; attempt++) {
    recordRequest(apiKey); // counts every attempt, since USDA may count it too
    let response = null;
    let failure = null;
    try {
      response = await fetch(url, options);
    } catch (err) {
      failure = err;
    }
    const retryable = failure || RETRYABLE_STATUS.has(response.status);
    if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
      if (failure) {
        console.warn('USDA request failed after retries', failure);
        throw new UsdaError(navigator.onLine === false
          ? 'Your device is offline. Connect to the internet and tap Try again.'
          : 'The USDA food database didn’t respond. It is sometimes briefly unavailable — tap Try again in a minute.');
      }
      return response;
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

// The key goes in the URL's api_key parameter, not an X-Api-Key header: a custom header makes the
// browser send a CORS preflight first, and api.data.gov fails those intermittently (4 of 10 in a
// test, versus 0 of 10 with the key in the URL). The URL is encrypted in transit (HTTPS) and
// background requests don't enter browser history. Never log the URL.
async function call(path, params, apiKey) {
  const query = new URLSearchParams({ ...params, api_key: apiKey || DEMO_KEY });
  const response = await fetchWithRetry(`${BASE}/${path}?${query}`, {}, apiKey);
  if (response.status === 429) {
    recordLimitHit(apiKey);
    throw new UsdaError(apiKey
      ? 'The USDA lookup limit for your key has been reached. Try again in an hour.'
      : 'The shared USDA demo key has hit its hourly limit. Add your own free key in Settings → Food database, or try again later.');
  }
  if (response.status === 403) throw new UsdaError('The USDA API key in Settings isn’t valid.');
  if (!response.ok) {
    console.warn('USDA request error', response.status, await response.text().catch(() => ''));
    throw new UsdaError(`The USDA food database returned an error (${response.status}). Tap Try again in a minute.`);
  }
  try {
    return await response.json();
  } catch {
    throw new UsdaError('The USDA food database sent an incomplete reply. Tap Try again.');
  }
}

export async function searchFoods(query, apiKey, pageSize = 12) {
  const result = await call('foods/search', { query, dataType: DATA_TYPES, pageSize }, apiKey);
  return result.foods ?? [];
}

// Full details (including portion weights) for several foods in one request.
export function getFoods(fdcIds, apiKey) {
  if (!fdcIds.length) return Promise.resolve([]);
  return call('foods', { fdcIds: fdcIds.join(','), format: 'full' }, apiKey);
}
