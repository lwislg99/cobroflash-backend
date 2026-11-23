// tests/scrum1787i-vencimiento-y-formas-de-pago.test.mjs — SCRUM-1787i
//
// Decisiones: c.22325 (GO de regla 40; rótulo `Vence el`; sin «Condiciones de pago»), c.22331
// (guardar las formas de pago; «Vence el» por defecto a 30 días de la expedición, y se puede
// cambiar o vaciar), c.22332/c.22333 (ALTER aplicado). Diseño: tramo 1787f del registro.
//
// QUÉ SE EJECUTA Y QUÉ NO. Se ejecuta lo que la ruta de la factura suelta compone: el validador
// (`validarFacturaSuelta`), el vencimiento (`vencimientoDeLaSuelta`) y la emisión de verdad
// (`emitInvoice` → `crearFacturaEmitida`) contra una transacción fabricada que captura el INSERT.
// La ruta MONTADA en `app` no se ejecuta aquí: que pasa los dos campos se LEE en su fuente (⑦).
//
// ① sin `dueDate` → la factura se congela con expedición + 30 días
// ② con `dueDate: null` → sin vencimiento · con fecha → esa fecha
// ③ con `payMethods` → congeladas; sin ellas → NULL
// ④ un `dueDate` o unas `payMethods` que no valen → se rechaza ANTES de emitir (el conjunto es el del presupuesto)
// ⑤ cambiar después las preferencias del comercio no cambia la factura
// ⑥ control: los caminos que no cambian (los otros orígenes de `emitInvoice`) quedan a NULL
// ⑦ la ruta de la suelta pasa los dos campos (leído en el fuente)
// ⑧ la ficha pinta `Vence el` con la fecha, y no lo pinta si no consta
// ⑨ la ficha pinta `Formas de pago` con los literales firmados en c.22345 ① (`Tarjeta`, `Bizum`,
//    `Transferencia`), una por cada forma congelada, y no la pinta si no consta ninguna
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La emisión deja de escribir el vencimiento que le llega.
    fichero: 'src/modules/invoicing/domain/invoicing.service.ts',
    de: 'dueDate: input.dueDate ?? null,',
    a: 'dueDate: null,',
    cae: 'SCRUM-1787i ① sin dueDate, la suelta se congela a expedición + 30 días',
  },
  {
    // La ficha deja de pintar la fila del vencimiento.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: "addDefRow(dlCobro, 'Vence el',",
    a: "void (",
    cae: 'SCRUM-1787i ⑧ la ficha pinta «Vence el» con la fecha congelada',
  },
  {
    // La ficha deja de pintar la fila de las formas de pago.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: "addDefRow(dlCobro, 'Formas de pago',",
    a: "void (",
    cae: 'SCRUM-1787i ⑨ la ficha pinta «Formas de pago» con los literales firmados',
  },
];

const D = '../dist/modules/invoicing/domain/';
const { emitInvoice } = await import(D + 'invoicing.service.js');
const suelta = await import(D + 'facturaSuelta.js');
const { validarFacturaSuelta } = suelta;
const { CreateQuoteSchema } = await import('../dist/core/validation/schemas.js');
const { ORIGENES_C7 } = await import(D + 'invoiceNumber.service.js');

const MERCHANT_ID = 71; // nunca el 1: es el demo y apaga comprobaciones (scrum409)
const ACTOR = { tipo: 'pro_propietario', teamMemberId: null };
const CLIENTE = { customerName: 'Cliente QA', customerLegalName: null, customerTaxId: 'B00000001', customerEmail: null, customerPhone: null };
const LINEAS = [{ concept: 'ZZ trabajo de ejemplo', qty: 1, price: 100, tax: 0.21 }];
const EXPEDICION = new Date('2026-11-21T10:00:00.000Z');
const DIA = 86_400_000;

/** Transacción FABRICADA (la forma de scrum347): captura lo que se inserta en `invoices`. */
function txDeEjemplo(preferencias = { payMethodsDelComercio: ['card', 'bizum', 'transfer'] }) {
  const creadas = [];
  return {
    creadas,
    preferencias,
    $executeRaw: async () => 0,
    merchant: {
      findUnique: async () => ({
        id: MERCHANT_ID, email: 'pro@ejemplo.test', country: 'ES',
        flags: { INVOICING_ES_ENABLED: true }, llevaLibrosPorSii: false,
        invoiceSeriesPrefix: 'CF', nextInvoiceNumber: 1, nextRectInvoiceNumber: 1, invoiceSeriesYear: 2026,
        ...preferencias,
      }),
      update: async () => ({}),
    },
    auditLog: { create: async () => ({}) },
    customer: { findFirst: async () => null },
    invoice: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }) => { creadas.push(data); return { id: creadas.length, ...data }; },
    },
  };
}

