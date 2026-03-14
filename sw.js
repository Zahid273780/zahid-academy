// Shaheen Institute Service Worker
// Strategy: Network first, cache as backup (always fresh when online)
const CACHE_VERSION = 'shaheen-v3';

// Install: only cache the offline fallback page
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.add('/offline.html')).catch(() => {})
  );
  self.skipWaiting();
});

// Activate: remove all old caches immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: always try network first
// If network succeeds -> save to cache + return fresh response
// If network fails -> serve from cache (student visited before)
// If not in cache either -> show offline page
self.addEventListener('fetch', event => {
  // Skip non-GET and API requests — always go to network for those
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  // Skip cross-origin requests (CDN fonts, icons etc)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Network succeeded — save a fresh copy in cache and return it
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        // Network failed — try cache, then offline page
        caches.match(event.request).then(cached => cached || caches.match('/offline.html'))
      )
  );
});
