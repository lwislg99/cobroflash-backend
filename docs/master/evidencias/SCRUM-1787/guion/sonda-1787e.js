// SCRUM-1787e · SONDA + CAPTURAS de la tabla de CONCEPTOS en la ficha de FACTURA y en la del PRESUPUESTO,
// a 390 px (móvil) y a 1280 px (escritorio, control: tiene que seguir igual). Código del árbol servido por
// `servidor-estatico.mjs` (puerto en globalThis.__puerto1787e, por defecto 5788); /admin/* lo contesta
// ESTE guion con datos de EJEMPLO. Contexto nuevo con `serviceWorkers: 'block'` (scrum1233g). Nada sale de
// 127.0.0.1. La fase (antes/despues) la lee del DOM de la factura: solo cambia el nombre de las capturas.
//
// Qué mide, por vista y anchura, sobre la PRIMERA línea con importe (no la cabecera de apartado):
//   · pagina   = scrollWidth del documento − ancho de la ventana (>0: la PÁGINA scrollea de lado);
//   · carril   = scrollWidth − clientWidth de la tabla (>0: la tabla esconde columnas tras su propio scroll);
//   · visibles = cuántas de las 5 celdas caben ENTERAS dentro de la ventana y de la caja de la tabla.
// El defecto es visibles < 5 en móvil. Si la sección Conceptos no aparece, la sonda LANZA (CIEGO), no da 0.
async (page) => {
  const PUERTO = globalThis.__puerto1787e || 5788;
  let FASE = null; // la fase la dice el DOM: con `.j1-fac-conceptos` es «despues»
  const DIR = (globalThis.__dir1787e || 'C:/Users/Javier Pereira/cobroflash-jv-j1ha') + '/docs/master/evidencias/SCRUM-1787/';
  const HOST = '127.0.0.1:' + PUERTO;
  const me = { merchantId: 1, userRole: 'admin', name: 'Ana', plan: 'pro', merchantName: 'Reformas Ejemplo', onboardingCompleted: true, country: 'ES' };
  const cliente = { id: 7, name: 'Cliente Ejemplo SL', phone: '+34600000000', email: 'cliente@ejemplo.test', taxId: 'B00000000' };
  const lineas = [
    { apartado: true, concept: 'Baño' },
    { concept: 'Desmontaje de plato de ducha', qty: 1, price: 120, tax: 0.21 },
    { concept: 'Alicatado de pared', qty: 8, price: 18.5, tax: 0.21 },
  ];
  const quote = {
    id: 6, number: 6, status: 'sent', total: '324.28', currency: 'EUR', customerId: 7, customer: cliente,
    createdAt: '2026-11-12T09:00:00Z', updatedAt: '2026-11-13T09:00:00Z', lines: lineas, decision: {},
    invoices: [], tiers: null, billingPlan: null, waDelivery: null, docHeaderText: null, docFooterText: null,
  };
  const invoice = {
    id: 9, number: 'F2026-0009', status: 'pending', type: 'F1', total: '324.28', currency: 'EUR', customerId: 7, customer: cliente,
    customerName: cliente.name, customerTaxId: cliente.taxId, customerPhone: cliente.phone, customerEmail: cliente.email,
    createdAt: '2026-11-14T09:00:00Z', quoteId: 6, charge: null, waDelivery: null, pdfUrl: null, rectifiedBy: [], lines: lineas,
  };
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  const fuera = []; const hechas = []; const medidas = {};
  const VISTAS = [['factura', '#invoice-detail/9'], ['presupuesto', '#quotes-detail/6']];
  for (const [sufijo, viewport, movil] of [['movil', { width: 390, height: 844 }, true], ['escritorio', { width: 1280, height: 900 }, false]]) {
    const ctx = await page.context().browser().newContext({ viewport, isMobile: movil, hasTouch: movil, serviceWorkers: 'block', locale: 'es-ES' });
    await ctx.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname;
      if (u.host !== HOST) { fuera.push(req.method() + ' ' + u.host + p); return route.abort(); }
      if (/\.(js|css|html|svg|png|ico|woff2?|webmanifest|json)$/.test(p) || p.endsWith('/')) return route.continue();
      if (req.method() !== 'GET') return json(route, {});
      if (p === '/admin/me') return json(route, me);
      if (p === '/admin/merchant') return json(route, { id: 1, name: me.merchantName, country: 'ES', onboardingCompleted: true });
      if (p === '/admin/invoices/9') return json(route, invoice);
      if (p === '/admin/quotes/6') return json(route, quote);
      if (/^\/admin\/(quotes|invoices|partes|quote-requests|precarga|metrics|team|albaranes)/.test(p)) return json(route, []);
      return json(route, {});
    });
    const pg = await ctx.newPage();
    for (const [vista, hash] of VISTAS) {
      await pg.goto(`http://${HOST}/dashboard/${hash}`, { waitUntil: 'networkidle' });
      await pg.reload({ waitUntil: 'networkidle' });
      await pg.waitForTimeout(400);
      const m = await pg.evaluate(() => {
        const sec = [...document.querySelectorAll('.detail-section')].find((s) => (s.querySelector('.detail-section-title') || {}).textContent === 'Conceptos');
        if (!sec) return null;
        const tabla = sec.querySelector('table');
        const fila = [...tabla.querySelectorAll('tbody tr')].find((tr) => tr.children.length === 5);
        const caja = tabla.getBoundingClientRect();
        const tope = Math.min(window.innerWidth, caja.right) + 0.5;
        const celdas = [...fila.children].map((td) => { const r = td.getBoundingClientRect(); return { texto: td.textContent.trim().slice(0, 30), izq: Math.round(r.left), der: Math.round(r.right), cabe: r.width > 0 && r.left >= Math.max(0, caja.left) - 0.5 && r.right <= tope }; });
        return {
          ventana: window.innerWidth,
          pagina: document.documentElement.scrollWidth - window.innerWidth,
          carril: tabla.scrollWidth - tabla.clientWidth,
          visibles: celdas.filter((c) => c.cabe).length,
          celdas,
        };
      });
      if (FASE === null) FASE = (await pg.locator('.j1-fac-conceptos').count()) ? 'despues' : 'antes';
      if (!m) throw new Error(`[${vista}-${sufijo}] la sección Conceptos NO está en pantalla — sonda CIEGA`);
      medidas[`${vista}-${sufijo}`] = m;
      const nombre = `1787e-${FASE}-${vista}-${sufijo}.png`;
      await pg.locator('.detail-section-title', { hasText: 'Conceptos' }).first().scrollIntoViewIfNeeded();
      await pg.screenshot({ path: DIR + nombre, fullPage: false });
      hechas.push(nombre);
    }
    await ctx.close();
  }
  return { fase: FASE, hechas, fuera, medidas };
}
