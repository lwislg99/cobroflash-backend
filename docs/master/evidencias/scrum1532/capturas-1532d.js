// SCRUM-1532d · «Cancelar cobro» en la ficha de FACTURA, a 1280 y a 390 px, con el código de la rama
// servido en estático (servidor-estatico.mjs de SCRUM-1787, puerto 5789) y /admin/* contestado AQUÍ con
// datos de EJEMPLO. Contexto nuevo con service worker BLOQUEADO (scrum1233g). Nada sale de 127.0.0.1:5789.
// Por cada ancho: ① abre el «⋯» y EXIGE el botón visible antes de capturar; ② lo pulsa, EXIGE que el
// diálogo diga el literal firmado (c.22430) y que el POST vaya a /admin/charges/3/cancel; ③ con la
// respuesta ya `cancelled`, EXIGE que el botón haya desaparecido y captura otra vez. Si algo falta, lanza.
// Uso (MCP de Playwright, browser_run_code): pasar esta función; `globalThis.__dir1532` = raíz del árbol.
async (page) => {
  const DIR = (globalThis.__dir1532 || 'C:/Users/Javier Pereira/cobroflash-jv-j1ik') + '/docs/master/evidencias/scrum1532/';
  const ORIGEN = '127.0.0.1:5789';
  const LITERAL = '¿Cancelar este cobro? El cliente ya no podrá pagarlo con este enlace.';
  const me = { merchantId: 1, userRole: 'admin', name: 'Ana', plan: 'pro', merchantName: 'Reformas Ejemplo', onboardingCompleted: true, country: 'ES' };
  const cliente = { id: 7, name: 'Cliente Ejemplo SL', phone: '+34600000000', email: 'cliente@ejemplo.test' };
  const base = {
    id: 9, number: 'F2026-0009', status: 'pending', type: 'F1', total: '324.28', currency: 'EUR', customerId: 7, customer: cliente,
    customerName: cliente.name, customerTaxId: 'B00000000', customerPhone: cliente.phone, customerEmail: cliente.email,
    createdAt: '2026-11-14T09:00:00Z', quoteId: 6, chargeId: 3, estadoDelCobro: 'pending', payToken: 'tok-ejemplo',
    waDelivery: { status: 'delivered' }, pdfUrl: null, rectifiedBy: [],
    lines: [
      { concept: 'Desmontaje de plato de ducha', qty: 1, price: 120, tax: 0.21 },
      { concept: 'Alicatado de pared', qty: 8, price: 18.5, tax: 0.21 },
    ],
  };
  let actual = base;
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const fuera = []; const escrituras = []; const hechas = []; const dialogos = [];

  for (const [sufijo, viewport, movil] of [['escritorio', { width: 1280, height: 900 }, false], ['movil', { width: 390, height: 844 }, true]]) {
    actual = base;
    const ctx = await page.context().browser().newContext({ viewport, isMobile: movil, hasTouch: movil, serviceWorkers: 'block', locale: 'es-ES' });
    await ctx.route('**/*', async (route) => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname;
      if (u.host !== ORIGEN) { fuera.push(req.method() + ' ' + u.host + p); return route.abort(); }
      if (/\.(js|css|html|svg|png|ico|woff2?|webmanifest|json)$/.test(p) || p.endsWith('/')) return route.continue();
      if (req.method() !== 'GET') {
        escrituras.push(req.method() + ' ' + p);
        if (p === '/admin/charges/3/cancel') { actual = { ...base, estadoDelCobro: 'cancelled' }; return json(route, { ok: true, status: 'cancelled' }); }
        return json(route, {});
      }
      if (p === '/admin/me') return json(route, me);
      if (p === '/admin/merchant') return json(route, { id: 1, name: me.merchantName, country: 'ES', onboardingCompleted: true });
      if (p === '/admin/invoices/9') return json(route, actual);
      if (/^\/admin\/(quotes|invoices|partes|quote-requests|precarga|metrics|team|albaranes)/.test(p)) return json(route, []);
      return json(route, {});
    });
    const pg = await ctx.newPage();
    pg.on('dialog', async (d) => { dialogos.push(`${sufijo}: ${d.message()}`); await d.accept(); });
    await pg.goto(`http://${ORIGEN}/dashboard/#invoice-detail/9`, { waitUntil: 'networkidle' });
    await pg.reload({ waitUntil: 'networkidle' });
    try { await pg.locator('.j1-prog').first().waitFor({ state: 'visible', timeout: 8000 }); }
    catch (e) { throw new Error(`[${sufijo}] la ficha NO está en pantalla — no se captura`); }
    // ① el «⋯» abierto con el botón
    await pg.locator('.overflow-trigger').first().click();
    const boton = pg.getByRole('menuitem', { name: 'Cancelar cobro' }).or(pg.locator('button', { hasText: 'Cancelar cobro' })).first();
    try { await boton.waitFor({ state: 'visible', timeout: 4000 }); }
    catch (e) { throw new Error(`[${sufijo}] «Cancelar cobro» NO está visible en el «⋯» — no se captura`); }
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: DIR + `1532d-menu-con-cancelar-${sufijo}.png` });
    hechas.push(`1532d-menu-con-cancelar-${sufijo}.png`);
    // ② pulsarlo: el diálogo y la llamada
    await boton.click();
    await pg.waitForTimeout(800);
    if (!dialogos.includes(`${sufijo}: ${LITERAL}`)) throw new Error(`[${sufijo}] el diálogo no dice el literal firmado: ${dialogos.join(' | ')}`);
    if (!escrituras.includes('POST /admin/charges/3/cancel')) throw new Error(`[${sufijo}] no se llamó a la ruta: ${escrituras.join(' | ')}`);
    // ③ repintada con el cobro cancelado: el botón ya no está
    await pg.locator('.j1-prog').first().waitFor({ state: 'visible', timeout: 8000 });
    await pg.locator('.overflow-trigger').first().click();
    await pg.waitForTimeout(300);
    const quedan = await pg.locator('button', { hasText: 'Cancelar cobro' }).count();
    if (quedan !== 0) throw new Error(`[${sufijo}] tras cancelar sigue el botón (${quedan})`);
    await pg.screenshot({ path: DIR + `1532d-menu-tras-cancelar-${sufijo}.png` });
    hechas.push(`1532d-menu-tras-cancelar-${sufijo}.png`);
    await ctx.close();
  }
  return { hechas, fuera, escrituras, dialogos };
}
