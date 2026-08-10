// tests/scrum461-censo-no-encoge.test.mjs — SCRUM-461
//
// EL CENSO DE DERIVA NO PUEDE ENCOGERSE EN SILENCIO.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO, MEDIDO EL 10-ago
//
// `scripts/generar-sql-deriva.mjs:28` escribe el censo leyendo
// `require('@prisma/client').Prisma.dmmf.datamodel` — el CLIENTE GENERADO, que vive en
// `node_modules`. El número que escribe es una propiedad **del entorno**, no del árbol. El mismo
// código dio tres números el mismo día: **331** (cliente atrasado, le faltaban cinco campos),
// **345** (el fichero commiteado) y **346** (el bueno).
//
// 🔴 Y LO QUE LO CONVIERTE EN DEFECTO: `tests/scrum222-deriva-arranque.test.mjs` comprueba ese
// fichero contra **el mismo cliente**. Generador y vigilante beben de la misma fuente, así que se
// dan la razón el uno al otro estando los dos mal.
//
//   «Dos testigos que comparten código son un testigo.» Aquí ni compartían: eran el mismo.
//
// El censo existe para detectar columnas que el código nombra y no están en una base. Uno encogido
// **deja de mirarlas** y pasa en verde. Aquel día se evitó porque el fundador vio un número raro;
// con una columna en vez de quince, nadie lo habría notado. El mecanismo no ayudó.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// LO QUE VIGILA ESTE FICHERO
//
//   ① las columnas que declara `prisma/schema.prisma`  ← parser propio, NO usa el cliente
//   ② las que ve el generador                          ← DMMF del cliente
//   ③ las que hay en `docs/sql/deriva-prod.sql`        ← el fichero commiteado
//
// Los tres se cuentan POR SEPARADO y tienen que coincidir. ① es el testigo que no comparte fuente
// con ② ni con ③, que es justo lo que faltaba.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { paresDelSchema, paresDelFichero } from '../scripts/_pares-del-schema.mjs';
import { paresEsperados, motivoParaNoEscribir, RUTA_SQL } from '../scripts/generar-sql-deriva.mjs';
import { comprobarProcedencia, mensaje } from '../scripts/_prisma-procedencia-guard.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = path.join(RAIZ, 'prisma', 'schema.prisma');

// Suelos: hoy hay 24 modelos y 346 columnas. Se exige el MÍNIMO y con holgura, para que añadir o
// quitar una tabla no obligue a tocar el guard — uno que estorba en cada PR acaba desactivado.
const MINIMO_MODELOS = 20;
const MINIMO_PARES = 300;

const clave = (p) => `${p[0]}.${p[1]}`;

/** Las entradas `('tabla','columna')` del fichero commiteado. */
function paresDelSql() {
  const txt = fs.readFileSync(RUTA_SQL, 'utf8');
  return [...txt.matchAll(/^ {4}\('([^']+)','([^']+)'\),?$/gm)].map((m) => [m[1], m[2]]);
}

// ── 🔴 SUELO · CADA RECUENTO POR SEPARADO ─────────────────────────────────────────────────

test('SCRUM-461 · 🔴 SUELO: ① el parser del `.prisma` ve modelos y campos de verdad', () => {
  const r = paresDelFichero(SCHEMA);
  assert.ok(r.modelos.length >= MINIMO_MODELOS,
    `🔴 ESCÁNER CIEGO: el parser ve ${r.modelos.length} modelos y hay al menos ${MINIMO_MODELOS}. ` +
    'Si dejó de entender el fichero, «coinciden» sería cierto sobre dos conjuntos vacíos.');
  assert.ok(r.pares.length >= MINIMO_PARES,
    `🔴 ESCÁNER CIEGO: ${r.pares.length} columnas y hay al menos ${MINIMO_PARES}.`);
  assert.ok(r.campos > r.pares.length,
    '🔴 el parser no está descartando NINGUNA relación: o el schema no tiene relaciones —falso— o ' +
    'las está contando como columnas.');
});

