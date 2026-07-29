// Service Worker — YaQu PWA
// SCRUM-45 (B): estáticos en NETWORK-FIRST — red primero (y refresco de la caché runtime);
// sin red, fallback a la caché = offline se conserva. Antes era cache-first sin revalidación
// y congelaba el dashboard tras cada deploy (bumps manuales v2/v3). El precache del SHELL
// queda SOLO como fallback offline de la primera visita.
const CACHE_NAME = 'yaqu-v4'; // último bump manual: con network-first ya no hace falta subirlo por deploy

// Shell de la app (alineado con los <script src> reales de dashboard/index.html — SCRUM-45)
const SHELL = [
  '/dashboard/',
  '/tokens.css',
  '/dashboard/css/styles.css',
  '/dashboard/js/api.js',
  '/dashboard/js/homeView.js',
  '/dashboard/js/onboardingView.js',
  '/dashboard/js/plansView.js',
  '/dashboard/js/customersView.js',
  '/dashboard/js/quotesListView.js',
  '/dashboard/js/quotesView.js',
  '/dashboard/js/quotesDetailView.js',
  '/dashboard/js/productsView.js',
  '/dashboard/js/providersView.js',
  '/dashboard/js/invoicesView.js',
  '/dashboard/js/invoiceDetailView.js',
  '/dashboard/js/expensesView.js',
  '/dashboard/js/settingsView.js',
  '/dashboard/js/teamView.js',
  '/dashboard/js/jobsView.js',
  '/dashboard/js/signaturePad.js',
  '/dashboard/js/jobDetailView.js',
  '/dashboard/js/voiceInput.js',
  '/dashboard/js/aiQuoteAssistant.js',
  '/dashboard/js/reportsView.js',
  '/dashboard/js/templatesView.js',
  '/dashboard/js/quoteRequestsView.js',
  '/dashboard/js/customerDetailView.js',
  '/dashboard/js/globalSearch.js',
  '/dashboard/js/csvImport.js',
  '/dashboard/js/tutorial.js',
  '/dashboard/js/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API y señales de versión: directo a red, sin cache (el poll de /version DEBE ver el deploy)
  if (url.pathname.startsWith('/admin/') || url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/quote') || url.pathname.startsWith('/webhooks/') ||
      url.pathname === '/version' || url.pathname.startsWith('/health')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Estáticos (HTML/JS/CSS/img): NETWORK-FIRST. La respuesta buena refresca la caché
  // runtime; si la red falla (offline), se sirve lo último cacheado.
  event.respondWith(
    // SCRUM-224: `no-cache` REVALIDA con If-None-Match (304 si no cambió). Sin esto, este `fetch`
    // respeta la caché HTTP del navegador y sirve el estático RANCIO hasta `max-age` (14400 s en
    // prod — las CABECERAS son SCRUM-231, no se tocan aquí): el network-first se volvía caché-first.
    // La caída a caché de abajo (offline) NO se toca; NO `reload` (descargaría entero, ignora el ETag).
    fetch(event.request, { cache: 'no-cache' })
      .then((resp) => {
        if (event.request.method === 'GET' && resp && resp.ok && url.origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || Response.error())
      )
  );
});

// SCRUM-224: el cliente puede preguntar qué CACHE_NAME corre ESTE SW (instrumentación de rancio:
// app.js lo adjunta al poll de /version). ADITIVO — no toca install/activate/fetch ni el ciclo de
// vida. Responde por el port del MessageChannel que manda el cliente.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_CACHE_NAME' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ cacheName: CACHE_NAME });
  }
});
