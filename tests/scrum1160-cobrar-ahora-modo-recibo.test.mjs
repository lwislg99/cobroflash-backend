// tests/scrum1160-cobrar-ahora-modo-recibo.test.mjs — SCRUM-1160
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// «💰 COBRAR AHORA» EN MODO JUSTIFICANTE: EL BOTÓN NO ESTÁ
//
// Medido por S0 sobre el JS servido por yaqu.app (26-sep-2026): un merchant ES real
// (`INVOICING_ES_ENABLED` en OFF, regla 24) abre un presupuesto aceptado, pulsa «Cobrar ahora» y
// lee, en rojo y solo, «[PENDIENTE microcopy oficial]». La cadena: el CTA delegaba en «Generar
// factura» sin mirar el modo de emisión → el servidor corta con 409 `facturacion_no_disponible`
// (correcto) → el front pintaba `data.message` tal cual.
//
// El arreglo es el que ya tienen los albaranes (`albaranAccion.js:65`, `jobDetailView.js:1540`):
// en `receipt` —y con el modo desconocido, porque falla cerrado (SCRUM-905)— no se OFRECE
// facturar. Aquí se mira la ficha MONTADA, en los dos sentidos: sin el botón en `receipt` y con
// él en `fiscal`/`demo`, para que «no está» no pueda ser «la ficha no se pintó».
// ═════════════════════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Un presupuesto ACEPTADO, 100 % por adelantado y sin facturas: el caso medido en producción. */
const presupuesto = (extra = {}) => ({
  id: 1, number: 1, quoteNumber: 1, revision: 0, numeroConRevision: 'P1', revisiones: [], vigenteId: 1,
  status: 'accepted', total: '100.00', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  // Rango IMPOSIBLE (34 + 0 + 8 dígitos), como en SCRUM-984: ningún envío puede llegar a nadie.
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1160', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: '2026-09-20T10:00:00.000Z', rejectedAt: null, decisionChannel: 'backoffice', decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
  ...extra,
});

/** Monta la ficha con el modo de emisión que el servidor habría dicho en `/admin/me`. */
async function montar(modo, quote = presupuesto()) {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/quotes\/1$/.test(String(url)) ? quote : []),
  });
  // `app.js` lo fija desde `/admin/me`; `undefined` aquí es «el arranque no lo trajo».
  if (modo !== undefined) banco.ctx.appModoEmision = modo;
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, 'renderQuoteDetailView', 1);
  const nodos = r.contenedor ? todos(r.contenedor) : [];
  return {
    r, nodos,
    cobrar: nodos.filter((n) => n.getAttribute && n.getAttribute('data-accion') === 'btnCobrar'),
    generar: nodos.filter((n) => n.id === 'btn-generate-invoice'),
    textoTodo: nodos.map((n) => String(n.textContent || '')).join(' | '),
  };
}

const FILAS_1 = ['fiscal', 'demo'];
const caso1 = casosEscritos(FILAS_1, (modo) => `SCRUM-1160 · en modo \`${modo}\` la ficha SÍ ofrece «Cobrar ahora» y «Generar factura» (control positivo)`, async (modo) => {
  const m = await montar(modo);
  assert.equal(m.r.error, null, `🔴 la ficha revienta: ${m.r.error && m.r.error.message}`);
  assert.ok(m.nodos.length > 60, `🔴 CIEGO: la ficha montó ${m.nodos.length} nodos; no es la pantalla entera`);
  assert.equal(m.cobrar.length, 1, '🔴 en modo emisión el presupuesto aceptado debe ofrecer «Cobrar ahora»');
  assert.equal(m.generar.length, 1, '🔴 en modo emisión debe estar «Generar factura»');
  assert.match(m.generar[0].textContent, /Generar factura \(100%\)/);
});
test('SCRUM-1160 · en modo `fiscal` la ficha SÍ ofrece «Cobrar ahora» y «Generar factura» (control positivo)', caso1(0));
test('SCRUM-1160 · en modo `demo` la ficha SÍ ofrece «Cobrar ahora» y «Generar factura» (control positivo)', caso1(1));
caso1.todos();

test('SCRUM-1160 · control: en modo `receipt` CON Trabajo de origen, «Siguiente paso» sigue ahí con «Nuevo albarán»', async () => {
  const m = await montar('receipt', presupuesto({ albaranOrigen: { elegible: true, jobId: 77, motivo: null } }));
  assert.equal(m.cobrar.length, 0, '🔴 «Cobrar ahora» se ofrece en modo justificante');
  assert.equal(m.nodos.filter((n) => n.getAttribute && n.getAttribute('data-accion') === 'btnNuevoAlbaran').length, 1,
    '🔴 ocultar el cobro se llevó por delante el albarán, que no factura');
  assert.match(m.textoTodo, /Siguiente paso/, '🔴 con una acción debajo, el bloque tiene que estar');
});

