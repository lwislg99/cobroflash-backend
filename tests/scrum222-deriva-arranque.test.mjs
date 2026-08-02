// SCRUM-222 · ARRANCAR CONTRA UN ESQUEMA QUE NO ESTÁ.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA
//
// El despliegue era `install` → `tsc` → `node dist/index.js`: sin `prestart`, sin Procfile, sin
// Dockerfile, y `src/index.ts` no mencionaba el esquema. **Nada comprobaba la base antes de
// escuchar.** Si un PR añade una columna y el `db push` no se ejecuta, el proceso arranca sano,
// contesta al healthcheck, y el fallo aparece más tarde — en producción y con un cliente
// delante— en la primera ruta que nombre esa columna.
//
// Existía `scripts/preflight-schema-drift.mjs` (SCRUM-167), pero no servía para esto: tiene un
// guard anti-prod deliberado, su cabecera dice «NO apuntes esto a prod», y lanza el CLI de
// Prisma, que es **devDependency**. La comprobación de arranque usa el DMMF de `@prisma/client`
// —dependencia de runtime— y UNA consulta al catálogo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ AFIRMAN ESTOS TESTS, Y POR QUÉ CADA UNO
//
//   ① El comparador ve la deriva que importa: una columna que falta, una tabla que falta.
//   ② No la ve donde no la hay: una columna DE MÁS en la base no es deriva (esperado ⊆ real es
//      el orden seguro — la base va por delante del código, que es como se despliega lo aditivo).
//   ③ El suelo anti-falso-positivo: catálogo vacío NUNCA es «faltan las 24 tablas». Sin este
//      test, un cambio de `search_path` tumbaría producción por algo que no es deriva.
//   ④ Los dos desenlaces son DISTINGUIBLES: deriva no arranca; «no pude comprobar» arranca. Si
//      compartieran desenlace, «hay deriva» y «el chequeo está roto» serían indistinguibles POR
//      CONSTRUCCIÓN.
//   ⑤ El aviso de «no pude comprobar» dice esas palabras y NO dice que esté todo bien. Es la
//      línea entre un aviso y el fail-open de SCRUM-206.
//   ⑥ Está CABLEADO en el arranque, por AST y antes de `app.listen`. Sin esto, todo lo anterior
//      podría estar perfecto y no ejecutarse nunca: el defecto seguiría abierto con los tests en
//      verde. Es la parte que de verdad impide que esto se apague sin que nadie se entere.
//
// ⚠️ AST, no `grep`: un guard por texto casa con el propio comentario que lo explica.

import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging con QA_DB_TEST=1 (fail-closed anti-prod)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import {
  tablasEsperadas,
  compararEsquema,
  mensajeDeDeriva,
  desenlaceDeArranque,
  comprobarDerivaDeSchema,
} from '../dist/core/db/schemaDrift.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Catálogo sintético que refleja EXACTAMENTE lo esperado: el control que las demás perturban. */
function catalogoCompleto(esperadas) {
  return esperadas.flatMap((t) => t.columnas.map((c) => ({ tabla: t.tabla, columna: c.columna })));
}

// ── ① El DMMF se lee bien ─────────────────────────────────────────────────────

test('tablasEsperadas resuelve el @map a medias del schema (columna mapeada y sin mapear)', () => {
  const inv = tablasEsperadas().find((t) => t.modelo === 'Invoice');
  assert.ok(inv, 'el modelo Invoice tiene que estar en el DMMF');
  assert.equal(inv.tabla, 'invoices', 'Invoice está mapeado a @@map("invoices")');

  const col = (campo) => inv.columnas.find((c) => c.campo === campo)?.columna;
  // Con @map: la columna NO se llama como el campo.
  assert.equal(col('chargeId'), 'charge_id');
  assert.equal(col('vfHash'), 'vf_hash');
  // Sin @map: se llama igual. Tomar el `name` siempre daría falsos positivos en el primer caso;
  // tomar el `dbName` siempre daría `undefined` en el segundo.
  assert.equal(col('merchantId'), 'merchantId');
});

test('tablasEsperadas descarta las relaciones: no son columnas', () => {
  const inv = tablasEsperadas().find((t) => t.modelo === 'Invoice');
  // `merchant` es un campo de relación (kind: 'object'). Si se colara, se pediría a la base una
  // columna «merchant» que no existe y todo arrancaría en rojo permanente.
  assert.ok(!inv.columnas.some((c) => c.campo === 'merchant'), 'la relación no debe ser columna');
  assert.ok(inv.columnas.some((c) => c.campo === 'merchantId'), 'la clave ajena SÍ es columna');
});

// ── ① y ② El comparador ───────────────────────────────────────────────────────

