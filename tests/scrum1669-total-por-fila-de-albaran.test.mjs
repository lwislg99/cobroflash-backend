// SCRUM-1669 (PILOTO-1) · la fila de GET /admin/albaranes trae su TOTAL.
//
// Corte de SCRUM-1669 c.21433: `listarAlbaranesDelMerchant` (albaranesListado.ts) no devolvía importe,
// y la tabla no podía enseñar cuánto vale cada albarán. Regla, la MISMA del detalle
// (`albaran.service.ts`: `totales: modoValoracion === 'VALORADO' ? calcAlbaranTotales(lineas) : null`):
// número para un VALORADO, `null` para un SIN_VALORAR — no un 0, que diría «vale cero» de algo que
// sólo no tiene precios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listarAlbaranesDelMerchant } from '../dist/modules/jobs/domain/albaranesListado.js';
import { calcAlbaranTotales } from '../dist/modules/jobs/domain/albaran.service.js';

const M = 1669;
const LINEAS_VALORADAS = [
  { concepto: 'Hora de oficial', cantidad: 2, unidad: 'h', precioUnitario: 30, tipoIva: 21 },
  { concepto: 'Tubo', cantidad: 3, unidad: 'ud', precioUnitario: 4.15, tipoIva: 10 },
];
const albaran = (id, modoValoracion, lineas) => ({
  id, merchantId: M, jobId: 10, numero: `ALB-${id}`, fecha: '2026-11-10', createdAt: '2026-11-10',
  estado: 'firmado', lineas, invoiceId: null, modoValoracion, customerName: null, customerLegalName: null,
});
const lector = (albaranes) => ({
  albaranes: async () => albaranes,
  jobs: async () => [{ id: 10, titulo: null, customerId: 7, quoteId: null }],
  customers: async () => [{ id: 7, name: 'María López', legalName: null }],
  libro: async () => [],
});

test('SCRUM-1669 · SUELO: el listado de verdad devuelve los dos albaranes sembrados', async () => {
  const { filas } = await listarAlbaranesDelMerchant(M, lector([albaran(1, 'VALORADO', LINEAS_VALORADAS), albaran(2, 'SIN_VALORAR', [])]));
  assert.equal(filas.length, 2, '🔴 SUELO: el listado no devolvió los albaranes sembrados');
});

test('SCRUM-1669 · 🔴 un albarán VALORADO trae su total, el MISMO número que el detalle', async () => {
  const { filas } = await listarAlbaranesDelMerchant(M, lector([albaran(1, 'VALORADO', LINEAS_VALORADAS)]));
  const esperado = calcAlbaranTotales(LINEAS_VALORADAS).total;
  assert.equal(esperado, 86.3, 'CONTROL: 60 + 12,60 de IVA + 12,45 + 1,25 de IVA');
  assert.equal(filas[0].total, esperado, `🔴 la fila trae total=${JSON.stringify(filas[0].total)}`);
});

test('SCRUM-1669 · 🔴 un albarán SIN_VALORAR trae `null`, no 0 (no tiene precios; no vale cero)', async () => {
  const { filas } = await listarAlbaranesDelMerchant(M, lector([albaran(2, 'SIN_VALORAR', [{ concepto: 'Revisión', cantidad: 1, unidad: 'ud' }])]));
  assert.ok('total' in filas[0], '🔴 la fila no trae la clave `total`');
  assert.equal(filas[0].total, null);
});