test('SCRUM-461 · 🔴 SUELO: ② el generador ve columnas, y ③ el fichero las tiene', () => {
  assert.ok(paresEsperados().length >= MINIMO_PARES,
    '🔴 ESCÁNER CIEGO: el DMMF del cliente no trae columnas suficientes.');
  assert.ok(paresDelSql().length >= MINIMO_PARES,
    '🔴 ESCÁNER CIEGO: no se leen entradas del fichero commiteado. Si el formato del SQL cambió, ' +
    'la comparación de abajo sería cierta sobre un conjunto vacío.');
});

// ── 🔴 LOS DOS TESTIGOS QUE NO COMPARTEN FUENTE ───────────────────────────────────────────

test('SCRUM-461 · 🔴 ① el `.prisma` y ② el cliente declaran LAS MISMAS columnas', () => {
  const a = new Set(paresDelFichero(SCHEMA).pares.map(clave));
  const b = new Set(paresEsperados().map(clave));

  const soloSchema = [...a].filter((x) => !b.has(x)).sort();
  const soloCliente = [...b].filter((x) => !a.has(x)).sort();

  assert.deepEqual(soloSchema, [],
    '🔴 EL CLIENTE VA POR DETRÁS DEL SCHEMA. Estas columnas están en `prisma/schema.prisma` y el ' +
    `generador NO las ve:\n    ${soloSchema.join('\n    ')}\n\n` +
    '  Es exactamente el incidente del 10-ago: el censo se escribiría CORTO y dejaría de vigilar\n' +
    '  justo estas columnas, en verde. Remedio: `npx prisma generate`.');
  assert.deepEqual(soloCliente, [],
    '🔴 EL CLIENTE TIENE COLUMNAS QUE EL SCHEMA YA NO DECLARA:\n    ' + soloCliente.join('\n    ') +
    '\n\n  El censo preguntaría por columnas que nadie usa. Remedio: `npx prisma generate`.');
});

test('SCRUM-461 · 🔴 ③ el fichero commiteado coincide con el `.prisma`, no sólo con el cliente', () => {
  // Ésta es la comparación que faltaba: hasta hoy el fichero se contrastaba SÓLO contra el cliente
  // —la misma fuente de la que salió—, así que un cliente atrasado los ponía de acuerdo a los dos.
  const delSchema = new Set(paresDelFichero(SCHEMA).pares.map(clave));
  const delSql = new Set(paresDelSql().map(clave));

  const faltanEnElSql = [...delSchema].filter((x) => !delSql.has(x)).sort();
  const sobranEnElSql = [...delSql].filter((x) => !delSchema.has(x)).sort();

  assert.deepEqual(faltanEnElSql, [],
    '🔴 EL CENSO SE HA ENCOGIDO: estas columnas están en `prisma/schema.prisma` y NO en\n' +
    `  docs/sql/deriva-prod.sql:\n    ${faltanEnElSql.join('\n    ')}\n\n` +
    '  El censo DEJA DE MIRARLAS. No es que avise mal: es que no pregunta, y responde «0 filas»\n' +
    '  —«en sync»— justo sobre la columna que le falta. Regenéralo con el cliente al día:\n' +
    '  `npx prisma generate && node scripts/generar-sql-deriva.mjs`.');
  assert.deepEqual(sobranEnElSql, [],
    '🔴 el censo pregunta por columnas que el schema ya no declara:\n    ' + sobranEnElSql.join('\n    '));
});

// ── 🔴 SUELO DEL CONTRASTE: NO PODER COMPARAR NO ES «COINCIDEN» ───────────────────────────

