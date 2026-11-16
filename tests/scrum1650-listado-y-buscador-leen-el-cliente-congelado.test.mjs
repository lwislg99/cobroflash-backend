// tests/scrum1650-listado-y-buscador-leen-el-cliente-congelado.test.mjs — SCRUM-1650
//
// 🔴 EL LISTADO DE ALBARANES Y EL BUSCADOR PINTABAN EL CLIENTE DE HOY, NO EL DEL DOCUMENTO.
//
// Un albarán y una factura congelan al cliente al emitirse (`albaranEmision.ts`, SCRUM-729): sus
// columnas `customerName`/`customerLegalName` son lo que quedó escrito. El listado de
// `GET /admin/albaranes` ni las pedía (leía la ficha viva) y el buscador `GET /admin/search`
// tampoco, para las facturas. Renombrar a un cliente reescribía en pantalla documentos ya emitidos.
// Medido en SCRUM-1595 c.21337 (sitios 1 y 7 de aquella tabla).
//
// ── LO QUE ESTE TEST NO DICE ──────────────────────────────────────────────────────────────
// No mira la ficha del albarán (`GET /admin/albaranes/:id`), la página pública ni la precarga del
// técnico: los tres alimentan el NOMBRE SUGERIDO DEL FIRMANTE, que acaba sellado, y el ticket manda
// parar ahí (regla 40). Tampoco el PDF ni `invoices.csv` (STOP, SCRUM-1595).
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Las rutas REALES de `dist/` con los `findMany` doblados. El doble PROYECTA el `select` como
// Prisma: lo que la ruta no pide no viaja. Sin eso, un lector que olvida pedir las columnas
// congeladas pasaría igual — y ése es justo el defecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reqDeSesion } from './_arnes-de-router.mjs';

const { prisma } = await import('../dist/core/db/prisma.js');
const routerDe = (m) => m.default?.default ?? m.default;
const albaranesRouter = routerDe(await import('../dist/modules/jobs/app/routes/albaranes.routes.js'));
const searchRouter = routerDe(await import('../dist/modules/search/app/routes/search.routes.js'));

const MIO = 77; // no es el 1: el 1 es el demo

/** Sólo viaja lo que el `select` pide, como en Prisma. */
function proyecta(fila, select) {
  if (!select) return { ...fila };
  const sale = {};
  for (const [clave, pide] of Object.entries(select)) {
    if (!pide) continue;
    if (pide === true) sale[clave] = fila[clave];
    else sale[clave] = fila[clave] == null ? fila[clave] : proyecta(fila[clave], pide.select);
  }
  return sale;
}

const CLIENTES = [
  { id: 1, merchantId: MIO, name: 'Nombre de Hoy',  legalName: 'Razón de Hoy SL' },
  { id: 2, merchantId: MIO, name: 'Pepe Nuevo',     legalName: 'Pepe Nuevo SL' },
  { id: 3, merchantId: MIO, name: 'Ana Hoy',        legalName: null },
];
const TRABAJOS = [
  { id: 10, merchantId: MIO, titulo: 'Baño',   customerId: 1, quoteId: null },
  { id: 20, merchantId: MIO, titulo: 'Cocina', customerId: 2, quoteId: null },
  { id: 30, merchantId: MIO, titulo: 'Patio',  customerId: 3, quoteId: null },
];
const base = { merchantId: MIO, fecha: new Date('2026-10-01T10:00:00Z'), createdAt: new Date('2026-10-01T10:00:00Z'),
  lineas: [], invoiceId: null, modoValoracion: 'SIN_VALORAR' };
const ALBARANES = [
  // Emitido con razón social: la congelada manda sobre la de hoy.
  { ...base, id: 101, jobId: 10, numero: 'A-1', estado: 'firmado', customerName: 'Fontanería Antigua', customerLegalName: 'Antigua Razón SL' },
  // Emitido SIN razón social: la de hoy NO se cuela por el hueco (el congelado es el conjunto, no campo a campo).
  { ...base, id: 102, jobId: 20, numero: 'A-2', estado: 'emitido', customerName: 'Pepe Viejo', customerLegalName: null },
  // Borrador: aún no se ha congelado nada → la ficha de hoy, que es lo único que hay.
  { ...base, id: 103, jobId: 30, numero: 'A-3', estado: 'borrador', customerName: null, customerLegalName: null },
];

