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
// SCRUM-98: ÚNICA fuente de verdad, movida a publicAccessDeclarations.ts (Guard A la
// reutiliza tal cual para su propia enumeración, con /dev excluido de SU exigencia
// porque no es superficie de producción — ver GUARD_A_EXCLUDED_PREFIXES ahí).
const { PUBLIC_PREFIXES } = await import('../dist/core/http/publicAccessDeclarations.js');

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

/**
 * SUELO DEL ENUMERADOR — al recuento REAL, sin margen. Medido: 125 rutas /admin (23-jul-2026).
 *
 * Antes era `routes.length > 100` con 125 montadas: **25 rutas de margen ciego**. El walker
 * podía dejar de ver veinticuatro y el canario seguía cantando. Un canario con 25 % de holgura
 * no avisa de nada — y esta es la enumeración de la que dependen los OTROS tres asserts del
 * fichero: si enumera de menos, «toda ruta declara rol» pasa en verde sobre las que sí vio.
 *
 * ⚠️ NO es el mismo caso que CENSO_MIN, aunque los dos sean suelos:
 *
 *   · CENSO_MIN protege una lista que se edita A MANO. Bajarlo es un cambio DELIBERADO que
 *     aparece en el diff de un PR y alguien lo revisa → holgado es aceptable, es convención.
 *   · Esto protege contra una caída INVISIBLE: Express cambia de versión, `app.router.stack`
 *     deja de exponer algo, y la enumeración encoge sin que nadie toque una línea. Nadie va a
 *     revisar un diff, porque no hay diff. Por eso tiene que ir APRETADO.
 *
 * La pregunta no es «¿tiene mecanismo?» sino «¿cuánto cuesta el atajo y quién lo vería?».
 * Aquí no hay atajo que revisar: hay un fallo que nadie ve. (SCRUM-124)
 *
 * MEDIDO, no supuesto. De las 125 rutas, 114 figuran en alguna de las tres listas y 11 no
 * figuran en ninguna (billing/checkout, team, connect, exports/fees.csv). Se inyectó una
 * avería que se lleva EXACTAMENTE esas 11 — las que se pueden perder sin dejar rastro:
 *
 *   suelo viejo (>100):  114 rutas · TODO VERDE, exit=0 · el diagnóstico imprime «114 rutas»
 *   suelo nuevo (>=125): 114 rutas · ROJO, exit=1
 *
 * El primer intento de demostrarlo recortó rutas al azar y salió rojo con el suelo viejo —
 * pero lo cazó el assert de «entrada muerta», no el suelo, y solo porque el recorte pilló
 * rutas declaradas. Cazar por casualidad no es cubrir esa clase (principio 7 de
 * docs/QA/SUITE_REGRESION.md, sección «Escribir verificaciones»): había
 * que buscar la avería que NO deja rastro, y esa pasaba entera.
 *
 * Al añadir rutas SUBE (el assert no molesta: 126 >= 125 pasa). Si se BORRA una ruta de
 * verdad, esto sale rojo y se baja a propósito, en el mismo commit y con el motivo.
 */
const RUTAS_MIN = 125;

