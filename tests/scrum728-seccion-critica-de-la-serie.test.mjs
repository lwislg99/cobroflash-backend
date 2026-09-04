// tests/scrum728-seccion-critica-de-la-serie.test.mjs — SCRUM-728 (fase de medición)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE PASA DENTRO DEL CERROJO DE SERIE, CONGELADO
//
// `pg_advisory_xact_lock(SERIE_LOCK_NS, merchantId)` SERIALIZA por merchant, y eso es lo que
// tiene que hacer: es lo único que impide que dos documentos cojan el mismo número. El problema
// medido en SCRUM-728 no es el cerrojo — es **cuánto se tarda dentro de él**: diez creaciones
// simultáneas del mismo merchant suman ~5.200 ms y el timeout de transacción de Prisma son 5 s.
//
// ⛔ ESTE FICHERO NO ARREGLA NADA Y NO QUITA EL CERROJO. Congela las tres propiedades que
// deciden el arreglo, para que ninguna se mueva sin que alguien lo vea:
//   ① el cerrojo es la PRIMERA sentencia de cada reserva (si baja, deja de proteger);
//   ② cuántas transacciones reservan número DENTRO de un bucle (hoy 1: la recapitulativa);
//   ③ cuántas `$transaction` fijan `timeout`/`maxWait` (hoy 0: todas van con el defecto).
//
// ③ es el que convierte una prohibición en mecanismo: subir el timeout es lo primero que se le
// ocurre a cualquiera y es la peor salida a solas —convierte un fallo rápido en una espera
// larga—. Si alguien lo sube, este test cae y le pide el número medido que lo justifique.
//
// Por AST y no por `grep`: hay que saber si una llamada está DENTRO del callback de una
// transacción y DENTRO de un bucle, y eso es estructura, no texto (SCRUM-203).
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');

/** Las funciones que toman el cerrojo de serie, directa o transitivamente. */
const TOMAN_CERROJO = new Set([
  'tomarCerrojoDeSerie', 'allocateInvoiceNumber', 'allocateAlbaranNumber', 'allocateQuoteNumber',
  'emitInvoice',
]);

const ES_BUCLE = (n) => ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n)
  || ts.isWhileStatement(n) || ts.isDoStatement(n);

function ficherosTs(dir) {
  const out = [];
  (function anda(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name.endsWith('.ts')) out.push(p);
    }
  })(dir);
  return out;
}

/** Analiza las `$transaction` de un fichero: viajes propios, bucles y quién toma el cerrojo. */
function transaccionesDe(rel, code) {
  const sf = ts.createSourceFile(rel, code, ts.ScriptTarget.Latest, true);
  const out = [];
  (function anda(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === '$transaction') {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      const info = { file: rel, line: line + 1, cerrojo: [], cerrojoEnBucle: [], opciones: [] };

      const opts = n.arguments[1];
      if (opts && ts.isObjectLiteralExpression(opts)) {
        info.opciones = opts.properties.map((p) => (p.name ? p.name.getText(sf) : '?'));
      }

      const cb = n.arguments[0];
      if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) {
        (function dentro(m, prof) {
          const p = prof + (ES_BUCLE(m) ? 1 : 0);
          if (ts.isCallExpression(m) && ts.isIdentifier(m.expression) && TOMAN_CERROJO.has(m.expression.text)) {
            info.cerrojo.push(m.expression.text);
            if (p > 0) info.cerrojoEnBucle.push(m.expression.text);
          }
          ts.forEachChild(m, (h) => dentro(h, p));
        })(cb.body, 0);
      }
      out.push(info);
    }
    ts.forEachChild(n, anda);
  })(sf);
  return out;
}

