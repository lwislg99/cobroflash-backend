// tests/scrum389-censo-vat.test.mjs — SCRUM-389 · el censo de quién deriva IVA por su cuenta.
//
// ⚠️ CORRE SIEMPRE, sin base, en `npm test`. El cuadre de las tres pantallas está gateado (pide
// Postgres); si este censo también lo estuviera, el CI no ejecutaría NADA de este ticket y la
// duplicación podría volver sin que saltara nada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ VIGILA, Y QUÉ NO
//
// `calcVatBreakdown` NO es el problema: es la primitiva compartida del IVA y la usa medio
// sistema —emisión, VeriFactu, exports, albaranes, recapitulativa, la landing—. Retirarla sería
// romper lo que funciona.
//
// El problema es **agregar un PERIODO por un camino propio**. Eso es lo que hacía
// `/admin/reports/vat` (leía facturas de un trimestre y las sumaba él), y por eso podía decir
// una cifra distinta de la del 303. Un llamador NUEVO no puede colarse sin que alguien decida
// en cuál de los dos grupos está: **por documento** (una factura, un albarán, un presupuesto —
// correcto) o **agrega un periodo** (tiene que pasar por el Libro).
//
// El censo se DERIVA del árbol con el compilador de TypeScript; los veredictos los pone una
// persona. Un `grep` no valdría: casaría con los comentarios que explican esto mismo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const FUNCION = 'calcVatBreakdown';

/** Todos los `.ts` de `src`. */
function fuentes(dir = path.join(RAIZ, 'src'), out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentes(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Ficheros que LLAMAN a `calcVatBreakdown` — por AST, no por texto. */
function llamadores() {
  const encontrados = new Map();
  for (const ruta of fuentes()) {
    const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let n = 0;
    const visitar = (nodo) => {
      if (ts.isCallExpression(nodo)) {
        const e = nodo.expression;
        const nombre = ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) ? e.name.text : null);
        if (nombre === FUNCION) n += 1;
      }
      ts.forEachChild(nodo, visitar);
    };
    visitar(sf);
    if (n > 0) encontrados.set(path.relative(RAIZ, ruta).replace(/\\/g, '/'), n);
  }
  return encontrados;
}

/**
 * EL CENSO — leído uno a uno, con su veredicto.
 *
 *   DOCUMENTO · desglosa UN documento (factura, albarán, presupuesto, registro VeriFactu).
 *               No agrega un periodo, así que no puede discrepar de nada. Correcto.
 *   PRIMITIVA · la define o la reexporta.
 */
const CENSO = {
  'src/modules/invoicing/domain/vat.service.ts': { veredicto: 'PRIMITIVA', nota: 'aquí se define; `calcVatCuotaTotal` la reexporta' },
  'src/modules/invoicing/domain/libroRegistro.ts': { veredicto: 'DOCUMENTO', nota: 'desglosa CADA factura del libro; es la fuente única de la que beben el 303 e Informes (SCRUM-389)' },
  'src/modules/invoicing/domain/verifactu.service.ts': { veredicto: 'DOCUMENTO', nota: 'desglose de la factura que se sella y el de la que rectifica' },
  'src/modules/invoicing/domain/finalInvoice.service.ts': { veredicto: 'DOCUMENTO', nota: 'la negativa por tipo del documento anterior' },
  'src/modules/invoicing/domain/invoiceLines.service.ts': { veredicto: 'DOCUMENTO', nota: 'el total de UNA factura desde sus líneas' },
  'src/modules/jobs/app/routes/albaranes.routes.ts': { veredicto: 'DOCUMENTO', nota: 'desglose de un albarán valorado' },
  'src/modules/jobs/domain/recapitulativa.service.ts': { veredicto: 'DOCUMENTO', nota: 'desglose de la recapitulativa que se está componiendo' },
  'src/modules/exports/domain/exportData.ts': { veredicto: 'DOCUMENTO', nota: 'una fila por factura en el CSV; no suma un total de periodo' },
  'src/modules/system/app/routes/invoicesAdmin.routes.ts': { veredicto: 'DOCUMENTO', nota: 'previsualización de UNA factura suelta (SCRUM-289)' },
  'src/modules/system/app/routes/quoteDecisionLanding.routes.ts': { veredicto: 'DOCUMENTO', nota: 'desglose del presupuesto que ve el cliente' },
  // SCRUM-500 · llamador NUEVO, y del tipo bueno: desglosa UN documento y además lo hace LLAMANDO
  // a la primitiva sobre las líneas ya filtradas, en vez de copiar el bucle «para filtrar de
  // paso» — que habría sido la segunda cifra oficial del mismo dinero que este censo persigue.
  // Su propio guard (`scrum500-suplidos.test.mjs` §7) exige que la llamada sea exactamente UNA.
  'src/modules/invoicing/domain/suplidos.ts': { veredicto: 'DOCUMENTO', nota: 'el desglose de UNA factura sacando los suplidos de la base; el IVA lo delega en la primitiva' },
  // ✅ 2-sep-2026 · SCRUM-656 · SALE `pdf.service.ts` y ENTRA el módulo que ahora hace esa
  // llamada. No es que se haya dejado de desglosar el presupuesto: es que el desglose se ha
  // mudado a `quotes/domain/presentacionIva.ts`, donde además decide QUÉ se pinta según el modo
  // de IVA del documento. La maqueta ya no calcula; pinta lo que le dan.
  //
  // ⚠️ Y la mudanza destapó algo que conviene no perder: mientras el bloque del presupuesto
  // llamaba a la primitiva DESDE EL MISMO FICHERO, el bloque de totales de la FACTURA —que
  // agrupa el IVA a mano, a propósito— quedaba fuera del censo de SCRUM-627, porque su criterio
  // es por fichero. Al irse la llamada, aquel fichero aparece por lo que lleva haciendo siempre.
  'src/modules/quotes/domain/presentacionIva.ts': { veredicto: 'DOCUMENTO', nota: 'el pie de UN presupuesto: llama a la primitiva y solo decide qué filas se pintan según el modo de IVA (SCRUM-656)' },
};

