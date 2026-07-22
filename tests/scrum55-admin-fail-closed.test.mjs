// tests/scrum55-admin-fail-closed.test.mjs — SCRUM-55 (S1)
//
// LA RED FAIL-CLOSED. Enumera TODAS las rutas montadas bajo /admin y falla si alguna
// no declara rol. Invierte el default que pedía S1 ("ruta nueva = declara rol mínimo;
// default Admin-only") y que hasta ahora no hacía cumplir nada: 124 rutas, 79 abiertas
// a un Operario, y la 125 iba a nacer abierta igual.
//
// SIN GATE (decisión D3 del fundador): corre en `npm test` NORMAL. No toca BD ni
// levanta servidor — solo importa dist/app.js e inspecciona el árbol de rutas. A12.4
// vive tras QA_DB_TEST=1 y ya se cayó ENTERA sin que nadie se enterara; una red que
// solo funciona en staging no es una red.
//
// COMPLEMENTA a tenancy-permisos.test.mjs (A12.4), no lo sustituye: aquel comprueba
// el COMPORTAMIENTO (403 real con sesión de técnico) sobre las rutas de su lista;
// este comprueba que esa lista esté COMPLETA, que es lo que nadie garantizaba.
import test from 'node:test';
import assert from 'node:assert/strict';

const { app } = await import('../dist/app.js');
const { getAdminMounts } = await import('../dist/core/http/adminMounts.js');
const { ADMIN_ONLY_ROUTES } = await import('../dist/core/http/adminOnlyRoutes.js');
const { TECNICO_ALLOWED, PENDIENTE_CLASIFICAR, PENDIENTE_MAX, REVISAR_ANTES_DE } =
  await import('../dist/core/http/adminRouteDeclarations.js');

// Prefijos públicos (NO /admin) montados en app.ts. Sirven para demostrar que todo
// router del stack está identificado: si aparece uno que no es /admin registrado ni
// de esta lista, es un montaje que la red no vigila → falla.
const PUBLIC_PREFIXES = [
  '/pay', '/cliente', '/albaran', '/webhooks/stripe', '/webhooks/stripe-connect',
  '/health', '/auth', '/webhooks/psp', '/charges', '/quote', '/invoice', '/recibo',
  '/webhooks/mp', '/webhooks/whatsapp', '/legal', '/p', '/dev',
];

const roleOf = (handle) => (handle && handle.__requiredRole) || null;
const key = (method, path) => `${method.toUpperCase()} ${path}`;

/** `/admin/invoices/:invoiceId/status` y `/admin/invoices/999999/status` → misma forma. */
function normalize(path) {
  return path
    .split('/')
    .map((seg) => (seg.startsWith(':') || /^\d+$/.test(seg) ? ':p' : seg))
    .join('/');
}

/**
 * Enumera las rutas /admin. Dos fuentes, porque Express 5 no guarda el prefijo de
 * montaje (layer.path undefined, matchers opacos — y app._router ya no existe):
 *   · rutas sueltas de app.get/app.post → el path COMPLETO sí está en app.router.stack
 *   · rutas dentro de routers → prefijo del registro de mountAdmin + path relativo
 */
function enumerateAdminRoutes() {
  const byKey = new Map();
  const add = (method, path, role, source) => {
    const k = key(method, path);
    const prev = byKey.get(k);
    // Una misma ruta puede registrarse dos veces (p.ej. app.post(...requireActivePlan)
    // delante del router). Declara rol si CUALQUIERA de sus registros lo declara.
    if (prev) {
      prev.role = prev.role || role;
      prev.sources.push(source);
      return;
    }
    byKey.set(k, { method: method.toUpperCase(), path, role, sources: [source] });
  };

  for (const layer of app.router.stack) {
    if (!layer.route) continue;
    const path = layer.route.path;
    if (typeof path !== 'string' || !path.startsWith('/admin')) continue;
    const role = layer.route.stack.map((s) => roleOf(s.handle)).find(Boolean) || null;
    for (const method of Object.keys(layer.route.methods)) add(method, path, role, 'app.ts');
  }

  for (const mount of getAdminMounts()) {
    const mountRole = mount.gates.map(roleOf).find(Boolean) || null;
    const useRole = mount.router.stack.filter((l) => !l.route).map((l) => roleOf(l.handle)).find(Boolean) || null;
    for (const layer of mount.router.stack) {
      if (!layer.route) {
        // Sub-router anidado dentro de un router /admin: la red no sabe reconstruir su
        // prefijo. Hoy no existe ninguno. Fail-closed antes que enumerar de menos.
        assert.ok(
          !(layer.handle && layer.handle.stack),
          `RED CIEGA: sub-router anidado bajo ${mount.prefix}. La enumeración no lo cubre — ` +
            `móntalo con mountAdmin o extiende esta red antes de añadirlo.`,
        );
        continue;
      }
      const routeRole = layer.route.stack.map((s) => roleOf(s.handle)).find(Boolean) || null;
      const rel = layer.route.path === '/' ? '' : layer.route.path;
      for (const method of Object.keys(layer.route.methods)) {
        add(method, mount.prefix + rel, mountRole || useRole || routeRole, mount.prefix);
      }
    }
  }
  return [...byKey.values()];
}