test('CONTROL · el catálogo que refleja lo esperado da en-sync', () => {
  const esperadas = tablasEsperadas();
  const r = compararEsquema(esperadas, catalogoCompleto(esperadas));
  assert.equal(r.estado, 'en-sync');
  assert.equal(r.tablas, esperadas.length);
  assert.ok(r.columnas > 100, `se comprueban las columnas de verdad (fueron ${r.columnas})`);
});

test('ROJO · falta UNA columna → deriva, y la nombra', () => {
  const esperadas = tablasEsperadas();
  const catalogo = catalogoCompleto(esperadas).filter(
    (c) => !(c.tabla === 'invoices' && c.columna === 'vf_hash'),
  );
  const r = compararEsquema(esperadas, catalogo);
  assert.equal(r.estado, 'deriva', 'quitar una columna real TIENE que dar deriva');
  assert.deepEqual(r.tablasQueFaltan, []);
  assert.equal(r.columnasQueFaltan.length, 1);
  assert.deepEqual(r.columnasQueFaltan[0], {
    modelo: 'Invoice',
    tabla: 'invoices',
    campo: 'vfHash',
    columna: 'vf_hash',
  });
});

test('ROJO · falta una TABLA entera → se reporta una vez, no una línea por columna', () => {
  const esperadas = tablasEsperadas();
  const r = compararEsquema(
    esperadas,
    catalogoCompleto(esperadas).filter((c) => c.tabla !== 'invoices'),
  );
  assert.equal(r.estado, 'deriva');
  assert.deepEqual(r.tablasQueFaltan, ['invoices']);
  // Un informe de arranque con 40 líneas para una sola tabla ausente no se lee.
  assert.deepEqual(
    r.columnasQueFaltan.filter((c) => c.tabla === 'invoices'),
    [],
    'sus columnas NO se repiten una a una',
  );
});

test('una columna DE MÁS en la base no es deriva: la base puede ir por delante del código', () => {
  const esperadas = tablasEsperadas();
  const catalogo = [
    ...catalogoCompleto(esperadas),
    { tabla: 'invoices', columna: 'columna_del_futuro' },
    { tabla: 'tabla_que_el_codigo_no_conoce', columna: 'x' },
  ];
  assert.equal(compararEsquema(esperadas, catalogo).estado, 'en-sync');
});

test('EL INCIDENTE DE SCRUM-220 · quotes.job_id declarada y no aplicada → no se arranca', () => {
  // Este es el caso REAL que abrió el ticket: el código que espera `quotes.job_id` se desplegó a
  // producción sin la columna → P2022 → 500 en la home, y el primero en enterarse fue el usuario
  // mirando la pantalla. Aquí se reproduce esa base y se exige el desenlace contrario.
  const esperadas = tablasEsperadas();
  const r = compararEsquema(
    esperadas,
    catalogoCompleto(esperadas).filter((c) => !(c.tabla === 'quotes' && c.columna === 'job_id')),
  );
  assert.equal(r.estado, 'deriva');
  assert.equal(mensajeDeDeriva(r), 'COLUMNAS que faltan (1): quotes.job_id (Quote.jobId)');
  assert.equal(
    desenlaceDeArranque(r, 'production').arranca,
    false,
    'el fallo pasa de tiempo de PETICIÓN a tiempo de arranque: ese es el ticket entero',
  );
});

// ── ③ El suelo anti-falso-positivo ────────────────────────────────────────────

test('SUELO · catálogo vacío es «no pude comprobar», JAMÁS «faltan todas las tablas»', () => {
  const r = compararEsquema(tablasEsperadas(), []);
  assert.equal(
    r.estado,
    'no-pude-comprobar',
    'sin este suelo, un search_path distinto tumbaría producción por algo que no es deriva',
  );
  assert.notEqual(r.estado, 'deriva');
  assert.match(r.motivo, /esquema|catálogo/i);
});

// ── ④ y ⑤ Los desenlaces ──────────────────────────────────────────────────────

const DERIVA = {
  estado: 'deriva',
  tablasQueFaltan: [],
  columnasQueFaltan: [{ modelo: 'Invoice', tabla: 'invoices', campo: 'vfHash', columna: 'vf_hash' }],
};

test('EN PRODUCCIÓN la deriva NO arranca, y el mensaje dice qué falta', () => {
  const d = desenlaceDeArranque(DERIVA, 'production');
  assert.equal(d.arranca, false, 'fail-closed: mejor no arrancar que arrancar mintiendo');
  assert.match(d.mensaje, /invoices\.vf_hash/, 'el detalle en claro es medio valor del chequeo');
  assert.match(d.mensaje, /Invoice\.vfHash/);
});

