// Service worker: lets the installed app open offline.
// Network-first, so new code is picked up whenever the device is online; the cache is the offline fallback.
const CACHE = 'weight-tracker-v38';
const SHELL = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'js/ui/app.js'];

self.addEventListener('install', (event) => {
  // 'reload' skips the browser's saved copies, so a new version never starts from old files.
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// GitHub Pages lets browsers reuse files for 10 minutes, so ask the server every time ('no-cache'
// revalidates: unchanged files come back as a tiny "not modified"). Updates then show on the next open.
const fresh = (request) => (request.mode === 'navigate'
  ? fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
  : fetch(new Request(request, { cache: 'no-cache' })));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fresh(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});