test('SCRUM-55: toda ruta /admin declara rol (fail-closed)', (t) => {
  const routes = enumerateAdminRoutes();
  assert.ok(
    routes.length >= RUTAS_MIN,
    `\n\n🔴 LA ENUMERACIÓN HA ENCOGIDO: ${routes.length} rutas /admin, el suelo es ${RUTAS_MIN}.\n\n` +
      `Los otros asserts de este fichero solo miran lo que ESTA función devuelve. Si enumera\n` +
      `de menos, «toda ruta declara rol» pasa en verde sobre las rutas que sí vio, y las que\n` +
      `se perdieron quedan fuera de la auditoría sin que nada lo diga.\n\n` +
      `Antes de bajar el suelo, descarta lo invisible: ¿cambió la versión de Express, o la\n` +
      `forma de montar un router? Esa es la avería que este número existe para cazar.\n` +
      `Solo si de verdad se BORRÓ una ruta, baja RUTAS_MIN a ${routes.length} aquí mismo, con el motivo.\n`,
  );

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
  // SCRUM-124: IGUALDAD EXACTA, no `<=`.
  //
  // Este assert decía `<=` y su propio mensaje pedía «si vacías una tanda, baja
  // PENDIENTE_MAX en el mismo commit» — sin nada que lo hiciera cumplir. Vaciar cinco
  // entradas y dejar el tope quieto pasaba en VERDE, con cinco huecos libres para aparcar
  // rutas nuevas sin que el test dijera ni pío. La prohibición estaba escrita; el
  // mecanismo, no.
  //
  // Lo grave no es el `<=`: es que la lección se aprendió AQUÍ. El ratchet de rutas se
  // dejó una vez en 25 con 24 entradas (SCRUM-103) y de ahí salió la regla. Al escribir
  // el ratchet de SCRUM-113 se aplicó `===` desde el primer día, citando este caso por su
  // nombre — y este fichero, el original, se quedó con el `<=`. **La corrección se escribió
  // y no se propagó a la hermana.** Tercera vez que aparece ese patrón el mismo día.
  //
  // Al cambiarlo: 16 entradas con PENDIENTE_MAX = 16. No-op hoy, red mañana.
  assert.equal(
    PENDIENTE_CLASIFICAR.length, PENDIENTE_MAX,
    PENDIENTE_CLASIFICAR.length > PENDIENTE_MAX
      ? `\n\n🔴 La lista de PENDIENTE_CLASIFICAR ha CRECIDO: ${PENDIENTE_CLASIFICAR.length} > ${PENDIENTE_MAX}.\n` +
        `Esa lista solo puede menguar. Una ruta NUEVA se declara (requireRole o TECNICO_ALLOWED);\n` +
        `no se aparca — y subir PENDIENTE_MAX para que quepa es exactamente el atajo que este\n` +
        `assert existe para impedir.\n`
      : `\n\n🔴 HOLGURA en el ratchet: ${PENDIENTE_CLASIFICAR.length} pendientes con el tope en ${PENDIENTE_MAX}.\n` +
        `Sobran ${PENDIENTE_MAX - PENDIENTE_CLASIFICAR.length} hueco(s), y un hueco libre es sitio donde aparcar una ruta\n` +
        `nueva sin que nadie se entere: el contador no sube, así que no salta nada.\n\n` +
        `Has clasificado rutas y no has bajado el tope. Baja PENDIENTE_MAX a ${PENDIENTE_CLASIFICAR.length} en\n` +
        `ESTE MISMO commit — es la otra mitad del trabajo, no una tarea aparte.\n`,
  );

  // El ratchet impide que crezca; la caducidad impide que se quede quieta.
  //
  // ── SCRUM-124 · CONVENCIÓN ACEPTADA ───────────────────────────────────────────────────
  // El mensaje de abajo dice «mueve REVISAR_ANTES_DE con el OK del fundador». Nada lo hace
  // cumplir, y no puede: un test no sabe si hubo OK. Se acepta porque mover la fecha es una
  // línea en el diff de un PR, con fecha y autor en el blame — deliberado y revisable.
  // Lo que sí tiene mecanismo es que la fecha NO se pueda ignorar: pasada, esto sale rojo.
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

// ─────────────────────────────────────────────────────────────────────────────
// SCRUM-103 — el ratchet CONTABA, pero no miraba lo que contaba.
//
// El ratchet y la caducidad tratan la lista como un número: cuántas hay y desde
// cuándo. Ninguno leía el campo `duda`, que es lo ÚNICO que justifica que una ruta
// esté aparcada en vez de decidida. Así se coló GET /admin/metrics/team con este
// texto literal:
//
//   duda: 'S1 dice "equipo ❌ Técnico" EXPLÍCITO → admin; confirmado 200 en prod'
//
// Una entrada de la lista de "sin clasificar" que afirmaba, ella misma, que NO había
// nada que clasificar Y que la ruta estaba abierta en producción. 25 ≤ 25, verde,
// y siguió sirviendo 200 a un Operario hasta el día siguiente.
//
// ⚠️ ESTAS HEURÍSTICAS SON BURLABLES A PROPÓSITO. Se saltan escribiendo una duda
// falsa que suene bien, y eso ESTÁ ACEPTADO: el objetivo NO es frenar a quien quiera
// engañar al test — eso es imposible con texto libre y quien lo intente abandonará.
// El objetivo es que aparcar una ruta CUESTE REDACTAR POR QUÉ, que es exactamente el
// paso que no se dio con metrics/team. Quien escriba una justificación falsa está
// mintiendo por escrito y con su nombre en el blame; quien no encuentra qué escribir
// descubre que no tenía una duda, tenía una tarea sin hacer.
//
// NO endurecer esto buscando infalibilidad. Si un día hay que elegir, prefiérase un
// falso NEGATIVO (se cuela una duda floja) a un falso POSITIVO (rojo con trabajo
// legítimo aparcado): lo segundo hace que alguien relaje el test para seguir, y un
// test relajado para seguir es cómo empezó todo esto.
//
// ── SCRUM-124 · CONVENCIÓN ACEPTADA, Y AQUÍ PARA LA REGRESIÓN ────────────────────
// Esta prohibición va dirigida a quien EDITE el test, no a quien lo ejecute, y por eso
// no puede tener mecanismo: sería un test que vigila cómo se escriben los tests, y ese
// necesitaría otro. La cadena termina aquí a propósito.
// El criterio se sostiene igual: endurecer estas heurísticas exige tocar estas líneas,
// sale en el diff y alguien lo revisa. Es el atajo caro y visible — convención.

/** Abreviatura de referencia a la entrada anterior. Legal SI tiene referente. */
const REF_A_LA_ANTERIOR = /^(í|i)dem\.?$/i;

/**
 * Cita el máster como YA DECIDIDO. Si S1 lo decidió, no es una duda: es una ruta
 * pendiente de gatear. Deliberadamente estrecho ("S1 dice/marca/dispone", "EXPLÍCITO")
 * para no pillar hedges legítimos del tipo "S1 no dice nada de esto".
 */
const CITA_S1_COMO_DECIDIDO = /S1\s+(dice|marca|dispone)|EXPL[IÍ]CITO/i;

/** Afirma que la ruta ya se vio abierta en producción. Eso es un incidente. */
const CONFIRMADA_ABIERTA_EN_PROD = /confirmad[oa][^.;]*prod|200 en prod|abiert[ao] en producci/i;

/**
 * Suelo de sustancia. La duda real más corta de la lista tiene 27 caracteres; 20 deja
 * margen holgado a las legítimas y rechaza los rellenos tipo "admin", "TODO", "luego".
 */
const MIN_DUDA = 20;

test('SCRUM-103: cada pendiente justifica por qué sigue sin decidir', () => {
  PENDIENTE_CLASIFICAR.forEach((r, i) => {
    const duda = String(r.duda || '').trim();
    const donde = `${r.method} ${r.path} (tanda ${r.tanda})`;

    // 1 · SUSTANCIA — aparcar cuesta redactar por qué.
    if (REF_A_LA_ANTERIOR.test(duda)) {
      // "Ídem" es legal: ahorra repetir el mismo motivo en un bloque contiguo. Pero
      // necesita REFERENTE — un "Ídem" sin nada delante no dice nada, y es lo que
      // queda cuando alguien reordena la lista o saca la entrada a la que apuntaba.
      const referente = PENDIENTE_CLASIFICAR.slice(0, i)
        .reverse()
        .find((p) => !REF_A_LA_ANTERIOR.test(String(p.duda || '').trim()));
      assert.ok(
        referente,
        `\n\n🔴 "${duda}" sin referente: ${donde}\n` +
          `   Es la primera entrada de la lista o todas las anteriores son también "Ídem",\n` +
          `   así que no remite a ningún motivo. Escribe el motivo entero aquí.\n`,
      );
    } else {
      assert.ok(
        duda.length >= MIN_DUDA,
        `\n\n🔴 Duda demasiado corta para justificar nada: ${donde}\n` +
          `   duda: "${duda}" (${duda.length} < ${MIN_DUDA} caracteres)\n\n` +
          `Aparcar una ruta CUESTA redactar por qué sigue sin decidir. Si no encuentras\n` +
          `qué escribir, no tienes una duda: tienes una tarea sin hacer. Decláralas\n` +
          `(requireRole o TECNICO_ALLOWED) en vez de aparcarla.\n`,
      );
    }

    // 2 · LO QUE EL MÁSTER YA DECIDIÓ NO SE APARCA.
    assert.ok(
      !CITA_S1_COMO_DECIDIDO.test(duda),
      `\n\n🔴 Esta "duda" dice que S1 ya lo decidió — entonces no es una duda: ${donde}\n` +
        `   duda: "${duda}"\n\n` +
        `Si el máster la clasificó, la ruta va a requireRole (o a TECNICO_ALLOWED con su\n` +
        `motivo), NO a la lista de sin clasificar. Este es el fallo exacto de\n` +
        `GET /admin/metrics/team: se aparcó una entrada que citaba S1 como explícito y\n` +
        `siguió abierta en producción un día más (SCRUM-55 → SCRUM-103).\n`,
    );

    // 3 · LO CONFIRMADO ABIERTO EN PRODUCCIÓN ES UN INCIDENTE, NO UN PENDIENTE.
    assert.ok(
      !CONFIRMADA_ABIERTA_EN_PROD.test(duda),
      `\n\n🔴 Esta "duda" dice que la ruta ya se vio ABIERTA EN PRODUCCIÓN: ${donde}\n` +
        `   duda: "${duda}"\n\n` +
        `Eso no es algo pendiente de clasificar: es un agujero confirmado, y aparcarlo lo\n` +
        `deja servido. Ciérralo con requireRole y verifica el 403 en producción.\n`,
    );
  });
});
