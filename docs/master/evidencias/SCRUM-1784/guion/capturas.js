// SCRUM-1784 · capturas de la pantalla REAL de Trabajos (código de main) con datos de EJEMPLO.
// Contexto nuevo con service worker BLOQUEADO: el SW del panel cachea /admin/* y se saltaba las rutas.
async (page) => {
  const equipo = [
    { id: null, name: 'Ana (propietaria)', role: 'admin', status: 'active' },
    { id: 11, name: 'Israel Gómez', role: 'tecnico', status: 'active' },
    { id: 12, name: 'Miguel Sanz', role: 'tecnico', status: 'active' },
    { id: 13, name: 'Jesús López', role: 'tecnico', status: 'active' },
  ];
  const A = (id) => ({ id, name: equipo.find((m) => m.id === id).name });
  const cli = (id, name) => ({ id, name, phone: '+34600000000', email: null });
  const base = (o) => ({
    planView: null, scheduledAt: null, notes: null, queHayQueHacer: null, createdAt: '2026-11-18T09:00:00Z',
    direccion: null, totalCobrado: '0.00', estadoCobro: 'pendiente', importeReferencia: o.totalAceptado,
    operarioId: null, operario: null, tipoOperacion: 'TRABAJO_UNICO', tipoIntervencion: null, quote: null, remaining: o.totalAceptado,
    nextStage: null, ...o, tituloPropio: o.titulo, assignedUserId: o.asignados.length ? o.asignados[0].id : null,
  });
  const jobs = [
    base({ id: 101, status: 'agendado', scheduledAt: '2026-11-24T08:00:00Z', titulo: 'Reforma de baño completa', direccion: 'C/ Alcalá 120, Madrid', totalAceptado: '4850.00', customer: cli(1, 'Comunidad Alcalá 120'), asignados: [A(11), A(12), A(13)], queHayQueHacer: 'Desmontar plato, alicatar y montar mampara' }),
    base({ id: 102, status: 'pendiente_agendar', titulo: 'Cambio de caldera', totalAceptado: '2390.00', customer: cli(2, 'Marta Ruiz'), asignados: [A(12), A(13)] }),
    base({ id: 103, status: 'en_curso', scheduledAt: '2026-11-21T07:30:00Z', titulo: 'Instalación de aire acondicionado', totalAceptado: '1640.00', customer: cli(3, 'Bar La Esquina'), asignados: [A(11)] }),
    base({ id: 104, status: 'pendiente_agendar', titulo: 'Revisión de cuadro eléctrico', totalAceptado: '180.00', customer: cli(4, 'Pedro Martín'), asignados: [] }),
  ];
  const me = { merchantId: 1, userRole: 'admin', name: 'Ana', teamMemberId: null, plan: 'pro', merchantName: 'Reformas Ejemplo', onboardingCompleted: true, country: 'ES' };
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const DIR = 'docs/master/evidencias/SCRUM-1784/';
  const PIE = 'SCRUM-1784 · código real de main fea1c0007 con datos de ejemplo, no la app viva';
  const hechas = []; const patches = [];

  async function abrir(viewport, isMobile) {
    const ctx = await page.context().browser().newContext({ viewport, isMobile, hasTouch: isMobile, serviceWorkers: 'block', locale: 'es-ES' });
    await ctx.route('http://127.0.0.1:5784/**', async (route) => {
      const req = route.request(); const p = new URL(req.url()).pathname;
      if (/\.(js|css|html|svg|png|ico|woff2?|webmanifest|json)$/.test(p) || p.endsWith('/')) return route.continue();
      if (p === '/admin/me') return json(route, me);
      if (p === '/admin/merchant') return json(route, { id: 1, name: me.merchantName, country: 'ES', onboardingCompleted: true });
      if (p === '/admin/team') return json(route, equipo);
      if (p === '/admin/jobs' && req.method() === 'GET') return json(route, jobs);
      const m = p.match(/^\/admin\/jobs\/(\d+)$/);
      if (m && req.method() === 'GET') { const j = jobs.find((x) => x.id === Number(m[1])); return json(route, { ...j, invoices: [], charge: null, albaranes: [], partes: [], entregaPendiente: null }); }
      if (m && req.method() === 'PATCH') { patches.push(req.postData()); return json(route, jobs.find((x) => x.id === Number(m[1])) || {}); }
      if (p === '/version') return json(route, { version: 'fea1c0007' });
      if (/^\/admin\/(partes|quote-requests|precarga|metrics)/.test(p)) return json(route, []);
      return json(route, {});
    });
    const pg = await ctx.newPage();
    return { ctx, pg };
  }
  async function pie(pg) {
    await pg.evaluate((t) => { if (document.getElementById('pie-1784')) return; const d = document.createElement('div'); d.id = 'pie-1784'; d.textContent = t; Object.assign(d.style, { position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: 99999, background: '#111827', color: '#fff', font: '600 12px system-ui', padding: '6px 10px', textAlign: 'center' }); document.body.appendChild(d); }, PIE);
  }
  async function foto(pg, nombre, opts = {}) { await pie(pg); await pg.screenshot({ path: DIR + nombre, ...opts }); hechas.push(nombre); }

  for (const [sufijo, viewport, movil] of [['escritorio', { width: 1440, height: 900 }, false], ['movil', { width: 390, height: 844 }, true]]) {
    const { ctx, pg } = await abrir(viewport, movil);
    await pg.goto('http://127.0.0.1:5784/dashboard/#jobs', { waitUntil: 'networkidle' });
    await pg.waitForTimeout(700);
    await foto(pg, `1-lista-${sufijo}.png`);
    // desplegable de casillas de la fila con 3 técnicos
    const menu = pg.locator('.jobs-tecnicos-menu').first();
    if (await menu.count()) { await menu.locator('summary, .jobs-tecnicos-resumen').first().click(); await pg.waitForTimeout(300); await foto(pg, `2-lista-casillas-${sufijo}.png`); await pg.keyboard.press('Escape'); await pg.goto('http://127.0.0.1:5784/dashboard/#jobs', { waitUntil: 'networkidle' }); await pg.waitForTimeout(500); }
    // filtro por técnico: Israel
    const sel = pg.locator('#jobs-filtro-tecnico-select');
    if (await sel.count()) { await sel.selectOption('11').catch(() => {}); await pg.waitForTimeout(400); await foto(pg, `3-lista-filtro-tecnico-${sufijo}.png`); }
    // ficha del trabajo con 3 técnicos
    await pg.goto('http://127.0.0.1:5784/dashboard/#jobs', { waitUntil: 'networkidle' }); await pg.waitForTimeout(400);
    await pg.evaluate(() => { window.appState = window.appState || {}; });
    const fila = pg.locator('text=Comunidad Alcalá 120').first();
    await fila.click().catch(() => {});
    await pg.waitForTimeout(900);
    await foto(pg, `4-ficha-${sufijo}.png`);
    await pg.getByRole('button', { name: 'El trabajo', exact: true }).first().click({ timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(600);
    const quien = pg.locator('[data-seccion="asignados"]:visible').first();
    if (await quien.count()) await quien.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await pg.waitForTimeout(300);
    await foto(pg, `5-ficha-quien-ejecuta-${sufijo}.png`);
    await ctx.close();
  }
  return { hechas, patches };
}
