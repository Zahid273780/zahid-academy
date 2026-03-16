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
// Runtime cache name for nav API (separate so it can be wiped independently)
const NAV_CACHE = 'navi-api-v1';
const NAV_CACHE_TTL = 120 * 1000; // 120 seconds

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ── Stale-while-revalidate for student-nav API only ──
  if (event.request.method === 'POST' && url.pathname === '/api/student-nav' && url.origin === self.location.origin) {
    event.respondWith(
      caches.open(NAV_CACHE).then(cache =>
        cache.match('student-nav').then(cached => {
          const networkFetch = fetch(event.request).then(response => {
            if (response && response.ok) {
              const copy = response.clone();
              const headers = new Headers(copy.headers);
              headers.set('sw-cached-at', String(Date.now()));
              copy.text().then(body => {
                cache.put('student-nav', new Response(body, {
                  status: copy.status,
                  statusText: copy.statusText,
                  headers: headers
                }));
              });
            }
            return response;
          });

          if (cached) {
            const cachedAt = Number(cached.headers.get('sw-cached-at') || 0);
            if (Date.now() - cachedAt < NAV_CACHE_TTL) {
              // Fresh enough — serve cached, revalidate in background
              networkFetch.catch(() => {});
              return cached;
            }
          }
          // No cache or expired — wait for network
          return networkFetch;
        })
      )
    );
    return;
  }

  // Skip non-GET and other API requests — always go to network for those
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  // Skip cross-origin requests (CDN fonts, icons etc)
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => cached || caches.match('/offline.html'))
      )
  );
});
