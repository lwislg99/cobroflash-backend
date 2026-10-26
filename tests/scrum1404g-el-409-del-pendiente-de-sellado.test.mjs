// tests/scrum1404g-el-409-del-pendiente-de-sellado.test.mjs — SCRUM-1404g (carril J1; cruce a J2 declarado en SCRUM-1404 c.20932)
//
// EL PDF DE UNA FACTURA PENDIENTE DE SELLADO CONTESTA 409 CON LA FRASE FIRMADA, Y NO 500 — PERO
// SÓLO SI ESA FACTURA ES DE LAS QUE ENTRAN EN LA CADENA.
//
// `ensureInvoicePdf` corta con `invoice_pendiente_de_sellado` ANTES de mirar si la factura es un
// justificante `J-` o de un comercio no español, y el `catch` de las dos rutas sólo reconocía
// `invoice_sin_sellar`: el fallo previsto salía como 500 (medido en SCRUM-1404 c.20921 y por el
// control de J5, `docs/master/evidencias/SCRUM-1517b/control-en-rojo.mjs`). Decisión del fundador:
// opción 2 de c.20930 (c.20932) — `esErrorSinSellar` recibe el número y el comercio, y reconoce el
// pendiente sólo si `debeEstarEnLaCadena`. El justificante y el comercio no español SIGUEN EN 500
// (c.20923 P4): «se está registrando en Hacienda» sería falso para ellos.
//
// 🔴 POR LA RUTA MONTADA, NO POR EL HANDLER (A10, SCRUM-1344): arranca `dist/app.js` con el banco de
// SCRUM-597, con `requireAuth` de verdad y el propietario como sesión sin fila de equipo.
// ⚠️ LAS FILAS LAS ESCRIBE EL CAMINO REAL: `sellarTrasEmision` compilado, sobre una base doblada con
// estado y los mismos fallos que fabrica el control de J5. El doble de la app respeta `select` e
// `include`: el comercio sólo llega a la ruta si la ruta lo pide.
//
// 🔴 EL GUARD DE J5 («la respuesta nunca antes que el reintento», c.18783): mientras
// `REINTENTO_ACTIVO_DESDE` sea `null`, P no puede contestar 409. Con esta rama, cae — y por eso va
// `todo`, con su motivo: el fundador escribe la fecha ENCIMA, en el mismo PR (c.20923 P2). Su hermano
// NO es `todo`: cae si la fecha deja de ser `null` y el `todo` sigue puesto, así que quien escriba la
// fecha tiene que poner `TODO_DEL_GUARD_J5 = null` en ese mismo commit, y el guard no se queda
// decorativo.
//
// La excepción declarada (c.20923 P5): el caso C —huella escrita, estado sin marcar— contesta 409
// «se reintenta solo», y el reintento no lo recoge nunca. Se fija aquí para que deje de ser
// excepción sólo con una decisión, no por accidente.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

// `invoicesDir` se calcula al CARGAR `dist` desde el directorio del proceso: los PDF van a un
// temporal del sistema, nunca al árbol (SCRUM-824). Se cambia ANTES de montar la app.
const RAIZ = path.resolve(import.meta.dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1404g-'));
process.chdir(TMP);
process.on('exit', () => {
  try { process.chdir(RAIZ); fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* temporal del sistema */ }
});

const { montarAppReal, bancoDePrisma, sesionesDe } = await import('./_banco-camino-real.mjs');
const require = createRequire(import.meta.url);
const app = await montarAppReal();
after(() => app.cerrar());

const K = require('../dist/modules/invoicing/domain/selladoEstado.js');
const porton = require('../dist/modules/invoicing/domain/portonDocumento.js');
const { documentoEnRegistroHtml } = require('../dist/core/http/publicNotFound.js');
const { REINTENTO_ACTIVO_DESDE } = require('../dist/modules/invoicing/domain/reintentoSellado.js');

/**
 * 🔴 EL `todo` DEL GUARD DE J5. Lo pone a `null` quien escriba `REINTENTO_ACTIVO_DESDE`, en el MISMO
 * commit (SCRUM-1404 c.20923 P2 y c.20932). Si no, cae el hermano de abajo.
 */
const TODO_DEL_GUARD_J5 = 'se enciende con la fecha de REINTENTO_ACTIVO_DESDE, mismo PR (SCRUM-1404 c.20923 P2 y c.20932)';

// Microcopy OFICIAL del panel (SCRUM-1502 c.18835), byte a byte. No es texto nuevo: es el que ya da G.
const FRASE_DEL_PANEL = 'Esta factura todavía no está registrada. Se reintenta solo; si sigue así, avísanos.';

const MIO = 1404;
const ses = sesionesDe(MIO, { id: 9, role: 'tecnico', merchantId: MIO });
const NIF = 'B12345678';
const ES = Object.freeze({ ...ses.merchant, country: 'ES', taxId: NIF, legalName: 'Fontaneria S.L.', address: null, logoUrl: null, whatsappPhone: null, timezone: null, flags: null });
const TOKEN = 'tok-scrum1404g-recibo';

const esquema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
const NACE = /vfEstado\s+String\s+@default\("([^"]+)"\)/.exec(esquema)?.[1] ?? null;
const ESCRIBE_ESTADO = (valor) => (a) => a?.data?.vfEstado === valor;

