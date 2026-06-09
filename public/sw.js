const CACHE_NAME = 'taze-v1';
const urlsToCache = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.hostname === 'api.taze.to') return;

  event.respondWith(caches.match(event.request).then((response) => response || fetch(event.request)));
});
