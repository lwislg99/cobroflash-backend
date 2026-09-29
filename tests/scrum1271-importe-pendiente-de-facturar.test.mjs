// tests/scrum1271-importe-pendiente-de-facturar.test.mjs — SCRUM-1271 (mitad de servidor)
//
// 🔴 TRAS UNA FACTURACIÓN PARCIAL, EL TRABAJO DECÍA QUE QUEDABA POR FACTURAR EL ALBARÁN ENTERO.
//
// `facturar-parcial` escribe el libro `AlbaranLineaFacturada` y NO pone `Albaran.invoiceId`; la
// ficha sumaba `totales.total` de todo albarán sin `invoiceId`. Ahora el detalle del Trabajo manda,
// por albarán, `importePendienteDeFacturar`, derivado del MISMO libro.
//
// Se entra por la RUTA de verdad (`GET /admin/jobs/:id`), con la base doblada por
// `_envio-doblado.mjs`, y el libro con la forma que escribe `facturar-parcial` (albaranId,
// lineaIndex, cantidad, invoiceId). ⛔ Sin red ni base.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';

const RUTAS = '../dist/modules/jobs/app/routes/jobs.routes.js';
const { calcAlbaranTotales } = await import('../dist/modules/jobs/domain/albaran.service.js');
const copia = (x) => JSON.parse(JSON.stringify(x));

const JOB_ID = 12710;
// 1.000 € de total: 10 h × 50 € (base 500, IVA 21 % = 105) + 1 ud × 395 € (IVA 0 %) = 1.000,00 €.
const LINEAS = [
  { concepto: 'Mano de obra', cantidad: 10, unidad: 'h', precioUnitario: 50, tipoIva: 21 },
  { concepto: 'Material exento', cantidad: 1, unidad: 'ud', precioUnitario: 395, tipoIva: 0 },
];

function albaran({ id = 1, modoValoracion = 'VALORADO', invoiceId = null, lineas = LINEAS } = {}) {
  return {
    id, merchantId: MERCHANT, jobId: JOB_ID, numero: `ALB-2026-${id}`, fecha: new Date('2026-09-20T08:00:00Z'),
    modoValoracion, lineas: copia(lineas), estado: 'firmado', version: 1, invoiceId,
    firmadoAt: new Date('2026-09-20T10:00:00Z'), createdAt: new Date('2026-09-20T08:00:00Z'),
    updatedAt: new Date('2026-09-20T10:00:00Z'),
  };
}

function manejador(router, ruta) {
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods.get);
  assert.ok(capa, `🔴 CIEGO: no encuentro GET ${ruta} en el router de trabajos`);
  const pila = capa.route.stack;
  return pila[pila.length - 1].handle;
}

/** El detalle del Trabajo, por la ruta, con estos albaranes y este libro de líneas facturadas. */
async function detalle(albaranes, libro) {
  inyectarBase({
    'job.findFirst': ({ where }) => (where.id === JOB_ID && where.merchantId === MERCHANT
      ? { id: JOB_ID, merchantId: MERCHANT, quoteId: null, customerId: null, operarioId: null, status: 'en_curso', createdAt: new Date('2026-09-19T08:00:00Z'), updatedAt: new Date('2026-09-19T08:00:00Z') }
      : null),
    'albaran.findMany': ({ where }) => (where.jobId === JOB_ID && where.merchantId === MERCHANT ? copia(albaranes) : []),
    'albaranLineaFacturada.findMany': ({ where }) => (where.merchantId === MERCHANT
      ? libro.filter((f) => where.albaranId.in.includes(f.albaranId)) : []),
  }, [RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const r = { status: 200, data: undefined };
  const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; } };
  await manejador(router, '/:id')({ params: { id: String(JOB_ID) }, merchantId: MERCHANT, userRole: 'admin' }, res);
  assert.equal(r.status, 200, `🔴 CIEGO: el detalle no responde (${r.status}) ${JSON.stringify(r.data)}`);
  assert.ok(Array.isArray(r.data.albaranes) && r.data.albaranes.length === albaranes.length,
    '🔴 CIEGO: el detalle no trae los albaranes del Trabajo');
  return r.data;
}

test('SCRUM-1271 · SUELO: el fixture es un albarán de 1.000,00 € de total', () => {
  assert.equal(calcAlbaranTotales(LINEAS).total, 1000);
});

test('SCRUM-1271 · control: sin ninguna parcial, lo pendiente es EXACTAMENTE el total del albarán', async () => {
  const d = await detalle([albaran()], []);
  const a = d.albaranes[0];
  assert.equal(a.estadoFacturacion, 'sin_facturar');
  assert.equal(a.importePendienteDeFacturar, a.totales.total);
  assert.equal(a.importePendienteDeFacturar, 1000);
});

test('🔴 SCRUM-1271 · tras una PARCIAL de 637 €, quedan 363 € — no el albarán entero', async () => {
  // La parcial se lleva 4 h de mano de obra (200 + 42 IVA = 242) y el material (395): 637 €.
  // Queda: 6 h × 50 = 300 + 63 IVA = 363 €. Se construye con el libro, como lo escribe la ruta.
  const libro = [
    { albaranId: 1, lineaIndex: 0, cantidad: '4', invoiceId: 901 },
    { albaranId: 1, lineaIndex: 1, cantidad: '1', invoiceId: 901 },
  ];
  const d = await detalle([albaran()], libro);
  const a = d.albaranes[0];
  assert.equal(a.facturado, false, 'SUELO: la parcial no pone invoiceId (el defecto de partida)');
  assert.equal(a.estadoFacturacion, 'parcial');
  assert.equal(a.importePendienteDeFacturar, 363,
    '🔴 lo pendiente no descuenta lo ya facturado en parciales: la ficha pediría facturar dinero ya facturado');
});

test('🔴 SCRUM-1271 · todo facturado en parciales → 0 pendiente (el hueco no debe salir)', async () => {
  const libro = [
    { albaranId: 1, lineaIndex: 0, cantidad: '6', invoiceId: 901 },
    { albaranId: 1, lineaIndex: 0, cantidad: '4', invoiceId: 902 },
    { albaranId: 1, lineaIndex: 1, cantidad: '1', invoiceId: 902 },
  ];
  const a = (await detalle([albaran()], libro)).albaranes[0];
  assert.equal(a.estadoFacturacion, 'facturado');
  assert.equal(a.importePendienteDeFacturar, 0);
});

test('SCRUM-1271 · facturado ENTERO por la vía de siempre (invoiceId) → 0; SIN_VALORAR → null', async () => {
  const d = await detalle([albaran({ id: 1, invoiceId: 77 }), albaran({ id: 2, modoValoracion: 'SIN_VALORAR' })], []);
  assert.equal(d.albaranes[0].importePendienteDeFacturar, 0);
  assert.equal(d.albaranes[1].importePendienteDeFacturar, null, 'sin precio no hay importe: null, no 0');
});