// La nota «sin tramos» solo sale con condiciones MANUAL, así que se mira con ellas: con el 100 % por
// adelantado, «la nota no está» sería verdad sobre el vacío.
const manual = () => presupuesto({ decision: { ...presupuesto().decision, paymentTerms: 'MANUAL' } });

test('SCRUM-1160 · con condiciones MANUAL en modo `fiscal`, la nota «sin tramos» SÍ acompaña al botón (control positivo)', async () => {
  const m = await montar('fiscal', manual());
  assert.equal(m.generar.length, 1, '🔴 CIEGO: sin botón en modo emisión, la nota no se puede juzgar');
  assert.match(m.textoTodo, /Estas condiciones no generan tramos automáticos/, '🔴 la nota firmada (SCRUM-151) desapareció en modo emisión');
});

test('SCRUM-1160 · 🔴 con condiciones MANUAL en modo `receipt`, ni botón ni la nota que lo acompaña', async () => {
  const m = await montar('receipt', manual());
  assert.ok(m.nodos.length > 60, `🔴 CIEGO: la ficha montó ${m.nodos.length} nodos`);
  assert.equal(m.generar.length, 0, '🔴 «Generar factura» se ofrece en modo justificante');
  assert.doesNotMatch(m.textoTodo, /Estas condiciones no generan tramos automáticos/, '🔴 la nota se quedó sin el botón al que acompaña');
});

const FILAS_2 = [['receipt', 'receipt'], ['desconocido (null)', null], ['sin dato (undefined)', undefined]];
const caso2 = casosEscritos(FILAS_2, ([nombre, modo]) => `SCRUM-1160 · 🔴 en modo ${nombre} NO hay «Cobrar ahora» ni «Generar factura»: el 409 no se alcanza desde la pantalla`, async ([nombre, modo]) => {
  const m = await montar(modo);
  assert.equal(m.r.error, null, `🔴 la ficha revienta: ${m.r.error && m.r.error.message}`);
  assert.ok(m.nodos.length > 60, `🔴 CIEGO: la ficha montó ${m.nodos.length} nodos; «no está» no vale si la ficha no se pintó`);
  assert.match(m.textoTodo, /Conceptos|Punto de luz/i, '🔴 CIEGO: no veo las líneas del presupuesto');
  assert.doesNotMatch(m.textoTodo, /Siguiente paso/, '🔴 sin ninguna acción, «Siguiente paso» es un rótulo vacío');
  assert.equal(m.cobrar.length, 0, '🔴 «Cobrar ahora» se ofrece en un modo que solo puede acabar en 409');
  assert.equal(m.generar.length, 0, '🔴 «Generar factura» se ofrece en un modo que solo puede acabar en 409');
  assert.doesNotMatch(m.textoTodo, /Estas condiciones no generan tramos automáticos/,
    '🔴 la nota acompaña al botón de facturar; sin botón, sobra');
  assert.doesNotMatch(m.textoTodo, /PENDIENTE microcopy/, '🔴 hay un marcador en pantalla');
});
test('SCRUM-1160 · 🔴 en modo receipt NO hay «Cobrar ahora» ni «Generar factura»: el 409 no se alcanza desde la pantalla', caso2(0));
test('SCRUM-1160 · 🔴 en modo desconocido (null) NO hay «Cobrar ahora» ni «Generar factura»: el 409 no se alcanza desde la pantalla', caso2(1));
test('SCRUM-1160 · 🔴 en modo sin dato (undefined) NO hay «Cobrar ahora» ni «Generar factura»: el 409 no se alcanza desde la pantalla', caso2(2));
caso2.todos();

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL SEGUNDO CORTE: «💰 Cobrar el resto» de un Trabajo terminado (`collect-rest`, 409 en `receipt`)
//
// La escalera (`jobNextAction.js`) es la fuente única de la lista y del detalle; se carga con el
// panel ENTERO, así que el veredicto sale del `albaranAccion.js` de verdad y no de un doble.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const terminadoConSaldo = () => ({
  id: 9, status: 'terminado', remaining: { amount: 250, currency: 'EUR' },
  pendingStagesCount: 1, nextStage: null, hasCustomPlan: false,
  customer: { phone: null }, invoices: [], albaranes: [],
});

function escaleraCon(modo) {
  const banco = cargarDashboard(RAIZ, { datos: () => [] });
  if (modo !== undefined) banco.ctx.appModoEmision = modo;
  assert.equal(typeof banco.ctx.jobNextAction, 'function', '🔴 CIEGO: el panel no expone la escalera');
  return banco.ctx.jobNextAction;
}

