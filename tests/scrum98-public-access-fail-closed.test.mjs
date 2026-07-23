// tests/scrum98-public-access-fail-closed.test.mjs — SCRUM-98 (Guard A, nace de SCRUM-88 §8)
//
// LA RED FAIL-CLOSED del otro extremo de SCRUM-55: aquella enumera TODAS las rutas
// /admin y falla si alguna no declara ROL; esta enumera TODA la superficie pública (todo
// lo montado antes de requireAuth, o gateado solo por requireInternalSecret/firma) y
// falla si alguna no declara CATEGORÍA DE ACCESO — token opaco, secreto interno, firma
// verificada, sesión real, o "sin recurso sensible". Las seis puertas de la misma fuga
// (SCRUM-72/74/85/87/90/95) se descubrieron por tropiezo porque esa pregunta no tenía
// dueño; esto la convierte en una comprobación de build.
//
// SIN GATE (mismo criterio D3 del fundador que scrum55-admin-fail-closed.test.mjs): corre
// en `npm test` normal, no toca BD ni levanta servidor — solo importa dist/app.js e
// inspecciona el árbol de rutas.
import test from 'node:test';
import assert from 'node:assert/strict';

const { app } = await import('../dist/app.js');
const {
  PUBLIC_PREFIXES,
  PUBLIC_TOP_LEVEL_PATHS,
  ROUTER_LEVEL_PREFIXES,
  GUARD_A_EXCLUDED_PREFIXES,
  PUBLIC_ACCESS_DECLARED,
  PUBLIC_ACCESS_ROUTER_LEVEL,
  PUBLIC_ACCESS_PENDING,
  PUBLIC_ACCESS_PENDING_MAX,
  PUBLIC_ACCESS_REVISAR_ANTES_DE,
} = await import('../dist/core/http/publicAccessDeclarations.js');

const key = (method, path) => `${method.toUpperCase()} ${path}`;

/**
 * Enumera las rutas públicas: sueltas en `app` bajo un prefijo/top-level conocido, más
 * las de cada router montado en PUBLIC_PREFIXES (mismo truco que enumerateAdminRoutes()
 * de SCRUM-55 — Express 5 no guarda el prefijo de montaje, layer.match(prefijo) sí sabe
 * decir si un router cuelga de él). Los prefijos en ROUTER_LEVEL_PREFIXES se saltan
 * (declarados en bloque, no ruta a ruta — ver publicAccessDeclarations.ts).
 */
/** Express admite `router.get(['/a', '/b'], handler)`: un único layer.route.path array. */
function asPathList(path) {
  return Array.isArray(path) ? path : [path];
}

function enumeratePublicRoutes() {
  const byKey = new Map();
  const add = (method, path, source) => {
    const k = key(method, path);
    const prev = byKey.get(k);
    if (prev) {
      prev.sources.push(source);
      return;
    }
    byKey.set(k, { method: method.toUpperCase(), path, sources: [source] });
  };

  for (const layer of app.router.stack) {
    if (!layer.route) continue;
    for (const path of asPathList(layer.route.path)) {
      if (typeof path !== 'string' || path.startsWith('/admin')) continue;
      const underPrefix = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
      const isTopLevel = PUBLIC_TOP_LEVEL_PATHS.includes(path);
      if (!underPrefix && !isTopLevel) continue;
      for (const method of Object.keys(layer.route.methods)) add(method, path, 'app.ts');
    }
  }

  for (const layer of app.router.stack) {
    const isRouter = !!(layer.handle && layer.handle.stack);
    if (!isRouter || layer.route) continue;
    const prefix = PUBLIC_PREFIXES.find((p) => {
      try {
        return layer.match(p);
      } catch {
        return false;
      }
    });
    if (!prefix) continue; // /admin ya lo enumera SCRUM-55; huérfanos ya los caza su 3er test
    if (GUARD_A_EXCLUDED_PREFIXES.has(prefix)) continue; // /dev: no es superficie de producción
    if (ROUTER_LEVEL_PREFIXES.has(prefix)) continue; // declarado en bloque

    for (const subLayer of layer.handle.stack) {
      if (!subLayer.route) {
        assert.ok(
          !(subLayer.handle && subLayer.handle.stack),
          `RED CIEGA: sub-router anidado bajo ${prefix}. La enumeración no lo cubre — ` +
            `extiende este test antes de añadirlo.`,
        );
        continue;
      }
      for (const relPath of asPathList(subLayer.route.path)) {
        const rel = relPath === '/' ? '' : relPath;
        for (const method of Object.keys(subLayer.route.methods)) add(method, prefix + rel, prefix);
      }
    }
  }
  return [...byKey.values()];
}

