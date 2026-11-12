// tests/scrum1650b-la-sugerencia-del-firmante-sale-de-lo-congelado.test.mjs — SCRUM-1650 (tramo b)
//
// 🔴 EL NOMBRE QUE SE LE PROPONE FIRMAR AL CLIENTE SALÍA DE LA FICHA DE HOY, NO DEL ALBARÁN.
//
// Un albarán congela al cliente al emitirse (`albaranEmision.ts`, SCRUM-729): `customerName` es lo
// que quedó escrito. Tres lectores lo ignoraban y leían la ficha VIVA, y los tres alimentan la
// SUGERENCIA del firmante (SCRUM-300), que acaba sellada en «Firmado por»:
//
//   #2 · `GET /admin/albaranes/:id` → `customer.name` → firma presencial (`albaranDetailView.js`)
//   #3 · `GET /albaran/:token` (página pública) → saludo + `firmanteCamposHtml` (campo precargado)
//   #4 · `construirPaquetePrecarga` → `clienteNombre` (firma sin conexión)
//
// O sea: editar la ficha después de emitir cambiaba lo que se proponía firmar, sin que nadie lo
// decidiera. GO del fundador del 10-nov-2026 (registro en docs/master/SCRUM-1650.md).
//
// ── LO QUE ESTE TEST NO DICE ──────────────────────────────────────────────────────────────
// No mira el PDF del albarán ni `invoices.csv` (STOP de SCRUM-1595), ni el WhatsApp del albarán.
// Tampoco mira el POST de la firma: el nombre sellado es el que MANDA el firmante; aquí se mira
// sólo lo que se le PROPONE.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Las rutas y el servicio REALES de `dist/`, con la base doblada. Los dobles PROYECTAN el `select`
// como Prisma: lo que el lector no pide no viaja. Sin eso, un lector que olvida pedir la columna
// congelada pasaría igual, y ése es justo el defecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reqDeSesion } from './_arnes-de-router.mjs';

const { prisma } = await import('../dist/core/db/prisma.js');
const routerDe = (m) => m.default?.default ?? m.default;
const albaranesRouter = routerDe(await import('../dist/modules/jobs/app/routes/albaranes.routes.js'));
const publicoRouter = routerDe(await import('../dist/modules/jobs/app/routes/albaranPublic.routes.js'));
const { construirPaquetePrecarga } = await import('../dist/modules/jobs/domain/precarga.service.js');

const MIO = 77; // no es el 1: el 1 es el demo
const DE_HOY = 'Nombre de Hoy';
const AL_EMITIR = 'Nombre al Emitir';
const TOKEN_CONGELADO = 'a'.repeat(32);
const TOKEN_ANTERIOR = 'b'.repeat(32);

/** Sólo viaja lo que el `select` pide, como en Prisma. */
function proyecta(fila, select) {
  if (!fila) return null;
  if (!select) return { ...fila };
  const sale = {};
  for (const [clave, pide] of Object.entries(select)) {
    if (!pide) continue;
    if (pide === true) sale[clave] = fila[clave];
    else sale[clave] = fila[clave] == null ? fila[clave] : proyecta(fila[clave], pide.select);
  }
  return sale;
}

const CLIENTE = { id: 1, merchantId: MIO, name: DE_HOY, legalName: null, phone: '34000001650', mobile: null }; // rango imposible (SCRUM-262)
const TRABAJO = { id: 10, merchantId: MIO, titulo: 'Baño', direccion: 'Calle Mayor 1', customerId: 1, quoteId: null,
  operarioId: null, assignedUserId: null, assignees: [], status: 'scheduled',
  scheduledAt: new Date('2026-11-10T09:00:00Z'), updatedAt: new Date('2026-11-10T08:00:00Z') };