/** Lo que hace la ruta de la suelta con un cuerpo: validar, fijar el vencimiento y emitir. */
async function emitirSuelta(tx, cuerpo, origen = 'C7-suelta') {
  const val = validarFacturaSuelta({ customerId: 5, lines: LINEAS, ...cuerpo });
  if (!val.ok) return { rechazada: val };
  assert.equal(typeof suelta.vencimientoDeLaSuelta, 'function', '🔴 `vencimientoDeLaSuelta` no existe: la suelta no fija vencimiento');
  const factura = await emitInvoice(tx, {
    merchantId: MERCHANT_ID, customerId: val.customerId, total: '121.00', currency: 'EUR', type: 'F1',
    lines: val.lineas, quoteId: null, actor: ACTOR, origen, clienteCongelado: CLIENTE, emisorCongelado: {},
    dueDate: suelta.vencimientoDeLaSuelta(val.dueDate, EXPEDICION),
    payMethods: val.payMethods,
  });
  return { factura };
}

test('SCRUM-1787i ① sin dueDate, la suelta se congela a expedición + 30 días', async () => {
  const tx = txDeEjemplo();
  const { factura } = await emitirSuelta(tx, {});
  assert.equal(tx.creadas.length, 1, '🔴 CIEGO: no se insertó ninguna factura');
  assert.ok(factura.dueDate instanceof Date, `🔴 la factura sale sin vencimiento: ${factura.dueDate}`);
  assert.equal(factura.dueDate.getTime() - EXPEDICION.getTime(), 30 * DIA, '🔴 el vencimiento por defecto no es expedición + 30 días (c.22331)');
});

test('SCRUM-1787i ② con dueDate null queda sin vencimiento, y con fecha, esa fecha', async () => {
  const tx = txDeEjemplo();
  const vacia = await emitirSuelta(tx, { dueDate: null });
  assert.equal(vacia.factura.dueDate, null, '🔴 el profesional vació el vencimiento y la factura lleva uno');
  const puesta = await emitirSuelta(tx, { dueDate: '2026-12-05T22:59:59.000Z' });
  assert.equal(puesta.factura.dueDate.toISOString(), '2026-12-05T22:59:59.000Z');
  // positivo del propio caso: la tercera, sin el campo, SÍ lleva vencimiento (si no, «null» no distingue nada)
  const porDefecto = await emitirSuelta(tx, {});
  assert.ok(porDefecto.factura.dueDate instanceof Date);
  assert.equal(tx.creadas.length, 3);
});

test('SCRUM-1787i ③ con payMethods quedan congeladas; sin ellas, NULL (todas las activas)', async () => {
  const tx = txDeEjemplo();
  const con = await emitirSuelta(tx, { payMethods: ['bizum', 'transfer'] });
  assert.deepEqual(con.factura.payMethods, ['bizum', 'transfer']);
  const sin = await emitirSuelta(tx, {});
  assert.equal(sin.factura.payMethods ?? null, null, '🔴 sin formas elegidas la factura no debe guardar ninguna');
});

test('SCRUM-1787i ④ lo que no vale se rechaza antes de emitir, con el conjunto del presupuesto', async () => {
  const tx = txDeEjemplo();
  for (const cuerpo of [{ payMethods: [] }, { payMethods: ['cheque'] }, { payMethods: 'bizum' }, { dueDate: 'no-es-fecha' }, { dueDate: 20261205 }]) {
    const r = await emitirSuelta(tx, cuerpo);
    assert.ok(r.rechazada && r.rechazada.ok === false, `🔴 se emitió con ${JSON.stringify(cuerpo)}`);
    assert.ok(r.rechazada.error, '🔴 el rechazo no lleva código');
    // Ningún texto nuevo sin firma (regla 39): el editor cae a su respaldo firmado con un mensaje vacío.
    assert.equal(r.rechazada.message, '', `🔴 el rechazo lleva un texto sin firmar: «${r.rechazada.message}»`);
  }
  assert.equal(tx.creadas.length, 0, '🔴 un cuerpo inválido llegó a insertar una factura');
  // El conjunto es EL del presupuesto, no una segunda lista: cada forma que el presupuesto acepta, la suelta también.
  const delPresupuesto = CreateQuoteSchema.shape.payMethods.unwrap().element.options;
  assert.ok(delPresupuesto.length >= 3, `🔴 CIEGO: el presupuesto declara ${delPresupuesto.length} formas de pago`);
  for (const forma of delPresupuesto) {
    const r = validarFacturaSuelta({ customerId: 5, lines: LINEAS, payMethods: [forma] });
    assert.equal(r.ok, true, `🔴 la suelta rechaza «${forma}», que el presupuesto acepta`);
    assert.deepEqual(r.payMethods, [forma]);
  }
});