test('SCRUM-461 · 🔴 SUELO: con una de las dos fuentes ilegible, el contraste NO da verde', () => {
  // «Coinciden» y «no pude comparar» son el mismo verde con significados opuestos. Se ejercita con
  // corpus sintético porque las fuentes reales sí se leen: una lista vacía hace verdad cualquier
  // afirmación sobre sus elementos.
  assert.deepEqual(paresDelSchema('').pares, [],
    '🔴 un schema vacío produce columnas: el parser se las está inventando.');
  assert.equal(paresDelSchema('').modelos.length, 0);

  // Y el suelo del primer test es el que lo caza: con 0 modelos, exige el mínimo y cae.
  const vacio = paresDelSchema('');
  assert.ok(!(vacio.modelos.length >= MINIMO_MODELOS),
    '🔴 el suelo daría por bueno un schema del que no se ha entendido nada.');

  // CONTROL POSITIVO DENTRO DEL MISMO TEST: sobre un schema mínimo pero REAL, el parser sí ve.
  //
  // `Persona` lleva el campo PEGADO a la llave de apertura a propósito: es válido en Prisma, y un
  // parser que descarte el resto de esa línea perdería la columna en silencio — que es justo el
  // modo de fallo que este fichero persigue. Lo cazó al escribirlo.
  const r = paresDelSchema(`
    model Cosa {
      id        Int      @id @default(autoincrement())
      nombreRaro String  @map("nombre_raro")
      duenoId   Int      @map("dueno_id")
      dueno     Persona  @relation(fields: [duenoId], references: [id])
      @@map("cosas")
    }
    model Persona { id Int @id
      cosas Cosa[]
    }
  `);
  assert.deepEqual(r.pares.map(clave).sort(),
    ['Persona.id', 'cosas.dueno_id', 'cosas.id', 'cosas.nombre_raro'],
    '🔴 el parser no resuelve `@map`, `@@map`, no descarta la relación, o pierde el campo que va ' +
    'pegado a la llave de apertura.');
});

test('SCRUM-461 · 🔴 el parser descarta RELACIONES y conserva los enum', () => {
  // Una relación no es una columna (en el DMMF, `kind: 'object'`). Un enum SÍ lo es, y confundirlos
  // encogería el censo por el otro lado.
  const r = paresDelSchema(`
    enum Estado { activo inactivo }
    model Pedido {
      id      Int    @id
      estado  Estado
      lineas  Linea[]
    }
    model Linea {
      id       Int    @id
      pedidoId Int    @map("pedido_id")
      pedido   Pedido @relation(fields: [pedidoId], references: [id])
    }
  `);
  const c = r.pares.map(clave).sort();
  assert.deepEqual(c, ['Linea.id', 'Linea.pedido_id', 'Pedido.estado', 'Pedido.id'],
    `🔴 el parser no separa relaciones de columnas: ${JSON.stringify(c)}`);
  assert.ok(!c.includes('Pedido.lineas'), '🔴 una relación de lista se está contando como columna.');
  assert.ok(c.includes('Pedido.estado'), '🔴 un enum se está descartando: es una columna de verdad.');
});

// ── 🔴 LA PUERTA QUE HAY QUE CERRAR: EL GENERADOR A MANO ──────────────────────────────────

test('SCRUM-461 · ✅ CONTROL NEGATIVO: con el cliente al día el generador NO molesta', () => {
  // Un guard que estorba en el caso normal se desactiva al primer roce. Con el cliente al día,
  // `motivoParaNoEscribir` no tiene nada que decir y el script escribe como siempre.
  assert.equal(motivoParaNoEscribir(), null,
    '🔴 el generador se niega a escribir CON EL CLIENTE AL DÍA. Eso es un falso positivo, y un ' +
    'guard que acusa en falso no se corrige: se desactiva.');
});

