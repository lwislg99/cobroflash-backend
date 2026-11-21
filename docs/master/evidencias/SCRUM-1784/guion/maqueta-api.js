// SCRUM-1784 · datos de EJEMPLO para enseñar la pantalla REAL de Trabajos sin staging ni producción.
// Ningún dato es de un cliente real. Lo carga browser_run_code_unsafe (filename).
async (page) => {
  const equipo = [
    { id: null, name: 'Ana (propietaria)', role: 'admin', status: 'active' },
    { id: 11, name: 'Israel Gómez', role: 'tecnico', status: 'active', email: 'israel@ejemplo.test' },
    { id: 12, name: 'Miguel Sanz', role: 'tecnico', status: 'active', email: 'miguel@ejemplo.test' },
    { id: 13, name: 'Jesús López', role: 'tecnico', status: 'active', email: 'jesus@ejemplo.test' },
  ];
  const A = (id) => ({ id, name: equipo.find((m) => m.id === id).name });
  const cli = (id, name) => ({ id, name, phone: '+34600000000', email: null });
  const base = (o) => ({
    planView: null, scheduledAt: null, notes: null, queHayQueHacer: null, createdAt: '2026-11-18T09:00:00Z',
    tituloPropio: true, direccion: null, totalCobrado: '0.00', estadoCobro: 'pendiente', importeReferencia: o.totalAceptado,
    operarioId: null, operario: null, tipoOperacion: 'TRABAJO_UNICO', tipoIntervencion: null, quote: null, remaining: o.totalAceptado,
    nextStage: null, ...o, tituloPropio: o.titulo, assignedUserId: o.asignados.length ? o.asignados[0].id : null,
  });
  const jobs = [
    base({ id: 101, status: 'agendado', scheduledAt: '2026-11-24T08:00:00Z', titulo: 'Reforma de baño completa', direccion: 'C/ Alcalá 120, Madrid', totalAceptado: '4850.00', customer: cli(1, 'Comunidad Alcalá 120'), asignados: [A(11), A(12), A(13)], queHayQueHacer: 'Desmontar plato, alicatar y montar mampara' }),
    base({ id: 102, status: 'pendiente_agendar', titulo: 'Cambio de caldera', totalAceptado: '2390.00', customer: cli(2, 'Marta Ruiz'), asignados: [A(12), A(13)] }),
    base({ id: 103, status: 'en_curso', scheduledAt: '2026-11-21T07:30:00Z', titulo: 'Instalación de aire acondicionado', totalAceptado: '1640.00', customer: cli(3, 'Bar La Esquina'), asignados: [A(11)] }),
    base({ id: 104, status: 'pendiente_agendar', titulo: 'Revisión de cuadro eléctrico', totalAceptado: '180.00', customer: cli(4, 'Pedro Martín'), asignados: [] }),
  ];
  const me = { merchantId: 1, userRole: 'admin', teamMemberId: null, plan: 'pro', merchantName: 'Reformas Ejemplo', email: 'ana@ejemplo.test', onboardingCompleted: true, country: 'ES' };
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const ctx = page.context();
  await ctx.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
  globalThis.__scrum1784 = { pedidas: [] };
  await ctx.route('http://127.0.0.1:5784/**', async (route) => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname;
    if (/\.(js|css|html|svg|png|ico|woff2?|webmanifest|json)$/.test(p) || p.endsWith('/')) return route.continue();
    globalThis.__scrum1784.pedidas.push(req.method() + ' ' + p);
    if (p === '/admin/me') return json(route, me);
    if (p === '/admin/merchant') return json(route, { id: 1, name: me.merchantName, country: 'ES', onboardingCompleted: true });
    if (p === '/admin/team') return json(route, equipo);
    if (p === '/admin/jobs' && req.method() === 'GET') return json(route, jobs);
    const m = p.match(/^\/admin\/jobs\/(\d+)$/);
    if (m && req.method() === 'GET') {
      const j = jobs.find((x) => x.id === Number(m[1]));
      return j ? json(route, { ...j, invoices: [], charge: null, albaranes: [], partes: [], entregaPendiente: null }) : json(route, { error: 'not_found' }, 404);
    }
    if (m && req.method() === 'PATCH') {
      // NO va a ningún servidor: se responde aquí. Asignar no envía nada (jobs.routes.ts:1024-1200).
      const j = jobs.find((x) => x.id === Number(m[1])); const b = JSON.parse(req.postData() || '{}');
      if (j && Array.isArray(b.assignedUserIds)) { j.asignados = b.assignedUserIds.map(A); j.assignedUserId = b.assignedUserIds[0] ?? null; }
      return json(route, j || {});
    }
    if (p === '/version') return json(route, { version: 'fea1c0007' });
    if (/^\/admin\/(partes|quote-requests|precarga|metrics)/.test(p)) return json(route, []);
    return json(route, {});
  });
  return 'rutas puestas';
}