const base = { merchantId: MIO, jobId: 10, estado: 'emitido', version: 1, fecha: new Date('2026-11-01T10:00:00Z'),
  createdAt: new Date('2026-11-01T10:00:00Z'), updatedAt: new Date('2026-11-01T10:00:00Z'),
  lineas: [], invoiceId: null, modoValoracion: 'SIN_VALORAR', ocultarPreciosEnDocumento: false,
  notas: null, fechaEntrega: null, lugarEntrega: null, enviadoParaFirmaAt: null, pdfUrl: null,
  customerLegalName: null, customerTaxId: null, customerEmail: null, customerPhone: null };
// Emitido: el cliente quedó escrito con el nombre de entonces; la ficha se renombró después.
const CONGELADO = { ...base, id: 101, numero: 'A-1', firmaToken: TOKEN_CONGELADO, customerName: AL_EMITIR };
// Anterior al escritor (columnas a NULL): la ficha de hoy es lo único que hay — excepción DECLARADA.
const ANTERIOR = { ...base, id: 102, numero: 'A-2', firmaToken: TOKEN_ANTERIOR, customerName: null };
const ALBARANES = [CONGELADO, ANTERIOR];

/** Sustituye métodos de `prisma` durante `fn` y los devuelve SIEMPRE. */
async function conDobles(dobles, fn) {
  const originales = [];
  for (const [modelo, metodos] of Object.entries(dobles)) {
    for (const [metodo, f] of Object.entries(metodos)) {
      originales.push([modelo, metodo, prisma[modelo][metodo]]);
      prisma[modelo][metodo] = f;
    }
  }
  try { return await fn(); } finally {
    for (const [modelo, metodo, f] of originales) prisma[modelo][metodo] = f;
  }
}

function manejador(router, ruta) {
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route.methods.get);
  assert.ok(capa, `🔴 CIEGO: no encuentro GET ${ruta} en el router`);
  return capa.route.stack[capa.route.stack.length - 1].handle;
}

// ── #3 · la página pública ──────────────────────────────────────────────────────────────────
async function paginaPublica(token) {
  let estado = 200; let cuerpo = '';
  const res = {
    status(c) { estado = c; return res; },
    setHeader() { return res; },
    send(b) { cuerpo = String(b); return res; },
  };
  await conDobles({
    albaran: { findUnique: async (a) => ALBARANES.find((f) => f.firmaToken === a.where.firmaToken) ?? null },
    merchant: { findUnique: async (a) => proyecta({ id: MIO, name: 'Fontanería QA', legalName: null, logoUrl: null, email: null, country: 'ES' }, a.select) },
    job: { findUnique: async (a) => proyecta(TRABAJO.id === a.where.id ? TRABAJO : null, a.select) },
    customer: { findUnique: async (a) => proyecta(CLIENTE.id === a.where.id ? CLIENTE : null, a.select) },
  }, () => manejador(publicoRouter, '/:token')({ params: { token }, headers: {} }, res));
  assert.equal(estado, 200, `🔴 la página pública contestó ${estado}`);
  const campo = cuerpo.match(/<input id="firmante-nombre"[^>]*value="([^"]*)"/);
  assert.ok(campo, '🔴 CIEGO: la página no lleva el campo del nombre del firmante');
  const saludo = cuerpo.match(/<h1\b[^>]*>Hola, ([^<]*) 👋/);
  assert.ok(saludo, '🔴 CIEGO: la página no lleva el saludo');
  return { sugerencia: campo[1], saludo: saludo[1] };
}

test('SCRUM-1650b · #3 página pública: el nombre propuesto al firmante es el que quedó ESCRITO al emitir', async () => {
  const { sugerencia, saludo } = await paginaPublica(TOKEN_CONGELADO);
  assert.equal(sugerencia, AL_EMITIR, '🔴 el campo «Firmado por» llega precargado con la ficha de HOY, no con el albarán');
  assert.equal(saludo, AL_EMITIR, '🔴 el saludo y la sugerencia dicen nombres distintos');
});

