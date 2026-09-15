// tests/scrum815c-el-escritor-de-los-cinco.test.mjs — SCRUM-815 · ③ el escritor
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// UN EVENTO QUE LLEGÓ Y NO TERMINÓ VUELVE A ENTRAR. Y SOLO PARA LOS CINCO SEGUROS.
//
// El defecto: la ruta marca el evento como visto ANTES de procesarlo. Si el trabajo falla
// después, responde 400, Stripe reintenta… y el reintento se descarta por «ya visto». El trabajo
// no se pierde por el fallo — se pierde por la marca puesta antes de tiempo.
//
// ── LO QUE ESTE FICHERO FIJA, y por qué son cuatro cosas y no una ─────────────────────────────
//
// ① 🔴 EL ROJO: hoy, un evento que falla después de recibirse PIERDE su reintento. Ejecutado
//    contra la función real de la ruta, no contra una descripción de ella.
// ② ✅ Con el protocolo, ese mismo evento vuelve a entrar — y se cuenta el intento.
// ③ ✅ Un proceso que muere ENTRE `received_at` y `processed_at` deja la puerta abierta. Ésa es
//    la propiedad entera de los dos timestamps, y un booleano `processed` no la tiene.
// ④ ✅ Los DOS excluidos siguen comportándose EXACTAMENTE como hoy. Si el protocolo los tocara,
//    el arreglo habría salido de la decisión del asesor.
//
// ⛔ NADA EN MEMORIA. El `Map` de aquí abajo es el DOBLE DE LA TABLA para poder medir sin base
//    —tiene la semántica del índice único, choca con `P2002`— no el arreglo. El arreglo escribe
//    en `gateway_events`, en disco, que es lo único que sobrevive a un reinicio y al tope de 500.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const RUTA_TS = path.join(RAIZ, 'src', 'modules', 'billing', 'app', 'routes', 'stripe.routes.ts');

const SERVICIO_TS = path.join(RAIZ, 'src', 'modules', 'billing', 'domain', 'gatewayEvents.service.ts');

const {
  llevaRegistro, abrirRegistroDeEvento, marcarEventoProcesado, anotarFalloDeEvento,
  EVENTOS_SIN_REGISTRO,
} = await import('../dist/modules/billing/domain/gatewayEvents.service.js');

/**
 * La lista de los CINCO se lee del fuente por AST, no se importa: no está exportada a propósito
 * —su consumidor real es `llevaRegistro`, dentro del propio módulo— y añadirle un `export` sólo
 * para que un test la viera sería abrir superficie pública para uso de test (SCRUM-411).
 */
