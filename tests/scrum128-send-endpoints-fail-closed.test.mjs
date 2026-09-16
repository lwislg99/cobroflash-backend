// tests/scrum128-send-endpoints-fail-closed.test.mjs — SCRUM-128 (paso b, nace de SCRUM-126)
//
// Guard MECÁNICO, mismo nivel de confianza que Guard A (SCRUM-98) / S1 (SCRUM-55): enumera
// las rutas /admin REALES (vía getAdminMounts(), el mismo registro que usa S1 — no hace
// falta reinventar reflection sobre Express) y falla si aparece una que huela a "envío a un
// cliente" (heurística: enviar/send/resend en el path) sin declarar en
// sendEndpointDeclarations.ts. Ver el LÍMITE HONESTO al principio de ese fichero antes de
// asumir que esto prueba más de lo que prueba: no verifica que el handler use
// sendFailureBody/sendSuccessBody de verdad, ni que el front mire el campo declarado.
//
// SIN GATE (mismo criterio D3 del fundador que scrum55/scrum98): corre en `npm test`
// normal, no toca BD ni levanta servidor — solo importa dist/app.js e inspecciona el
// registro de montajes /admin.
import test from 'node:test';
import assert from 'node:assert/strict';

const { app } = await import('../dist/app.js');
const { getAdminMounts } = await import('../dist/core/http/adminMounts.js');
const {
  SEND_ENDPOINTS_DECLARED,
  SEND_ENDPOINTS_PENDING,
  SEND_ENDPOINTS_PENDING_MAX,
  SEND_ENDPOINTS_REVISAR_ANTES_DE,
  SEND_HEURISTIC,
} = await import('../dist/core/http/sendEndpointDeclarations.js');

const key = (method, path) => `${method.toUpperCase()} ${path}`;

/** Express admite `router.get(['/a', '/b'], handler)`: un único layer.route.path array (SCRUM-98). */
function asPathList(path) {
  return Array.isArray(path) ? path : [path];
}

/**
 * Enumera TODAS las rutas /admin reales (no solo las que huelen a envío — el filtro se
 * aplica después, para que "ninguna declaración apunta a una ruta muerta" pueda cruzar
 * contra el universo completo, igual que hace scrum55/scrum98). Importar dist/app.js
 * ANTES de leer getAdminMounts() es lo que puebla el registro (mountAdmin se ejecuta al
 * cargar app.ts) — por eso el import de `app` va arriba del fichero, mismo orden que
 * scrum55, aunque `app` en sí no se referencie más aquí abajo.
 */
function enumerateAllAdminRoutes() {
  const byKey = new Map();
  const add = (method, path) => {
    const k = key(method, path);
    if (!byKey.has(k)) byKey.set(k, { method: method.toUpperCase(), path });
  };

  for (const mount of getAdminMounts()) {
    for (const layer of mount.router.stack) {
      if (!layer.route) continue; // sub-routers anidados: fuera de alcance de este guard (S1 ya los vigila)
      for (const relPath of asPathList(layer.route.path)) {
        const rel = relPath === '/' ? '' : relPath;
        for (const method of Object.keys(layer.route.methods)) {
          add(method, mount.prefix + rel);
        }
      }
    }
  }
  return [...byKey.values()];
}

function enumerateSendSmellingAdminRoutes() {
  return enumerateAllAdminRoutes().filter((r) => SEND_HEURISTIC.test(r.path));
}

test('SCRUM-128: toda ruta /admin que huele a envío declara su contrato de sent (fail-closed)', (t) => {
  const smelling = enumerateSendSmellingAdminRoutes();
  assert.ok(smelling.length >= 8, `enumeración sospechosamente corta (${smelling.length}): ¿se rompió el filtro o el registro de mounts?`);

  const declared = new Set(SEND_ENDPOINTS_DECLARED.map((r) => key(r.method, r.path)));
  const pending = new Set(SEND_ENDPOINTS_PENDING.map((r) => key(r.method, r.path)));

  const undeclared = [];
  const doubleDeclared = [];
  for (const r of smelling) {
    const k = key(r.method, r.path);
    const inDeclared = declared.has(k);
    const inPending = pending.has(k);
    if (inDeclared && inPending) doubleDeclared.push(k);
    if (!inDeclared && !inPending) undeclared.push(k);
  }

  assert.deepEqual(
    undeclared,
    [],
    `\n\n🔴 RUTA /admin QUE HUELE A ENVÍO SIN DECLARAR (${undeclared.length}):\n` +
      undeclared.map((r) => `   · ${r}`).join('\n') +
      `\n\n¿Envía WhatsApp/email a un cliente? Declárala en\n` +
      `src/core/http/sendEndpointDeclarations.ts (SEND_ENDPOINTS_DECLARED) con dónde vive\n` +
      `el campo \`sent\` en su respuesta. Si NO usa el contrato de src/lib/sendOutcome.ts\n` +
      `todavía, apárcala en SEND_ENDPOINTS_PENDING con un ticket real — nunca sin dueño.\n` +
      `Si no envía nada a un cliente (falso positivo de la heurística), añádela igual: una\n` +
      `entrada de más aquí solo cuesta una línea; una que falte es el punto ciego que este\n` +
      `guard existe para cerrar.\n`,
  );

  assert.deepEqual(
    doubleDeclared,
    [],
    `\n\n🔴 RUTA DECLARADA A LA VEZ EN SEND_ENDPOINTS_DECLARED Y EN PENDING:\n` +
      doubleDeclared.map((r) => `   · ${r}`).join('\n') +
      `\nElige una: o tiene contrato de sent (declarada) o no lo tiene todavía (aparcada).\n`,
  );

  t.diagnostic(`${smelling.length} rutas /admin huelen a envío · ${SEND_ENDPOINTS_DECLARED.length} declaradas · ${SEND_ENDPOINTS_PENDING.length} aparcadas`);
});

