// SCRUM-1365 · «COBRAR EL RESTO» NO EMITE EL TRAMO DE UN PRESUPUESTO QUE NADIE HA ACEPTADO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO (leído en `origin/main`, no ejecutado en producción: allí la ruta responde 409
// `facturacion_no_disponible` antes de elegir): `POST /admin/jobs/:id/collect-rest` cargaba TODOS
// los presupuestos del Trabajo, sin mirar el estado, y se los pasaba a `primeroConTramoPendiente`.
// Si el primero con tramo pendiente era un BORRADOR, se emitía su factura.
//
// Misma raíz que SCRUM-1355 (las cinco LECTURAS); ésta es la ESCRITURA. El criterio no se
// escribe otra vez: es `presupuestoAceptado`, de `dineroDelTrabajo.ts`.
//
// DOS MITADES, como en scrum1355:
//   · LA DECISIÓN, con las funciones de producción importadas de `dist` (no una copia).
//   · EL CABLEADO, por AST: la ruta sólo elige entre los filtrados. Sin esta mitad, la decisión
//     de arriba probaría una composición que la ruta podría no hacer.
//
// MUTANTES que este fichero tiene que cazar (los dos, corridos a mano y anotados en el registro):
//   · «selección sin filtrar»: la ruta pasa `quotesConPlan` a `primeroConTramoPendiente` → rojo (AST).
//   · «criterio que acepta todo»: `presupuestoAceptado` devuelve `true` → rojo (decisión).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { resolveBillingPlan } from '../dist/modules/quotes/domain/billingPlan.js';
import { primeroConTramoPendiente } from '../dist/modules/jobs/domain/presupuestosDelTrabajo.js';
import { presupuestoAceptado } from '../dist/modules/jobs/domain/dineroDelTrabajo.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'jobs.routes.ts');

const ORIGINAL = 10;
const FACTURA = { id: 1 };
const Q = (over = {}) => ({
  id: ORIGINAL, status: 'accepted', total: '200.00', paymentTerms: 'FIFTY_FIFTY',
  customBillingPlan: null, Invoice: [], ...over,
});

/** Lo que la ruta compone (el AST de abajo vigila que lo componga ASÍ). */
function elegido(quotes) {
  const aceptados = quotes.filter(presupuestoAceptado);
  return { aceptados, conPendiente: primeroConTramoPendiente(aceptados, ORIGINAL, resolveBillingPlan) };
}

// ═════════════════════════════════════════════════════════════════════════════
// 0 · SUELO: el banco de pruebas distingue
// ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-1365 · SUELO: el plan de prueba tiene 2 tramos, y SIN filtro un borrador saldría elegido', () => {
  assert.equal(resolveBillingPlan(Q()).length, 2, '🔴 CIEGO: `FIFTY_FIFTY` ya no son 2 tramos; los casos de abajo no miden lo que dicen');
  const borrador = Q({ status: 'draft' });
  assert.equal(primeroConTramoPendiente([borrador], ORIGINAL, resolveBillingPlan), borrador,
    '🔴 CIEGO: sin filtrar, el borrador NO sale elegido. Entonces «no se elige» no probaría el filtro.');
});

// ═════════════════════════════════════════════════════════════════════════════
// 1 · LA DECISIÓN
// ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-1365 · 🔴 un Trabajo que sólo tiene presupuestos SIN ACEPTAR no tiene de qué cobrar', () => {
  for (const status of ['draft', 'sent', 'rejected', 'expired', null, undefined, 'ACCEPTED', '']) {
    const { aceptados, conPendiente } = elegido([Q({ status })]);
    assert.equal(aceptados.length, 0, `🔴 un presupuesto con estado ${JSON.stringify(status)} pasa por aceptado`);
    assert.equal(conPendiente, null, `🔴 se elige para emitir un presupuesto con estado ${JSON.stringify(status)}`);
  }
});

test('SCRUM-1365 · 🔴 original aceptado YA cobrado entero + adicional en BORRADOR pendiente → no queda nada', () => {
  const original = Q({ Invoice: [FACTURA, FACTURA] });
  const adicionalBorrador = Q({ id: 11, status: 'draft', total: '80.00' });
  const { aceptados, conPendiente } = elegido([adicionalBorrador, original]);
  assert.deepEqual(aceptados.map((q) => q.id), [ORIGINAL], 'el Trabajo SÍ tiene presupuesto: el original');
  assert.equal(conPendiente, null, '🔴 se emite el tramo de un adicional que el cliente no ha aceptado');
});

test('SCRUM-1365 · CONTROL: lo aceptado se sigue cobrando igual (SCRUM-195 no retrocede)', () => {
  const pendiente = Q({ Invoice: [FACTURA] });
  assert.equal(elegido([pendiente]).conPendiente, pendiente, '🔴 el original aceptado con tramo pendiente ya no se cobra');

  const cobrado = Q({ Invoice: [FACTURA, FACTURA] });
  const adicional = Q({ id: 11, total: '80.00' });
  assert.equal(elegido([adicional, cobrado]).conPendiente, adicional, '🔴 el adicional ACEPTADO pendiente ya no se cobra');

  // Y el orden: con los dos pendientes, el ORIGINAL primero, aunque haya un borrador con id menor.
  const borradorAnterior = Q({ id: 5, status: 'draft' });
  assert.equal(elegido([borradorAnterior, adicional, pendiente]).conPendiente, pendiente);
});

// ═════════════════════════════════════════════════════════════════════════════
// 2 · EL CABLEADO · la ruta sólo elige entre los filtrados (AST, sin comentarios por construcción)
// ═════════════════════════════════════════════════════════════════════════════

