// tests/scrum475-schema-vs-sql.test.mjs — SCRUM-475
//
// QUE `schema.prisma` Y EL SQL APLICADO A LAS BASES DIGAN LO MISMO.
//
// Sin gate y SIN BASE DE DATOS: `migrate diff --from-empty` no conecta con nada, y por eso este
// instrumento es el que manda — no necesita ninguna credencial para poder correr.
//
// ── LA VÍCTIMA ────────────────────────────────────────────────────────────────────────────
// El modelo `EmailMessage` se pegó a mano en `schema.prisma`, y el SQL se aplicó a mano a staging y
// a producción desde la consola de Railway. Son dos copias del mismo diseño escritas por separado.
// Si una sola línea difiere, **el cliente de Prisma promete una forma que la base no tiene**, y el
// fallo no aparece aquí: aparece en producción, escribiendo un correo, con un `INSERT` que revienta
// contra una columna que no existe o un tipo que no encaja.
//
// ── POR QUÉ ESTO ACREDITA LAS TRES ────────────────────────────────────────────────────────
// El `\d email_messages` del fundador ya probó que **staging y producción SON** el contenido de
// `docs/sql/scrum-475-email-messages.sql` (12 columnas, mismos tipos, mismos defaults, 4 índices).
// Así que la cadena se cierra por transitividad: si lo que `schema.prisma` produciría contra vacío
// coincide con ese fichero, coincide con las dos bases. Lo que este test compara es el eslabón que
// nadie había comprobado — y es el único que se puede comprobar sin credenciales.
//
// ── 🔴 SE COMPARA POR CONTENIDO NORMALIZADO, NO POR IGUALDAD DE TEXTO ─────────────────────
// El fichero `.sql` lleva `IF NOT EXISTS` añadidos a mano —convención de la casa, declarada en su
// propia cabecera— y la herramienta no los emite. Comparar los dos textos daría una diferencia
// FALSA en las cuatro sentencias, y una diferencia falsa acaba con alguien relajando el guard. Lo
// que se compara es la ESTRUCTURA: nombre, tipo, nulabilidad y default de cada columna; y nombre,
// unicidad y columnas de cada índice. Ver `NORMALIZACIONES` para la lista exacta y su motivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { ejecutorLocal, controlPositivo, SCHEMA_POR_DEFECTO } from '../scripts/preview-migracion.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const FICHERO_SQL = 'docs/sql/scrum-475-email-messages.sql';
const TABLA = 'email_messages';

/**
 * LO QUE SE NORMALIZA, Y POR QUÉ CADA COSA. Escrito aquí porque una normalización sin motivo es
 * una excepción disfrazada: cada línea de ésta tapa una diferencia que NO es una divergencia.
 *
 *   1 · `IF NOT EXISTS` — lo añade el fundador a mano para que el fichero sea re-ejecutable
 *       (convención de la casa: `scrum-425-clave-idempotencia.sql`, `scrum-449-instalada-pwa.sql`).
 *       No cambia ni una columna ni un tipo: cambia qué pasa si el objeto ya está.
 *   2 · espacios, sangría y líneas en blanco — la herramienta deja una línea vacía antes del
 *       `CONSTRAINT` y el fichero no. Medido, no supuesto.
 *   3 · comentarios `--` — la herramienta emite `-- CreateTable`/`-- CreateIndex`; el fichero tiene
 *       su cabecera de procedencia. Ninguno de los dos es estructura.
 *
 * ⚠️ NO se normaliza NADA MÁS. En particular no se tocan tipos, nulabilidad, defaults ni nombres
 * de índice: son exactamente lo que este test existe para comparar.
 */
const NORMALIZACIONES = ['IF NOT EXISTS', 'espacios y líneas en blanco', 'comentarios --'];

function sinComentarios(sql) {
  return sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
}

/** El bloque `CREATE TABLE "<tabla>" ( … );` de un SQL, ya sin `IF NOT EXISTS` ni comentarios. */
function bloqueDeTabla(sql, tabla) {
  const limpio = sinComentarios(sql).replace(/\bIF NOT EXISTS\b/g, ' ');
  const rx = new RegExp(`CREATE TABLE\\s+"${tabla}"\\s*\\(([\\s\\S]*?)\\n\\);`, 'i');
  const m = limpio.match(rx);
  return m ? m[1] : null;
}

/**
 * Las columnas y la clave primaria de un bloque `CREATE TABLE`, como datos.
 *
 * Cada columna sale como `{ nombre, tipo, nulo, defecto }`. `nulo` se DERIVA de la ausencia de
 * `NOT NULL` —que es como lo escribe Postgres— en vez de exigir la palabra `NULL`, que no aparece.
 */
