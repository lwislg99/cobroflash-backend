// SCRUM-1355 · UN PRESUPUESTO QUE NADIE HA ACEPTADO NO ES DINERO QUE TE DEBAN.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, medido en producción el 1-oct-2026 (merchant 46, Trabajo #76, presupuesto #203):
// un Trabajo abierto sin presupuesto al que se le cuelga un BORRADOR de 121 € decía que le
// debían 121 €. `serializeJob` leía los presupuestos del Trabajo sin mirar su estado —su `select`
// ni siquiera lo traía— y, con `job.totalAceptado` nulo, caía a `quote.total`.
//
// 🔴 UNA RAÍZ, CINCO SALIDAS. Del mismo borrador salían `totalAceptado`, el chip (`estadoCobro`),
// `importeReferencia`, `remaining` y `nextStage`. Por eso este test NO prueba «una cifra»: prueba
// las cinco a la vez, y un guard por AST vigila que ninguna vuelva a leerse por su cuenta.
//
// SIN GATE Y CON DOBLES: se prueba la DECISIÓN, importando el criterio de producción desde `dist`
// (no una copia). El cableado de la ruta lo vigila el AST de abajo.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { resolveBillingPlan } from '../dist/modules/quotes/domain/billingPlan.js';
import { buildBillingPlanView } from '../dist/modules/quotes/domain/billingPlanView.js';
import { estadoCobroFor, importeDeReferencia } from '../dist/modules/jobs/domain/job.service.js';
import { dineroDelTrabajo } from '../dist/modules/jobs/domain/dineroDelTrabajo.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'jobs.routes.ts');

const Q = (over = {}) => ({
  id: 203, status: 'draft', total: '121.00', currency: 'EUR', paymentTerms: 'FIFTY_FIFTY',
  customBillingPlan: null, lines: [], discountGlobalAmount: null, Invoice: [], ...over,
});

/**
 * Las CINCO salidas, compuestas igual que las compone `serializeJob`: el criterio sale de
 * `dineroDelTrabajo` y el semáforo de las dos funciones de SCRUM-363, todas las de producción.
 */
function salidas({ guardado = null, cobrado = 0, facturado = 0, quotes }) {
  const dinero = dineroDelTrabajo({ totalAceptadoGuardado: guardado, quotes, resolverPlan: resolveBillingPlan });
  const plan = dinero.quoteDelPlan
    ? buildBillingPlanView(dinero.quoteDelPlan, (dinero.quoteDelPlan.Invoice || []).length)
    : null;
  return {
    totalAceptado: dinero.totalAceptado,
    estadoCobro: estadoCobroFor(cobrado, dinero.totalAceptado ?? 0, facturado),
    importeReferencia: importeDeReferencia(dinero.totalAceptado ?? 0, facturado),
    remaining: dinero.restante > 0 ? dinero.restante : null,
    nextStage: plan?.nextStage ? plan.nextStage.amount : null,
    pendingStagesCount: plan?.pendingStagesCount ?? 0,
  };
}

const NADA = {
  totalAceptado: null, estadoCobro: null, importeReferencia: null,
  remaining: null, nextStage: null, pendingStagesCount: 0,
};

// ═════════════════════════════════════════════════════════════════════════════
// 1 · EL CASO MEDIDO: Trabajo sin importe guardado + un borrador de 121 €
// ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-1355 · 🔴 con un presupuesto en BORRADOR el Trabajo no debe nada y el chip no promete nada', () => {
  assert.deepEqual(salidas({ quotes: [Q()] }), NADA,
    '🔴 un borrador que nadie ha aceptado sigue saliendo como dinero del Trabajo. Son CINCO salidas ' +
    'de la misma raíz: si falla una sola, las otras cuatro no la tapan.');
});

