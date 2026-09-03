// 🔧 Incrementado a v20 para sincronizar con el index.html y forzar actualización
const CACHE_VERSION = 'v20';
const CACHE_NAME = `alphatom-vault-${CACHE_VERSION}`;

// Assets estáticos del frontend (Incluyendo el nuevo chat.js)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/security.js',
  './js/translations.js',
  './js/api.js',
  './js/chat.js',
  './js/app.js'
];

// 🔒 Dominios que NUNCA deben cachearse (Para evitar saldos y rangos congelados)
const NEVER_CACHE_HOSTNAMES = [
  'alpha-bunker-backend-production.up.railway.app'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Llamadas al backend: siempre network-first, nunca desde caché
  if (NEVER_CACHE_HOSTNAMES.includes(url.hostname)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Assets estáticos propios: cache-first con fallback a network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        return caches.match('./index.html');
      });
    })
  );
});