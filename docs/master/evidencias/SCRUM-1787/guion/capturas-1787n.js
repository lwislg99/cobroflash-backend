// SCRUM-1787n · la LISTA de presupuestos y la LISTA de facturas, lado a lado, en escritorio y móvil.
// `public/` de ESTE árbol servido en estático (`servidor-estatico.mjs <puerto>`); /admin/* lo contesta
// AQUÍ con datos de EJEMPLO. Contexto nuevo con service worker BLOQUEADO (`serviceWorkers: 'block'`):
// el SW del panel cachea /admin/* y se saltaría las rutas. Nada sale del puerto local (se cuenta).
// Antes de cada foto se EXIGE en el DOM la tabla con sus filas; si falta, el guion lanza y no captura.
// Lo que devuelve: las cabeceras leídas del DOM de cada lista (la comparación que la foto enseña).
// Uso (MCP de Playwright, `browser_run_code_unsafe`): globalThis.__dir1787 = <raíz del árbol>;
// globalThis.__puerto1787 = <puerto>; globalThis.__fase1787 = 'antes' | 'despues'.
async (page) => {
  const RAIZ = globalThis.__dir1787 || 'C:/Users/Javier Pereira/cobroflash-jv-j1hq';
  const DIR = RAIZ + '/docs/master/evidencias/SCRUM-1787/';
  const PUERTO = globalThis.__puerto1787 || 5789;
  const FASE = globalThis.__fase1787 || 'antes';
  const HOST = '127.0.0.1:' + PUERTO;
  const me = { merchantId: 1, userRole: 'admin', name: 'Ana', plan: 'pro', merchantName: 'Reformas Ejemplo', onboardingCompleted: true, country: 'ES' };
  const presupuestos = [
    { id: 31, number: 14, customerName: 'Cliente Ejemplo SL', status: 'sent', totalAmount: '1250.00', currency: 'EUR', method: 'card', createdAt: '2026-11-20T09:15:00Z', tags: ['Baños'] },
    { id: 32, number: 15, customerName: 'Marta Ejemplo', status: 'accepted', totalAmount: '480.50', currency: 'EUR', method: null, createdAt: '2026-11-18T16:40:00Z', tags: [] },
    { id: 33, number: 16, customerName: 'Comunidad Ejemplo', status: 'draft', totalAmount: '3120.00', currency: 'EUR', method: 'bank', createdAt: '2026-11-12T11:05:00Z', tags: ['Obra'] },
  ];
  const facturas = [
    { id: 41, number: 'F2026-0012', type: 'F1', customerName: 'Cliente Ejemplo SL', status: 'pending', total: '1250.00', currency: 'EUR', paidVia: null, createdAt: '2026-11-20T09:15:00Z', tags: ['Baños'] },
    { id: 42, number: 'F2026-0011', type: 'F1', customerName: 'Marta Ejemplo', status: 'paid', total: '480.50', currency: 'EUR', paidVia: 'transfer', createdAt: '2026-11-18T16:40:00Z', tags: [] },
    { id: 43, number: 'F2026-0010', type: 'F1', customerName: 'Comunidad Ejemplo', status: 'annulled', total: '3120.00', currency: 'EUR', paidVia: null, createdAt: '2026-11-12T11:05:00Z', tags: ['Obra'] },
  ];
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const fuera = []; const escrituras = []; const hechas = []; const dom = {};

  async function abrir(viewport, isMobile) {
    const ctx = await page.context().browser().newContext({ viewport, isMobile, hasTouch: isMobile, serviceWorkers: 'block', locale: 'es-ES' });
    await ctx.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname;
      if (u.host !== HOST) { fuera.push(req.method() + ' ' + u.host + p); return route.abort(); }
      if (/\.(js|css|html|svg|png|ico|woff2?|webmanifest|json)$/.test(p) || p.endsWith('/')) return route.continue();
      if (req.method() !== 'GET') { escrituras.push(req.method() + ' ' + p); return json(route, {}); }
      if (p === '/admin/me') return json(route, me);
      if (p === '/admin/merchant') return json(route, { id: 1, name: me.merchantName, country: 'ES', onboardingCompleted: true });
      if (p === '/admin/quotes') return json(route, presupuestos);
      if (p === '/admin/invoices') return json(route, facturas);
      if (/^\/admin\/(quotes|invoices|partes|quote-requests|precarga|metrics|team|albaranes)/.test(p)) return json(route, []);
      return json(route, {});
    });
    return { ctx, pg: await ctx.newPage() };
  }

  async function foto(pg, vista, nombre) {
    // El hash de entrada no lo respeta el arranque (abre Inicio): se entra por el router, como el menú.
    await pg.goto(`http://${HOST}/dashboard/`, { waitUntil: 'networkidle' });
    await pg.evaluate((v) => window.renderAppView(v), vista);
    await pg.waitForLoadState('networkidle');
    try { await pg.locator('table.table--cards-mobile tbody tr td.cell-client').first().waitFor({ state: 'visible', timeout: 8000 }); }
    catch (e) { throw new Error(`[${nombre}] la tabla de ${vista} NO tiene filas en pantalla — no se captura`); }
    const leido = await pg.evaluate(() => {
      const t = document.querySelector('table.table--cards-mobile');
      return {
        cabeceras: [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim()),
        filas: t.querySelectorAll('tbody tr').length,
      };
    });
    if (leido.filas !== 3) throw new Error(`[${nombre}] filas: ${leido.filas}`);
    dom[nombre] = leido;
    await pg.waitForTimeout(400);
    const buf = await pg.screenshot({ fullPage: false });
    return buf.toString('base64');
  }

  for (const [sufijo, viewport, movil] of [['escritorio', { width: 1280, height: 760 }, false], ['movil', { width: 390, height: 844 }, true]]) {
    const { ctx, pg } = await abrir(viewport, movil);
    const izq = await foto(pg, 'quotes-list', `presupuestos-${sufijo}`);
    const der = await foto(pg, 'invoices', `facturas-${sufijo}`);
    // Lado a lado: las dos fotos en una página en blanco (sin red) y una tercera foto de esa página.
    const lado = await ctx.browser().newContext({ viewport: { width: viewport.width * 2 + 24, height: viewport.height + 40 }, serviceWorkers: 'block' });
    const lp = await lado.newPage();
    await lp.setContent(`<body style="margin:0;background:#e5e7eb;display:flex;gap:24px;font:13px sans-serif">
      <figure style="margin:0"><figcaption style="padding:6px">Presupuestos</figcaption><img src="data:image/png;base64,${izq}" width="${viewport.width}"></figure>
      <figure style="margin:0"><figcaption style="padding:6px">Facturas</figcaption><img src="data:image/png;base64,${der}" width="${viewport.width}"></figure></body>`);
    const nombre = `1787n-listas-${FASE}-${sufijo}.png`;
    await lp.screenshot({ path: DIR + nombre, fullPage: true });
    hechas.push(nombre);
    await lado.close();
    await ctx.close();
  }
  return { hechas, fuera, escrituras, dom };
}