test('SCRUM-1787i ⑤ cambiar después las preferencias del comercio no cambia la factura', async () => {
  const tx = txDeEjemplo();
  const { factura } = await emitirSuelta(tx, { payMethods: ['bizum'] });
  const antes = JSON.stringify({ v: factura.dueDate, f: factura.payMethods });
  tx.preferencias.payMethodsDelComercio = ['card'];
  assert.equal(JSON.stringify({ v: tx.creadas[0].dueDate, f: tx.creadas[0].payMethods }), antes);
  assert.deepEqual(tx.creadas[0].payMethods, ['bizum']);
  // y lo congelado es una copia: mutar lo que mandó el editor tampoco la cambia
  const enviado = ['transfer'];
  const otra = await emitirSuelta(tx, { payMethods: enviado });
  enviado.push('card');
  assert.deepEqual(otra.factura.payMethods, ['transfer']);
});

test('SCRUM-1787i ⑥ control: los caminos que no cambian quedan a NULL', async () => {
  // La lista es la de la casa (la que scrum347 ata al tipo `OrigenC7`), no una mía.
  assert.ok(ORIGENES_C7.includes('C7-suelta'), '🔴 CIEGO: `C7-suelta` no está en ORIGENES_C7');
  const origenes = ORIGENES_C7.filter((o) => o !== 'C7-suelta');
  assert.ok(origenes.length >= 3, `🔴 CIEGO: sólo veo ${origenes.length} orígenes de emitInvoice distintos de la suelta`);
  for (const origen of origenes) {
    const tx = txDeEjemplo();
    const f = await emitInvoice(tx, {
      merchantId: MERCHANT_ID, customerId: 5, total: '121.00', currency: 'EUR', type: 'F1',
      lines: LINEAS, quoteId: null, actor: ACTOR, origen, clienteCongelado: CLIENTE, emisorCongelado: {},
    });
    assert.equal(tx.creadas.length, 1);
    assert.equal(f.dueDate ?? null, null, `🔴 «${origen}» escribe un vencimiento que nadie le dio`);
    assert.equal(f.payMethods ?? null, null, `🔴 «${origen}» escribe formas de pago que nadie le dio`);
  }
});

