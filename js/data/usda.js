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

// The key goes in a header rather than the URL, so it never appears in logs or browser history.
async function call(path, params, apiKey) {
  const query = new URLSearchParams(params);
  let response;
  try {
    response = await fetch(`${BASE}/${path}?${query}`, { headers: { 'X-Api-Key': apiKey || DEMO_KEY } });
  } catch {
    throw new UsdaError('Couldn’t reach the USDA food database. Check your internet connection.');
  }
  recordRequest(apiKey);
  if (response.status === 429) {
    recordLimitHit(apiKey);
    throw new UsdaError(apiKey
      ? 'The USDA lookup limit for your key has been reached. Try again in an hour.'
      : 'The shared USDA demo key has hit its hourly limit. Add your own free key in Settings → Food database, or try again later.');
  }
  if (response.status === 403) throw new UsdaError('The USDA API key in Settings isn’t valid.');
  if (!response.ok) throw new UsdaError(`The USDA food database returned an error (${response.status}).`);
  return response.json();
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
