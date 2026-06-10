// Tests de la numeración de facturas por serie anual (Sprint SPAIN).
// Se ejecutan contra el build (dist/), por eso el script de test compila primero.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatInvoiceNumber,
  resolveSeriesSeq,
} from '../dist/modules/invoicing/domain/invoiceNumber.service.js';

test('formatInvoiceNumber: serie anual 2026-CF-001', () => {
  assert.equal(formatInvoiceNumber('CF', 2026, 1), '2026-CF-001');
  assert.equal(formatInvoiceNumber('CF', 2026, 42), '2026-CF-042');
  assert.equal(formatInvoiceNumber('YQ', 2027, 7), '2027-YQ-007');
});

test('formatInvoiceNumber: más de 999 facturas no trunca la secuencia', () => {
  assert.equal(formatInvoiceNumber('CF', 2026, 1234), '2026-CF-1234');
});

test('formatInvoiceNumber: sin prefijo cae a CF', () => {
  assert.equal(formatInvoiceNumber(null, 2026, 3), '2026-CF-003');
  assert.equal(formatInvoiceNumber('', 2026, 3), '2026-CF-003');
  assert.equal(formatInvoiceNumber('  ', 2026, 3), '2026-CF-003');
});

test('formatInvoiceNumber: serie de rectificativas lleva sufijo -R', () => {
  assert.equal(formatInvoiceNumber('CF', 2026, 1, true), '2026-CF-R-001');
});

test('resolveSeriesSeq: misma serie anual → continúa el contador', () => {
  assert.equal(resolveSeriesSeq({ invoiceSeriesYear: 2026, nextInvoiceNumber: 8 }, 2026), 8);
});

test('resolveSeriesSeq: cambio de año → serie nueva desde 1', () => {
  assert.equal(resolveSeriesSeq({ invoiceSeriesYear: 2026, nextInvoiceNumber: 8 }, 2027), 1);
});

test('resolveSeriesSeq: merchant antiguo sin año de serie → serie nueva desde 1', () => {
  assert.equal(resolveSeriesSeq({ invoiceSeriesYear: null, nextInvoiceNumber: 8 }, 2026), 1);
});
