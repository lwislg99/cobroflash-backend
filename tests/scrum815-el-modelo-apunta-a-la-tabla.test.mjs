// tests/scrum815-el-modelo-apunta-a-la-tabla.test.mjs — SCRUM-815 · el paso 6
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL MODELO `GatewayEvent` APUNTA A LAS COLUMNAS QUE LA TABLA TIENE DE VERDAD.
//
// `gateway_events` ya existe en desarrollo, staging y producción. El paso 6 pega su modelo en
// `schema.prisma` para que Prisma sepa que la tabla está ahí. Este fichero vigila la costura
// entre las dos cosas — el modelo y la tabla — y no hay ninguna otra que la mire.
//
// ── 🔴 POR QUÉ ESTO NO LO CUBRE `scrum235`, Y NO ES UN SOLAPE ─────────────────────────────────
//
// `scrum235` compara el SCHEMA contra el CLIENTE generado, en los dos sentidos y mirando `@map`.
// Es un guard excelente y caza el cliente desfasado. Pero las dos mitades que compara salen del
// MISMO fichero: si alguien le quita el `@map("event_id")` a `eventId` **y regenera**, el schema
// y el cliente vuelven a cuadrar al instante y `scrum235` sigue en verde — medido, no supuesto.
//
// Lo que ese guard no puede ver es el tercer extremo: **la base**. Y es el que decide.
//
// > Sin `@map`, Prisma busca una columna `"eventId"` en camello. En `gateway_events` esa columna
// > NO EXISTE —la real es `event_id`— así que el error no sale al compilar ni al generar: sale en
// > la PRIMERA CONSULTA que toque la tabla, en ejecución, y en el camino de un webhook de cobro.
//
// Por eso aquí la referencia no es `schema.prisma`: es el DDL que creó la tabla
// (`docs/sql/scrum-815-el-evento-que-no-se-pierde.sql`), que es lo que hay en las tres bases. Los
// nombres físicos se LEEN de ahí, no se escriben a mano en una lista de este fichero — una lista
// copiada a mano es una cuarta copia que puede divergir como las otras tres.
//
// ⛔ Este fichero NO escribe el protocolo del webhook (insertar, reintentar, decidir): eso toca
//    el flujo de cobro en producción y va aparte. Aquí sólo se comprueba que el sitio está bien
//    abierto.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DDL = path.join(RAIZ, 'docs', 'sql', 'scrum-815-el-evento-que-no-se-pierde.sql');
const TABLA = 'gateway_events';
const MODELO = 'GatewayEvent';

const { Prisma, PrismaClient } = await import('@prisma/client');

/**
 * Las columnas que el DDL crea de verdad.
 *
 * 🔴 Se parsea SÓLO el cuerpo del `CREATE TABLE`, y las líneas de comentario se tiran ANTES. El
 * fichero explica el modelo en su cabecera y ahí aparecen escritos `"event_id"`, `"processed_at"`
 * y los demás: un barrido sobre el fichero entero los encontraría igual y daría verde aunque el
 * `CREATE TABLE` no los tuviera. Sería leer la explicación en vez de la tabla.
 */
function columnasDelDdl() {
  const sinComentarios = fs.readFileSync(DDL, 'utf8')
    .split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n');
  const desde = sinComentarios.indexOf(`CREATE TABLE IF NOT EXISTS "${TABLA}"`);
  assert.ok(desde > -1, `🔴 el DDL ya no crea la tabla "${TABLA}": ${DDL}`);
  const cuerpo = sinComentarios.slice(desde, sinComentarios.indexOf(');', desde));
  return [...cuerpo.matchAll(/^\s*"([a-z0-9_]+)"\s+[A-Z]/gm)].map((m) => m[1]);
}

/** Los índices que el DDL crea, por las columnas que llevan dentro. */
function indicesDelDdl() {
  const texto = fs.readFileSync(DDL, 'utf8')
    .split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n');
  return [...texto.matchAll(/CREATE\s+(UNIQUE\s+)?INDEX[^(]*ON\s*"([a-z_]+)"\s*\(([^)]*)\)/g)]
    .map((m) => ({
      unico: Boolean(m[1]),
      tabla: m[2],
      columnas: m[3].split(',').map((c) => c.trim().replace(/"/g, '')),
    }));
}

const modelo = Prisma.dmmf.datamodel.models.find((m) => m.name === MODELO);
/** El nombre FÍSICO de cada campo: el `@map` si lo lleva, y si no el propio nombre. */
const columnaDe = (f) => f.dbName ?? f.name;
const escalares = (modelo?.fields ?? []).filter((f) => f.kind !== 'object');

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SUELO — tres formas de que todo lo de abajo saliera verde sin haber mirado nada
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-815 · SUELO: el DDL se parsea y produce las columnas de la tabla', () => {
  const cols = columnasDelDdl();
  assert.ok(cols.length >= 8,
    `🔴 el parser del DDL sacó ${cols.length} columnas. Con una lista vacía, «todos los campos `
    + 'apuntan a una columna del DDL» sería cierto por vacío y este fichero no mediría nada.');
  // Y que ha leído la TABLA y no la explicación de la cabecera: la cabecera no declara tipos.
  assert.ok(cols.includes('event_id') && cols.includes('processed_at'),
    `🔴 el parser no encuentra las columnas multipalabra dentro del CREATE TABLE: ${cols}`);
});

