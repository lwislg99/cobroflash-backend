// tests/scrum1055c-senal-cobro-sin-fecha.test.mjs — SCRUM-1055c · la señal «cobro sin fecha declarada»
// en el libro de caja, SIN esquema: sale de `invoice_payments.fecha_origen = 'marcado'` (SCRUM-1732,
// decisión del fundador en c.21928 ③; corrección del alcance en SCRUM-1055 c.22874).
//
// ⚠️ SE MIDE POR LA RUTA (A10, SCRUM-1344): el manejador REAL de `GET /admin/libro-registro`, sacado de
// su router, con un cliente Prisma falso en memoria puesto en `global.prisma` ANTES de cargar la ruta
// (el patrón de `tests/scrum1232-libro-sin-justificantes.test.mjs`). Ninguna base. Hasta 1055c esa ruta
// no preguntaba el criterio del comercio, así que sus asientos nunca traían cobros y la señal no
// podía llegar al panel: la primera mutación de abajo devuelve la ruta a ese estado y tiene que caer.
//
// Qué fija:
//   · un cobro `marcado` → señal · `declarada` → sin señal · `aviso` → sin señal;
//   · una factura `paid` SIN filas (anterior a 1732) → sin señal, y contada en `cobrosSinFilas`;
//   · una anulación (que nace `marcado`, `cobrosDeFactura.ts`) no enciende la señal;
//   · el recuento del periodo, `cobrosSinFechaDeclarada`, cuenta los asientos con señal;
//   · CONTROL: sin criterio de caja declarado, el libro es el de siempre y no trae ni señal ni recuentos.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { reqDeSesion } from './_arnes-de-router.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La ruta deja de preguntar el criterio (el estado anterior a 1055c): sin cobros no hay señal.
    fichero: 'src/modules/invoicing/app/routes/libroRegistro.routes.ts',
    de: '      ...criterio,\n',
    a: '',
    cae: 'SCRUM-1055c · por la ruta: marcado lleva la señal; declarada, aviso, anulada y sin filas no',
  },
  {
    // La señal con `declarada` en vez de `marcado`.
    fichero: 'src/modules/invoicing/domain/libroRegistro.ts',
    de: "    const sinFechaDeclarada = cobros.some((c) => c.origen === 'marcado');",
    a: "    const sinFechaDeclarada = cobros.some((c) => c.origen === 'declarada');",
    cae: 'SCRUM-1055c · por la ruta: marcado lleva la señal; declarada, aviso, anulada y sin filas no',
  },
  {
    // El recuento del periodo a 0.
    fichero: 'src/modules/invoicing/domain/libroRegistro.ts',
    de: '    if (sinFechaDeclarada) cobrosSinFechaDeclarada += 1;',
    a: '',
    cae: 'SCRUM-1055c · por la ruta: el resumen cuenta 1 cobro sin fecha declarada y 1 factura cobrada sin filas',
  },
  {
    // El lector deja de dar entrada vacía a la factura de caja sin filas: no se podría contar.
    fichero: 'src/modules/invoicing/domain/libroRegistro.repo.ts',
    de: '  for (const id of ids) porFactura.set(id, []);',
    a: '',
    cae: 'SCRUM-1055c · por la ruta: el resumen cuenta 1 cobro sin fecha declarada y 1 factura cobrada sin filas',
  },
];

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(path.join(RAIZ, 'package.json'));

const M = 7;
const DIA = new Date('2026-02-10T10:00:00.000Z');
const COBRO = new Date('2026-03-02T10:00:00.000Z');

const factura = (id, number, status) => ({
  id, merchantId: M, number, createdAt: DIA, paidAt: status === 'paid' ? COBRO : null, type: 'F1',
  total: '121.00', currency: 'EUR', status, customerId: null, quoteId: null, chargeId: null,
  albaranRefs: null, lines: [{ concept: 'Trabajo', qty: 1, price: 100, tax: 0.21 }],
  // SCRUM-1730f · el congelado decide qué factura va por caja.
  merchantCriterioCaja: true, rectifiesId: null,
});
const fila = (id, invoiceId, fechaOrigen, extra = {}) => ({
  id, merchantId: M, invoiceId, chargeId: null, importe: '121.00', fechaCobro: COBRO, fechaOrigen,
  metodo: 'transferencia', tipo: 'cobro', anulaId: null, ...extra,
});