/** La base con estado sobre la que el camino real ESCRIBE la fila (la del control de J5). */
function fabricar({ numero, merchant, falla = [] }) {
  const fila = {
    id: 4101, number: numero, total: '121.00', currency: 'EUR', type: 'F1', stageLabel: null,
    createdAt: new Date('2026-09-29T10:00:00Z'), merchantId: MIO, customerId: 9,
    lines: [{ concept: 'Obra', qty: 1, price: 100, tax: 0.21 }],
    pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
    vfEstado: NACE, vfHash: null, vfPrevHash: null, vfTimestamp: null,
    vfAnulHash: null, vfAnulTimestamp: null, vfAnulPrevHash: null, merchantName: null,
    merchant: { ...merchant },
    customer: { id: 9, name: 'Cliente', legalName: null, taxId: 'A11111111', email: null, phone: null, address: null },
  };
  const modelo = (m) => new Proxy({}, {
    get: (_, op) => async (args) => {
      const clave = `${m}.${String(op)}`;
      const f = falla.find((x) => x.clave === clave && x.si(args));
      if (f) throw new Error(f.mensaje);
      if (clave === 'invoice.findUnique') return fila;
      if (clave === 'invoice.findFirst') return null;
      if (clave === 'invoice.update') { Object.assign(fila, args?.data ?? {}); return fila; }
      if (clave === 'merchant.findUnique') return { ...fila.merchant };
      if (op === 'findMany') return [];
      if (op === 'count') return 0;
      return { id: 1, ...(args?.data ?? {}) };
    },
  });
  const cliente = new Proxy({}, {
    get: (_, k) => {
      if (k === '$transaction') return async (fn) => fn(cliente);
      if (k === '$executeRaw' || k === '$executeRawUnsafe') return async () => 1;
      if (k === '$queryRaw') return async () => [];
      if (k === 'then' || typeof k === 'symbol') return undefined;
      return modelo(String(k));
    },
  });
  return { fila, cliente };
}

function proyectar(obj, sel) {
  if (!sel) return { ...obj };
  return Object.fromEntries(Object.keys(sel).filter((k) => sel[k] && k in obj).map((k) => [k, obj[k]]));
}
/** Como Prisma: las relaciones sólo llegan si se piden, y con las columnas que se pidan. */
function servir(fila, args) {
  const { merchant, customer, ...columnas } = fila;
  const relaciones = { merchant, customer, rectifies: null };
  const sel = args?.select;
  const out = proyectar(columnas, sel);
  for (const [k, v] of Object.entries(relaciones)) {
    const pide = sel?.[k] ?? args?.include?.[k];
    if (pide) out[k] = v == null ? null : (pide === true ? { ...v } : proyectar(v, pide.select));
  }
  return out;
}

/** Fabrica la fila por el camino real y la pide por las DOS rutas montadas. */
async function pedirLasDos({ numero, merchant, falla = [], sinPuerta = false, despues }) {
  const d = fabricar({ numero, merchant, falla });
  bancoDePrisma().programar({ authSession: ses.tabla, merchant: { findUnique: async () => ({ ...d.fila.merchant }) } });
  if (!sinPuerta) {
    await K.sellarTrasEmision(
      { id: d.fila.id, number: d.fila.number, total: { toString: () => d.fila.total }, createdAt: d.fila.createdAt, merchantId: MIO, type: d.fila.type },
      merchant, d.cliente,
    ).catch(() => { /* lo que deje escrito es la fila; el fallo es el que se fabrica */ });
    await new Promise((r) => setImmediate(r));
  }
  if (despues) despues(d.fila);
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => ({ ...d.fila.merchant }) },
    charge: { findUnique: async (a) => (a?.where?.receiptToken === TOKEN
      ? { id: 501, status: 'paid', merchantId: MIO, events: [{ type: 'invoiced', payload: { invoice_id: d.fila.id } }] }
      : null) },
    quote: { findFirst: async () => null },
    invoice: {
      findUnique: async (a) => (a?.where?.id === d.fila.id ? servir(d.fila, a) : null),
      findFirst: async (a) => (a?.where?.id === d.fila.id && a?.where?.merchantId === MIO ? servir(d.fila, a) : null),
      update: async (a) => { Object.assign(d.fila, a?.data ?? {}); return d.fila; },
    },
  });
  const errores = console.error;
  console.error = () => {}; // las rutas registran el error; aquí se mide la respuesta
  try {
    const recibo = await app.pedir(`/recibo/${TOKEN}/pdf`);
    const panel = await app.pedir(`/admin/invoices/${d.fila.id}/pdf`, { token: ses.PROPIETARIO });
    const escritasEnFactura = bancoDePrisma().escrituras.filter((e) => e.modelo === 'invoice').length;
    return { fila: d.fila, recibo, panel, escritasEnFactura };
  } finally { console.error = errores; }
}

