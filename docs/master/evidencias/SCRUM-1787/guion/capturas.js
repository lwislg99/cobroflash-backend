// SCRUM-1787a · ficha de PRESUPUESTO | ficha de FACTURA, lado a lado, con el código real de main
// (e24f2828e) servido en estático en 127.0.0.1:5787 y /admin/* contestado AQUÍ con datos de EJEMPLO.
// Contexto nuevo con service worker BLOQUEADO (scrum1233g): el SW del panel cachea /admin/* y se
// saltaría las rutas. Nada sale de 127.0.0.1:5787. Tras cada navegación se EXIGE el bloque que la
// captura promete; si no está visible, el guion lanza y no captura.
async (page) => {
  const DIR = (globalThis.__dir1787 || 'C:/Users/Javier Pereira/cobroflash-jv-j1gu') + '/docs/master/evidencias/SCRUM-1787/';
  const PIE = 'SCRUM-1787a · código real de main e24f2828e con datos de EJEMPLO, no la app viva';
  const me = { merchantId: 1, userRole: 'admin', name: 'Ana', plan: 'pro', merchantName: 'Reformas Ejemplo', onboardingCompleted: true, country: 'ES' };
  const cliente = { id: 7, name: 'Cliente Ejemplo SL', phone: '+34600000000', email: 'cliente@ejemplo.test', taxId: 'B00000000' };
  const lineas = [
    { concept: 'Desmontaje de plato de ducha', qty: 1, price: 120, tax: 21 },
    { concept: 'Alicatado de pared', qty: 8, price: 18.5, tax: 21 },
  ];
  const quote = {
    id: 6, number: 6, status: 'sent', total: '254.10', currency: 'EUR', customerId: 7, customer: cliente,
    // 1.ª pasada: con `tax: 21` la ficha pintó «2.100 %» — el presupuesto guarda el IVA en FRACCIÓN.
    createdAt: '2026-11-12T09:00:00Z', updatedAt: '2026-11-13T09:00:00Z', lines: lineas.map((l) => ({ ...l, tax: l.tax / 100 })), decision: {},
    invoices: [], tiers: null, billingPlan: null, waDelivery: null, docHeaderText: null, docFooterText: null,
  };
  const invoice = {
    id: 9, number: 'F2026-0009', status: 'pending', total: '254.10', currency: 'EUR', customerId: 7, customer: cliente,
    customerName: cliente.name, customerTaxId: cliente.taxId, type: 'F1', createdAt: '2026-11-14T09:00:00Z',
    lines: lineas, quoteId: 6, charge: null, waDelivery: null, pdfUrl: null,
  };
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const fuera = []; const escrituras = []; const hechas = [];

  async function abrir(viewport, isMobile) {
    const ctx = await page.context().browser().newContext({ viewport, isMobile, hasTouch: isMobile, serviceWorkers: 'block', locale: 'es-ES' });
    await ctx.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname;
      if (u.host !== '127.0.0.1:5787') { fuera.push(req.method() + ' ' + u.host + p); return route.abort(); }
      if (/\.(js|css|html|svg|png|ico|woff2?|webmanifest|json)$/.test(p) || p.endsWith('/')) return route.continue();
      if (req.method() !== 'GET') { escrituras.push(req.method() + ' ' + p); return json(route, {}); }
      if (p === '/admin/me') return json(route, me);
      if (p === '/admin/merchant') return json(route, { id: 1, name: me.merchantName, country: 'ES', onboardingCompleted: true });
      if (p === '/admin/quotes/6') return json(route, quote);
      if (p === '/admin/invoices/9') return json(route, invoice);
      if (/^\/admin\/(quotes|invoices|partes|quote-requests|precarga|metrics|team|albaranes)/.test(p)) return json(route, []);
      return json(route, {});
    });
    return { ctx, pg: await ctx.newPage() };
  }
  async function exige(pg, sel, nombre) {
    try { await pg.locator(sel).first().waitFor({ state: 'visible', timeout: 8000 }); }
    catch (e) { throw new Error(`[${nombre}] NO está en pantalla: ${sel} — no se captura`); }
  }
  async function foto(pg, hash, sel, nombre) {
    await pg.goto('http://127.0.0.1:5787/dashboard/' + hash, { waitUntil: 'networkidle' });
    await exige(pg, sel, nombre);
    await pg.waitForTimeout(600);
    return pg.screenshot({ fullPage: false });
  }
  for (const [sufijo, viewport, movil] of [['escritorio', { width: 1280, height: 900 }, false], ['movil', { width: 390, height: 844 }, true]]) {
    const { ctx, pg } = await abrir(viewport, movil);
    const a = await foto(pg, '#quotes-detail/6', '.detail-total-amount', 'presupuesto-' + sufijo);
    const b = await foto(pg, '#invoice-detail/9', '.detail-total-amount', 'factura-' + sufijo);
    const lado = await ctx.newPage();
    await lado.setViewportSize({ width: viewport.width * 2 + 24, height: viewport.height + 60 });
    await lado.setContent(`<body style="margin:0;font:600 14px system-ui;background:#e5e7eb">
      <div style="display:flex;gap:24px"><div><div style="padding:6px">PRESUPUESTO</div><img src="data:image/png;base64,${a.toString('base64')}"></div>
      <div><div style="padding:6px">FACTURA</div><img src="data:image/png;base64,${b.toString('base64')}"></div></div>
      <div style="padding:6px;background:#111827;color:#fff;text-align:center">${PIE}</div></body>`);
    const nombre = `ficha-lado-a-lado-${sufijo}.png`;
    await lado.screenshot({ path: DIR + nombre, fullPage: true });
    hechas.push(nombre);
    await ctx.close();
  }
  return { hechas, fuera, escrituras };
}
