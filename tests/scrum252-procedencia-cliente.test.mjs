// SCRUM-252 · GUARD-PRISMA-2: ¿este cliente salió de ESTE schema.prisma?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL HUECO, MEDIDO ANTES DE CONSTRUIR NADA
//
// El guard de SCRUM-235 compara el conjunto de nombres de COLUMNA en los dos sentidos — y lo
// DECLARA en su cabecera: no mira tipo, opcionalidad, `@default` ni `@db.<nativo>`. Con un
// `id Int` → `String` inyectado (ningún nombre cambia) aquel guard sale **VERDE**, comprobado
// ejecutándolo contra el cliente real.
//
// No es un caso de laboratorio: es `55fd152` (23-sep-2025, migración
// `20250921193122_ids_autoincrement`), donde **nueve campos** pasaron de `String` a `Int` sin
// que cambiara un solo nombre — `Charge.id/customerId/merchantId`, `Customer.id`,
// `Event.id/chargeId`, `Merchant.id`, `Reconciliation.id/chargeId`.
//
// EL ARREGLO NO ES AMPLIAR AQUEL PARSER. Comparar tipo y opcionalidad con más regex cubre menos
// y cuesta más. El cliente generado guarda **una copia del schema del que salió**, así que
// comparar los dos textos responde la pregunta de raíz y trae gratis tipo, opcionalidad,
// `@default`, `@db.<nativo>`, relaciones, índices y `@@map`.
//
// SON DOS PROPIEDADES DISTINTAS Y NO SE CANIBALIZAN: 235 verifica lo que el cliente VA A EMITIR
// (verdad de ejecución); esto verifica la PROCEDENCIA. Por eso se añade y aquel queda intacto.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE AFIRMAN ESTOS TESTS
//
//   ① El control del árbol SANO → verde, contra el cliente REAL. Es la condición que hace que
//      una deriva del formateador de Prisma se cace aquí, en `npm test`, y no en la noche de
//      alguien. Sin este test, las cuatro normalizaciones serían una apuesta.
//   ② El rojo de `55fd152`: cambia el TIPO, ningún nombre cambia → cae.
//   ③ 🚨 EL SUELO INNEGOCIABLE: si la copia del cliente no está donde Prisma la deja hoy —es
//      detalle interno, no API documentada— el guard se pone ROJO, JAMÁS verde. Un guard que se
//      queda ciego en silencio es peor que no tenerlo: sigue firmando un verde vacío.
//   ④ El segundo suelo: si la normalización se comiera el texto, dos schemas cualesquiera
//      saldrían iguales. Eso es un fallo del guard, no un verde.
//   ⑤ Cada normalización, por separado: que absorbe lo que debe absorber y —lo que importa— que
//      NO tapa un cambio de tipo, de opcionalidad ni de atributo.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizarSchema,
  rutaSchemaDelCliente,
  comprobarProcedencia,
  mensaje,
  esInvocacionDirecta,
} from '../scripts/_prisma-procedencia-guard.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = path.join(RAIZ, 'prisma', 'schema.prisma');
const textoSchema = fs.readFileSync(SCHEMA, 'utf8');