test('SCRUM-98: toda ruta pública declara su categoría de acceso (fail-closed)', (t) => {
  const routes = enumeratePublicRoutes();
  assert.ok(routes.length > 15, `enumeración sospechosamente corta (${routes.length}): ¿se rompió el walker?`);

  const declared = new Set(PUBLIC_ACCESS_DECLARED.map((r) => key(r.method, r.path)));
  const pending = new Set(PUBLIC_ACCESS_PENDING.map((r) => key(r.method, r.path)));

  const undeclared = [];
  const doubleDeclared = [];
  for (const r of routes) {
    const k = key(r.method, r.path);
    const inDeclared = declared.has(k);
    const inPending = pending.has(k);
    if (inDeclared && inPending) doubleDeclared.push(k);
    if (!inDeclared && !inPending) undeclared.push(k);
  }

  assert.deepEqual(
    undeclared,
    [],
    `\n\n🔴 RUTA PÚBLICA SIN DECLARAR CATEGORÍA DE ACCESO (${undeclared.length}):\n` +
      undeclared.map((r) => `   · ${r}`).join('\n') +
      `\n\n¿Resuelve el recurso por un token opaco, un secreto interno, una firma verificada,\n` +
      `una sesión real, o no hay recurso sensible detrás? Declárala en\n` +
      `src/core/http/publicAccessDeclarations.ts (PUBLIC_ACCESS_DECLARED) con motivo.\n` +
      `Si NO puedes declararla segura todavía, apárcala en PUBLIC_ACCESS_PENDING con un\n` +
      `ticket real — nunca la dejes sin clasificar. Un rate-limit NO es una categoría\n` +
      `segura: acota la velocidad de explotar un IDOR, no lo cierra.\n`,
  );

  assert.deepEqual(
    doubleDeclared,
    [],
    `\n\n🔴 RUTA DECLARADA A LA VEZ EN PUBLIC_ACCESS_DECLARED Y EN PENDING:\n` +
      doubleDeclared.map((r) => `   · ${r}`).join('\n') +
      `\nElige una: o está resuelta (declarada) o no lo está (aparcada).\n`,
  );

  t.diagnostic(
    `${routes.length} rutas públicas · ${PUBLIC_ACCESS_DECLARED.length} declaradas · ` +
      `${PUBLIC_ACCESS_ROUTER_LEVEL.length} prefijos declarados en bloque · ` +
      `${PUBLIC_ACCESS_PENDING.length} aparcadas`,
  );
});

test('SCRUM-98: ninguna declaración apunta a una ruta que ya no existe', () => {
  const real = new Set(enumeratePublicRoutes().map((r) => key(r.method, r.path)));

  const muertas = [];
  for (const d of PUBLIC_ACCESS_DECLARED) {
    const k = key(d.method, d.path);
    if (!real.has(k)) muertas.push(`${k}  (en PUBLIC_ACCESS_DECLARED, kind=${d.kind})`);
  }
  for (const p of PUBLIC_ACCESS_PENDING) {
    const k = key(p.method, p.path);
    if (!real.has(k)) muertas.push(`${k}  (en PUBLIC_ACCESS_PENDING, ticket=${p.ticket})`);
  }

  assert.deepEqual(
    muertas,
    [],
    `\n\n🔴 DECLARACIÓN MUERTA: apunta a una ruta que YA NO EXISTE:\n` +
      muertas.map((r) => `   · ${r}`).join('\n') +
      `\n\nUna declaración muerta no prueba nada y es indistinguible de una que sí. Bórrala o corrígela.\n`,
  );
});

test('SCRUM-98: todo prefijo de ROUTER_LEVEL_PREFIXES tiene su declaración en bloque', () => {
  const declaradosEnBloque = new Set(PUBLIC_ACCESS_ROUTER_LEVEL.map((r) => r.prefix));
  const faltantes = [...ROUTER_LEVEL_PREFIXES].filter((p) => !declaradosEnBloque.has(p));
  assert.deepEqual(
    faltantes,
    [],
    `\n\n🔴 Prefijo en ROUTER_LEVEL_PREFIXES sin su declaración en PUBLIC_ACCESS_ROUTER_LEVEL: ${faltantes.join(', ')}\n`,
  );
});

test('SCRUM-98: la lista de aparcadas mengua (ratchet + caducidad)', (t) => {
  assert.ok(
    PUBLIC_ACCESS_PENDING.length <= PUBLIC_ACCESS_PENDING_MAX,
    `\n\n🔴 PUBLIC_ACCESS_PENDING ha CRECIDO: ${PUBLIC_ACCESS_PENDING.length} > ${PUBLIC_ACCESS_PENDING_MAX}.\n` +
      `Esa lista solo puede menguar. Una ruta pública NUEVA se declara (categoría real);\n` +
      `no se aparca. Si cierras un ticket que la vaciaba, baja PUBLIC_ACCESS_PENDING_MAX en el mismo commit.\n`,
  );

  const hoy = new Date().toISOString().slice(0, 10);
  if (PUBLIC_ACCESS_PENDING.length > 0) {
    assert.ok(
      hoy <= PUBLIC_ACCESS_REVISAR_ANTES_DE,
      `\n\n🔴 CADUCÓ el plazo para clasificar las rutas públicas aparcadas.\n` +
        `   Hoy ${hoy} · plazo ${PUBLIC_ACCESS_REVISAR_ANTES_DE} · quedan ${PUBLIC_ACCESS_PENDING.length}.\n\n` +
        `Esto NO es un fallo del código: es la señal de que "ya tiene ticket" se quedó a medias.\n` +
        `Cierra los tickets o mueve PUBLIC_ACCESS_REVISAR_ANTES_DE con el OK del fundador. Pendientes:\n` +
        PUBLIC_ACCESS_PENDING.map((r) => `   · ${r.method} ${r.path} — ${r.duda} (${r.ticket})`).join('\n') +
        `\n`,
    );
  }

  if (PUBLIC_ACCESS_PENDING.length === 0) {
    t.diagnostic('sin pendientes: toda la superficie pública está clasificada 🎉');
  } else {
    t.diagnostic(`pendientes: ${PUBLIC_ACCESS_PENDING.length} · plazo ${PUBLIC_ACCESS_REVISAR_ANTES_DE}`);
  }
});
