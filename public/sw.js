// Service Worker — YaQu PWA
// SCRUM-45 (B): estáticos en NETWORK-FIRST — red primero (y refresco de la caché runtime);
// sin red, fallback a la caché = offline se conserva. Antes era cache-first sin revalidación
// y congelaba el dashboard tras cada deploy (bumps manuales v2/v3). El precache del SHELL
// queda SOLO como fallback offline de la primera visita.
const CACHE_NAME = 'yaqu-v4'; // último bump manual: con network-first ya no hace falta subirlo por deploy

// Shell de la app. Tiene que llevar TODOS los `<script src>` de dashboard/index.html — y desde
// SCRUM-274 eso ya no es una afirmación en un comentario: lo comprueba
// `tests/scrum274-shell-alineado.test.mjs`, en los DOS sentidos.
//
// La afirmación llevaba tiempo siendo falsa: al medirla, el HTML cargaba 31 scripts y aquí había
// 28. Faltaban `semaforoFiscal.js`, `quoteMargen.js` y `exportView.js` — o sea que la primera
// visita SIN COBERTURA ya se quedaba sin esas tres pantallas, y nada lo decía.
//
// ⚠️ El modo de fallo del otro sentido es peor: `cache.addAll` es ATÓMICO. Una sola ruta que ya
// no exista hace que RECHACE ENTERA — el precache no se queda a medias, se queda en NADA y el
// `install` falla. Por eso el guard mira también SHELL → HTML.
const SHELL = [
  '/dashboard/',
  '/tokens.css',
  '/dashboard/css/styles.css',
  '/dashboard/js/api.js',
  '/dashboard/js/selectorMetodoCobro.js',
  '/dashboard/js/contacto.js',
  '/dashboard/js/modalHeader.js', // SCRUM-446
  '/dashboard/js/jobNextAction.js',
  '/dashboard/js/semaforoFiscal.js',
  '/dashboard/js/homeView.js',
  '/dashboard/js/onboardingView.js',
  '/dashboard/js/plansView.js',
  '/dashboard/js/customersView.js',
  '/dashboard/js/quotesTabs.js', // SCRUM-432
  '/dashboard/js/quotesListView.js',
  '/dashboard/js/quoteMargen.js',
  '/dashboard/js/quoteSuplido.js',
  '/dashboard/js/quotesView.js',
  '/dashboard/js/quotesDetailView.js',
  '/dashboard/js/productsView.js',
  '/dashboard/js/providersView.js',
  '/dashboard/js/tipoDestinatarioPendiente.js', // SCRUM-615
  '/dashboard/js/invoicesView.js',
  '/dashboard/js/cobrosView.js', // SCRUM-285 (B4)
  '/dashboard/js/nuevaFacturaModal.js', // SCRUM-289 (A0.3)
  // SCRUM-302 (C2): la LEY del patrón va antes que los registros que la consumen — el mismo
  // orden que en el shell HTML, porque el registro lee sus globales al cargarse.
  '/dashboard/js/patronDetalleAcciones.js',
  '/dashboard/js/invoiceActionsRegistry.js',
  '/dashboard/js/quoteActionsRegistry.js',
  '/dashboard/js/invoiceDetailView.js',
  '/dashboard/js/jobActionsRegistry.js', // SCRUM-316 (G1)
  '/dashboard/js/jobDocsReparto.js', // SCRUM-319 (G4)
  '/dashboard/js/jobCobroHuecos.js', // SCRUM-320 (G5)
  '/dashboard/js/facturaPreEmision.js', // SCRUM-292 (A1)
  '/dashboard/js/jobRailBlocks.js', // SCRUM-318 (G3)
  '/dashboard/js/albaranActionsRegistry.js', // SCRUM-302 (C2)
  '/dashboard/js/albaranDetailView.js',
  '/dashboard/js/albaranesView.js', // SCRUM-301 (C1)
  '/dashboard/js/expensesView.js',
  '/dashboard/js/settingsSubmenus.js', // SCRUM-284
  '/dashboard/js/puertaSerie.js',
  '/dashboard/js/settingsView.js',
  '/dashboard/js/exportView.js',
  '/dashboard/js/libroRegistroView.js',
  '/dashboard/js/teamView.js',
  '/dashboard/js/jobsCierreTrabajo.js', // SCRUM-344
  '/dashboard/js/terminadoSinCobrar.js',
  '/dashboard/js/jobsView.js',
  '/dashboard/js/signaturePad.js',
  '/dashboard/js/jobDetailView.js',
  '/dashboard/js/voiceInput.js',
  '/dashboard/js/aiQuoteAssistant.js',
  '/dashboard/js/paidViaEtiquetas.js',
  '/dashboard/js/reportsView.js',
  '/dashboard/js/templatesView.js',
  '/dashboard/js/quoteRequestsView.js',
  '/dashboard/js/customerDetailView.js',
  '/dashboard/js/globalSearch.js',
  '/dashboard/js/csvImport.js',
  '/dashboard/js/tutorial.js',
  '/dashboard/js/almacenLocal.js',
  '/dashboard/js/estadoFirma.js',
  '/dashboard/js/colaDeFirmas.js',
  '/dashboard/js/resistenciaAlmacen.js',
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
    fetch(event.request)
      .then((resp) => {
        if (event.request.method === 'GET' && resp && resp.ok && url.origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() =>
        // SCRUM-274 · `ignoreSearch` NO es laxitud: sin él este fallback deja de existir.
        //
        // Desde SCRUM-274 el HTML pide `/dashboard/js/api.js?v=<huella>`, y la query ENTRA en la
        // clave de la Cache API igual que entra en la de Cloudflare (medido). El SHELL de arriba
        // se precachea con las rutas PELADAS, así que sin `ignoreSearch` un `caches.match` de la
        // URL con huella no casaría NUNCA con lo precacheado: el profesional sin cobertura se
        // quedaría sin dashboard y el precache pasaría a ser peso muerto.
        //
        // Y es seguro AQUÍ y solo aquí: esto es el camino de OFFLINE, al que solo se llega
        // cuando la red YA ha fallado. Servir una versión anterior es justo lo que se quiere en
        // ese caso — la alternativa no es «servir la nueva», es no servir nada. La frescura la
        // garantiza el network-first de arriba, que es quien manda mientras hay red.
        caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || Response.error())
      )
  );
});
