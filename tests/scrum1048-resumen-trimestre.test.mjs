// tests/scrum1048-resumen-trimestre.test.mjs — SCRUM-1048 (CON-07a)
//
// EL CÁLCULO DEL RESUMEN, sin gate: funciones puras, ni BD ni red. El periodo (los bordes del
// trimestre, incluida la medianoche de Madrid) lo pone `rangoTrimestre`, que ya tiene sus propios
// tests desde el 303 — aquí NO se repite esa cobertura, se prueba la agregación que es NUEVA.
//
// Todo se mide por la SUPERFICIE PÚBLICA (`construirResumenTrimestre`). `agruparIvaPorTipo`,
// `calcularIvaSoportado` y `retencionesNoDisponibles` no se exportan: probarlas directo medía
// ayudantes internos en vez del contrato, y además dejaba tres `export` que nadie de fuera
// consume — lo cazó el guard de SCRUM-411 y tenía razón (patrón en
// tests/scrum441-metodo-declarado.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { construirResumenTrimestre } from '../dist/modules/reports/domain/resumenTrimestre.js';

const soloSoportado = (expenses) =>
  construirResumenTrimestre({ año: 2026, trimestre: 1, repercutidoPorTipo: [], expenses }).ivaSoportado;

test('el caso del ticket, a mano: emitida base 1.000/210 y gasto deducible base 300/63 → diferencia 147', () => {
  const r = construirResumenTrimestre({
    año: 2026,
    trimestre: 3,
    repercutidoPorTipo: [{ tipo: 21, base: 1000, cuota: 210 }],
    expenses: [{ amount: '363.00', baseAmount: '300.00', vatRate: 21, vatAmount: '63.00', vatDeducible: true }],
  });
  assert.equal(r.ivaRepercutido.totalCuota, 210);
  assert.equal(r.ivaSoportado.totalCuotaDeducible, 63);
  assert.equal(r.diferencia, 147, '🔴 210 repercutido − 63 soportado deducible = 147');
});

test('retenciones: SIEMPRE no disponibles — Invoice no guarda la retención aplicada (SCRUM-293/A2)', () => {
  const resumen = construirResumenTrimestre({
    año: 2026, trimestre: 1, repercutidoPorTipo: [], expenses: [],
  });
  assert.equal(resumen.retenciones.disponible, false);
  assert.match(resumen.retenciones.motivo, /ALTER/, 'el motivo tiene que decir POR QUÉ, no solo que falta');
});

test('trimestre sin datos: todo a cero, sin lanzar, marcado borrador', () => {
  const r = construirResumenTrimestre({ año: 2026, trimestre: 1, repercutidoPorTipo: [], expenses: [] });
  assert.equal(r.ivaRepercutido.totalCuota, 0);
  assert.equal(r.ivaSoportado.totalCuotaDeducible, 0);
  assert.equal(r.diferencia, 0);
  assert.equal(r.borradorParaAsesor, true);
});

test('resultado negativo se devuelve TAL CUAL, sin palabras como «devolución» (regla 7)', () => {
  const r = construirResumenTrimestre({
    año: 2026,
    trimestre: 2,
    repercutidoPorTipo: [{ tipo: 21, base: 100, cuota: 21 }],
    expenses: [{ amount: '605.00', baseAmount: '500.00', vatRate: 21, vatAmount: '105.00', vatDeducible: true }],
  });
  assert.equal(r.diferencia, -84);
  assert.equal(typeof r.diferencia, 'number');
});

test('IVA soportado: no deducible cuenta aparte y NO entra en la diferencia', () => {
  const r = soloSoportado([
    { amount: '121.00', baseAmount: '100.00', vatRate: 21, vatAmount: '21.00', vatDeducible: true },
    { amount: '121.00', baseAmount: '100.00', vatRate: 21, vatAmount: '21.00', vatDeducible: false },
  ]);
  assert.equal(r.totalCuotaDeducible, 21, 'solo el marcado deducible entra en la cuota que resta');
  assert.deepEqual(r.noDeducible, { count: 1, importe: 21 });
});

test('IVA soportado: vatDeducible sin marcar (null) se declara sin clasificar, no se reparte a ojo', () => {
  const r = soloSoportado([
    { amount: '121.00', baseAmount: '100.00', vatRate: 21, vatAmount: '21.00', vatDeducible: null },
  ]);
  assert.equal(r.totalCuotaDeducible, 0);
  assert.deepEqual(r.sinClasificar, { count: 1, importe: 121 });
});

test('IVA soportado: marcado deducible pero SIN baseAmount se declara sin clasificar (no se inventa la base)', () => {
  const r = soloSoportado([
    { amount: '121.00', baseAmount: null, vatRate: 21, vatAmount: '21.00', vatDeducible: true },
  ]);
  assert.equal(r.totalCuotaDeducible, 0, '🔴 sin baseAmount no hay tipo que cuadre: no se mete en porTipo como si constara');
  assert.deepEqual(r.sinClasificar, { count: 1, importe: 121 });
});

test('IVA soportado: varios gastos deducibles del mismo tipo se suman en una sola fila', () => {
  const r = soloSoportado([
    { amount: '121.00', baseAmount: '100.00', vatRate: 21, vatAmount: '21.00', vatDeducible: true },
    { amount: '12.10', baseAmount: '10.00', vatRate: 21, vatAmount: '2.10', vatDeducible: true },
  ]);
  assert.deepEqual(r.porTipo, [{ tipo: 21, base: 110, cuota: 23.1 }]);
});

test('agruparIvaPorTipo (repercutido): mismo tipo en dos entradas se suma, orden descendente por tipo', () => {
  const r = construirResumenTrimestre({
    año: 2026,
    trimestre: 1,
    repercutidoPorTipo: [
      { tipo: 10, base: 100, cuota: 10 },
      { tipo: 21, base: 50, cuota: 10.5 },
      { tipo: 10, base: 50, cuota: 5 },
    ],
    expenses: [],
  });
  assert.deepEqual(r.ivaRepercutido.porTipo, [
    { tipo: 21, base: 50, cuota: 10.5 },
    { tipo: 10, base: 150, cuota: 15 },
  ]);
});

test('céntimos: no se rompe por coma flotante (0.10 + 0.20 clásico) en el soportado', () => {
  const r = soloSoportado([
    { amount: '0.10', baseAmount: '0.10', vatRate: 0, vatAmount: '0.00', vatDeducible: true },
    { amount: '0.20', baseAmount: '0.20', vatRate: 0, vatAmount: '0.00', vatDeducible: true },
  ]);
  assert.equal(r.totalBaseDeducible, 0.3, '🔴 en coma flotante 0.1+0.2 no da 0.3');
});
