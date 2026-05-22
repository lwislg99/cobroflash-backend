// Service Worker — PresuFácil PWA
const CACHE_NAME = 'presufacil-v1';

// Recursos estáticos del dashboard (shell de la app)
const SHELL = [
  '/dashboard/',
  '/dashboard/css/styles.css',
  '/dashboard/js/api.js',
  '/dashboard/js/app.js',
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
  '/dashboard/js/settingsView.js',
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

  // API calls: network first, sin cache
  if (url.pathname.startsWith('/admin/') || url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/quote') || url.pathname.startsWith('/webhooks/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Shell y estáticos: cache first, fallback network
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