/** Escribe un schema temporal y devuelve su ruta. */
function conSchema(texto, nombre = 'schema.prisma') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum252-'));
  const p = path.join(dir, nombre);
  fs.writeFileSync(p, texto, 'utf8');
  return { ruta: p, limpiar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

// ── ① El control del árbol sano, contra el cliente REAL ───────────────────────

test('CONTROL · el árbol sano da VERDE contra el cliente real', () => {
  const r = comprobarProcedencia();
  assert.equal(
    r.ok,
    true,
    'o el cliente está desfasado (`npx prisma generate`), o el formateador de Prisma canonicaliza ' +
    `algo que las cuatro normalizaciones no absorben:\n${mensaje(r)}`,
  );
  // Suelo del propio control: un verde sobre cuatro líneas no probaría nada.
  assert.ok(r.lineas > 400, `se compararon muy pocas líneas: ${r.lineas}`);
});

// ── ② EL ROJO: el caso real de 55fd152 ───────────────────────────────────────

test('ROJO 55fd152 · un campo cambia de TIPO y ningún nombre cambia → cae', () => {
  const roto = textoSchema.replace(
    /^(\s*)id(\s+)Int(\s+@id @default\(autoincrement\(\)\))/m,
    '$1id$2String$3',
  );
  assert.notEqual(roto, textoSchema, 'la inyección no se aplicó: el test no estaría midiendo nada');

  const { ruta, limpiar } = conSchema(roto);
  try {
    const r = comprobarProcedencia({ schemaPath: ruta });
    assert.equal(r.ok, false, 'un cambio de tipo TIENE que verse: es el defecto entero del ticket');
    assert.match(mensaje(r), /NO salió de este schema/);
    // Y el mensaje enseña la línea, que es la diferencia entre parar y saber por qué.
    assert.ok(r.soloRepo.some((l) => /id String @default\(autoincrement\(\)\) @id/.test(l)),
      `el rojo no nombra la línea cambiada: ${JSON.stringify(r.soloRepo)}`);
  } finally { limpiar(); }
});

test('ROJO · cambiar solo la OPCIONALIDAD también cae (String → String?)', () => {
  const roto = textoSchema.replace(/^(\s*name\s+)String(\s*$)/m, '$1String?$2');
  assert.notEqual(roto, textoSchema, 'la inyección no se aplicó');
  const { ruta, limpiar } = conSchema(roto);
  try {
    assert.equal(comprobarProcedencia({ schemaPath: ruta }).ok, false);
  } finally { limpiar(); }
});

test('ROJO · cambiar solo un @db.<nativo> también cae (Decimal(12,2) → Decimal(14,2))', () => {
  const roto = textoSchema.replace('@db.Decimal(12, 2)', '@db.Decimal(14, 2)');
  assert.notEqual(roto, textoSchema, 'la inyección no se aplicó');
  const { ruta, limpiar } = conSchema(roto);
  try {
    assert.equal(comprobarProcedencia({ schemaPath: ruta }).ok, false,
      'el tipo nativo es de lo que el guard de 235 declara NO mirar: aquí sí se ve');
  } finally { limpiar(); }
});

// ── ③ 🚨 EL SUELO INNEGOCIABLE ────────────────────────────────────────────────

test('SUELO · si la copia del cliente NO está donde Prisma la deja, el guard es ROJO, no verde', () => {
  // Se apunta a una ruta que no existe: es lo que pasará el día que Prisma la mueva o la quite.
  const r = comprobarProcedencia({ clienteSchemaPath: path.join(RAIZ, 'no', 'existe', 'schema.prisma') });
  assert.equal(r.ok, false, 'quedarse ciego NUNCA puede ser verde: seguiría firmando un verde vacío');
  assert.match(mensaje(r), /no se pudo leer la copia del cliente/);
});

test('SUELO · si no se puede resolver .prisma/client, también es ROJO', () => {
  // `desde` apunta a un directorio sin node_modules: la resolución falla como el día que el
  // paquete cambie de nombre o de sitio.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum252-sin-'));
  try {
    const r = rutaSchemaDelCliente(dir);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /no se pudo resolver el cliente generado/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SUELO · la ruta se resuelve por el MISMO camino que carga la app, no a mano', () => {
  const r = rutaSchemaDelCliente();
  assert.equal(r.ok, true, r.motivo);
  assert.ok(fs.existsSync(r.ruta), `resuelta pero inexistente: ${r.ruta}`);
  assert.match(r.ruta.replace(/\\/g, '/'), /\.prisma\/client\/schema\.prisma$/);
});

// ── ④ El segundo suelo: la normalización no puede comerse el texto ───────────

test('SUELO · si la normalización deja el texto vacío, es ROJO — no «dos vacíos son iguales»', () => {
  const { ruta, limpiar } = conSchema('// solo comentarios\n\n// nada más\n');
  try {
    const r = comprobarProcedencia({ schemaPath: ruta });
    assert.equal(r.ok, false, 'dos textos vaciados por la normalización NO son un schema que cuadra');
    assert.match(r.motivo, /por debajo del suelo/);
  } finally { limpiar(); }
});

// ── ⑤ Las cuatro normalizaciones, una a una ──────────────────────────────────

test('normalización ① · el fin de línea CRLF no es una diferencia de schema', () => {
  const t = 'model A {\n  id Int @id\n}\n';
  assert.equal(normalizarSchema(t.replace(/\n/g, '\r\n')), normalizarSchema(t));
});

test('normalización ② · la alineación en columnas del formateador no es una diferencia', () => {
  assert.equal(
    normalizarSchema('model A {\n  id      Int    @id\n}'),
    normalizarSchema('model A {\n  id Int @id\n}'),
  );
});

test('normalización ③ · un comentario no pone en rojo la suite de todos los worktrees', () => {
  assert.equal(
    normalizarSchema('model A {\n  id Int @id // esto lo explica\n}'),
    normalizarSchema('model A {\n  id Int @id\n}'),
  );
});

test('normalización ④ · el orden de atributos lo canonicaliza Prisma, no el autor', () => {
  assert.equal(
    normalizarSchema('model A {\n  x String? @db.Text @map("x_col")\n}'),
    normalizarSchema('model A {\n  x String? @map("x_col") @db.Text\n}'),
  );
});

test('CONTRACONTROL · ninguna normalización tapa un cambio real', () => {
  const base = 'model A {\n  id Int @id @default(autoincrement())\n  x String? @db.Text @map("x_col")\n}';
  const cambios = {
    'el TIPO':          base.replace('id Int', 'id String'),
    'la OPCIONALIDAD':  base.replace('x String?', 'x String'),
    'el @default':      base.replace('@default(autoincrement())', '@default(1)'),
    'el @db nativo':    base.replace('@db.Text', '@db.VarChar(30)'),
    'el @map':          base.replace('@map("x_col")', '@map("otra")'),
    'un campo NUEVO':   base.replace('}', '  y Int\n}'),
  };
  for (const [qué, texto] of Object.entries(cambios)) {
    assert.notEqual(normalizarSchema(texto), normalizarSchema(base),
      `la normalización se está comiendo ${qué}: el guard no vería ese cambio`);
  }
});

test('REGRESIÓN · el escáner no trunca en paréntesis ANIDADOS', () => {
  // La primera versión de esto era `/@[\w.]+(\([^)]*\))?/g`, que corta en el PRIMER `)`:
  // `@default(autoincrement())` salía como `@default(autoincrement()` y, al reconstruir la línea
  // con los trozos reconocidos, lo que quedaba fuera **se perdía en silencio**. Texto descartado
  // sin avisar es donde se esconde una diferencia.
  assert.equal(
    normalizarSchema('id Int @id @default(autoincrement())'),
    'id Int @default(autoincrement()) @id',
  );
  // Y lo que de verdad importa: una diferencia que vive DESPUÉS del primer `)` se tiene que ver.
  assert.notEqual(
    normalizarSchema('y String @default(dbgenerated("a()"))'),
    normalizarSchema('y String @default(dbgenerated("b()"))'),
  );
  // Un atributo de bloque no deja espacio delante: el mensaje del rojo es la mitad del guard.
  assert.equal(normalizarSchema('@@map("merchants")'), '@@map("merchants")');
});

// ── El enganche ──────────────────────────────────────────────────────────────

test('esInvocacionDirecta aguanta una ruta con espacios', () => {
  const conEspacio = path.join(os.tmpdir(), 'con espacio', 'g.mjs');
  assert.equal(esInvocacionDirecta(`file:///${conEspacio.replace(/\\/g, '/')}`, conEspacio), true);
  assert.equal(esInvocacionDirecta(import.meta.url, undefined), false);
});

test('el guard está enganchado en pretest, o no protege nada', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  for (const hook of ['pretest', 'pretest:staging', 'pretest:staging:gated']) {
    assert.match(
      pkg.scripts[hook] ?? '',
      /_prisma-procedencia-guard\.mjs/,
      `${hook} no ejecuta el guard de procedencia: estaría escrito y nunca correría`,
    );
  }
});
