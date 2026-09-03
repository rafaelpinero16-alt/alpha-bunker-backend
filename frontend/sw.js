// 🔧 Elevado a v30 y reestructurado a Network-First
const CACHE_VERSION = 'v30';
const CACHE_NAME = `alphatom-vault-${CACHE_VERSION}`;

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

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Obliga al nuevo Service Worker a instalarse de inmediato
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // Destruye cualquier caché vieja estancada
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 🚀 ESTRATEGIA NETWORK-FIRST: Siempre busca cambios en Vercel primero
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => {
        // Fallback a caché SOLO si no hay internet
        return caches.match(event.request);
      })
  );
});