function listaDelFuente(nombre) {
  const sf = ts.createSourceFile(SERVICIO_TS, fs.readFileSync(SERVICIO_TS, 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let valores = null;
  (function walk(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText() === nombre && n.initializer) {
      valores = [...n.initializer.getText().matchAll(/'([^']+)'/g)].map((m) => m[1]);
    }
    ts.forEachChild(n, walk);
  })(sf);
  assert.ok(valores?.length, `🔴 no se pudo leer \`${nombre}\` del fuente: el lector está ciego`);
  return valores;
}

/**
 * 🔒 El tope de `last_error` se deriva del ESQUEMA, que es quien manda: la columna es
 * `VarChar(N)` y Postgres no recorta sola — rechaza la escritura. Un 500 clavado aquí seguiría
 * dando verde el día que la columna cambie, justo cuando el recorte dejaría de bastar.
 */
function topeDeLastError() {
  const schema = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
  const m = schema.match(/lastError\s+String\?[^\n]*@db\.VarChar\((\d+)\)/);
  assert.ok(m, '🔴 no se encuentra `lastError` con su VarChar en el schema: el ancla está rota');
  return Number(m[1]);
}

const EVENTOS_CON_REGISTRO = listaDelFuente('EVENTOS_CON_REGISTRO');
const MAX_LAST_ERROR = topeDeLastError();

// ── El doble de `gateway_events`: una tabla con su índice único ───────────────────────────────
//
// Reproduce lo único que el protocolo le pide a la base: que un segundo `create` con el mismo
// (provider, eventId) CHOQUE con `P2002`. Sin esa semántica el banco diría que sí a todo y los
// casos de abajo saldrían verdes sin haber ejercitado el mecanismo.
function bancoTabla() {
  const filas = new Map();
  const k = (provider, eventId) => `${provider}::${eventId}`;
  return {
    filas,
    gatewayEvent: {
      async create({ data }) {
        const id = k(data.provider, data.eventId);
        if (filas.has(id)) { const e = new Error('Unique constraint failed'); e.code = 'P2002'; throw e; }
        // 🔴 EL ORDEN DE ESTE SPREAD ES UN CONTROL, y se midió: con los defaults DETRÁS de
        // `...data`, un `create` que escribiera `processedAt` —o sea, EL DEFECTO de este
        // ticket: marcar al recibir— quedaba machacado a `null` por el propio banco, y la
        // mutación que lo inyecta salía VERDE. El banco tiene que guardar lo que le mandan,
        // como la tabla: los defaults sólo rellenan lo que NO viene.
        filas.set(id, {
          id: filas.size + 1,
          receivedAt: new Date(), processedAt: null, attempts: 1, lastError: null,
          ...data,
        });
        return filas.get(id);
      },
      async findUnique({ where }) {
        const { provider, eventId } = where.provider_eventId;
        return filas.get(k(provider, eventId)) ?? null;
      },
      async update({ where, data }) {
        const { provider, eventId } = where.provider_eventId;
        const fila = filas.get(k(provider, eventId));
        if (!fila) { const e = new Error('Record to update not found'); e.code = 'P2025'; throw e; }
        for (const [campo, valor] of Object.entries(data)) {
          fila[campo] = (valor && typeof valor === 'object' && 'increment' in valor)
            ? fila[campo] + valor.increment
            : valor;
        }
        return fila;
      },
    },
  };
}

const UN_EVENTO = 'evt_1Nq7XyZ';
const TIPO_SEGURO = 'customer.subscription.updated';

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SUELO — un banco que no choca haría verdes todos los casos de abajo
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-815c · SUELO: el doble de la tabla CHOCA con P2002 en el segundo insert', async () => {
  const db = bancoTabla();
  await db.gatewayEvent.create({ data: { provider: 'stripe', eventId: 'x', type: 't' } });
  await assert.rejects(
    () => db.gatewayEvent.create({ data: { provider: 'stripe', eventId: 'x', type: 't' } }),
    (e) => e.code === 'P2002',
    '🔴 el banco admite dos filas con la misma clave. Sin el choque, «el segundo intento entra» '
    + 'saldría verde sobre un banco que nunca ejercita el índice único — que ES el mecanismo.',
  );
  // Y que SÍ admite otro evento distinto: un banco que rechazara todo daría el mismo verde.
  await db.gatewayEvent.create({ data: { provider: 'stripe', eventId: 'y', type: 't' } });
  assert.equal(db.filas.size, 2);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① 🔴 EL ROJO — EL DEFECTO DE HOY, ejecutado contra la función REAL de la ruta
//
// `isDuplicateStripeEvent` marca al VER, no al terminar. Se llama en la puerta, antes de
// despachar. Así que basta con que el trabajo falle después para que el reintento se descarte.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-815c · 🔴 EL DEFECTO: con la memoria, un evento que FALLA pierde su reintento', async () => {
  const { isDuplicateStripeEvent } = await import(
    '../dist/modules/billing/app/routes/stripe.routes.js');

  // ⚠️ MEDIDO, no supuesto: dentro de un proceso el `Set` es UNO SOLO y no se puede aislar —
  // `import(...'?v=1')` y `import(...'?v=2')` devuelven la MISMA función aquí (comprobado:
  // `a.isDuplicateStripeEvent === b.isDuplicateStripeEvent`). Por eso cada caso usa un id
  // propio en vez de fingir un módulo limpio que no existe.
  const id = 'evt_falla_despues';
  let trabajosHechos = 0;

  // ── Entrega 1: la puerta lo marca como visto, y el trabajo REVIENTA después ──
  assert.equal(isDuplicateStripeEvent(id), false, 'la primera entrega no es duplicada');
  try { trabajosHechos += 1; throw new Error('la base estaba caída'); } catch { /* 400 a Stripe */ }

  // ── Entrega 2: Stripe reintenta (lo hace durante 3 días) ──
  const descartada = isDuplicateStripeEvent(id);

  assert.equal(descartada, true,
    '🔴 si esto fuera false, el defecto ya no existiría y este fichero sobra');
  assert.equal(trabajosHechos, 1,
    `🔴 EL DEFECTO, MEDIDO: el trabajo se intentó ${trabajosHechos} vez, falló, y el reintento se `
    + 'descartó por «ya visto». La marca se puso al RECIBIR, no al terminar: el evento se pierde '
    + 'para siempre y nadie se entera, porque la ruta ya respondió 200 al reintento.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② ✅ CON EL PROTOCOLO: ese mismo evento vuelve a entrar, y se cuenta el intento
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-815c · ✅ con el registro, el evento que falló VUELVE A ENTRAR', async () => {
  const db = bancoTabla();
  let trabajosHechos = 0;

  // ── Entrega 1: se abre el registro, el trabajo falla, se anota. NO se marca procesado ──
  assert.equal(await abrirRegistroDeEvento(UN_EVENTO, TIPO_SEGURO, db), 'hacer');
  trabajosHechos += 1;
  await anotarFalloDeEvento(UN_EVENTO, 'la base estaba caída', db);

  // ── Entrega 2: el reintento de Stripe ──
  const decision = await abrirRegistroDeEvento(UN_EVENTO, TIPO_SEGURO, db);
  assert.equal(decision, 'hacer',
    '🔴 el reintento se ha descartado. La fila existe pero `processed_at` está a NULL: eso '
    + 'significa «llegó y NO terminó», y el trabajo tiene que rehacerse.');
  trabajosHechos += 1;

  assert.equal(trabajosHechos, 2, '🔴 el trabajo no se rehizo en el reintento');

  const fila = await db.gatewayEvent.findUnique({
    where: { provider_eventId: { provider: 'stripe', eventId: UN_EVENTO } } });
  assert.equal(fila.attempts, 2,
    `🔴 \`attempts\` vale ${fila.attempts} y son 2. Sin ese contador, un evento atascado es `
    + 'indistinguible de uno recién llegado — y es la única señal de que algo no termina nunca.');
  assert.equal(fila.processedAt, null, '🔴 se ha marcado como procesado un evento que falló');
  assert.match(fila.lastError, /base estaba caída/, '🔴 el motivo del fallo no se guardó');
});

