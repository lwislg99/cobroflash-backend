// tests/scrum1055f-senal-en-303-y-evidencias.test.mjs — SCRUM-1055f · el recuento de cobros sin fecha
// declarada (y el de facturas cobradas sin filas) en la SALIDA del borrador del 303 y del paquete de
// evidencias. 1055c los puso en el libro; los dos lectores los recibían y los perdían al construir su
// salida (`construirModelo303` y el `resumen` del paquete enumeran sus campos).
//
// ⚠️ SE MIDE POR LA RUTA (A10, SCRUM-1344): los manejadores REALES de `GET /admin/modelo-303` y
// `GET /admin/evidencias.zip`, sacados de su router, con un cliente Prisma falso en memoria puesto en
// `global.prisma` ANTES de cargar las rutas (el patrón de `tests/scrum1055c-senal-cobro-sin-fecha.test.mjs`).
// El ZIP se abre con el lector de `tests/scrum1251b-el-zip-dice-cuantas-facturas.test.mjs` y se lee su
// `manifiesto.json`, que es lo que recibe el asesor. Ninguna base. Ningún texto nuevo: son dos números.
//
// Qué fija:
//   · un periodo con un cobro `marcado` y una `paid` sin filas → el 303 y el manifiesto dicen 1 y 1;
//   · el mismo periodo con `declarada` y `aviso` (y sin la de sin filas) → 0 y 0;
//   · CONTROL: sin criterio de caja declarado, ninguna de las dos salidas trae los campos.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import zlib from 'node:zlib';
import { PassThrough } from 'node:stream';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { reqDeSesion } from './_arnes-de-router.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El 303 deja de sacar el recuento a su salida (el estado anterior a 1055f).
    fichero: 'src/modules/fiscal/modelo303/modelo303.ts',
    de: '    ...(params.libro.cobrosSinFechaDeclarada !== undefined ? { cobrosSinFechaDeclarada: params.libro.cobrosSinFechaDeclarada } : {}),\n',
    a: '',
    cae: 'SCRUM-1055f · por las rutas: un cobro marcado → el 303 y el manifiesto dicen 1',
  },
  {
    // El 303 deja de sacar las facturas cobradas sin filas.
    fichero: 'src/modules/fiscal/modelo303/modelo303.ts',
    de: '    ...(params.libro.cobrosSinFilas !== undefined ? { cobrosSinFilas: params.libro.cobrosSinFilas } : {}),\n',
    a: '',
    cae: 'SCRUM-1055f · por las rutas: un cobro marcado → el 303 y el manifiesto dicen 1',
  },
  {
    // El `resumen` del paquete (y con él `manifiesto.json`) deja de llevar el recuento.
    fichero: 'src/modules/fiscal/evidencias/paquete.ts',
    de: '    ...(params.libro.cobrosSinFechaDeclarada !== undefined ? { cobrosSinFechaDeclarada: params.libro.cobrosSinFechaDeclarada } : {}),\n',
    a: '',
    cae: 'SCRUM-1055f · por las rutas: un cobro marcado → el 303 y el manifiesto dicen 1',
  },
  {
    // El `resumen` del paquete deja de llevar las facturas cobradas sin filas.
    fichero: 'src/modules/fiscal/evidencias/paquete.ts',
    de: '    ...(params.libro.cobrosSinFilas !== undefined ? { cobrosSinFilas: params.libro.cobrosSinFilas } : {}),\n',
    a: '',
    cae: 'SCRUM-1055f · por las rutas: un cobro marcado → el 303 y el manifiesto dicen 1',
  },
];

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(path.join(RAIZ, 'package.json'));

const M = 7;
const DIA = new Date('2026-02-10T10:00:00.000Z');   // emitidas en el T1-2026
const COBRO = new Date('2026-03-02T10:00:00.000Z'); // cobradas en el T1-2026
const PERIODO = { year: '2026', quarter: '1' };

const factura = (id, number, status) => ({
  id, merchantId: M, number, createdAt: DIA, paidAt: status === 'paid' ? COBRO : null, type: 'F1',
  total: '121.00', currency: 'EUR', status, customerId: null, quoteId: null, chargeId: null,
  albaranRefs: null, lines: [{ concept: 'Trabajo', qty: 1, price: 100, tax: 0.21 }],
  merchantCriterioCaja: true, rectifiesId: null,
});
const fila = (id, invoiceId, fechaOrigen) => ({
  id, merchantId: M, invoiceId, chargeId: null, importe: '121.00', fechaCobro: COBRO, fechaOrigen,
  metodo: 'transferencia', tipo: 'cobro', anulaId: null,
});

