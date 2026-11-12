// SCRUM-1669 (PILOTO-1) · tramo b · un BORRADOR no tiene fecha de «Emisión».
//
// Aceptación 2 de SCRUM-1669: «decidido y escrito qué enseña "Emisión" para un borrador». Decisión del
// orquestador (respuesta a S1 del 11-nov, sobre la propuesta de SCRUM-1669 c.21486): el servidor manda
// `emisionAt: null` cuando el albarán está en `borrador`, y la lista pinta la raya «—» que ya pinta
// `fechaCorta` para un dato ausente (`albaranesView.js`). Sin texto nuevo. Antes salía `createdAt`
// (SCRUM-67), y un borrador aparecía como «emitido» el día que se creó, sin estarlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listarAlbaranesDelMerchant } from '../dist/modules/jobs/domain/albaranesListado.js';

const M = 16692;
const CREADO = '2026-10-16T12:41:22.412Z';
const albaran = (id, estado) => ({
  id, merchantId: M, jobId: 10, numero: `ALB-${id}`, fecha: '2026-10-20', createdAt: CREADO,
  estado, lineas: [], invoiceId: null, modoValoracion: 'SIN_VALORAR', customerName: null, customerLegalName: null,
});
const lector = (albaranes) => ({
  albaranes: async () => albaranes,
  jobs: async () => [{ id: 10, titulo: null, customerId: 7, quoteId: null }],
  customers: async () => [{ id: 7, name: 'María López', legalName: null }],
  libro: async () => [],
});
const filaDe = async (estado) => (await listarAlbaranesDelMerchant(M, lector([albaran(1, estado)]))).filas[0];

test('SCRUM-1669b · SUELO: el listado de verdad devuelve el albarán sembrado', async () => {
  const fila = await filaDe('borrador');
  assert.ok(fila, '🔴 SUELO: el listado no devolvió el albarán');
  assert.equal(fila.estado, 'borrador');
});

test('SCRUM-1669b · 🔴 un BORRADOR trae `emisionAt: null` (no se ha emitido), con la clave presente', async () => {
  const fila = await filaDe('borrador');
  assert.ok('emisionAt' in fila, '🔴 la fila no trae la clave `emisionAt`');
  assert.equal(fila.emisionAt, null, `🔴 un borrador sale con emisión ${JSON.stringify(fila.emisionAt)}`);
});

test('SCRUM-1669b · CONTROL: emitido y firmado siguen trayendo su fecha de emisión (createdAt, SCRUM-67)', async () => {
  for (const estado of ['emitido', 'firmado']) {
    const fila = await filaDe(estado);
    assert.equal(new Date(fila.emisionAt).toISOString(), CREADO, `🔴 un albarán ${estado} perdió su fecha de emisión`);
  }
});