test('SCRUM-461 · 🔴 con el cliente ATRASADO se niega, y NOMBRA los campos que faltan', () => {
  // Se ejercita el mecanismo REAL —`comprobarProcedencia`— contra dos ficheros sintéticos, sin
  // tocar `prisma/schema.prisma`, que es del fundador.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum461-'));
  const delRepo = path.join(dir, 'schema.prisma');
  const delCliente = path.join(dir, 'cliente.prisma');

  // ⚠️ EL CORPUS TIENE QUE SER GRANDE, y lo aprendí en rojo: `comprobarProcedencia` lleva SU PROPIO
  // suelo —si la normalización deja menos de 100 líneas se declara CIEGO— porque con el texto
  // vaciado dos schemas cualesquiera saldrían iguales. Un corpus de cinco líneas no ejercita el
  // mecanismo: dispara el suelo. Se rellena por encima del umbral con campos de verdad.
  const relleno = Array.from({ length: 120 }, (_, i) => `  campo${i} String @map("campo_${i}")`).join('\n');
  const base = `model AuthSession {\n  id Int @id\n${relleno}\n}\n`;
  fs.writeFileSync(delRepo, base.replace('\n}\n', '\n  instaladaPwa Boolean? @map("instalada_pwa")\n}\n'));
  fs.writeFileSync(delCliente, base);

  const r = comprobarProcedencia({ schemaPath: delRepo, clienteSchemaPath: delCliente });
  assert.equal(r.ok, false, '🔴 no detecta que el cliente salió de otro schema.');

  const texto = mensaje(r);
  assert.match(texto, /instaladaPwa/,
    `🔴 el rechazo no NOMBRA el campo que falta. «El cliente está viejo» no basta: hay que decir ` +
    `CUÁL, que es lo que convierte el rojo en una acción. Dijo: ${texto}`);

  // CONTROL POSITIVO EN EL MISMO TEST: con los dos iguales, no se queja. Sin esto, un detector que
  // dijera «distintos» siempre pasaría este test y sería inútil.
  fs.writeFileSync(delRepo, base);
  assert.equal(comprobarProcedencia({ schemaPath: delRepo, clienteSchemaPath: delCliente }).ok, true,
    '🔴 dice que difieren con dos schemas idénticos: acusaría en falso siempre.');

  fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * Dónde se LLAMA a una función en un fichero, por AST. `-1` si no se llama.
 *
 * ⚠️ AST y no `indexOf`, y lo aprendí en rojo aquí mismo: la primera versión buscaba el texto
 * `motivoParaNoEscribir()` y **encontraba su propia declaración**, así que quitar la llamada no
 * ponía nada en rojo. Es exactamente el «mencionar no es hacer» que este test dice combatir,
 * cometido por el test.
 */
function posicionDeLlamada(codigo, nombre) {
  const sf = ts.createSourceFile('x.mjs', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let pos = -1;
  (function walk(n) {
    if (pos === -1 && ts.isCallExpression(n)) {
      const e = n.expression;
      const texto = ts.isPropertyAccessExpression(e) ? e.name.text
        : (ts.isIdentifier(e) ? e.text : '');
      if (texto === nombre) pos = n.getStart(sf);
    }
    ts.forEachChild(n, walk);
  })(sf);
  return pos;
}

test('SCRUM-461 · 🔴 el generador COMPRUEBA antes de escribir — no basta con que exista', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'scripts', 'generar-sql-deriva.mjs'), 'utf8');
  const comprueba = posicionDeLlamada(src, 'motivoParaNoEscribir');
  const escribe = posicionDeLlamada(src, 'writeFileSync');

  assert.ok(comprueba !== -1,
    '🔴 EL GENERADOR ESCRIBE SIN COMPROBAR LA PROCEDENCIA DEL CLIENTE. Es la puerta por la que ' +
    'entró el incidente del 10-ago: `_prisma-sync.mjs` corre en `pretest` y protege la TANDA, pero ' +
    'este script lanzado a mano no pasa por ahí — y a mano es exactamente como se lanzó.');
  assert.ok(escribe !== -1, '🔴 ESCÁNER CIEGO: no encuentro dónde escribe el fichero.');
  assert.ok(comprueba < escribe,
    '🔴 el generador comprueba DESPUÉS de escribir: el censo corto ya está en el disco.');
  assert.match(src, /process\.exit\(1\)/,
    '🔴 detecta el cliente atrasado y escribe igual: avisar no es negarse.');

  // CONTROL POSITIVO Y NEGATIVO DEL DETECTOR, dentro del mismo test: distingue LLAMAR de DECLARAR.
  // Sin esto, un detector que encontrara la declaración daría este mismo verde — y lo dio.
  assert.equal(posicionDeLlamada('export function f() { return 1; }', 'f'), -1,
    '🔴 el detector toma una DECLARACIÓN por una llamada: es el agujero exacto que tuvo la primera ' +
    'versión de este test, y con él quitar la comprobación no ponía nada en rojo.');
  assert.ok(posicionDeLlamada('function f(){} const x = f();', 'f') > -1,
    '🔴 el detector no ve una llamada que tiene delante.');
});

test('SCRUM-461 · el guard de SCRUM-222 sigue en pie y no se ha relajado', () => {
  // Este ticket ACOMPAÑA a `scrum222`, no lo afloja: si el guard tuviera un defecto se arregla o se
  // acompaña, nunca se relaja.
  const src = fs.readFileSync(path.join(RAIZ, 'tests', 'scrum222-deriva-arranque.test.mjs'), 'utf8');
  assert.match(src, /generarSql|paresEsperados/,
    '🔴 el guard de SCRUM-222 ya no compara el fichero con lo que produce el generador.');
});
