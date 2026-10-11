// Where a recipe came from: { url, author, photo: 'own' | 'source' }. Kept so the creator is credited
// and so sharing can leave out material that belongs to someone else.

const MAX_URL = 500;
const MAX_AUTHOR = 120;

// Returns a normalized http(s) URL, or null. Other schemes (javascript:, data:, file:) are refused,
// since the link is shown to the user and may come from a shared file.
export function safeWebUrl(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > MAX_URL) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

// "https://www.cookieandkate.com/best-…" → "cookieandkate.com"
export function siteName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export const cleanAuthor = (text) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_AUTHOR);

// Normalizes a source object (from the editor or a shared file); returns null when empty.
export function cleanSource(source) {
  if (!source || typeof source !== 'object') return null;
  const url = safeWebUrl(source.url);
  const author = cleanAuthor(source.author);
  const photo = source.photo === 'own' || source.photo === 'source' ? source.photo : null;
  return url || author || photo ? { url, author, photo } : null;
}

// A recipe counts as someone else's when it has a source link or creator.
export const isFromSource = (recipe) => Boolean(recipe.source?.url || recipe.source?.author);

// Photo belongs to someone else unless the person said it's their own. Photos on recipes with no
// source are assumed to be the person's own.
export const photoIsOwn = (recipe) => (recipe.source?.photo ? recipe.source.photo === 'own' : !isFromSource(recipe));

export function creditLine(source) {
  if (!source) return '';
  const site = source.url ? siteName(source.url) : '';
  return [source.author, site].filter(Boolean).join(' · ');
}
