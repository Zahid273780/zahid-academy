// Shaheen Institute Service Worker
// Update this version number whenever you deploy major changes
const CACHE_VERSION = 'shaheen-v2';

const STATIC_ASSETS = [
  '/login.html',
  '/portal.html',
  '/index.html',
  '/Navi.html',
  '/givetest.html',
  '/mistake-bucket.html',
  '/student-analytics.html',
  '/offline.html',
  '/login.css',
  '/portal.css',
  '/index.css',
  '/Navi.css',
  '/givetest.css',
  '/mistake-bucket.css',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/Logo.png'
];

// Install: cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first, fall back to cache, then offline page
self.addEventListener('fetch', event => {
  // Skip non-GET and API requests — always go to network for those
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Save a fresh copy in cache
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