test('SCRUM-128: ninguna declaración (ni pendiente) apunta a una ruta que ya no existe', () => {
  // Universo COMPLETO, no solo las que huelen a envío: así collect-rest —declarada a mano
  // porque la heurística no la detecta, ver el límite honesto en sendEndpointDeclarations.ts—
  // se valida igual que las demás.
  const real = new Set(enumerateAllAdminRoutes().map((r) => key(r.method, r.path)));

  const muertas = [];
  for (const d of SEND_ENDPOINTS_DECLARED) {
    const k = key(d.method, d.path);
    if (!real.has(k)) muertas.push(`${k}  (en SEND_ENDPOINTS_DECLARED, channel=${d.channel})`);
  }
  for (const p of SEND_ENDPOINTS_PENDING) {
    const k = key(p.method, p.path);
    if (!real.has(k)) muertas.push(`${k}  (en SEND_ENDPOINTS_PENDING, ticket=${p.ticket})`);
  }

  assert.deepEqual(
    muertas,
    [],
    `\n\n🔴 DECLARACIÓN MUERTA: apunta a una ruta que YA NO EXISTE:\n` +
      muertas.map((r) => `   · ${r}`).join('\n') +
      `\n\nUna declaración muerta no prueba nada y es indistinguible de una que sí. Bórrala o corrígela.\n`,
  );
});

test('SCRUM-128: los 9 endpoints con contrato de sendOutcome.ts están TODOS declarados', () => {
  // Suelo exacto, no ">=": si alguien borra una entrada por error, esto lo dice de
  // inmediato en vez de esperar a que la enumeración (que sí podría no verla si además
  // se borra la ruta) lo note por otra vía. Mismo espíritu que RUTAS_MIN de scrum55,
  // aplicado a una lista mucho más pequeña y por eso exacto en vez de suelo con margen.
  assert.equal(
    SEND_ENDPOINTS_DECLARED.length, 9,
    `\n\n🔴 SEND_ENDPOINTS_DECLARED tiene ${SEND_ENDPOINTS_DECLARED.length} entradas, se esperaban 9 ` +
      `(los 9 endpoints con contrato de cuerpo de SCRUM-126 — el 9º, el fire-and-forget de ` +
      `quotes.routes.ts:568, no tiene contrato que declarar). Si añadiste un endpoint de envío ` +
      `NUEVO, este número sube a propósito: actualízalo aquí mismo, en el mismo commit.\n`,
  );
});

test('SCRUM-128: la lista de aparcadas mengua (ratchet + caducidad)', (t) => {
  // SCRUM-124: igualdad exacta, no `<=` — un hueco libre en el ratchet es sitio para
  // aparcar algo nuevo sin que el número suba. Ver la doctrina completa en
  // scrum55-admin-fail-closed.test.mjs, que es de donde viene esta regla.
  assert.equal(
    SEND_ENDPOINTS_PENDING.length, SEND_ENDPOINTS_PENDING_MAX,
    SEND_ENDPOINTS_PENDING.length > SEND_ENDPOINTS_PENDING_MAX
      ? `\n\n🔴 SEND_ENDPOINTS_PENDING ha CRECIDO: ${SEND_ENDPOINTS_PENDING.length} > ${SEND_ENDPOINTS_PENDING_MAX}.\n` +
        `Esa lista solo puede menguar. Una ruta de envío NUEVA se declara (contrato real);\n` +
        `no se aparca.\n`
      : `\n\n🔴 HOLGURA en el ratchet: ${SEND_ENDPOINTS_PENDING.length} pendientes con el tope en ${SEND_ENDPOINTS_PENDING_MAX}.\n` +
        `Baja SEND_ENDPOINTS_PENDING_MAX a ${SEND_ENDPOINTS_PENDING.length} en ESTE MISMO commit.\n`,
  );

  const hoy = new Date().toISOString().slice(0, 10);
  if (SEND_ENDPOINTS_PENDING.length > 0) {
    assert.ok(
      hoy <= SEND_ENDPOINTS_REVISAR_ANTES_DE,
      `\n\n🔴 CADUCÓ el plazo para arreglar los endpoints de envío aparcados.\n` +
        `   Hoy ${hoy} · plazo ${SEND_ENDPOINTS_REVISAR_ANTES_DE} · quedan ${SEND_ENDPOINTS_PENDING.length}.\n\n` +
        SEND_ENDPOINTS_PENDING.map((r) => `   · ${r.method} ${r.path} — ${r.duda} (${r.ticket})`).join('\n') +
        `\n`,
    );
  }

  if (SEND_ENDPOINTS_PENDING.length === 0) {
    t.diagnostic('sin pendientes: todos los endpoints de envío tienen contrato declarado 🎉');
  } else {
    t.diagnostic(`pendientes: ${SEND_ENDPOINTS_PENDING.length} · plazo ${SEND_ENDPOINTS_REVISAR_ANTES_DE}`);
  }
});