/** Llama al último manejador de `GET <ruta>` con la base doblada. */
async function llamar(router, ruta, req, dobles) {
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route.methods.get);
  assert.ok(capa, `🔴 CIEGO: no encuentro GET ${ruta} en el router`);
  const originales = Object.keys(dobles).map((k) => [k, prisma[k].findMany]);
  for (const [modelo, fn] of Object.entries(dobles)) prisma[modelo].findMany = fn;
  let estado = 200;
  let cuerpo;
  const res = { status(c) { estado = c; return res; }, json(b) { cuerpo = b; return res; } };
  try {
    await capa.route.stack[capa.route.stack.length - 1].handle(req, res);
  } finally {
    for (const [modelo, fn] of originales) prisma[modelo].findMany = fn;
  }
  assert.equal(estado, 200, `🔴 GET ${ruta} contestó ${estado}: ${JSON.stringify(cuerpo)}`);
  return cuerpo;
}

const doblesDelListado = {
  albaran: async (a) => ALBARANES.filter((f) => f.merchantId === a.where.merchantId).map((f) => proyecta(f, a.select)),
  job: async (a) => TRABAJOS.filter((f) => f.merchantId === a.where.merchantId).map((f) => proyecta(f, a.select)),
  customer: async (a) => CLIENTES.filter((f) => f.merchantId === a.where.merchantId && a.where.id.in.includes(f.id)).map((f) => proyecta(f, a.select)),
  albaranLineaFacturada: async () => [],
};

/** El listado como lo ve ESE rol: el admin pasa por un lector y el técnico por el otro (acotado). */
async function comprobarListado(rol) {
  const req = reqDeSesion({ rol, merchantId: MIO, teamMemberId: rol === 'tecnico' ? 5 : null, query: {} });
  const { filas } = await llamar(albaranesRouter, '/', req, doblesDelListado);
  const cliente = Object.fromEntries(filas.map((f) => [f.id, f.cliente]));
  assert.equal(Object.keys(cliente).length, 3, 'población: los tres albaranes del banco');
  assert.equal(cliente[101], 'Antigua Razón SL', '🔴 el albarán emitido enseña la razón social de HOY, no la que lleva escrita');
  assert.equal(cliente[102], 'Pepe Viejo', '🔴 sin razón social congelada, se ha colado la de la ficha de hoy');
  assert.equal(cliente[103], 'Ana Hoy', 'control: un borrador no ha congelado nada y cae a la ficha');
}

test('SCRUM-1650 · listado de albaranes (admin): cada fila lleva el cliente que quedó ESCRITO al emitir', () => comprobarListado('admin'));
test('SCRUM-1650 · listado de albaranes (técnico, lector acotado): cada fila lleva el cliente que quedó ESCRITO al emitir', () => comprobarListado('tecnico'));

test('SCRUM-1650 · buscador: la factura se enseña con el cliente de su emisión, y la forma de la respuesta no cambia', async () => {
  const FACTURAS = [
    { id: 1, merchantId: MIO, number: 'F-1', status: 'issued', total: 121, currency: 'EUR', createdAt: new Date('2026-10-02T10:00:00Z'),
      customerName: 'Nombre al Emitir', customer: { name: 'Nombre de Hoy' } },
    { id: 2, merchantId: MIO, number: 'F-2', status: 'issued', total: 50, currency: 'EUR', createdAt: new Date('2026-10-03T10:00:00Z'),
      customerName: null, customer: { name: 'Anterior al Escritor' } },
  ];
  const req = reqDeSesion({ rol: 'admin', merchantId: MIO, query: { q: 'nombre' } });
  const cuerpo = await llamar(searchRouter, '/', req, {
    customer: async () => [],
    quote: async () => [],
    invoice: async (a) => FACTURAS.filter((f) => f.merchantId === a.where.merchantId).map((f) => proyecta(f, a.select)),
  });
  const porId = Object.fromEntries(cuerpo.invoices.map((f) => [f.id, f]));
  assert.equal(porId[1].customer.name, 'Nombre al Emitir', '🔴 el buscador pinta el nombre de HOY de una factura ya emitida');
  assert.equal(porId[2].customer.name, 'Anterior al Escritor', 'control: factura anterior al escritor → la ficha');
  assert.deepEqual(Object.keys(porId[1]).sort(), ['createdAt', 'currency', 'customer', 'id', 'number', 'status', 'total'],
    '🔴 la columna cruda viaja o falta un campo: la pantalla (S2) lee la forma de siempre');
});
