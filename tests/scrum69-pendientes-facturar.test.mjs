// SCRUM-69 (FACT-1) — bandeja "Pendientes de facturar" + semáforo de plazo legal
// (art. 13 RD 1619/2012). Parte pura SIEMPRE corre (contra dist/), sin BD.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTipoDestinatario,
  fechaLimiteRecapitulativa,
  calcularSemaforo,
  toIsoDateLocal,
} from '../dist/modules/jobs/domain/pendientesFacturar.service.js';

// fechaLimiteRecapitulativa devuelve una Date en hora LOCAL a propósito (para comparar con
// "hoy" también local, ver calcularSemaforo) — formatear con toIsoDateLocal, NUNCA
// .toISOString() (convierte a UTC y desplaza un día en timezones con offset positivo, p.ej.
// Madrid). Este helper de test replica exactamente lo que usa el código real.
function limite(mesKey, tipo) {
  return toIsoDateLocal(fechaLimiteRecapitulativa(mesKey, tipo));
}

// ── resolveTipoDestinatario ──────────────────────────────────────────────────
test('resolveTipoDestinatario: null/undefined → PARTICULAR (criterio seguro, plazo más corto)', () => {
  assert.equal(resolveTipoDestinatario({ tipoDestinatario: null }), 'PARTICULAR');
  assert.equal(resolveTipoDestinatario({}), 'PARTICULAR');
  assert.equal(resolveTipoDestinatario({ tipoDestinatario: 'EMPRESARIO' }), 'EMPRESARIO');
  assert.equal(resolveTipoDestinatario({ tipoDestinatario: 'PARTICULAR' }), 'PARTICULAR');
});

// ── fechaLimiteRecapitulativa ─────────────────────────────────────────────────
test('fechaLimiteRecapitulativa: PARTICULAR = último día del mes natural', () => {
  assert.equal(limite('2026-02', 'PARTICULAR'), '2026-02-28'); // febrero no bisiesto
  assert.equal(limite('2024-02', 'PARTICULAR'), '2024-02-29'); // bisiesto
  assert.equal(limite('2026-04', 'PARTICULAR'), '2026-04-30'); // 30 días
  assert.equal(limite('2026-01', 'PARTICULAR'), '2026-01-31'); // 31 días
});

test('fechaLimiteRecapitulativa: EMPRESARIO = día 16 del mes siguiente', () => {
  assert.equal(limite('2026-03', 'EMPRESARIO'), '2026-04-16');
  assert.equal(limite('2026-01', 'EMPRESARIO'), '2026-02-16');
});

test('fechaLimiteRecapitulativa: diciembre → enero (desbordamiento de año)', () => {
  assert.equal(limite('2026-12', 'PARTICULAR'), '2026-12-31');
  assert.equal(limite('2026-12', 'EMPRESARIO'), '2027-01-16');
});

// ── calcularSemaforo ──────────────────────────────────────────────────────────
test('calcularSemaforo: fronteras exactas 0/5/6/-1 días', () => {
  const hoy = new Date('2026-07-10T15:00:00'); // hora del día no debe afectar (normaliza a medianoche)
  assert.equal(calcularSemaforo(new Date('2026-07-10'), hoy), 'ambar'); // 0 días → ámbar
  assert.equal(calcularSemaforo(new Date('2026-07-15'), hoy), 'ambar'); // 5 días → ámbar
  assert.equal(calcularSemaforo(new Date('2026-07-16'), hoy), 'verde'); // 6 días → verde
  assert.equal(calcularSemaforo(new Date('2026-07-09'), hoy), 'rojo');  // -1 día (vencido) → rojo
});

test('calcularSemaforo: verde muy por delante, rojo muy vencido', () => {
  const hoy = new Date('2026-07-10');
  assert.equal(calcularSemaforo(new Date('2026-08-31'), hoy), 'verde');
  assert.equal(calcularSemaforo(new Date('2026-01-01'), hoy), 'rojo');
});