test('SCRUM-815 · SUELO: el modelo EXISTE en el cliente generado (hecho, no forma)', () => {
  // `prisma validate` en verde dice que el fichero está bien ESCRITO. Esto dice que los campos
  // han LLEGADO al cliente: es la diferencia entre la forma y el hecho, y sin ella un `generate`
  // que fallara en silencio dejaría todo lo de abajo comprobando un modelo ausente.
  assert.ok(modelo,
    `🔴 \`${MODELO}\` no está en el cliente de Prisma. O falta el modelo en \`schema.prisma\`, o `
    + 'no se ha regenerado el cliente después de añadirlo (`prisma generate`).');
  assert.equal(modelo.dbName, TABLA,
    `🔴 el modelo apunta a la tabla «${modelo.dbName}» y la que existe es «${TABLA}»`);
  assert.ok(escalares.length >= 8, `🔴 el modelo tiene ${escalares.length} campos escalares`);
});

test('SCRUM-815 · SUELO: el delegado se puede pedir al cliente', () => {
  // No consulta nada: sólo comprueba que `prisma.gatewayEvent` existe. Si el modelo no se hubiera
  // generado, aquí saldría `undefined` y quien escriba el protocolo lo sabría al minuto, no en
  // la primera llamada real de un webhook.
  assert.equal(typeof new PrismaClient().gatewayEvent, 'object',
    '🔴 `prisma.gatewayEvent` no existe en el cliente');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE — las dos direcciones, porque los dos fallos son distintos
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-815 · 🔴 CADA campo del modelo apunta a una columna que la tabla TIENE', () => {
  const cols = new Set(columnasDelDdl());
  const huerfanos = escalares
    .filter((f) => !cols.has(columnaDe(f)))
    .map((f) => `${f.name} → "${columnaDe(f)}"`);

  assert.deepEqual(huerfanos, [],
    `🔴 ${huerfanos.length} campo(s) del modelo apuntan a una columna que NO EXISTE en `
    + `${TABLA}: ${huerfanos.join(', ')}.\n`
    + '   Casi siempre es un `@map` que falta o que se ha escrito mal. Sin él Prisma pide la '
    + 'columna con el nombre del campo EN CAMELLO, y la base responde por su nombre físico: el '
    + 'error no aparece al compilar ni al generar el cliente — aparece en la PRIMERA CONSULTA, en '
    + `ejecución.\n   Columnas reales: ${[...cols].join(', ')}`);
});

test('SCRUM-815 · 🔴 CADA columna de la tabla tiene su campo (nada queda inalcanzable)', () => {
  const apuntadas = new Set(escalares.map(columnaDe));
  const sinCampo = columnasDelDdl().filter((c) => !apuntadas.has(c));

  assert.deepEqual(sinCampo, [],
    `🔴 la tabla tiene columna(s) que ningún campo del modelo alcanza: ${sinCampo.join(', ')}. `
    + 'Una columna sin campo no se puede leer ni escribir desde el código: existe en la base, '
    + 'ocupa sitio y no sirve para nada. `attempts` y `last_error` son justo las que hacen VISIBLE '
    + 'un evento atascado — perderlas es perder el diagnóstico entero.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 Y LO QUE ES EL TICKET ENTERO: `processed_at` puede ser NULL
//
// Confundir «visto» con «procesado» es el defecto que SCRUM-815 existe para cerrar. `NULL` en
// `processed_at` es un ESTADO con significado —llegó y no terminó, o está en curso, o el proceso
// murió— y es lo que hace que un reintento de Stripe pase en vez de darse por hecho. Si el campo
// dejara de ser opcional, el modelo ya no podría representar «recibido y sin terminar».
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-815 · 🔴 `processedAt` es NULLABLE, y `receivedAt` no', () => {
  const campo = (n) => escalares.find((f) => f.name === n);
  assert.equal(campo('processedAt')?.isRequired, false,
    '🔴 `processedAt` ha dejado de ser opcional. NULL no es un hueco: es «llegó y NO terminó», y '
    + 'sin ese estado el modelo vuelve a no distinguir «visto» de «procesado» — que es exactamente '
    + 'el defecto que este ticket cierra.');
  assert.equal(campo('receivedAt')?.isRequired, true,
    '🔴 `receivedAt` se ha vuelto opcional: no hay ninguna fila que pueda no tener instante de '
    + 'llegada, lo pone la base al insertar.');
  assert.equal(campo('lastError')?.isRequired, false, '🔴 `lastError` tiene que poder ser NULL');
});

test('SCRUM-815 · 🔴 el UNIQUE (provider, event_id) está en el modelo Y en la tabla', () => {
  // Es el mecanismo, no un adorno: es lo que hace imposible que dos réplicas se crean las dos las
  // primeras en atender el mismo evento. Si se cae de un lado, el choque deja de ocurrir.
  assert.deepEqual(modelo.uniqueFields, [['provider', 'eventId']],
    `🔴 el modelo ya no declara el único por (provider, eventId): ${JSON.stringify(modelo.uniqueFields)}`);

  const unicos = indicesDelDdl().filter((i) => i.unico && i.tabla === TABLA);
  assert.deepEqual(unicos.map((i) => i.columnas), [['provider', 'event_id']],
    `🔴 el DDL ya no crea el índice único por (provider, event_id): ${JSON.stringify(unicos)}`);

  // Y que los dos hablen de lo MISMO: el del modelo, traducido a columnas físicas, es el del DDL.
  const enColumnas = modelo.uniqueFields[0].map((n) => columnaDe(escalares.find((f) => f.name === n)));
  assert.deepEqual(enColumnas, unicos[0].columnas,
    `🔴 el único del modelo apunta a ${enColumnas} y el de la tabla es ${unicos[0].columnas}`);
});