test('fuera de producción la deriva solo avisa: en local el esquema baila y eso es trabajar', () => {
  const d = desenlaceDeArranque(DERIVA, 'development');
  assert.equal(d.arranca, true);
  assert.equal(d.nivel, 'warn');
});

test('«no pude comprobar» ARRANCA — un hipo de red no puede ser una caída total', () => {
  const d = desenlaceDeArranque({ estado: 'no-pude-comprobar', motivo: 'timeout.' }, 'production');
  assert.equal(d.arranca, true);
  // Y el punto entero: los dos desenlaces son distinguibles.
  assert.notEqual(d.arranca, desenlaceDeArranque(DERIVA, 'production').arranca);
});

test('«no pude comprobar» lo dice con esas palabras, a gritos, y NO dice que esté todo bien', () => {
  const d = desenlaceDeArranque({ estado: 'no-pude-comprobar', motivo: 'timeout.' }, 'production');
  assert.match(d.mensaje, /no pude comprobar/i, 'las palabras exactas: es la decisión del fundador');
  assert.equal(d.nivel, 'error', 'ruidoso o no vale: pasar en silencio sería el fail-open de 206');
  // Lo prohibido es AFIRMAR que está bien, no la palabra: el mensaje sí dice «todo bien», pero
  // negado. Prohibir la cadena a secas rompería la propia frase que hace falta.
  assert.match(d.mensaje, /NO significa que esté todo bien/);
  assert.doesNotMatch(d.mensaje, /en sync|✅|coincide con el del código\./i);
});

test('en-sync habla por log normal y no grita', () => {
  const d = desenlaceDeArranque({ estado: 'en-sync', tablas: 24, columnas: 400 }, 'production');
  assert.equal(d.arranca, true);
  assert.equal(d.nivel, 'log');
});

test('mensajeDeDeriva nombra tablas y columnas por separado', () => {
  const m = mensajeDeDeriva({
    estado: 'deriva',
    tablasQueFaltan: ['audit_log'],
    columnasQueFaltan: [{ modelo: 'Invoice', tabla: 'invoices', campo: 'vfHash', columna: 'vf_hash' }],
  });
  assert.match(m, /TABLAS que faltan \(1\): audit_log/);
  assert.match(m, /COLUMNAS que faltan \(1\): invoices\.vf_hash/);
});

// ── La lectura nunca lanza ────────────────────────────────────────────────────

test('si la consulta revienta → «no pude comprobar» con el motivo, no una excepción', async () => {
  const r = await comprobarDerivaDeSchema({
    client: { $queryRawUnsafe: async () => { throw new Error('connection refused'); } },
  });
  assert.equal(r.estado, 'no-pude-comprobar');
  assert.match(r.motivo, /connection refused/);
});

test('si la base no contesta, el timeout corta: un arranque colgado también es una caída', async () => {
  const r = await comprobarDerivaDeSchema({
    client: { $queryRawUnsafe: () => new Promise(() => {}) }, // no resuelve jamás
    timeoutMs: 50,
  });
  assert.equal(r.estado, 'no-pude-comprobar');
  assert.match(r.motivo, /no respondió en 50 ms/);
});

test('la consulta llega hasta el comparador: un catálogo bueno de mentira da en-sync', async () => {
  const esperadas = tablasEsperadas();
  const r = await comprobarDerivaDeSchema({
    client: { $queryRawUnsafe: async () => catalogoCompleto(esperadas) },
  });
  assert.equal(r.estado, 'en-sync');
});

// ── CONTRA UNA BASE DE VERDAD (gateado) ───────────────────────────────────────
//
// Todo lo de arriba compara contra un catálogo que construyo yo a partir de `tablasEsperadas()`:
// es circular por diseño —sirve de control para las perturbaciones— pero NO prueba que la
// consulta funcione. Los alias (`tabla`, `columna`), `current_schema()` y el hecho de que el
// esquema real encaje solo los puede afirmar una base de verdad. Este es el único test aquí que
// abre una conexión, y solo LEE `information_schema`: no crea ni borra nada.

const ENABLED = process.env.QA_DB_TEST === '1';

test('GATEADO · contra la BD de staging el arranque da en-sync de verdad', { skip: !ENABLED }, async () => {
  const r = await comprobarDerivaDeSchema();
  assert.equal(
    r.estado,
    'en-sync',
    `staging debería estar en sync; salió ${r.estado}` +
      (r.estado === 'deriva' ? `: ${mensajeDeDeriva(r)}` : ` (${r.motivo ?? ''})`),
  );
  // Suelo anti-verde-hueco: un en-sync sobre cuatro columnas no probaría nada.
  assert.ok(r.tablas >= 20, `pocas tablas comprobadas: ${r.tablas}`);
  assert.ok(r.columnas >= 100, `pocas columnas comprobadas: ${r.columnas}`);
});