/** Cada factura está por un motivo, y el motivo va al lado. */
const FACTURAS = [
  factura(1, 'F-MARCADO', 'paid'),    // cobro apuntado a mano sin día: LA señal (el positivo)
  factura(2, 'F-DECLARADA', 'paid'),  // el usuario dijo el día: sin señal
  factura(3, 'F-AVISO', 'paid'),      // Stripe / Mercado Pago: su reloj es el cobro, sin señal
  factura(4, 'F-SIN-FILAS', 'paid'),  // `paid` anterior a 1732: no se afirma nada, se cuenta aparte
  factura(5, 'F-ANULADA', 'paid'),    // su cobro se anuló; la anulación nace `marcado` y no cuenta
  factura(6, 'F-PENDIENTE', 'pending'), // sin cobrar y sin filas: ni señal ni «sin filas»
];
const FILAS = [
  fila(101, 1, 'marcado'),
  fila(102, 2, 'declarada'),
  fila(103, 3, 'aviso'),
  fila(105, 5, 'declarada'),
  fila(106, 5, 'marcado', { tipo: 'anulacion', anulaId: 105 }),
];

/** El cliente falso: aplica los `where` que usa el libro (merchant, congelado de caja, ids). */
function clienteFalso() {
  const estado = { criterioCaja: true };
  return {
    estado,
    merchant: { findUnique: async () => ({ id: M, country: 'ES', criterioCaja: estado.criterioCaja }) },
    invoice: {
      findMany: async ({ where: w = {} }) => FACTURAS.filter((f) => f.merchantId === w.merchantId
        && (w.merchantCriterioCaja === undefined || f.merchantCriterioCaja === w.merchantCriterioCaja)
        && (!w.id?.in || w.id.in.includes(f.id))),
    },
    invoicePayment: {
      findMany: async ({ where: w = {} }) => FILAS.filter((p) => p.merchantId === w.merchantId
        && (!w.invoiceId?.in || w.invoiceId.in.includes(p.invoiceId))),
    },
    quote: { findMany: async () => [] },
    albaran: { findMany: async () => [] },
  };
}

const db = clienteFalso();
globalThis.prisma = db; // ANTES de cargar la ruta: `core/db/prisma` se queda con éste.
const rutaLibro = require('./dist/modules/invoicing/app/routes/libroRegistro.routes.js').default;
assert.equal(require('./dist/core/db/prisma.js').prisma, db,
  '🔴 el singleton de Prisma no es el cliente falso: la ruta estaría hablando con otra cosa.');

/** Llama al manejador REAL de `GET /` del router del libro, con una respuesta de mentira. */
async function llamar() {
  const capa = rutaLibro.stack.find((c) => c.route && c.route.path === '/' && c.route.methods.get);
  assert.ok(capa, '🔴 el router no tiene GET /: el test no está midiendo la ruta.');
  const res = {
    statusCode: 200, cuerpo: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.cuerpo = b; return this; },
  };
  await capa.route.stack[0].handle(reqDeSesion({ rol: 'admin', merchantId: M, query: {} }), res,
    (e) => { throw e ?? new Error('next'); });
  assert.equal(res.statusCode, 200, `🔴 la ruta no ha contestado 200: ${JSON.stringify(res.cuerpo)}`);
  return res.cuerpo;
}

const senal = (libro) => Object.fromEntries(libro.asientos.map((a) => [a.numero, a.cobroSinFechaDeclarada]));

test('SCRUM-1055c · por la ruta: marcado lleva la señal; declarada, aviso, anulada y sin filas no', async () => {
  db.estado.criterioCaja = true;
  const libro = await llamar();
  assert.equal(libro.asientos.length, FACTURAS.length, '🔴 el libro ha perdido o ganado asientos');
  assert.deepEqual(senal(libro), {
    'F-MARCADO': true,
    'F-DECLARADA': false,
    'F-AVISO': false,
    'F-SIN-FILAS': false,
    'F-ANULADA': false,
    'F-PENDIENTE': false,
  }, '🔴 la señal «cobro sin fecha declarada» no sale de `fecha_origen = marcado` de los cobros vivos');
});

test('SCRUM-1055c · por la ruta: el resumen cuenta 1 cobro sin fecha declarada y 1 factura cobrada sin filas', async () => {
  db.estado.criterioCaja = true;
  const libro = await llamar();
  assert.equal(libro.cobrosSinFechaDeclarada, 1,
    '🔴 el recuento del periodo no es el número de asientos con la señal');
  assert.equal(libro.cobrosSinFilas, 1,
    '🔴 la factura `paid` sin filas en invoice_payments (anterior a 1732) no se ha contado aparte; '
    + 'la pendiente sin filas no cuenta');
});

test('SCRUM-1055c · CONTROL: sin criterio de caja declarado, el libro de siempre, sin señal ni recuentos', async () => {
  db.estado.criterioCaja = null;
  try {
    const libro = await llamar();
    assert.equal(libro.asientos.length, FACTURAS.length);
    assert.ok(libro.asientos.every((a) => a.cobroSinFechaDeclarada === undefined && a.cobros.length === 0),
      '🔴 sin criterio declarado el libro no debe traer cobros ni señal: no se afirma una declaración que nadie hizo');
    assert.equal(libro.cobrosSinFechaDeclarada, undefined);
    assert.equal(libro.cobrosSinFilas, undefined);
  } finally {
    db.estado.criterioCaja = true;
  }
});