test('SCRUM-1787i ⑦ la ruta de la suelta pasa los dos campos a la emisión (leído en el fuente)', () => {
  // SCRUM-700: el filtro es el de la casa; uno propio que corta en `//` ciega lo que va tras una URL.
  const sinComentarios = soloEjecutable(
    fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/invoicesAdmin.routes.ts'), 'utf8'),
    { almohadillaEsComentario: false });
  const desde = sinComentarios.indexOf("origen: 'C7-suelta'");
  assert.ok(desde > 0, '🔴 CIEGO: no encuentro la emisión de la suelta en la ruta');
  const llamada = sinComentarios.slice(sinComentarios.lastIndexOf('emitInvoice(tx', desde), sinComentarios.indexOf('}),', desde));
  assert.match(llamada, /dueDate:\s*vencimientoDeLaSuelta\(val\.dueDate,/, '🔴 la ruta no fija el vencimiento de la suelta');
  assert.match(llamada, /payMethods:\s*val\.payMethods/, '🔴 la ruta no pasa las formas de pago');
});

// ── La ficha ─────────────────────────────────────────────────────────────────────────────
const FACTURA = Object.freeze({
  id: 7, number: 'F-2026-0007', status: 'pending', type: 'F1', total: 121, currency: 'EUR',
  createdAt: '2026-11-21T10:00:00.000Z', customerName: 'ZZCLIENTE Ejemplo', customer: { id: 1, name: 'ZZCLIENTE Ejemplo' },
  lines: LINEAS, rectifiedBy: [],
});
async function fichaDe(cambios) {
  const factura = { ...FACTURA, ...cambios };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.fetch = async (u) => ({ ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? factura : []) });
  banco.ctx.apiRequest = async () => [];
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha revienta al abrirse: ${r.error && r.error.message}`);
  const nodos = todos(r.contenedor);
  const rotulos = nodos.filter((n) => n.tagName === 'DT').map((n) => (n.textContent || '').trim());
  const valorDe = (rotulo) => {
    const i = nodos.findIndex((n) => n.tagName === 'DT' && (n.textContent || '').trim() === rotulo);
    const dd = i < 0 ? null : nodos.slice(i + 1).find((n) => n.tagName === 'DD');
    return dd ? (dd.textContent || '').trim() : null;
  };
  return { rotulos, valorDe };
}

test('SCRUM-1787i ⑧ la ficha pinta «Vence el» con la fecha congelada', async () => {
  const con = await fichaDe({ dueDate: '2026-12-21T10:00:00.000Z' });
  assert.ok(con.rotulos.includes('Cliente'), `🔴 CIEGO: la ficha no pinta ni «Cliente» (rótulos: ${con.rotulos.join(' | ')})`);
  assert.ok(con.rotulos.includes('Vence el'), `🔴 la ficha no pinta «Vence el» (rótulos: ${con.rotulos.join(' | ')})`);
  const valor = con.valorDe('Vence el');
  assert.match(valor, /21/, `🔴 el valor no lleva el día: «${valor}»`);
  assert.match(valor, /2026/, `🔴 el valor no lleva el año: «${valor}»`);
  assert.match(valor, /dic/i, `🔴 el valor no lleva el mes: «${valor}»`);
});

test('SCRUM-1787i ⑧ una factura sin vencimiento no pinta «Vence el»', async () => {
  const sin = await fichaDe({ dueDate: null });
  assert.ok(sin.rotulos.includes('Cliente'), '🔴 CIEGO: la ficha no pinta ni «Cliente»');
  assert.equal(sin.rotulos.includes('Vence el'), false, '🔴 la ficha pinta «Vence el» sin fecha');
});

// ── ⑨ «Formas de pago» en la ficha (literales FIRMADOS en c.22345 ①) ───────────────────────────
const FORMAS_FIRMADAS = Object.freeze({ card: 'Tarjeta', bizum: 'Bizum', transfer: 'Transferencia' });

test('SCRUM-1787i ⑨ la ficha pinta «Formas de pago» con los literales firmados', async () => {
  // Las claves salen del esquema del presupuesto: si mañana acepta una forma más sin literal, esto cae.
  const delPresupuesto = CreateQuoteSchema.shape.payMethods.unwrap().element.options;
  assert.deepEqual([...delPresupuesto].sort(), Object.keys(FORMAS_FIRMADAS).sort(), '🔴 hay una forma de pago sin literal firmado');
  const todas = await fichaDe({ payMethods: ['card', 'bizum', 'transfer'] });
  assert.ok(todas.rotulos.includes('Cliente'), '🔴 CIEGO: la ficha no pinta ni «Cliente»');
  assert.ok(todas.rotulos.includes('Formas de pago'), `🔴 la ficha no pinta «Formas de pago» (rótulos: ${todas.rotulos.join(' | ')})`);
  const valor = todas.valorDe('Formas de pago');
  for (const literal of Object.values(FORMAS_FIRMADAS)) {
    assert.ok(valor.split(', ').includes(literal), `🔴 falta el literal «${literal}» en «${valor}»`);
  }
  assert.doesNotMatch(valor, /card|bizum\b|transfer\b/, `🔴 la ficha pinta claves crudas: «${valor}»`);
  // Sólo las congeladas: una factura con una forma enseña esa y ninguna más.
  const una = await fichaDe({ payMethods: ['bizum'] });
  assert.equal(una.valorDe('Formas de pago'), 'Bizum');
});

test('SCRUM-1787i ⑨ una factura sin formas de pago congeladas no pinta «Formas de pago»', async () => {
  for (const payMethods of [null, undefined, [], ['cheque']]) {
    const sin = await fichaDe({ payMethods });
    assert.ok(sin.rotulos.includes('Cliente'), '🔴 CIEGO: la ficha no pinta ni «Cliente»');
    assert.equal(sin.rotulos.includes('Formas de pago'), false, `🔴 pinta «Formas de pago» con ${JSON.stringify(payMethods)}`);
  }
});