test('GATEADO · contra la BD de staging, una deriva de verdad se ve y NO arrancaría', { skip: !ENABLED }, async () => {
  // La otra mitad: que el en-sync de arriba no sea un «siempre digo que sí». Se le enseña a la
  // base real un datamodel que dice tener una columna que la base NO tiene — que es exactamente
  // la forma del defecto: un PR añade la columna y el `db push` no se ejecuta.
  const { Prisma } = await import('@prisma/client');
  const models = Prisma.dmmf.datamodel.models.map((m) =>
    m.name === 'Invoice'
      ? { ...m, fields: [...m.fields, { name: 'columnaQueNoExiste', kind: 'scalar', dbName: 'columna_que_no_existe' }] }
      : m,
  );

  const r = await comprobarDerivaDeSchema({ datamodel: { models } });
  assert.equal(r.estado, 'deriva', 'la deriva inyectada TIENE que verse contra la base real');
  assert.deepEqual(r.tablasQueFaltan, []);
  assert.deepEqual(r.columnasQueFaltan, [
    { modelo: 'Invoice', tabla: 'invoices', campo: 'columnaQueNoExiste', columna: 'columna_que_no_existe' },
  ]);
  assert.equal(desenlaceDeArranque(r, 'production').arranca, false);
});

// ── ⑥ Que esté CABLEADO en el arranque (AST) ──────────────────────────────────

test('GUARD · src/index.ts llama a assertSchemaSinDeriva ANTES de app.listen', () => {
  const ruta = path.join(RAIZ, 'src', 'index.ts');
  const sf = ts.createSourceFile(
    ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS,
  );

  // 1) Localizar la llamada `app.listen(...)`.
  let listen = null;
  const recorrer = (n, visita) => { visita(n); n.forEachChild((h) => recorrer(h, visita)); };
  recorrer(sf, (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'listen'
    ) listen = n;
  });
  assert.ok(listen, 'no se encontró app.listen() en src/index.ts');

  // 2) Tiene que estar DENTRO de una función: si volviera al nivel de módulo, escucharía sin
  //    esperar a nada y la comprobación sería decorativa.
  let fn = listen.parent;
  while (fn && !ts.isFunctionDeclaration(fn)) fn = fn.parent;
  assert.ok(fn, 'app.listen ya no está dentro de una función: el arranque no espera a nada');

  // 3) En esa misma función, un `await assertSchemaSinDeriva(...)` — y ANTES del listen.
  let esperaLaComprobacion = null;
  recorrer(fn.body, (n) => {
    if (
      ts.isAwaitExpression(n) &&
      ts.isCallExpression(n.expression) &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === 'assertSchemaSinDeriva'
    ) esperaLaComprobacion = n;
  });
  assert.ok(esperaLaComprobacion, 'el arranque no ESPERA a assertSchemaSinDeriva');
  assert.ok(
    esperaLaComprobacion.end < listen.getStart(sf),
    'la comprobación tiene que ir ANTES de escuchar, no después',
  );

  // 4) Y esa función tiene que llamarse desde fuera de sí misma: declararla y no invocarla
  //    dejaría el defecto abierto con todo en verde.
  const nombre = fn.name.text;
  let invocada = false;
  recorrer(sf, (n) => {
    if (
      ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre &&
      n.getStart(sf) >= fn.end // fuera del cuerpo de la propia función
    ) invocada = true;
  });
  assert.ok(invocada, `${nombre}() se declara pero nunca se invoca`);
});

// ── AUTOPRUEBA del guard ⑥ ────────────────────────────────────────────────────
//
// Un guard estructural que nadie ha visto fallar no es un guard. Aquí se le da el arranque
// SIN la comprobación y se exige que lo cace: si esto pasara, el test de arriba estaría
// afirmando sobre nada.

test('AUTOPRUEBA · el guard caza un arranque al que le quitaron la comprobación', () => {
  const roto = `
    async function arrancar() {
      app.listen(config.PORT, () => {});
    }
    arrancar();
  `;
  const sf = ts.createSourceFile('roto.ts', roto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const recorrer = (n, visita) => { visita(n); n.forEachChild((h) => recorrer(h, visita)); };
  let encontrada = false;
  recorrer(sf, (n) => {
    if (
      ts.isAwaitExpression(n) &&
      ts.isCallExpression(n.expression) &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === 'assertSchemaSinDeriva'
    ) encontrada = true;
  });
  assert.equal(encontrada, false, 'el guard tiene que ver la ausencia, no darla por buena');
});