test('SCRUM-1650b · #3 página pública (control): un albarán anterior al escritor cae a la ficha', async () => {
  const { sugerencia } = await paginaPublica(TOKEN_ANTERIOR);
  assert.equal(sugerencia, DE_HOY);
});

// ── #2 · la ficha del albarán (firma presencial) ─────────────────────────────────────────────
async function fichaDelAlbaran(id) {
  let estado = 200; let cuerpo;
  const res = { status(c) { estado = c; return res; }, json(b) { cuerpo = b; return res; } };
  await conDobles({
    albaran: { findFirst: async (a) => ALBARANES.find((f) => f.id === a.where.id && f.merchantId === a.where.merchantId) ?? null },
    job: { findFirst: async (a) => proyecta(TRABAJO.id === a.where.id && a.where.merchantId === MIO ? TRABAJO : null, a.select) },
    customer: { findFirst: async (a) => proyecta(CLIENTE.id === a.where.id && a.where.merchantId === MIO ? CLIENTE : null, a.select) },
    quote: { findFirst: async () => null },
    albaranLineaFacturada: { findMany: async () => [] },
    attachment: { count: async () => 0 },
  }, () => manejador(albaranesRouter, '/:id')(reqDeSesion({ rol: 'admin', merchantId: MIO, params: { id: String(id) }, query: {} }), res));
  assert.equal(estado, 200, `🔴 GET /:id contestó ${estado}: ${JSON.stringify(cuerpo)}`);
  return cuerpo;
}

test('SCRUM-1650b · #2 ficha del albarán: `customer.name` (sugerencia de la firma presencial) es el del documento', async () => {
  const cuerpo = await fichaDelAlbaran(101);
  assert.equal(cuerpo.customer.name, AL_EMITIR, '🔴 la ficha manda a la firma presencial el nombre de HOY');
  assert.equal(cuerpo.customer.id, 1, 'el enlace a la ficha del cliente sigue siendo el del cliente');
  assert.equal(cuerpo.customer.puedeRecibirWhatsApp, true, 'el canal se sigue decidiendo con la ficha de hoy (es a quién se escribe HOY)');
  assert.equal('customerName' in cuerpo, false, '🔴 la columna cruda viaja: el serializador es una lista blanca');
});

test('SCRUM-1650b · #2 ficha del albarán (control): anterior al escritor → la ficha', async () => {
  const cuerpo = await fichaDelAlbaran(102);
  assert.equal(cuerpo.customer.name, DE_HOY);
});

// ── #4 · la precarga del técnico (firma sin conexión) ───────────────────────────────────────
test('SCRUM-1650b · #4 precarga: `clienteNombre` es el del documento, y un anterior al escritor cae a la ficha', async () => {
  const cliente = {
    job: { findMany: async (a) => [proyecta(TRABAJO, a.select)] },
    albaran: { findMany: async (a) => ALBARANES.filter((f) => f.merchantId === a.where.merchantId).map((f) => proyecta(f, a.select)) },
    customer: { findMany: async (a) => [CLIENTE].filter((c) => c.merchantId === a.where.merchantId && a.where.id.in.includes(c.id)).map((c) => proyecta(c, a.select)) },
  };
  const paquete = await construirPaquetePrecarga(MIO, new Date('2026-11-10T10:00:00Z'), cliente);
  assert.equal(paquete.estado, 'LISTA', `🔴 la precarga no se pudo construir: ${paquete.motivo}`);
  const porId = Object.fromEntries(paquete.albaranes.map((a) => [a.id, a.clienteNombre]));
  assert.equal(Object.keys(porId).length, 2, 'población: los dos albaranes del banco');
  assert.equal(porId[101], AL_EMITIR, '🔴 la precarga propone al firmante el nombre de HOY, no el del albarán');
  assert.equal(porId[102], DE_HOY, 'control: anterior al escritor → la ficha');
});