test('SCRUM-55: toda ruta /admin declara rol (fail-closed)', (t) => {
  const routes = enumerateAdminRoutes();
  assert.ok(routes.length > 100, `enumeración sospechosamente corta (${routes.length}): ¿se rompió el walker?`);

  const declared = new Set(TECNICO_ALLOWED.map((r) => key(r.method, normalize(r.path))));
  const pending = new Set(PENDIENTE_CLASIFICAR.map((r) => key(r.method, normalize(r.path))));

  const undeclared = [];
  const doubleDeclared = [];
  for (const r of routes) {
    const k = key(r.method, normalize(r.path));
    const asTecnico = declared.has(k);
    const asPending = pending.has(k);
    if (r.role && (asTecnico || asPending)) doubleDeclared.push(`${k} (requireRole + lista)`);
    if (!r.role && !asTecnico && !asPending) undeclared.push(k);
  }

  assert.deepEqual(
    undeclared, [],
    `\n\n🔴 RUTA /admin SIN DECLARAR ROL (${undeclared.length}):\n` +
      undeclared.map((r) => `   · ${r}`).join('\n') +
      `\n\nS1: "ruta nueva = declara rol mínimo; default Admin-only". Elige UNA:\n` +
      `   (a) requireRole('admin') en la ruta o en su montaje  ← el default\n` +
      `   (b) añadirla a TECNICO_ALLOWED en src/core/http/adminRouteDeclarations.ts,\n` +
      `       CON MOTIVO, si de verdad es trabajo de campo del Operario.\n` +
      `No la aparques en PENDIENTE_CLASIFICAR: esa lista solo mengua.\n`,
  );

  // Declarar rol Y listarla como visible es contradictorio: alguien cambió una sin la otra.
  assert.deepEqual(
    doubleDeclared, [],
    `\n\n🔴 RUTA DECLARADA DOS VECES (requireRole y además en una lista):\n` +
      doubleDeclared.map((r) => `   · ${r}`).join('\n') +
      `\nQuita la entrada de la lista: el gate manda.\n`,
  );

  const conRol = routes.filter((r) => r.role).length;
  t.diagnostic(
    `${routes.length} rutas /admin · ${conRol} con requireRole · ` +
      `${TECNICO_ALLOWED.length} visibles para Técnico · ${PENDIENTE_CLASIFICAR.length} sin clasificar`,
  );
});

test('SCRUM-55: ninguna entrada declarada apunta a una ruta que ya no existe', () => {
  const real = new Set(enumerateAdminRoutes().map((r) => key(r.method, normalize(r.path))));

  const muertas = [];
  const check = (list, listName, get) => {
    for (const entry of list) {
      const k = key(get(entry).method, normalize(get(entry).path));
      if (!real.has(k)) muertas.push(`${k}  (en ${listName})`);
    }
  };
  check(TECNICO_ALLOWED, 'TECNICO_ALLOWED', (e) => e);
  check(PENDIENTE_CLASIFICAR, 'PENDIENTE_CLASIFICAR', (e) => e);
  check(ADMIN_ONLY_ROUTES, 'ADMIN_ONLY_ROUTES', (e) => e);

  assert.deepEqual(
    muertas, [],
    `\n\n🔴 ENTRADA MUERTA: declara una ruta que NO está montada:\n` +
      muertas.map((r) => `   · ${r}`).join('\n') +
      `\n\nUna entrada muerta no prueba nada y es indistinguible de una que sí. Así vivió\n` +
      `'GET /admin/billing/summary' en ADMIN_ONLY_ROUTES: el requireRole del MONTAJE\n` +
      `devolvía 403 antes de que nadie notara que la ruta no existía. Bórrala o corrígela.\n`,
  );
});