test('SCRUM-815c · ✅ y cuando TERMINA BIEN, el duplicado real se descarta sin trabajo', async () => {
  const db = bancoTabla();
  assert.equal(await abrirRegistroDeEvento(UN_EVENTO, TIPO_SEGURO, db), 'hacer');
  await marcarEventoProcesado(UN_EVENTO, db);

  assert.equal(await abrirRegistroDeEvento(UN_EVENTO, TIPO_SEGURO, db), 'ya_procesado',
    '🔴 un evento YA PROCESADO vuelve a hacer el trabajo. El control de arriba («vuelve a '
    + 'entrar») saldría verde igual con un protocolo que dijera «hacer» siempre: es este caso el '
    + 'que prueba que sabe distinguir.');

  const fila = await db.gatewayEvent.findUnique({
    where: { provider_eventId: { provider: 'stripe', eventId: UN_EVENTO } } });
  assert.ok(fila.processedAt instanceof Date, '🔴 `processed_at` no quedó puesto');
  assert.equal(fila.attempts, 1, '🔴 un duplicado real no debe contar como intento nuevo');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ ✅ EL QUE CIERRA — morir ENTRE `received_at` y `processed_at`
//
// Es la propiedad entera de los dos timestamps, y es distinta del caso de arriba: allí el
// trabajo falló y alguien lo anotó; aquí NADIE anota nada, porque el proceso ya no está. Un
// booleano `processed` puesto al recibir daría por hecho este evento para siempre.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-815c · ✅ EL QUE CIERRA: si el proceso MUERE a medias, la entrega siguiente entra', async () => {
  const db = bancoTabla();

  // Entrega 1: se abre el registro y… el proceso desaparece. No hay `catch`, no hay anotación,
  // no hay 400. Simplemente no se vuelve a ejecutar ni una línea de esta petición.
  assert.equal(await abrirRegistroDeEvento(UN_EVENTO, TIPO_SEGURO, db), 'hacer');

  const aMedias = await db.gatewayEvent.findUnique({
    where: { provider_eventId: { provider: 'stripe', eventId: UN_EVENTO } } });
  assert.ok(aMedias.receivedAt instanceof Date, '🔴 no consta cuándo llegó');
  assert.equal(aMedias.processedAt, null,
    '🔴 `processed_at` quedó puesto sin que nadie terminara el trabajo. Si esto se escribiera al '
    + 'recibir, este evento quedaría dado por hecho para siempre — que es el defecto de hoy '
    + 'guardado en disco, con más pasos y sobreviviendo a los despliegues.');

  // Entrega 2, después del reinicio: la fila sigue ahí y dice «llegó y no terminó».
  assert.equal(await abrirRegistroDeEvento(UN_EVENTO, TIPO_SEGURO, db), 'hacer',
    '🔴 la entrega siguiente NO entra: el trabajo de un proceso que murió a medias se pierde');
});