const CASOS = {
  P: { numero: '2026-CF-0002', merchant: ES,
    falla: [{ clave: 'invoice.update', si: (a) => !!a?.data?.vfHash, mensaje: 'la base no responde (huella)' }] },
  C: { numero: '2026-CF-0003', merchant: ES,
    falla: [{ clave: 'invoice.update', si: ESCRIBE_ESTADO(K.SELLADO_HECHO), mensaje: 'la base no responde (estado)' }] },
  D: { numero: 'J-20260929-AB12', merchant: ES,
    falla: [{ clave: 'invoice.update', si: ESCRIBE_ESTADO(K.SELLADO_NO_APLICA), mensaje: 'la base no responde (no aplica)' }] },
  E: { numero: '2026-CF-0005', merchant: { ...ES, country: 'PT', taxId: 'PT509999999' },
    falla: [{ clave: 'invoice.update', si: ESCRIBE_ESTADO(K.SELLADO_NO_APLICA), mensaje: 'la base no responde (no aplica)' }] },
  F: { numero: '2026-CF-0006', merchant: ES, sinPuerta: true },
  G: { numero: '2026-CF-0007', merchant: { ...ES, taxId: null }, despues: (fila) => { fila.merchant.taxId = NIF; } },
  SELLADA: { numero: '2026-CF-0001', merchant: ES },
  X: { numero: '2026-CF-0008', merchant: ES, despues: (fila) => { fila.merchant.name = null; } },
};
const R = {};
for (const [id, c] of Object.entries(CASOS)) R[id] = await pedirLasDos(c);

const PAGINA_409 = documentoEnRegistroHtml(porton.COPY_PUBLICO_SIN_SELLAR);
const esPdf = (r) => r.texto.startsWith('%PDF-');
const ver = (r) => `${r.status} ${String(r.texto).slice(0, 160)}`;

function es409Firmado(r, donde) {
  assert.equal(r.recibo.status, 409, `${donde} · recibo: ${ver(r.recibo)}`);
  assert.equal(r.recibo.texto, PAGINA_409, `${donde} · recibo: la página no es, byte a byte, la del 409 firmado`);
  assert.equal(r.panel.status, 409, `${donde} · panel: ${ver(r.panel)}`);
  assert.deepEqual(r.panel.json, { error: porton.ERROR_SIN_SELLAR, message: FRASE_DEL_PANEL }, `${donde} · panel: el cuerpo no es el firmado`);
  assert.equal(r.escritasEnFactura, 0, `${donde} · regla 29: pedir el documento escribió en la factura`);
}
function sigueEn500(r, donde) {
  assert.equal(r.recibo.status, 500, `${donde} · recibo: ${ver(r.recibo)}`);
  assert.ok(!r.recibo.texto.includes(porton.COPY_PUBLICO_SIN_SELLAR), `${donde} · recibo: lleva la frase de Hacienda`);
  assert.equal(r.panel.status, 500, `${donde} · panel: ${ver(r.panel)}`);
  assert.deepEqual(r.panel.json, { error: 'pdf_generation_failed' }, `${donde} · panel`);
  assert.equal(r.escritasEnFactura, 0, `${donde} · regla 29: pedir el documento escribió en la factura`);
}

test('SCRUM-1404g · suelo: el camino real deja las filas donde cada caso dice', () => {
  assert.equal(NACE, K.SELLADO_PENDIENTE, 'el @default del esquema no es SELLADO_PENDIENTE');
  const pendientes = ['P', 'C', 'D', 'E', 'F'];
  for (const id of pendientes) assert.equal(R[id].fila.vfEstado, K.SELLADO_PENDIENTE, `${id} no quedó pendiente`);
  assert.equal(R.P.fila.vfHash, null, 'P: sin huella');
  assert.ok(R.C.fila.vfHash, 'C: con la huella escrita');
  for (const id of ['G', 'SELLADA', 'X']) assert.notEqual(R[id].fila.vfEstado, K.SELLADO_PENDIENTE, `${id} no debía quedar pendiente`);
  assert.equal(Object.keys(R).length, Object.keys(CASOS).length, 'población: corrieron todos los casos');
});

