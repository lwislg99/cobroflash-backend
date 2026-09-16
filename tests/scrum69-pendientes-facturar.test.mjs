// SCRUM-69 (FACT-1) — bandeja "Pendientes de facturar" + semáforo de plazo legal
// (art. 13 RD 1619/2012). Parte pura SIEMPRE corre (contra dist/), sin BD.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTipoDestinatario,
  fechaLimiteRecapitulativa,
  calcularSemaforo,
} from '../dist/modules/jobs/domain/pendientesFacturar.service.js';

// 🔴 SCRUM-643 · `fechaLimiteRecapitulativa` YA DEVUELVE UN DÍA (`YYYY-MM-DD`), así que este
// helper ya no formatea nada. Antes devolvía una `Date` en hora LOCAL y había que formatearla
// con `toIsoDateLocal` —NUNCA `.toISOString()`, que desplazaba el día en husos positivos—. Ese
// cuidado era un vigilante que había que recordar; un plazo legal es un DÍA y ahora se
// representa como tal, así que no hay nada que vigilar. `toIsoDateLocal` se retiró con él.
const limite = (mesKey, tipo) => fechaLimiteRecapitulativa(mesKey, tipo);

// La zona con la que se leen los tests de semáforo: se fija A MANO. Sin esto volverían a medir
// la máquina donde corren, que es lo que cazó SCRUM-640 en cinco ficheros.
const MADRID = 'Europe/Madrid';

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
  // La hora del día no debe afectar: el semáforo compara DÍAS naturales, no instantes.
  const hoy = new Date(Date.UTC(2026, 6, 10, 13, 0)); // 15:00 en Madrid
  assert.equal(calcularSemaforo('2026-07-10', hoy, MADRID), 'ambar'); // 0 días → ámbar
  assert.equal(calcularSemaforo('2026-07-15', hoy, MADRID), 'ambar'); // 5 días → ámbar
  assert.equal(calcularSemaforo('2026-07-16', hoy, MADRID), 'verde'); // 6 días → verde
  assert.equal(calcularSemaforo('2026-07-09', hoy, MADRID), 'rojo');  // -1 día (vencido) → rojo
});

test('calcularSemaforo: verde muy por delante, rojo muy vencido', () => {
  const hoy = new Date(Date.UTC(2026, 6, 10, 10, 0)); // mediodía en Madrid
  assert.equal(calcularSemaforo('2026-08-31', hoy, MADRID), 'verde');
  assert.equal(calcularSemaforo('2026-01-01', hoy, MADRID), 'rojo');
});
