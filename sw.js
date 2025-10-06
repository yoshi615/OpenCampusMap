
const CACHE_NAME = 'reitaku-map-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/map.js',
  '/getdata.js',
  '/manifest.json',
  '/images/pwa_icon_192.png',
  '/images/pwa_icon_512.png',
  'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