function parsearTabla(bloque) {
  const columnas = [];
  let pk = null;
  for (const cruda of bloque.split('\n')) {
    const linea = cruda.trim().replace(/,$/, '');
    if (!linea) continue;
    const mPk = linea.match(/^CONSTRAINT\s+"([^"]+)"\s+PRIMARY KEY\s*\(([^)]*)\)/i);
    if (mPk) {
      pk = { nombre: mPk[1], columnas: mPk[2].split(',').map((c) => c.trim().replace(/"/g, '')) };
      continue;
    }
    const mCol = linea.match(/^"([^"]+)"\s+(.*)$/);
    if (!mCol) continue;
    const nombre = mCol[1];
    let resto = mCol[2].trim();
    const noNulo = /\bNOT NULL\b/i.test(resto);
    resto = resto.replace(/\bNOT NULL\b/i, ' ').trim();
    let defecto = null;
    const mDef = resto.match(/\bDEFAULT\s+(.+)$/i);
    if (mDef) { defecto = mDef[1].trim(); resto = resto.slice(0, mDef.index).trim(); }
    columnas.push({ nombre, tipo: resto.replace(/\s+/g, ' ').trim(), nulo: !noNulo, defecto });
  }
  return { columnas, pk };
}

/** Los índices de una tabla, como datos: `{ nombre, unico, columnas }`. Ordenados por nombre. */
function parsearIndices(sql, tabla) {
  const limpio = sinComentarios(sql).replace(/\bIF NOT EXISTS\b/g, ' ');
  const rx = new RegExp(`CREATE\\s+(UNIQUE\\s+)?INDEX\\s+"([^"]+)"\\s+ON\\s+"${tabla}"\\s*\\(([^)]*)\\)`, 'gi');
  const out = [];
  for (const m of limpio.matchAll(rx)) {
    out.push({
      nombre: m[2],
      unico: !!m[1],
      columnas: m[3].split(',').map((c) => c.trim().replace(/"/g, '')),
    });
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Lo que `schema.prisma` produciría contra una base vacía. NO conecta con ninguna base. */
function sqlDelSchema() {
  const ejecutor = ejecutorLocal();
  const control = controlPositivo(ejecutor, SCHEMA_POR_DEFECTO);
  const r = ejecutor(['migrate', 'diff', '--from-empty', '--to-schema-datamodel', SCHEMA_POR_DEFECTO, '--script']);
  return { control, sql: r.salida, ok: r.ok, error: r.error };
}

const DEL_FICHERO = fs.readFileSync(path.join(RAIZ, FICHERO_SQL), 'utf8');
const DEL_SCHEMA = sqlDelSchema();

// ── 0 · 🔴 EL SUELO · «coinciden» y «no supe mirar» salen por líneas DISTINTAS ─────────────

test('SCRUM-475 · 🔴 SUELO: la herramienta responde y hay algo que comparar', () => {
  assert.ok(DEL_SCHEMA.control.ok,
    '🔴 NO SUPE MIRAR — la herramienta de la casa no responde, así que nada de lo de abajo se puede '
    + `creer.\n\n${DEL_SCHEMA.control.motivo || ''}`);
  assert.ok(DEL_SCHEMA.control.tablas >= 25,
    `🔴 el control positivo ve ${DEL_SCHEMA.control.tablas} tablas y el esquema tiene 25 con `
    + '`EmailMessage` dentro. Si ve menos, no está leyendo el esquema de esta rama.');
  assert.ok(DEL_SCHEMA.ok, `🔴 el diff contra vacío falló: ${DEL_SCHEMA.error || 'sin detalle'}`);

  const bloqueSchema = bloqueDeTabla(DEL_SCHEMA.sql, TABLA);
  const bloqueFichero = bloqueDeTabla(DEL_FICHERO, TABLA);
  assert.ok(bloqueSchema,
    `🔴 NO SUPE MIRAR: no encuentro \`CREATE TABLE "${TABLA}"\` en lo que produce \`schema.prisma\`. `
    + 'O el modelo ya no está en el esquema, o el extractor ha dejado de reconocer la forma. Las dos '
    + 'cosas hay que mirarlas: un «coinciden» sobre dos vacíos es el peor verde posible.');
  assert.ok(bloqueFichero,
    `🔴 NO SUPE MIRAR: no encuentro \`CREATE TABLE "${TABLA}"\` en ${FICHERO_SQL}.`);
});

// ── 1 · 🔴 AUTOPRUEBA · el comparador tiene que VER una diferencia antes de negar ninguna ──

test('SCRUM-475 · 🔴 AUTOPRUEBA: el comparador ve un tipo cambiado, una nulabilidad y un default', () => {
  // Sin esto, «no hay diferencias» y «mi comparador no compara» salen por la misma línea. Se le
  // introducen diferencias SINTÉTICAS —sobre una copia en memoria, el fichero no se toca— y se
  // comprueba que las caza una a una.
  const bueno = parsearTabla(bloqueDeTabla(DEL_FICHERO, TABLA));

  const tipoCambiado = parsearTabla(bloqueDeTabla(
    DEL_FICHERO.replace('"kind" TEXT NOT NULL', '"kind" VARCHAR(50) NOT NULL'), TABLA));
  assert.notDeepEqual(tipoCambiado.columnas, bueno.columnas,
    '🔴 el comparador NO VE un tipo cambiado (`TEXT` → `VARCHAR(50)`). Con esto roto, el test de '
    + 'abajo daría verde sobre un esquema que promete una forma que la base no tiene.');
  assert.equal(tipoCambiado.columnas.find((c) => c.nombre === 'kind').tipo, 'VARCHAR(50)');

  const nulabilidad = parsearTabla(bloqueDeTabla(
    DEL_FICHERO.replace('"to_email" TEXT NOT NULL', '"to_email" TEXT'), TABLA));
  assert.notDeepEqual(nulabilidad.columnas, bueno.columnas,
    '🔴 el comparador NO VE una nulabilidad cambiada. Es la diferencia más traicionera de las tres: '
    + 'el `INSERT` funciona hasta el día que llega una fila sin ese dato.');
  assert.equal(nulabilidad.columnas.find((c) => c.nombre === 'to_email').nulo, true);

  const defecto = parsearTabla(bloqueDeTabla(
    DEL_FICHERO.replace("DEFAULT 'aceptado_sin_identificador'", "DEFAULT 'entregado'"), TABLA));
  assert.notDeepEqual(defecto.columnas, bueno.columnas,
    '🔴 el comparador NO VE un default cambiado. Aquí eso sería grave de verdad: el default es '
    + '`aceptado_sin_identificador` y `entregado` es el estado que SOLO puede venir de un aviso del '
    + 'proveedor (SCRUM-475 fase 2). Un default equivocado convertiría cada fila nueva en una mentira.');

  const indiceRenombrado = parsearIndices(
    DEL_FICHERO.replace('email_messages_provider_id_key', 'email_messages_provider_id_uniq'), TABLA);
  assert.notDeepEqual(indiceRenombrado, parsearIndices(DEL_FICHERO, TABLA),
    '🔴 el comparador NO VE un índice renombrado. El nombre importa: es el que Prisma DERIVA, y si '
    + 'la base tiene otro, el cliente y la base no hablan del mismo objeto.');

  const indicePerdido = parsearIndices(
    DEL_FICHERO.replace(/CREATE INDEX IF NOT EXISTS "email_messages_related_type_related_id_idx"[^;]*;/, ''), TABLA);
  assert.equal(indicePerdido.length, 2,
    '🔴 el comparador NO VE que falte un índice: cuenta los mismos con uno menos.');
});

// ── 2 · 🔴 EL TEST QUE DECIDE ──────────────────────────────────────────────────────────────

test('SCRUM-475 · 🔴 `schema.prisma` y el SQL aplicado a las bases dicen LO MISMO', () => {
  const delSchema = parsearTabla(bloqueDeTabla(DEL_SCHEMA.sql, TABLA));
  const delFichero = parsearTabla(bloqueDeTabla(DEL_FICHERO, TABLA));

  // Suelo del propio aserto: 12 columnas es lo que el fundador contó con `\d` en las dos bases.
  assert.equal(delFichero.columnas.length, 12,
    `🔴 ${FICHERO_SQL} tiene ${delFichero.columnas.length} columnas y el \`\\d\` de staging y `
    + 'producción contó DOCE. Si el fichero ya no son 12, no describe lo que hay aplicado.');

  const diferencias = [];
  const porNombre = (lista) => new Map(lista.map((c) => [c.nombre, c]));
  const a = porNombre(delSchema.columnas);
  const b = porNombre(delFichero.columnas);
  for (const nombre of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(nombre);
    const y = b.get(nombre);
    if (!x) { diferencias.push(`${nombre}: está en el SQL aplicado y NO en schema.prisma`); continue; }
    if (!y) { diferencias.push(`${nombre}: está en schema.prisma y NO en el SQL aplicado`); continue; }
    if (x.tipo !== y.tipo) diferencias.push(`${nombre}.tipo — schema: ${x.tipo} · aplicado: ${y.tipo}`);
    if (x.nulo !== y.nulo) diferencias.push(`${nombre}.nulable — schema: ${x.nulo} · aplicado: ${y.nulo}`);
    if (x.defecto !== y.defecto) diferencias.push(`${nombre}.default — schema: ${x.defecto} · aplicado: ${y.defecto}`);
  }
  if (JSON.stringify(delSchema.pk) !== JSON.stringify(delFichero.pk)) {
    diferencias.push(`PRIMARY KEY — schema: ${JSON.stringify(delSchema.pk)} · aplicado: ${JSON.stringify(delFichero.pk)}`);
  }

  assert.deepEqual(diferencias, [],
    '🔴 `schema.prisma` Y LAS BASES NO DICEN LO MISMO:\n    ' + diferencias.join('\n    ') + '\n\n'
    + '  El SQL de este fichero está APLICADO a staging y a producción (12-ago-2026, a mano). Si el\n'
    + '  esquema difiere, el cliente de Prisma promete una forma que la base no tiene y el fallo\n'
    + '  saldrá en producción escribiendo un correo, no aquí.\n\n'
    + '  ⚠️ NO se arregla el esquema por tu cuenta: `prisma/schema.prisma` es de los fundadores y\n'
    + '  la base YA está escrita. Se reporta con las dos versiones delante.\n\n'
    + `  Normalizado antes de comparar (y nada más): ${NORMALIZACIONES.join(' · ')}.`);
});

test('SCRUM-475 · 🔴 los cuatro índices coinciden, nombre a nombre', () => {
  const delSchema = parsearIndices(DEL_SCHEMA.sql, TABLA);
  const delFichero = parsearIndices(DEL_FICHERO, TABLA);

  assert.equal(delFichero.length, 3,
    `🔴 ${FICHERO_SQL} declara ${delFichero.length} índices con \`CREATE INDEX\` y son TRES; el `
    + 'cuarto es la `PRIMARY KEY`, que va dentro del `CREATE TABLE` y se comprueba con las columnas. '
    + 'Los cuatro juntos son los que el fundador contó con `\\d`.');

  assert.deepEqual(delSchema, delFichero,
    '🔴 LOS ÍNDICES NO COINCIDEN.\n'
    + `    schema.prisma: ${JSON.stringify(delSchema)}\n`
    + `    SQL aplicado:  ${JSON.stringify(delFichero)}\n\n`
    + '  El nombre lo DERIVA Prisma, así que un nombre distinto significa que el cliente busca un\n'
    + '  objeto que en la base se llama de otra forma. Reportar, no arreglar.');

  // Y el UNIQUE de `provider_id` no es un índice cualquiera: es el que permitirá al webhook del
  // proveedor encontrar la fila. Se comprueba aparte para que su ausencia no se lea como un detalle.
  const unico = delFichero.find((i) => i.unico);
  assert.deepEqual(unico && { nombre: unico.nombre, columnas: unico.columnas },
    { nombre: 'email_messages_provider_id_key', columnas: ['provider_id'] },
    '🔴 el UNIQUE de `provider_id` no está o no es el esperado. Sin él, el webhook del proveedor no '
    + 'puede encontrar la fila del correo y el rebote se pierde — que es el motivo de la tabla.');
});

// ── 3 · el modelo del esquema es el que el documento aprobó, sin rediseñar ─────────────────

test('SCRUM-475 · el modelo de `schema.prisma` es el de la entrada de máster, línea a línea', () => {
  // Cierra el tercer lado del triángulo: documento → esquema → SQL → bases. Si el modelo pegado a
  // mano se hubiera desviado del aprobado, esto lo dice sin necesidad de leerlos en paralelo.
  const entrada = fs.readFileSync(path.join(RAIZ, 'docs/master/SCRUM-475.md'), 'utf8');
  const mDoc = entrada.match(/```prisma\r?\n([\s\S]*?)```/);
  assert.ok(mDoc, '🔴 NO SUPE MIRAR: no hay bloque ```prisma en docs/master/SCRUM-475.md.');

  const esquema = fs.readFileSync(SCHEMA_POR_DEFECTO, 'utf8');
  const mSchema = esquema.match(/model EmailMessage \{[\s\S]*?\n\}/);
  assert.ok(mSchema, '🔴 NO SUPE MIRAR: `model EmailMessage` no está en prisma/schema.prisma.');

  const norm = (s) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean).join('\n');
  assert.equal(norm(mSchema[0]), norm(mDoc[1]),
    '🔴 el modelo pegado en `schema.prisma` NO es el que aprobó la entrada de máster. Se comparan '
    + 'sin sangría ni líneas vacías, así que la diferencia es de CONTENIDO. Reportar, no arreglar.');
});