test('SCRUM-815c · ✅ REINICIO: la memoria se vacía y el disco NO', () => {
  // 🔴 UN REINICIO ES UN PROCESO NUEVO, así que se mide con procesos nuevos y no con una caché
  // de módulos. Medido antes de escribir esto: dentro de UN proceso el `Set` no se puede aislar
  // —`import('…?v=1')` y `import('…?v=2')` devuelven la misma función—, así que fingir el
  // reinicio con un import habría dado un verde sobre la memoria del vecino.
  const id = 'evt_tras_reinicio';
  const preguntar = (veces) => JSON.parse(execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `
      const { isDuplicateStripeEvent } = await import(${JSON.stringify(
        pathToFileURL(path.join(RAIZ, 'dist/modules/billing/app/routes/stripe.routes.js')).href)});
      const r = [];
      for (let i = 0; i < ${veces}; i++) r.push(isDuplicateStripeEvent(${JSON.stringify(id)}));
      console.log(JSON.stringify(r));
    `],
    { cwd: RAIZ, encoding: 'utf8' },
  ).trim().split('\n').pop());

  // Dentro del MISMO proceso sí recuerda: la segunda pregunta ya sale duplicada.
  assert.deepEqual(preguntar(2), [false, true],
    '🔴 la memoria no recuerda ni dentro del mismo proceso: entonces no hay LRU que medir');

  // Y un proceso NUEVO no recuerda nada. Ése es el tercer modo de pérdida, y el que hace que
  // «reiniciar» y «pasar de 500 eventos» tengan el mismo efecto.
  assert.deepEqual(preguntar(1), [false],
    '🔴 si esto saliera `true`, la memoria sobreviviría al reinicio y el tercer modo de pérdida '
    + 'no existiría. Sale false: tras reiniciar, el MISMO evento se reprocesa entero — y Stripe '
    + 'reentrega durante 3 días.');

  // Con el registro en disco la respuesta sobrevive, porque no vive en el proceso.
  const db = bancoTabla();
  return (async () => {
    await abrirRegistroDeEvento(id, TIPO_SEGURO, db);
    await marcarEventoProcesado(id, db);
    assert.equal(await abrirRegistroDeEvento(id, TIPO_SEGURO, db), 'ya_procesado',
      '🔴 el registro tampoco recuerda: entonces no es disco, es otro Map');
  })();
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ ✅ LOS DOS EXCLUIDOS — el control positivo de la decisión del asesor
//
// No es un detalle de alcance: encender el protocolo para ellos cambiaría un fallo SILENCIOSO
// (se pierden eventos) por uno RUIDOSO (correo reenviado, WhatsApp repetido, mes gratis
// duplicado). Que sigan como hoy es el resultado que se busca, no lo que faltó por hacer.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-815c · ✅ POSITIVO: los DOS no idempotentes NO llevan registro, y se nombran', () => {
  for (const tipo of EVENTOS_SIN_REGISTRO) {
    assert.equal(llevaRegistro(tipo), false,
      `🔴 \`${tipo}\` ha entrado en el protocolo. No es idempotente al repetir: volver a entrar `
      + 'le cuesta al cliente un correo, un WhatsApp o un mes gratis. Es una exclusión '
      + 'deliberada, no un olvido.');
  }
  assert.deepEqual([...EVENTOS_SIN_REGISTRO].sort(),
    ['charge.dispute.created', 'checkout.session.completed'],
    '🔴 la lista de excluidos ya no es la que decidió el asesor');
});

