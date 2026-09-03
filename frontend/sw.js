// 🔧 Versión v31 - Service Worker Blindado contra dominios externos
const CACHE_VERSION = 'v31';
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

// 🚀 FETCH BLINDADO: Ignora dominios externos de wallets para evitar el error de Response
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Si la petición es externa (APIs, TonConnect, CDNs de imágenes externas), déjala pasar libremente sin cachear
  if (url.origin !== location.origin) {
    return;
  }

  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});