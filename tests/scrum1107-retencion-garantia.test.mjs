// tests/scrum1107-retencion-garantia.test.mjs — SCRUM-1107
//
// Retención de garantía de obra. Módulo PURO: sin BD, sin red — el rojo/verde se ejercita entero
// aquí. Los dos invariantes que el encargo pidió fijados con test desde el principio:
//   ① retenido + recibido = total, EXACTO al céntimo (nunca "casi").
//   ② el cobro de la liberación es un Charge NUEVO; `retencionGarantiaCobrada` pasa de NULL a
//      fecha en ESE momento — verificado a nivel de ruta en scrum1107b (el "cuándo" es de HTTP).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularSplitRetencion, tieneRetencionDeclarada, retencionPendiente,
  datosParaDeclararRetencion, datosParaMarcarCobrada,
} from '../dist/modules/billing/domain/retencionGarantia.js';

// ═══ ① EL INVARIANTE: retenido + recibido = total, SIEMPRE, al céntimo ═══════════════════

test('SCRUM-1107 · 🔴 EL INVARIANTE: retenido + recibido = total exacto, en una batería de casos', () => {
  // Incluye el 5% "habitual" del encargo, los otros dos vistos (3% y 10%), y porcentajes NO
  // redondos sobre bases NO redondas — que es justo donde un redondeo independiente por cada
  // lado se desincroniza.
  const casos = [
    [10000, 5], [10000, 3], [10000, 10],
    [12345.67, 7], [999.99, 5], [1, 50], [0.03, 5],
    [123456.78, 4.5], [50, 99.99], [77.77, 0.01],
  ];
  for (const [total, porcentaje] of casos) {
    const r = calcularSplitRetencion(total, porcentaje);
    assert.equal(r.ok, true, `🔴 se rechazó un caso válido: total=${total} porcentaje=${porcentaje}`);
    const sumaCent = Math.round(r.importeRetenido * 100) + Math.round(r.importeRecibido * 100);
    assert.equal(sumaCent, Math.round(total * 100),
      `🔴 NO CUADRA: retenido (${r.importeRetenido}) + recibido (${r.importeRecibido}) ≠ total (${total})`);
  }
});

test('SCRUM-1107 · el importe retenido es positivo y menor que el total (porcentaje entre 0 y 100)', () => {
  const r = calcularSplitRetencion(10000, 5);
  assert.equal(r.ok, true);
  assert.ok(r.importeRetenido > 0, '🔴 el retenido tiene que ser positivo para un 5% declarado');
  assert.ok(r.importeRetenido < 10000, '🔴 el retenido no puede ser el total entero');
  assert.equal(r.importeRetenido, 500, '🔴 el 5% de 10.000 es 500, sin redondeos raros');
});

// ═══ Rechazos — SUELO: la primitiva distingue válido de inválido ═════════════════════════

test('SCRUM-1107 · total inválido se rechaza (cero, negativo, no finito)', () => {
  for (const total of [0, -100, NaN, Infinity, -Infinity]) {
    const r = calcularSplitRetencion(total, 5);
    assert.equal(r.ok, false, `🔴 aceptó total=${total}`);
    assert.equal(r.error, 'total_invalido');
  }
});

test('SCRUM-1107 · porcentaje fuera de (0,100) se rechaza — 0% y 100% NO son "hay retención"', () => {
  for (const porcentaje of [0, 100, -5, 105, NaN, Infinity]) {
    const r = calcularSplitRetencion(10000, porcentaje);
    assert.equal(r.ok, false, `🔴 aceptó porcentaje=${porcentaje}`);
    assert.equal(r.error, 'porcentaje_invalido');
  }
});

test('SCRUM-1107 · el suelo del error es EL PRIMERO que falla, sin ambigüedad', () => {
  // total inválido Y porcentaje inválido a la vez: el mensaje tiene que decir UNO, no confundir.
  const r = calcularSplitRetencion(-1, -1);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'total_invalido', '🔴 con los dos rotos, se espera que el total mande primero');
});

// ═══ ② El estado de la retención: declarada / pendiente / cobrada ════════════════════════

test('SCRUM-1107 · tieneRetencionDeclarada: NULL en el porcentaje es "no", cualquier número es "sí"', () => {
  assert.equal(tieneRetencionDeclarada({ retencionGarantiaPorcentaje: null }), false);
  assert.equal(tieneRetencionDeclarada({ retencionGarantiaPorcentaje: undefined }), false);
  assert.equal(tieneRetencionDeclarada({ retencionGarantiaPorcentaje: 5 }), true);
  assert.equal(tieneRetencionDeclarada({ retencionGarantiaPorcentaje: 0 }), true,
    '🔴 un 0 declarado (aunque no debería poder llegar aquí desde el split) NO es lo mismo que NULL');
});

test('SCRUM-1107 · retencionPendiente: sin retención declarada NUNCA es "pendiente"', () => {
  assert.equal(
    retencionPendiente({ retencionGarantiaPorcentaje: null, retencionGarantiaCobrada: null }),
    false,
    '🔴 "pendiente" sobre un cobro SIN garantía retenida no significa nada, y no puede salir true',
  );
});

test('SCRUM-1107 · retencionPendiente: declarada y sin cobrar → pendiente; declarada y cobrada → NO', () => {
  assert.equal(
    retencionPendiente({ retencionGarantiaPorcentaje: 5, retencionGarantiaCobrada: null }),
    true,
  );
  assert.equal(
    retencionPendiente({ retencionGarantiaPorcentaje: 5, retencionGarantiaCobrada: new Date('2027-04-01') }),
    false,
    '🔴 EL APAGADO DEL AVISO: con fecha de cobrada, ya NO está pendiente — si esto da true, el ' +
    'aviso seguiría sonando sobre dinero ya ingresado.',
  );
});

// ═══ Los fragmentos `data` que se escriben ════════════════════════════════════════════════

test('SCRUM-1107 · datosParaDeclararRetencion: los cuatro campos, cobrada SIEMPRE null al declarar', () => {
  const split = calcularSplitRetencion(10000, 5);
  assert.equal(split.ok, true);
  const liberacion = new Date('2027-09-23T00:00:00Z');
  const data = datosParaDeclararRetencion(split, liberacion);
  assert.deepEqual(data, {
    retencionGarantiaPorcentaje: 5,
    retencionGarantiaImporte: 500,
    retencionGarantiaLiberacion: liberacion,
    retencionGarantiaCobrada: null,
  });
});

test('SCRUM-1107 · datosParaMarcarCobrada: UN campo, la fecha que se le pase (o "ahora" por defecto)', () => {
  const fecha = new Date('2027-10-01T00:00:00Z');
  assert.deepEqual(datosParaMarcarCobrada(fecha), { retencionGarantiaCobrada: fecha });
  const porDefecto = datosParaMarcarCobrada();
  assert.ok(porDefecto.retencionGarantiaCobrada instanceof Date);
});