test('SCRUM-1404g · P · factura ES pendiente de sellado → 409 firmado en las dos rutas', () => es409Firmado(R.P, 'P'));
test('SCRUM-1404g · F · factura ES que no llegó a la puerta (pendiente) → 409 firmado en las dos rutas', () => es409Firmado(R.F, 'F'));
test('SCRUM-1404g · D · justificante J- pendiente → SIGUE en 500 (c.20923 P4)', () => sigueEn500(R.D, 'D'));
test('SCRUM-1404g · E · comercio no español pendiente → SIGUE en 500 (c.20923 P4)', () => sigueEn500(R.E, 'E'));
test('SCRUM-1404g · G · el 409 del portón de la huella no cambia', () => es409Firmado(R.G, 'G'));
test('SCRUM-1404g · una factura sellada → 200 con el PDF por las dos rutas', () => {
  assert.equal(R.SELLADA.recibo.status, 200, `recibo: ${ver(R.SELLADA.recibo)}`);
  assert.ok(esPdf(R.SELLADA.recibo), 'recibo: no es un PDF');
  assert.equal(R.SELLADA.panel.status, 200, `panel: ${ver(R.SELLADA.panel)}`);
  assert.ok(esPdf(R.SELLADA.panel), 'panel: no es un PDF');
});
test('SCRUM-1404g · X · la avería de verdad (emisor sin nombre) sigue en 500', () => sigueEn500(R.X, 'X'));
test('SCRUM-1404g · C · EXCEPCIÓN DECLARADA (c.20923 P5): huella escrita y estado sin marcar → 409, y el reintento no la recoge', () => {
  es409Firmado(R.C, 'C');
});

test('SCRUM-1404g · guard de J5: mientras REINTENTO_ACTIVO_DESDE sea null, el pendiente NO contesta 409', { todo: TODO_DEL_GUARD_J5 }, () => {
  if (REINTENTO_ACTIVO_DESDE !== null) return;
  assert.notEqual(R.P.recibo.status, 409, 'recibo: promete «vuelve a intentarlo» sin reintento encendido');
  assert.notEqual(R.P.panel.status, 409, 'panel: promete «se reintenta solo» sin reintento encendido');
});
test('SCRUM-1404g · hermano del guard de J5: con la fecha escrita, su todo ya no puede seguir puesto', () => {
  assert.ok(!(REINTENTO_ACTIVO_DESDE !== null && TODO_DEL_GUARD_J5),
    `REINTENTO_ACTIVO_DESDE = ${REINTENTO_ACTIVO_DESDE} y el guard de J5 sigue en todo: pon TODO_DEL_GUARD_J5 = null en este mismo commit`);
});

export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/invoicing/domain/portonDocumento.ts',
    de: "=== ERROR_PDF_SIN_SELLAR && !!numero && debeEstarEnLaCadena(numero, merchant);",
    a: "=== ERROR_PDF_SIN_SELLAR;",
    cae: 'SCRUM-1404g · D · justificante J- pendiente → SIGUE en 500 (c.20923 P4)' },
  { fichero: 'src/modules/invoicing/domain/portonDocumento.ts',
    de: "=== ERROR_PDF_SIN_SELLAR && !!numero && debeEstarEnLaCadena(numero, merchant);",
    a: "=== ERROR_PDF_SIN_SELLAR && !!numero && false;",
    cae: 'SCRUM-1404g · P · factura ES pendiente de sellado → 409 firmado en las dos rutas' },
  { fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: 'if (esErrorSinSellar(err, factura?.number, factura?.merchant)) {',
    a: 'if (esErrorSinSellar(err)) {',
    cae: 'SCRUM-1404g · P · factura ES pendiente de sellado → 409 firmado en las dos rutas' },
  { fichero: 'src/modules/billing/app/routes/receipt.routes.ts',
    de: 'if (esErrorSinSellar(err, invoice?.number, invoice?.merchant)) {',
    a: 'if (esErrorSinSellar(err)) {',
    cae: 'SCRUM-1404g · P · factura ES pendiente de sellado → 409 firmado en las dos rutas' },
  { fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: "return res.status(500).json({ error: 'pdf_generation_failed' });\n  }\n});\n\n/**\n * PATCH /admin/invoices/:id/asignados",
    a: "return res.status(409).json({ error: 'pdf_generation_failed' });\n  }\n});\n\n/**\n * PATCH /admin/invoices/:id/asignados",
    cae: 'SCRUM-1404g · X · la avería de verdad (emisor sin nombre) sigue en 500' },
  { fichero: 'src/modules/invoicing/domain/reintentoSellado.ts',
    de: 'export const REINTENTO_ACTIVO_DESDE: string | null = null;',
    a: "export const REINTENTO_ACTIVO_DESDE: string | null = '2026-10-27T00:00:00Z';",
    cae: 'SCRUM-1404g · hermano del guard de J5: con la fecha escrita, su todo ya no puede seguir puesto' },
];
