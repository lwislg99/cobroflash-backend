// SCRUM-1802 · CAPTURAS de la fila «Vence el» de la ficha de FACTURA a 1280 px y a 390 px, y lectura del
// texto de las tres fechas que cambian (Vence el · fecha del bloque de cobro · fechas de los pasos).
// Código del árbol servido por `docs/master/evidencias/SCRUM-1787/guion/servidor-estatico.mjs <puerto>`
// (puerto en globalThis.__puerto1802, por defecto 5802); /admin/* lo contesta ESTE guion con datos de
// EJEMPLO. Contexto nuevo con `serviceWorkers: 'block'` (scrum1233g). Nada sale de 127.0.0.1.
// La fase (antes/despues) la dice el texto pintado: «05 dic» → antes; «5 dic» → despues. Si la fila
// «Vence el» no aparece, el guion LANZA (CIEGO), no da vacío.
async (page) => {
  const PUERTO = globalThis.__puerto1802 || 5802;
  const DIR = (globalThis.__dir1802 || 'C:/Users/Javier Pereira/cobroflash-jv-j1ja') + '/docs/master/evidencias/SCRUM-1802/';
  const HOST = '127.0.0.1:' + PUERTO;
  const me = { merchantId: 1, userRole: 'admin', name: 'Ana', plan: 'pro', merchantName: 'Reformas Ejemplo', onboardingCompleted: true, country: 'ES' };
  const cliente = { id: 7, name: 'Cliente Ejemplo SL', phone: '+34600000000', email: 'cliente@ejemplo.test', taxId: 'B00000000' };
  const invoice = {
    id: 9, number: 'F2026-0009', status: 'paid', type: 'F1', total: '224.27', currency: 'EUR', customerId: 7, customer: cliente,
    customerName: cliente.name, customerTaxId: cliente.taxId, customerPhone: cliente.phone, customerEmail: cliente.email,
    createdAt: '2026-12-05T12:00:00Z', dueDate: '2026-12-05T12:00:00Z', paidAt: '2026-12-06T12:00:00Z', chargeId: 'ch_ejemplo',
    paidVia: 'transfer', payMethods: ['bizum', 'transfer'], quoteId: null, charge: null, waDelivery: null, pdfUrl: null, rectifiedBy: [],
    lines: [{ concept: 'Desmontaje de plato de ducha', qty: 1, price: 120, tax: 0.21 }, { concept: 'Sellado', qty: 1, price: 65.35, tax: 0.21 }],
  };
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  const fuera = []; const hechas = []; const leido = {};
  let FASE = null;
  for (const [sufijo, viewport, movil] of [['escritorio', { width: 1280, height: 900 }, false], ['movil', { width: 390, height: 844 }, true]]) {
    const ctx = await page.context().browser().newContext({ viewport, isMobile: movil, hasTouch: movil, serviceWorkers: 'block', locale: 'es-ES', timezoneId: 'Europe/Madrid' });
    await ctx.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname;
      if (u.host !== HOST) { fuera.push(req.method() + ' ' + u.host + p); return route.abort(); }
      if (/\.(js|css|html|svg|png|ico|woff2?|webmanifest|json)$/.test(p) || p.endsWith('/')) return route.continue();
      if (req.method() !== 'GET') return json(route, {});
      if (p === '/admin/me') return json(route, me);
      if (p === '/admin/merchant') return json(route, { id: 1, name: me.merchantName, country: 'ES', onboardingCompleted: true });
      if (p === '/admin/invoices/9') return json(route, invoice);
      if (/^\/admin\/(quotes|invoices|partes|quote-requests|precarga|metrics|team|albaranes)/.test(p)) return json(route, []);
      return json(route, {});
    });
    const pg = await ctx.newPage();
    await pg.goto(`http://${HOST}/dashboard/#invoice-detail/9`, { waitUntil: 'networkidle' });
    await pg.reload({ waitUntil: 'networkidle' });
    await pg.waitForTimeout(400);
    const m = await pg.evaluate(() => {
      const dt = [...document.querySelectorAll('dt')].find((d) => d.textContent.trim() === 'Vence el');
      if (!dt) return null;
      const dd = dt.nextElementSibling;
      return {
        venceEl: dd ? dd.textContent.trim() : null,
        cobro: [...document.querySelectorAll('.detail-cobro-fecha')].map((n) => n.textContent.trim()),
        pasos: [...document.querySelectorAll('.j1-prog-fecha')].map((n) => n.textContent.trim()),
      };
    });
    if (!m) throw new Error(`[${sufijo}] la fila «Vence el» NO está en pantalla — guion CIEGO`);
    if (FASE === null) FASE = /^0\d /.test(m.venceEl) ? 'antes' : 'despues';
    leido[sufijo] = m;
    const nombre = `1802-${FASE}-vence-el-${sufijo}.png`;
    await pg.locator('dt', { hasText: 'Vence el' }).first().scrollIntoViewIfNeeded();
    await pg.screenshot({ path: DIR + nombre, fullPage: false });
    hechas.push(nombre);
    await ctx.close();
  }
  return { fase: FASE, hechas, fuera, leido };
}