/** Cada muestra está por un motivo, y el motivo va al lado. */
const MUESTRAS = {
  // EL POSITIVO: un cobro apuntado a mano sin día, y una `paid` anterior a 1732 sin filas.
  conMarcado: {
    facturas: [factura(1, 'F-MARCADO', 'paid'), factura(2, 'F-DECLARADA', 'paid'), factura(4, 'F-SIN-FILAS', 'paid')],
    filas: [fila(101, 1, 'marcado'), fila(102, 2, 'declarada')],
  },
  // EL CERO: el usuario dijo el día, o lo dijo el aviso de Stripe / Mercado Pago.
  sinMarcado: {
    facturas: [factura(2, 'F-DECLARADA', 'paid'), factura(3, 'F-AVISO', 'paid')],
    filas: [fila(102, 2, 'declarada'), fila(103, 3, 'aviso')],
  },
};

/** El cliente falso: aplica los `where` que usan el libro y los dos lectores (merchant, congelado de caja, ids). */
const estado = { criterioCaja: true, muestra: MUESTRAS.conMarcado };
const db = {
  merchant: {
    findUnique: async () => ({
      id: M, country: 'ES', criterioCaja: estado.criterioCaja, timezone: 'Europe/Madrid',
      name: 'Muestra', legalName: null, taxId: null,
    }),
  },
  invoice: {
    findMany: async ({ where: w = {} }) => estado.muestra.facturas.filter((f) => f.merchantId === w.merchantId
      && (w.merchantCriterioCaja === undefined || f.merchantCriterioCaja === w.merchantCriterioCaja)
      && (!w.id?.in || w.id.in.includes(f.id))),
  },
  invoicePayment: {
    findMany: async ({ where: w = {} }) => estado.muestra.filas.filter((p) => p.merchantId === w.merchantId
      && (!w.invoiceId?.in || w.invoiceId.in.includes(p.invoiceId))),
  },
  quote: { findMany: async () => [] },
  albaran: { findMany: async () => [] },
  expense: { findMany: async () => [] },
  job: { findMany: async () => [] },
  customer: { findMany: async () => [] },
};
globalThis.prisma = db; // ANTES de cargar las rutas: `core/db/prisma` se queda con éste.
const ruta303 = require('./dist/modules/fiscal/modelo303/modelo303.routes.js').default;
const rutaEvidencias = require('./dist/modules/fiscal/evidencias/evidencias.routes.js').default;
assert.equal(require('./dist/core/db/prisma.js').prisma, db,
  '🔴 el singleton de Prisma no es el cliente falso: las rutas estarían hablando con otra cosa.');

const getDe = (router, nombre) => {
  const capa = router.stack.find((c) => c.route && c.route.path === '/' && c.route.methods.get);
  assert.ok(capa, `🔴 el router de ${nombre} no tiene GET /: el test no está midiendo la ruta.`);
  return capa.route.stack[0].handle;
};

/** `GET /admin/modelo-303` con el manejador REAL. */
async function pedir303() {
  const res = {
    statusCode: 200, cuerpo: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.cuerpo = b; return this; },
  };
  await getDe(ruta303, 'el 303')(reqDeSesion({ rol: 'admin', merchantId: M, query: PERIODO }), res,
    (e) => { throw e ?? new Error('next'); });
  assert.equal(res.statusCode, 200, `🔴 el 303 no ha contestado 200: ${JSON.stringify(res.cuerpo)}`);
  return res.cuerpo;
}

/** El lector de ZIP de `scrum1251b` (directorio central: el ZIP en flujo no lleva tamaños en la cabecera local). */
function abrirZip(buf) {
  let fin = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  assert.ok(fin >= 0, `suelo: no es un ZIP (sin fin de directorio central), ${buf.length} B`);
  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const salida = [];
  for (let n = 0; n < total; n++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'suelo: entrada del directorio central ilegible');
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const lNombre = buf.readUInt16LE(p + 28);
    const lExtra = buf.readUInt16LE(p + 30);
    const lComent = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + lNombre);
    const datos = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const crudo = buf.subarray(datos, datos + comprimido);
    salida.push({ nombre, contenido: metodo === 8 ? zlib.inflateRawSync(crudo) : Buffer.from(crudo) });
    p += 46 + lNombre + lExtra + lComent;
  }
  return salida;
}