test('SCRUM-55: todo router montado está identificado (nadie se salta mountAdmin)', () => {
  const registered = new Set(getAdminMounts().map((m) => m.router));
  const huerfanos = [];

  for (const layer of app.router.stack) {
    const isRouter = !!(layer.handle && layer.handle.stack);
    if (!isRouter || layer.route) continue;
    if (registered.has(layer.handle)) continue;
    // No está en el registro de /admin: tiene que ser uno de los públicos conocidos.
    // layer.match(prefijo) es la única forma en Express 5 de saber dónde está montado.
    const known = PUBLIC_PREFIXES.some((p) => {
      try { return layer.match(p); } catch { return false; }
    });
    if (!known) huerfanos.push(layer.name || '(anónimo)');
  }

  assert.deepEqual(
    huerfanos, [],
    `\n\n🔴 ROUTER MONTADO QUE LA RED NO VE (${huerfanos.length}): ${huerfanos.join(', ')}\n` +
      `Si va bajo /admin: móntalo con mountAdmin(app, '/admin/...', router), no con app.use —\n` +
      `Express 5 no guarda el prefijo y sin registro sus rutas quedan FUERA de la auditoría.\n` +
      `Si es público: añade su prefijo a PUBLIC_PREFIXES en este test, con un comentario.\n`,
  );
});

test('SCRUM-55: la lista de pendientes mengua (ratchet + caducidad)', (t) => {
  assert.ok(
    PENDIENTE_CLASIFICAR.length <= PENDIENTE_MAX,
    `\n\n🔴 La lista de PENDIENTE_CLASIFICAR ha CRECIDO: ${PENDIENTE_CLASIFICAR.length} > ${PENDIENTE_MAX}.\n` +
      `Esa lista solo puede menguar. Una ruta NUEVA se declara (requireRole o TECNICO_ALLOWED);\n` +
      `no se aparca. Si vacías una tanda, baja PENDIENTE_MAX en el mismo commit.\n`,
  );

  // El ratchet impide que crezca; la caducidad impide que se quede quieta.
  const hoy = new Date().toISOString().slice(0, 10);
  if (PENDIENTE_CLASIFICAR.length > 0) {
    assert.ok(
      hoy <= REVISAR_ANTES_DE,
      `\n\n🔴 CADUCÓ el plazo para clasificar las rutas /admin pendientes.\n` +
        `   Hoy ${hoy} · plazo ${REVISAR_ANTES_DE} · quedan ${PENDIENTE_CLASIFICAR.length} sin clasificar.\n\n` +
        `Esto NO es un fallo del código: es la señal de que "el resto por tandas" se quedó a medias.\n` +
        `Clasifícalas (SCRUM-55 tandas 2 y 3) o mueve REVISAR_ANTES_DE con el OK del fundador —\n` +
        `pero que sea una decisión, no un despiste. Pendientes ahora mismo:\n` +
        PENDIENTE_CLASIFICAR.map((r) => `   · [tanda ${r.tanda}] ${r.method} ${r.path} — ${r.duda}`).join('\n') +
        `\n`,
    );
  }

  if (PENDIENTE_CLASIFICAR.length === 0) {
    t.diagnostic('sin pendientes: las 125 rutas /admin están clasificadas 🎉');
  } else {
    const t2 = PENDIENTE_CLASIFICAR.filter((r) => r.tanda === 2).length;
    const t3 = PENDIENTE_CLASIFICAR.filter((r) => r.tanda === 3).length;
    t.diagnostic(`pendientes: ${PENDIENTE_CLASIFICAR.length} (tanda 2: ${t2} · tanda 3: ${t3}) · plazo ${REVISAR_ANTES_DE}`);
  }
});