const FILAS_3 = ['fiscal', 'demo'];
const caso3 = casosEscritos(FILAS_3, (modo) => `SCRUM-1160 · Trabajo terminado con saldo, modo \`${modo}\`: la primaria SÍ es «Cobrar el resto» (control positivo)`, (modo) => {
  const acc = escaleraCon(modo)(terminadoConSaldo(), true);
  assert.equal(acc && acc.kind, 'cobrar', '🔴 en modo emisión, un terminado con saldo debe proponer cobrar');
  assert.match(acc.label, /Cobrar el resto/);
});
test('SCRUM-1160 · Trabajo terminado con saldo, modo `fiscal`: la primaria SÍ es «Cobrar el resto» (control positivo)', caso3(0));
test('SCRUM-1160 · Trabajo terminado con saldo, modo `demo`: la primaria SÍ es «Cobrar el resto» (control positivo)', caso3(1));
caso3.todos();

const FILAS_4 = [['receipt', 'receipt'], ['desconocido (null)', null], ['sin dato (undefined)', undefined]];
const caso4 = casosEscritos(FILAS_4, ([nombre, modo]) => `SCRUM-1160 · 🔴 Trabajo terminado con saldo, modo ${nombre}: la escalera SALTA «Cobrar el resto»`, ([nombre, modo]) => {
  const acc = escaleraCon(modo)(terminadoConSaldo(), true);
  assert.notEqual(acc && acc.kind, 'cobrar', '🔴 la primaria de un trabajo terminado sólo sabe acabar en 409');
});
test('SCRUM-1160 · 🔴 Trabajo terminado con saldo, modo receipt: la escalera SALTA «Cobrar el resto»', caso4(0));
test('SCRUM-1160 · 🔴 Trabajo terminado con saldo, modo desconocido (null): la escalera SALTA «Cobrar el resto»', caso4(1));
test('SCRUM-1160 · 🔴 Trabajo terminado con saldo, modo sin dato (undefined): la escalera SALTA «Cobrar el resto»', caso4(2));
caso4.todos();

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL CINTURÓN: si pese a todo llega el 409, no se pinta el `message` sin firmar
// ═════════════════════════════════════════════════════════════════════════════════════════════

const FIRMADO = 'Desde tu cuenta todavía no se pueden generar facturas.';

test('SCRUM-1160 · 🔴 cinturón: el 409 `facturacion_no_disponible` y cualquier marcador pintan el texto FIRMADO', () => {
  const f = cargarDashboard(RAIZ, { datos: () => [] }).ctx.textoDeErrorDeFacturar;
  assert.equal(typeof f, 'function', '🔴 CIEGO: el panel no expone el cinturón');
  assert.equal(f({ error: 'facturacion_no_disponible', message: '[PENDIENTE microcopy oficial]' }, 'x'), FIRMADO);
  assert.equal(f({ error: 'facturacion_no_disponible' }, 'x'), FIRMADO);
  assert.equal(f({ error: 'otro', message: '[PENDIENTE microcopy oficial] algo' }, 'x'), FIRMADO,
    '🔴 un marcador de otro error también es un texto sin firmar');
});

test('SCRUM-1160 · 🔴 cinturón del CTA del Trabajo: `collect-rest` en 409 da el texto firmado; lo demás, null (sigue su camino)', () => {
  const g = cargarDashboard(RAIZ, { datos: () => [] }).ctx.errorDeFacturarSinFirmar;
  assert.equal(typeof g, 'function', '🔴 CIEGO: el panel no expone el cinturón del CTA');
  assert.equal(g({ error: 'facturacion_no_disponible', message: '[PENDIENTE microcopy oficial]' }), FIRMADO);
  assert.equal(g({ error: 'sin_lineas', message: 'Este presupuesto no tiene líneas.' }), null,
    '🔴 un error con texto firmado propio no es asunto del cinturón');
  assert.equal(g(undefined), null, '🔴 un fallo de red (sin `data`) no es asunto del cinturón');
});

test('SCRUM-1160 · control negativo: los 409 que YA traen texto firmado siguen saliendo tal cual', () => {
  const f = cargarDashboard(RAIZ, { datos: () => [] }).ctx.textoDeErrorDeFacturar;
  const firmadoDeOtro = 'Este presupuesto no tiene líneas.';
  assert.equal(f({ error: 'sin_lineas', message: firmadoDeOtro }, 'x'), firmadoDeOtro,
    '🔴 el cinturón se comió un texto firmado bueno');
  assert.equal(f({ error: 'algo' }, 'por defecto'), 'por defecto');
  assert.equal(f(null, 'por defecto'), 'por defecto');
});
