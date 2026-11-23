// SCRUM-1787b · la FICHA DE FACTURA nueva en tres estados (pendiente, cobrada, anulada), escritorio y
// móvil, con el código de la rama servido en estático en 127.0.0.1:5787 y /admin/* contestado AQUÍ con
// datos de EJEMPLO. Contexto nuevo con service worker BLOQUEADO (`serviceWorkers: 'block'`, scrum1233g):
// el SW del panel cachea /admin/* y se saltaría las rutas. Nada sale de 127.0.0.1:5787. Tras cada
// navegación se EXIGE en el DOM lo que la captura promete (título con número, pasos de progreso,
// «Siguiente paso», «Conceptos»); si falta, el guion lanza y no captura.
async (page) => {
  const DIR = (globalThis.__dir1787 || 'C:/Users/Javier Pereira/cobroflash-jv-j1gy') + '/docs/master/evidencias/SCRUM-1787/';
  const me = { merchantId: 1, userRole: 'admin', name: 'Ana', plan: 'pro', merchantName: 'Reformas Ejemplo', onboardingCompleted: true, country: 'ES' };
  const cliente = { id: 7, name: 'Cliente Ejemplo SL', phone: '+34600000000', email: 'cliente@ejemplo.test' };
  const base = {
    id: 9, number: 'F2026-0009', status: 'pending', type: 'F1', total: '324.28', currency: 'EUR', customerId: 7, customer: cliente,
    customerName: cliente.name, customerTaxId: 'B00000000', customerPhone: cliente.phone, customerEmail: cliente.email,
    createdAt: '2026-11-14T09:00:00Z', quoteId: 6, charge: null, waDelivery: null, pdfUrl: null, rectifiedBy: [],
    lines: [
      { apartado: true, concept: 'Baño' },
      { concept: 'Desmontaje de plato de ducha', qty: 1, price: 120, tax: 0.21 },
      { concept: 'Alicatado de pared', qty: 8, price: 18.5, tax: 0.21 },
    ],
  };
  const ESTADOS = {
    pendiente: { ...base },
    cobrada: { ...base, status: 'paid', paidAt: '2026-11-16T10:00:00Z', paidVia: 'bizum', chargeId: 3, waDelivery: { status: 'read' } },
    anulada: { ...base, status: 'annulled', waDelivery: { status: 'delivered' } },
  };
  const PASOS = { pendiente: ['Emitida', 'Enviada', 'Cobrada'], cobrada: ['Emitida', 'Enviada', 'Cobrada'], anulada: ['Emitida', 'Enviada', 'ANULADA'] };
  let actual = ESTADOS.pendiente;
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const fuera = []; const escrituras = []; const hechas = []; const dom = {};

  async function abrir(viewport, isMobile) {
    const ctx = await page.context().browser().newContext({ viewport, isMobile, hasTouch: isMobile, serviceWorkers: 'block', locale: 'es-ES' });
    await ctx.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname;
      if (u.host !== '127.0.0.1:5787') { fuera.push(req.method() + ' ' + u.host + p); return route.abort(); }
      if (/\.(js|css|html|svg|png|ico|woff2?|webmanifest|json)$/.test(p) || p.endsWith('/')) return route.continue();
      if (req.method() !== 'GET') { escrituras.push(req.method() + ' ' + p); return json(route, {}); }
      if (p === '/admin/me') return json(route, me);
      if (p === '/admin/merchant') return json(route, { id: 1, name: me.merchantName, country: 'ES', onboardingCompleted: true });
      if (p === '/admin/invoices/9') return json(route, actual);
      if (/^\/admin\/(quotes|invoices|partes|quote-requests|precarga|metrics|team|albaranes)/.test(p)) return json(route, []);
      return json(route, {});
    });
    return { ctx, pg: await ctx.newPage() };
  }
  for (const [sufijo, viewport, movil] of [['escritorio', { width: 1280, height: 900 }, false], ['movil', { width: 390, height: 844 }, true]]) {
    const { ctx, pg } = await abrir(viewport, movil);
    for (const estado of Object.keys(ESTADOS)) {
      actual = ESTADOS[estado];
      await pg.goto('http://127.0.0.1:5787/dashboard/#invoice-detail/9', { waitUntil: 'networkidle' });
      await pg.reload({ waitUntil: 'networkidle' });
      try { await pg.locator('.j1-prog').first().waitFor({ state: 'visible', timeout: 8000 }); }
      catch (e) { throw new Error(`[${estado}-${sufijo}] la línea de progreso NO está en pantalla — no se captura`); }
      const leido = await pg.evaluate(() => ({
        h2: (document.querySelector('.detail-head h2') || {}).textContent,
        pasos: [...document.querySelectorAll('.j1-prog-rotulo')].map((n) => n.textContent),
        siguiente: !!document.querySelector('.detail-next-label'),
        conceptos: [...document.querySelectorAll('.detail-section-title')].map((n) => n.textContent),
      }));
      if (leido.h2 !== 'Factura F2026-0009') throw new Error(`[${estado}-${sufijo}] título: ${leido.h2}`);
      if (leido.pasos.join('|') !== PASOS[estado].join('|')) throw new Error(`[${estado}-${sufijo}] pasos: ${leido.pasos.join('|')}`);
      if (!leido.siguiente || !leido.conceptos.includes('Conceptos')) throw new Error(`[${estado}-${sufijo}] falta Siguiente paso o Conceptos: ${leido.conceptos.join('|')}`);
      dom[`${estado}-${sufijo}`] = leido;
      await pg.waitForTimeout(500);
      const nombre = `1787b-ficha-${estado}-${sufijo}.png`;
      await pg.screenshot({ path: DIR + nombre, fullPage: true });
      hechas.push(nombre);
    }
    await ctx.close();
  }
  return { hechas, fuera, escrituras, dom };
}