test('SCRUM-1355 · tampoco lo es uno enviado, rechazado, caducado, ni uno cuyo estado no se pudo leer', () => {
  // Parte L del máster: `draft → sent → accepted | rejected` (+ `expired`). Sólo `accepted`
  // compromete dinero. Y el último caso es el fail-closed: sin estado legible NO se afirma deuda.
  for (const status of ['sent', 'rejected', 'expired', undefined, null, '', 'ACCEPTED']) {
    assert.deepEqual(salidas({ quotes: [Q({ status })] }), NADA,
      `🔴 un presupuesto con estado ${JSON.stringify(status)} cuenta como dinero aceptado`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 2 · CONTROL POSITIVO: «devolver null siempre» pasaría lo de arriba
// ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-1355 · CONTROL: el MISMO presupuesto, aceptado, da las cinco salidas de siempre', () => {
  assert.deepEqual(salidas({ quotes: [Q({ status: 'accepted' })] }), {
    totalAceptado: 121, estadoCobro: 'Pendiente', importeReferencia: 121,
    remaining: 121, nextStage: 60.5, pendingStagesCount: 2,
  });
});

test('SCRUM-1355 · CONVIVENCIA: el Trabajo de siempre (importe guardado + original aceptado) no se mueve', () => {
  // El 100 % de los Trabajos nacidos de un accept: `totalAceptado` congelado y un tramo emitido.
  const original = Q({ id: 7, status: 'accepted', total: '1000.00', Invoice: [{ id: 1, total: '500.00' }] });
  assert.deepEqual(salidas({ guardado: '1000.00', cobrado: 500, facturado: 500, quotes: [original] }), {
    totalAceptado: 1000, estadoCobro: 'Parcial', importeReferencia: 1000,
    remaining: 500, nextStage: 500, pendingStagesCount: 1,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3 · MEZCLAS: el borrador no suma, y no arrastra al que sí está aceptado
// ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-1355 · un ADICIONAL en borrador no suma al pendiente; el original aceptado sí', () => {
  const original = Q({ id: 7, status: 'accepted', total: '1000.00', Invoice: [{ id: 1 }] }); // queda 500
  const borrador = Q({ id: 9, status: 'draft', total: '200.00' });
  const s = salidas({ guardado: '1000.00', quotes: [original, borrador] });
  assert.equal(s.remaining, 500, '🔴 el pendiente cuenta un adicional que nadie ha aceptado');
  assert.equal(s.totalAceptado, 1000);
});

test('SCRUM-1355 · un adicional ACEPTADO sigue sumando (SCRUM-195 no retrocede)', () => {
  const original = Q({ id: 7, status: 'accepted', total: '1000.00', Invoice: [{ id: 1 }] });
  const adicional = Q({ id: 9, status: 'accepted', total: '200.00' });
  assert.equal(salidas({ guardado: '1000.00', quotes: [original, adicional] }).remaining, 700);
});

test('SCRUM-1355 · Trabajo sin presupuesto original: un borrador delante NO esconde al adicional aceptado', () => {
  // `quotesDeJob` ordena por id cuando no hay `Job.quoteId`: el borrador puede quedar el primero.
  const borrador = Q({ id: 5, status: 'draft', total: '121.00' });
  const aceptado = Q({ id: 9, status: 'accepted', total: '200.00' });
  const s = salidas({ quotes: [borrador, aceptado] });
  assert.equal(s.remaining, 200, '🔴 el adicional aceptado ha dejado de contar como pendiente');
  assert.equal(s.totalAceptado, null, 'el importe de referencia no se inventa a partir del borrador');
  assert.equal(s.nextStage, null, 'el plan base es el del PRIMERO, y el primero no está aceptado');
});

test('SCRUM-1355 · lo FACTURADO sigue siendo eje aunque el presupuesto no esté aceptado (SCRUM-363)', () => {
  // Una factura emitida es un hecho. El orden del fundador (aceptado → facturado → sin eje) no cambia.
  const s = salidas({ cobrado: 0, facturado: 80, quotes: [Q()] });
  assert.equal(s.importeReferencia, 80);
  assert.equal(s.estadoCobro, 'Pendiente');
  assert.equal(s.totalAceptado, null);
});

test('SCRUM-1355 · el importe GUARDADO manda sobre cualquier presupuesto', () => {
  assert.equal(salidas({ guardado: '300.00', quotes: [Q()] }).totalAceptado, 300);
  assert.equal(salidas({ guardado: 0, quotes: [Q({ status: 'accepted' })] }).totalAceptado, 0,
    'un 0 guardado es un dato, no una ausencia: no cae al presupuesto');
});

// ═════════════════════════════════════════════════════════════════════════════
// 4 · EL CABLEADO · `serializeJob` no vuelve a leer el dinero por su cuenta (AST)
// ═════════════════════════════════════════════════════════════════════════════

function recorrer(nodo, visita) { visita(nodo); ts.forEachChild(nodo, (h) => recorrer(h, visita)); }

function serializeJobDeLaRuta() {
  const sf = ts.createSourceFile(RUTAS, fs.readFileSync(RUTAS, 'utf8'), ts.ScriptTarget.Latest, true);
  let fn = null;
  let select = null;
  recorrer(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'serializeJob') fn = n;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'QUOTE_SELECT') select = n;
  });
  return { sf, fn, select };
}

test('SCRUM-1355 · 🔴 `serializeJob` saca el dinero de `dineroDelTrabajo`, no de `quote.total`', () => {
  const { sf, fn, select } = serializeJobDeLaRuta();
  assert.ok(fn, '🔴 CIEGO: no encuentro `serializeJob` en jobs.routes.ts. ¿Se renombró?');
  assert.ok(select, '🔴 CIEGO: no encuentro `QUOTE_SELECT`.');

  // Sin `status` en el `select`, el criterio no tiene qué mirar y TODO saldría «sin aceptar».
  // Por AST y sólo el PRIMER nivel: por texto casaba con el `status: true` del `Invoice` anidado,
  // y quitar el del presupuesto dejaba el test en verde (medido al mutarlo).
  let literal = select.initializer;
  while (literal && (ts.isAsExpression(literal) || ts.isParenthesizedExpression(literal))) literal = literal.expression;
  assert.ok(literal && ts.isObjectLiteralExpression(literal), '🔴 CIEGO: `QUOTE_SELECT` ya no es un objeto literal.');
  const campos = literal.properties.map((p) => p.name?.getText(sf));
  assert.ok(campos.includes('total'), `🔴 CIEGO: no veo \`total\` entre los campos de \`QUOTE_SELECT\` (${campos.join(', ')}).`);
  assert.ok(campos.includes('status'),
    '🔴 `QUOTE_SELECT` no trae `status`: el serializador no puede distinguir un borrador de un aceptado');

  const llamadas = [];
  const totalesDelQuote = [];
  recorrer(fn, (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) llamadas.push(n);
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'total'
      && ts.isIdentifier(n.expression) && n.expression.text === 'quote') totalesDelQuote.push(n);
  });
  const de = (nombre) => llamadas.filter((c) => c.expression.text === nombre);

  assert.equal(de('dineroDelTrabajo').length, 1,
    '🔴 `serializeJob` no llama a `dineroDelTrabajo` exactamente una vez: el criterio vuelve a estar repartido');
  assert.equal(de('restanteDelTrabajo').length, 0,
    '🔴 `serializeJob` vuelve a sumar el pendiente por su cuenta, sobre presupuestos sin filtrar');
  for (const c of de('buildBillingPlanView')) {
    assert.notEqual(c.arguments[0]?.getText(sf), 'quote',
      '🔴 el siguiente tramo vuelve a salir de `quote` a secas, esté aceptado o no');
  }

  // `quote.total` sólo puede aparecer dentro de la propiedad `quote:` de la respuesta, que es el
  // DOCUMENTO («este presupuesto vale tanto»), no una afirmación sobre lo que deben al Trabajo.
  const dentroDeLaPropiedadQuote = (n) => {
    for (let p = n.parent; p && p !== fn; p = p.parent) {
      if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'quote') return true;
    }
    return false;
  };
  assert.ok(totalesDelQuote.length >= 1,
    '🔴 CIEGO: no veo ni un `quote.total` en `serializeJob`, y la propiedad `quote:` lleva uno. El escáner no mira.');
  const fuera = totalesDelQuote.filter((n) => !dentroDeLaPropiedadQuote(n));
  assert.equal(fuera.length, 0,
    `🔴 hay ${fuera.length} lectura(s) de \`quote.total\` fuera de la propiedad \`quote:\` ` +
    `(línea ${fuera.map((n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1).join(', ')}): ` +
    'el importe del Trabajo vuelve a salir de un presupuesto sin preguntar si está aceptado.');
});