function recorrer(nodo, visita) { visita(nodo); ts.forEachChild(nodo, (h) => recorrer(h, visita)); }

function leerRuta() {
  const sf = ts.createSourceFile(RUTAS, fs.readFileSync(RUTAS, 'utf8'), ts.ScriptTarget.Latest, true);
  let handler = null;
  recorrer(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'post'
      && n.arguments.length && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === '/:id/collect-rest') handler = n;
  });
  return { sf, handler };
}

/** `<algo>.filter(presupuestoAceptado)`, exactamente: sin envoltorio que pueda cambiar el criterio. */
function esFiltroPorAceptado(expr) {
  return Boolean(expr) && ts.isCallExpression(expr)
    && ts.isPropertyAccessExpression(expr.expression) && expr.expression.name.text === 'filter'
    && expr.arguments.length === 1 && ts.isIdentifier(expr.arguments[0]) && expr.arguments[0].text === 'presupuestoAceptado';
}

test('SCRUM-1365 · 🔴 `collect-rest` elige SÓLO entre los presupuestos aceptados', () => {
  const { sf, handler } = leerRuta();
  assert.ok(handler, '🔴 CIEGO: no encuentro `router.post(\'/:id/collect-rest\', …)` en jobs.routes.ts');

  const declaraciones = new Map();
  const elecciones = [];
  const usos = [];
  recorrer(handler, (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) declaraciones.set(n.name.text, n);
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'primeroConTramoPendiente') elecciones.push(n);
    if (ts.isIdentifier(n) && n.text === 'quotesConPlan') usos.push(n);
  });

  assert.equal(elecciones.length, 1, `🔴 CIEGO: esperaba UNA llamada a \`primeroConTramoPendiente\` en la ruta y hay ${elecciones.length}`);
  assert.ok(usos.length >= 2, '🔴 CIEGO: no veo `quotesConPlan` en la ruta. ¿Se renombró la lista sin filtrar?');

  const lista = elecciones[0].arguments[0];
  assert.ok(lista && ts.isIdentifier(lista), '🔴 el primer argumento de `primeroConTramoPendiente` ya no es una variable: no puedo seguir de dónde sale');
  const decl = declaraciones.get(lista.text);
  assert.ok(decl, `🔴 \`${lista.text}\` no se declara dentro de la ruta`);
  assert.ok(esFiltroPorAceptado(decl.initializer),
    `🔴 \`primeroConTramoPendiente\` recibe \`${lista.text}\`, que NO es \`….filter(presupuestoAceptado)\` ` +
    `(es \`${decl.initializer?.getText(sf)}\`): un borrador con tramo pendiente puede salir elegido y EMITIRSE.`);
  assert.equal(decl.initializer.expression.expression.getText(sf), 'quotesConPlan', 'se filtra la lista de presupuestos del Trabajo, no otra');

  // Después del filtro, la lista SIN filtrar no se vuelve a leer: ni para elegir ni para `ordenados`
  // (de donde sale el presupuesto cuyo plan explica el «no queda nada»).
  const tardios = usos.filter((u) => u.getStart(sf) > decl.getEnd());
  assert.equal(tardios.length, 0,
    `🔴 \`quotesConPlan\` (sin filtrar) se vuelve a leer después del filtro, en la línea ` +
    `${tardios.map((u) => sf.getLineAndCharacterOfPosition(u.getStart(sf)).line + 1).join(', ')}`);

  // Sin ninguno aceptado: el 409 que YA existía, sin texto nuevo (regla 39).
  let vacio = null;
  recorrer(handler, (n) => {
    if (ts.isIfStatement(n) && n.expression.getText(sf).replace(/\s+/g, '') === `${lista.text}.length===0`) vacio = n;
  });
  assert.ok(vacio, `🔴 la ruta no corta cuando \`${lista.text}\` está vacía: seguiría con \`ordenados[0]\` indefinido (500)`);
  const corte = vacio.thenStatement.getText(sf);
  assert.match(corte, /status\(409\)/, '🔴 sin presupuesto aceptado la ruta no responde 409');
  assert.match(corte, /'job_without_quote'/, '🔴 el código ya no es `job_without_quote`, el que existía');
  assert.doesNotMatch(corte, /message/, '🔴 hay un `message` nuevo: es texto que ve el usuario y lo firma el fundador (regla 39)');
  assert.ok(vacio.getStart(sf) < elecciones[0].getStart(sf), 'el corte va ANTES de elegir');
});

test('SCRUM-1365 · 🔴 el criterio es EL de `dineroDelTrabajo.ts`, no uno escrito en la ruta', () => {
  const { sf } = leerRuta();
  let importado = null;
  const locales = [];
  recorrer(sf, (n) => {
    if (ts.isImportSpecifier(n) && n.name.text === 'presupuestoAceptado') importado = n;
    if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name && ts.isIdentifier(n.name) && n.name.text === 'presupuestoAceptado') locales.push(n);
  });
  assert.ok(importado, '🔴 la ruta no importa `presupuestoAceptado`');
  assert.equal(importado.propertyName, undefined, '🔴 `presupuestoAceptado` es un alias de otra cosa');
  const origen = importado.parent.parent.parent.moduleSpecifier.text;
  assert.match(origen, /\/domain\/dineroDelTrabajo$/, `🔴 \`presupuestoAceptado\` viene de \`${origen}\`: hay un segundo criterio`);
  assert.equal(locales.length, 0, '🔴 la ruta define su propio `presupuestoAceptado`');
});