const TODAS = ficherosTs(SRC).flatMap((f) => {
  const rel = path.relative(RAIZ, f).split(path.sep).join('/');
  return transaccionesDe(rel, fs.readFileSync(f, 'utf8'));
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO — un censo que no encuentra nada da el mismo número que uno que no supo mirar
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-728 · SUELO: el detector ve transacciones, ve el cerrojo y sabe ver un bucle', () => {
  assert.ok(TODAS.length >= 20,
    `🔴 CIEGO: sólo ${TODAS.length} transacciones en todo src/. El barrido no está mirando.`);
  const conCerrojo = TODAS.filter((t) => t.cerrojo.length > 0);
  assert.ok(conCerrojo.length >= 10,
    `🔴 CIEGO: sólo ${conCerrojo.length} transacciones toman el cerrojo de serie. Si las funciones ` +
    'de reserva se renombraron, este fichero dejó de vigilar lo que dice vigilar.');

  // Y el detector tiene que distinguir «en bucle» de «no en bucle» sobre un caso fabricado.
  const cebo = transaccionesDe('cebo.ts', `
    await prisma.$transaction(async (tx) => {
      await allocateInvoiceNumber(tx, 1);
      for (const g of grupos) { await emitInvoice(tx, {}); }
    }, { timeout: 20000 });
  `)[0];
  assert.deepEqual(cebo.cerrojo.sort(), ['allocateInvoiceNumber', 'emitInvoice']);
  assert.deepEqual(cebo.cerrojoEnBucle, ['emitInvoice'], '🔴 el detector no distingue el bucle.');
  assert.deepEqual(cebo.opciones, ['timeout'], '🔴 el detector no ve las opciones de la transacción.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ① El cerrojo, primero. Si baja de posición, deja de cubrir lo que lee.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-728 · ① el cerrojo es la PRIMERA sentencia de cada reserva de número', () => {
  const RESERVAS = [
    ['src/modules/invoicing/domain/invoiceNumber.service.ts', 'allocateInvoiceNumber'],
    ['src/modules/jobs/domain/albaranNumber.service.ts', 'allocateAlbaranNumber'],
    ['src/modules/quotes/domain/quoteNumber.service.ts', 'allocateQuoteNumber'],
  ];
  for (const [rel, nombre] of RESERVAS) {
    const code = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    const sf = ts.createSourceFile(rel, code, ts.ScriptTarget.Latest, true);
    let cuerpo = null;
    (function anda(n) {
      if (ts.isFunctionDeclaration(n) && n.name && n.name.text === nombre) cuerpo = n.body;
      ts.forEachChild(n, anda);
    })(sf);
    assert.ok(cuerpo, `🔴 CIEGO: no encuentro \`${nombre}\` en ${rel}. ¿Renombrada?`);

    const primera = cuerpo.statements[0];
    assert.ok(primera && /pg_advisory_xact_lock/.test(primera.getText(sf)),
      `🔴 ${nombre}: la PRIMERA sentencia ya no es el cerrojo. Todo lo que se lea antes de ` +
      'tomarlo queda fuera de la sección crítica, y el read-then-write vuelve a ser una carrera.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ② El censo que no puede subir sin que se vea
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-728 · ② sólo UNA transacción reserva número dentro de un BUCLE, y es la recapitulativa', () => {
  const enBucle = TODAS.filter((t) => t.cerrojoEnBucle.length > 0)
    .map((t) => `${t.file}:${t.line}`).sort();

  assert.deepEqual(enBucle, ['src/modules/jobs/domain/recapitulativa.service.ts:72'],
    '🔴 EL CENSO SE MOVIÓ. Una reserva dentro de un bucle hace que la sección crítica sea ' +
    'proporcional a los DATOS, no constante: con N grupos son N reservas seguidas con el ' +
    'cerrojo tomado, y el timeout de 5 s no depende de N. Si has añadido una, trae el número ' +
    'de cuánto tarda con el N máximo real. Si has quitado la que había, actualiza este censo.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ③ La prohibición del encargo, hecha mecanismo
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-728 · ③ ninguna transacción sube el timeout por su cuenta', () => {
  const conOpciones = TODAS.filter((t) => t.opciones.length > 0)
    .map((t) => `${t.file}:${t.line} → ${t.opciones.join(',')}`);

  assert.deepEqual(conOpciones, [],
    '🔴 ALGUIEN FIJÓ OPCIONES DE TRANSACCIÓN. Subir el `timeout` es la salida obvia y es la peor ' +
    'a solas: convierte un fallo rápido en una espera larga, y el usuario espera más para ver el ' +
    'mismo error. Si de verdad toca subirlo, que venga con (a) cuánto tarda UNA reserva medida, ' +
    '(b) qué pasa al llegar al nuevo límite, y (c) esta línea actualizada a propósito:\n     ' +
    conOpciones.join('\n     '));
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// CONTROL NEGATIVO — lo que deliberadamente NO debe hacerlo caer
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-728 · CONTROL NEGATIVO: una transacción SIN cerrojo, y un bucle SIN reserva, no saltan', () => {
  const inocuas = transaccionesDe('cebo2.ts', `
    await prisma.$transaction(async (tx) => {
      for (const x of xs) { await tx.albaran.update({ where: { id: x } }); }
      await tx.job.findMany({});
    });
    await prisma.$transaction([a, b]);
  `);
  assert.equal(inocuas.length, 2);
  for (const t of inocuas) {
    assert.deepEqual(t.cerrojoEnBucle, [],
      '🔴 FALSO POSITIVO: un bucle que sólo actualiza filas NO reserva número y no alarga la ' +
      'serialización de la serie. Si esto salta, el guard acusa a quien no toca.');
    assert.deepEqual(t.opciones, []);
  }

  // Y el `updateMany` de la recapitulativa, que SÍ va en bucle, no cuenta como reserva:
  // marca albaranes, no consume número de serie.
  const soloUpdate = transaccionesDe('cebo3.ts', `
    await prisma.$transaction(async (tx) => {
      for (const g of grupos) { await tx.albaran.updateMany({ where: {}, data: {} }); }
    });
  `)[0];
  assert.deepEqual(soloUpdate.cerrojoEnBucle, []);
});