/** `GET /admin/evidencias.zip` con el manejador REAL; devuelve el `manifiesto.json` del ZIP. */
async function pedirManifiesto() {
  const res = new PassThrough();
  const trozos = [];
  res.on('data', (t) => trozos.push(t));
  const terminado = new Promise((ok, mal) => { res.on('end', ok); res.on('error', mal); });
  res.statusCode = 200;
  res.headersSent = false;
  res.setHeader = () => {};
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.cuerpo = b; res.end(); return res; };
  await getDe(rutaEvidencias, 'las evidencias')(reqDeSesion({ rol: 'admin', merchantId: M, query: PERIODO }), res,
    (e) => { throw e ?? new Error('next'); });
  await terminado;
  assert.equal(res.statusCode, 200, `🔴 las evidencias no han contestado 200: ${JSON.stringify(res.cuerpo)}`);
  const manifiesto = abrirZip(Buffer.concat(trozos)).find((f) => f.nombre === 'manifiesto.json');
  assert.ok(manifiesto, '🔴 el ZIP no lleva manifiesto.json: el test no está midiendo lo que recibe el asesor.');
  return JSON.parse(manifiesto.contenido.toString('utf8'));
}

const recuentos = (o) => ({ cobrosSinFechaDeclarada: o.cobrosSinFechaDeclarada, cobrosSinFilas: o.cobrosSinFilas });

test('SCRUM-1055f · por las rutas: un cobro marcado → el 303 y el manifiesto dicen 1', async () => {
  estado.criterioCaja = true;
  estado.muestra = MUESTRAS.conMarcado;
  const m303 = await pedir303();
  assert.ok(m303.asientos >= 3, `🔴 el 303 no ha visto las tres facturas de la muestra (asientos=${m303.asientos}): no mide nada`);
  assert.deepEqual(recuentos(m303), { cobrosSinFechaDeclarada: 1, cobrosSinFilas: 1 },
    '🔴 el borrador del 303 pierde los recuentos del libro de caja: no viajan con el dato');
  const manifiesto = await pedirManifiesto();
  assert.ok(manifiesto.resumen.asientos >= 3, `🔴 el paquete no ha visto las tres facturas (asientos=${manifiesto.resumen.asientos})`);
  assert.deepEqual(recuentos(manifiesto.resumen), { cobrosSinFechaDeclarada: 1, cobrosSinFilas: 1 },
    '🔴 el manifiesto.json del paquete de evidencias pierde los recuentos del libro de caja');
});

test('SCRUM-1055f · por las rutas: con declarada y aviso, el 303 y el manifiesto dicen 0', async () => {
  estado.criterioCaja = true;
  estado.muestra = MUESTRAS.sinMarcado;
  try {
    const m303 = await pedir303();
    assert.ok(m303.asientos >= 2, `🔴 el 303 no ha visto la muestra (asientos=${m303.asientos})`);
    assert.deepEqual(recuentos(m303), { cobrosSinFechaDeclarada: 0, cobrosSinFilas: 0 },
      '🔴 el 303 cuenta como «sin fecha declarada» un cobro con día declarado o con aviso');
    const manifiesto = await pedirManifiesto();
    assert.deepEqual(recuentos(manifiesto.resumen), { cobrosSinFechaDeclarada: 0, cobrosSinFilas: 0 },
      '🔴 el manifiesto cuenta como «sin fecha declarada» un cobro con día declarado o con aviso');
  } finally {
    estado.muestra = MUESTRAS.conMarcado;
  }
});

test('SCRUM-1055f · CONTROL: sin criterio de caja declarado, ni el 303 ni el manifiesto traen los campos', async () => {
  estado.criterioCaja = null;
  estado.muestra = MUESTRAS.conMarcado;
  try {
    const m303 = await pedir303();
    assert.ok(m303.asientos >= 3, `🔴 el 303 no ha visto la muestra (asientos=${m303.asientos})`);
    assert.deepEqual(recuentos(m303), { cobrosSinFechaDeclarada: undefined, cobrosSinFilas: undefined },
      '🔴 sin criterio declarado el 303 no debe afirmar recuentos de caja');
    const manifiesto = await pedirManifiesto();
    assert.deepEqual(recuentos(manifiesto.resumen), { cobrosSinFechaDeclarada: undefined, cobrosSinFilas: undefined },
      '🔴 sin criterio declarado el manifiesto no debe afirmar recuentos de caja');
  } finally {
    estado.criterioCaja = true;
  }
});