test('SCRUM-389 · SUELO: el extractor ENCUENTRA llamadores', () => {
  const n = llamadores().size;
  assert.ok(n >= 8,
    `🔴 el AST solo ha encontrado ${n} ficheros que llamen a ${FUNCION}, y hay más.\n\n` +
    '  «Nadie deriva el IVA por su cuenta» y «no supe encontrar a quién lo hace» son el mismo\n' +
    '  número. Si el extractor se rompió, arréglalo ANTES de creerte el verde de abajo.');
});

test('SCRUM-389 · todo el que deriva IVA está CENSADO con su veredicto', () => {
  const nuevos = [...llamadores().keys()].filter((f) => !CENSO[f]);

  assert.deepEqual(nuevos, [],
    `🔴 HAY LLAMADORES DE ${FUNCION} SIN CLASIFICAR:\n` +
    nuevos.map((f) => `   · ${f}`).join('\n') + '\n\n' +
    '  Derivar el IVA no está prohibido: por DOCUMENTO es lo correcto y lo hace medio sistema.\n' +
    '  Lo que no vale es que aparezca uno **que agregue un PERIODO** sin que nadie lo mire: eso\n' +
    '  es una segunda cifra oficial del mismo trimestre, y ya pasó — `/admin/reports/vat` decía\n' +
    '  su propio total hasta SCRUM-389.\n\n' +
    '  Si el nuevo agrega un periodo, que lea el LIBRO (`leerLibroRegistro`). Si es por\n' +
    '  documento, clasifícalo aquí con su motivo.');
});

test('SCRUM-389 · el censo no describe ficheros que ya no existen (trinquete)', () => {
  // Sin esto, el censo se llena de entradas fantasma y su tamaño deja de significar nada.
  const vivos = llamadores();
  const fantasmas = Object.keys(CENSO).filter((f) => !vivos.has(f));
  assert.deepEqual(fantasmas, [],
    `🔴 el censo describe ficheros que ya no llaman a ${FUNCION}: ${fantasmas.join(', ')}. ` +
    'Quítalos EN EL MISMO COMMIT en que dejen de hacerlo.');
});

test('SCRUM-389 · Informes ya NO deriva el IVA por su cuenta', () => {
  // El corazón del ticket, comprobado por estructura y sin base: la ruta del trimestre pasa por
  // el Libro y no vuelve a agregar.
  const ruta = path.join(RAIZ, 'src/modules/reports/app/routes/reports.routes.ts');
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const llamadas = [];
  const importa = new Set();
  const visitar = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const nombre = ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) ? e.name.text : null);
      if (nombre) llamadas.push(nombre);
    }
    if (ts.isImportDeclaration(n)) {
      const cl = n.importClause?.namedBindings;
      if (cl && ts.isNamedImports(cl)) for (const el of cl.elements) importa.add(el.name.text);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);

  assert.ok(llamadas.includes('leerLibroRegistro'),
    '🔴 Informes ya no lee el Libro: si vuelve a leer facturas por su cuenta, vuelve a ser una ' +
    'segunda cifra oficial del mismo trimestre.');
  assert.ok(!llamadas.includes(FUNCION) && !importa.has(FUNCION),
    `🔴 Informes vuelve a llamar a ${FUNCION} por su cuenta. El desglose de cada factura lo hace ` +
    'el Libro una sola vez; hacerlo aquí otra vez es reabrir el defecto que este ticket cierra.');
  assert.ok(llamadas.includes('rangoTrimestre'),
    '🔴 Informes ha vuelto a construirse su propio rango de fechas. Dos copias del criterio de ' +
    'fechas es exactamente cómo empiezan a discrepar dos cifras que deberían ser una.');
});
