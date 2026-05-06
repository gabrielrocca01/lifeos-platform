// ============================================================
// Finance OS — Service Worker
// Strategia: cache-first per assets statici,
//            network-first per le API (dati sempre freschi)
// ============================================================

const CACHE_NAME = 'finance-os-v1';
const OFFLINE_URL = '/offline.html';

// Assets statici da cachare subito all'installazione
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:ital,wght@0,300;0,600;1,300&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
];

// ---- INSTALL: precache assets statici ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Precache parziale:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE: pulizia vecchie cache ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- FETCH: strategia ibrida ----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls → network-first (dati sempre aggiornati)
  // Se offline → risponde con errore JSON leggibile
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ success: false, error: 'Offline — backend non raggiungibile', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Assets statici → cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        // Copia nella cache solo risposte valide
        if (response.status === 200 && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback offline per navigazione SPA
        if (request.destination === 'document') {
          return caches.match('/index.html') ??
            caches.match(OFFLINE_URL) ??
            new Response('Offline', { status: 503 });
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ---- SYNC: quando torna online, notifica l'app ----
self.addEventListener('online', () => {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage({ type: 'ONLINE' }));
  });
});