test('SCRUM-815c · ✅ POSITIVO: los CINCO seguros SÍ llevan registro, y son exactamente cinco', () => {
  assert.equal(EVENTOS_CON_REGISTRO.length, 5,
    `🔴 la lista tiene ${EVENTOS_CON_REGISTRO.length} tipos y el censo de SCRUM-815b dice cinco`);
  for (const tipo of EVENTOS_CON_REGISTRO) assert.equal(llevaRegistro(tipo), true);
  // Y las dos listas no se solapan: un tipo en las dos haría verdes los dos tests de arriba.
  const enLasDos = EVENTOS_CON_REGISTRO.filter((t) => EVENTOS_SIN_REGISTRO.includes(t));
  assert.deepEqual(enLasDos, [], `🔴 ${enLasDos} está en las dos listas`);
  assert.equal(llevaRegistro('cualquier.otro.evento'), false,
    '🔴 un tipo desconocido entra en el protocolo: la lista es cerrada a propósito');
});

test('SCRUM-815c · 🔴 LA RUTA sólo abre registro DENTRO de la puerta `llevaRegistro`', () => {
  // Por AST y no por texto: `llevaRegistro` y `abrirRegistroDeEvento` aparecen también en el
  // `import` y en los comentarios de la ruta, así que un `grep` seguiría verde con la llamada
  // sacada fuera del `if` — que es exactamente el fallo que este caso vigila.
  const codigo = fs.readFileSync(RUTA_TS, 'utf8');
  const sf = ts.createSourceFile(RUTA_TS, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  let aperturas = 0;
  let dentroDeLaPuerta = 0;
  const visitar = (n, bajoPuerta) => {
    let puerta = bajoPuerta;
    if (ts.isIfStatement(n) && /\bllevaRegistro\s*\(/.test(n.expression.getText())) puerta = true;
    if (ts.isCallExpression(n) && n.expression.getText().endsWith('abrirRegistroDeEvento')) {
      aperturas += 1;
      if (bajoPuerta) dentroDeLaPuerta += 1;
    }
    ts.forEachChild(n, (h) => visitar(h, ts.isIfStatement(n) ? (h === n.thenStatement ? puerta : bajoPuerta) : puerta));
  };
  visitar(sf, false);

  assert.equal(aperturas, 1,
    `🔴 la ruta abre registro en ${aperturas} sitios y tiene que ser exactamente 1. Si son 0, `
    + 'el protocolo no está conectado y todo lo de arriba mide una función que nadie llama.');
  assert.equal(dentroDeLaPuerta, 1,
    '🔴 se abre registro FUERA del `if (llevaRegistro(...))`. Así entrarían los dos tipos '
    + 'excluidos, y el arreglo habría salido de la decisión del asesor.');
  // Y la otra mitad: los excluidos conservan su camino de hoy.
  assert.match(codigo, /isDuplicateStripeEvent\(event\.id\)/,
    '🔴 la ruta ya no usa el LRU en memoria: los dos tipos excluidos se han quedado SIN ninguna '
    + 'deduplicación, que es peor que como estaban');
});

test('SCRUM-815c · 🔴 LA RUTA CIERRA el registro al terminar, y sin más condiciones', () => {
  // 🔴 ESTE CASO NACIÓ DE UN ROJO QUE NO CAÍA. Los tests de arriba prueban el SERVICIO, y el
  // anterior prueba que la ruta ABRE el registro en el sitio correcto — pero nadie miraba que lo
  // CIERRE. Medido: envolver la marca en una condición imposible dejaba la tanda en 10/10.
  //
  // Sin el cierre, `processed_at` no se escribe nunca: toda entrega vuelve a entrar para siempre
  // y el mecanismo entero queda en un `INSERT` que no sirve para decidir nada.
  const codigo = fs.readFileSync(RUTA_TS, 'utf8');
  const sf = ts.createSourceFile(RUTA_TS, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const marcas = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n) && n.expression.getText().endsWith('marcarEventoProcesado')) {
      // El `if` que la envuelve: su condición es lo único que puede impedir que se ejecute.
      let p = n.parent;
      while (p && !ts.isIfStatement(p) && !ts.isSourceFile(p)) p = p.parent;
      marcas.push({ guarda: ts.isIfStatement(p) ? p.expression.getText().trim() : null });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  assert.equal(marcas.length, 1,
    `🔴 la ruta marca como procesado en ${marcas.length} sitios y tiene que ser exactamente 1. `
    + 'Con 0, `processed_at` no se escribe nunca y la tabla no puede distinguir «terminó» de '
    + '«murió a medias» — que es la propiedad entera de este ticket.');
  assert.equal(marcas[0].guarda, 'entregaConRegistro',
    `🔴 la marca de procesado está guardada por «${marcas[0].guarda}». La ÚNICA condición puede `
    + 'ser que haya un registro abierto: cualquier otra hace que un evento termine bien y no '
    + 'quede marcado, y entonces vuelve a entrar en cada reentrega durante tres días.');

  // Y su pareja: el fallo se anota en el `catch`, que es donde `processed_at` se queda a NULL.
  assert.match(codigo, /catch[\s\S]*anotarFalloDeEvento\(/,
    '🔴 la ruta ya no anota el motivo del fallo en el `catch`: un evento atascado se queda sin '
    + 'diagnóstico, y `attempts` sube sin que nadie pueda decir por qué');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Y el borde que revienta la escritura del diagnóstico
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-815c · 🔴 un motivo larguísimo se RECORTA: `last_error` es VarChar(500)', async () => {
  const db = bancoTabla();
  await abrirRegistroDeEvento(UN_EVENTO, TIPO_SEGURO, db);
  await anotarFalloDeEvento(UN_EVENTO, 'x'.repeat(MAX_LAST_ERROR * 3), db);

  const fila = await db.gatewayEvent.findUnique({
    where: { provider_eventId: { provider: 'stripe', eventId: UN_EVENTO } } });
  assert.equal(fila.lastError.length, MAX_LAST_ERROR,
    `🔴 el motivo se guardó con ${fila.lastError.length} caracteres y la columna admite `
    + `${MAX_LAST_ERROR}. Postgres no lo corta solo: rechaza la escritura, y entonces el `
    + 'diagnóstico del fallo se pierde ENTERO justo cuando hace falta.');
});
