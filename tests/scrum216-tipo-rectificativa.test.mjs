// SCRUM-216 (VeriFactu · FISCAL, sin gate: corre en `npm test`, no toca BD ni red).
//
// NINGUNA R1 SALE SIN `TipoRectificativa`.
//
// El emisor no lo ponía nunca → error AEAT **1114** en cada rectificativa. Se omitió a
// propósito, con el criterio correcto («no inventar una calificación fiscal») aplicado al
// revés: **omitir un campo que el esquema exige no es abstenerse, es garantizar el rechazo.**
// La abstención de verdad es bloquear y pedir el dato — que es lo que hace esto.
//
// 🔴 Y HAY UNA CONTRADICCIÓN SIN RESOLVER, POR ESO NO SE ELIGE EL VALOR:
//   · P12 del expediente: nuestras R1 «consignan el total corregido» → sería **S**.
//   · El código: `invoicesAdmin.routes.ts` crea la R1 con `total: -original.total` y las
//     líneas negadas — el delta, no el total corregido → es **I**.
//   · `registro.builder.ts` lo dice desde S1-C: «YaQu usa 'I'», con un `[VALIDAR]` sin validar.
// Dos documentos y el código no coinciden. Hasta que P12 se confirme CONTRA EL CÓDIGO, se
// bloquea; y las dos salidas quedan construidas para que confirmarlo sea una línea.
import test from 'node:test';
import assert from 'node:assert/strict';

import { validarRegistrosXml } from './_xsd-verifactu.mjs';

process.env.VERIFACTU_PRODUCTOR_NOMBRE = 'QA Productor';
process.env.VERIFACTU_PRODUCTOR_NIF = '89890001K';
process.env.VERIFACTU_ID_SISTEMA = '01';
process.env.VERIFACTU_VERSION = '1.0.0';
process.env.VERIFACTU_NUM_INSTALACION = '1';

const merchant = {
  id: 1, country: 'ES', taxId: 'B12345678', legalName: 'Fontanería QA S.L.', name: 'Fontanería QA',
};

const CLIENTE = { name: 'Cliente QA', taxId: 'A11111111' }; // con NIF: aquí se prueba la R1, no el 1189

/** La factura ORIGINAL rectificada: 100 € de base al 21 % → cuota 21 €. */
const ORIGINAL = {
  number: '2026-CF-001',
  createdAt: new Date('2026-03-15T10:00:00Z'),
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
};

/** La R1 tal y como la CREA el producto hoy: el original en negativo (el delta). */
const mkR1 = (over = {}) => ({
  number: '2026-CF-R-001', createdAt: new Date('2026-04-01T10:00:00Z'),
  total: '-121.00', type: 'R1',
  lines: [{ concept: 'Reparación', qty: 1, price: -100, tax: 0.21 }],
  vfHash: 'A'.repeat(64), vfPrevHash: null,
  customer: CLIENTE,
  rectifies: ORIGINAL,
  ...over,
});

const fakePrisma = (invoices) => ({
  merchant: { findUnique: async () => merchant },
  invoice: { findMany: async (a) => (a?.where?.vfHash ? invoices.filter((i) => i.vfHash) : invoices) },
});

const build = async (invoices, opts) => {
  const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');
  return buildVerifactuRegistrosXml({ merchantId: 1, year: 2026 }, fakePrisma(invoices), opts);
};

// ── 1 · HOY: la R1 no se declara a medias, se bloquea ─────────────────────────────────────

test('SCRUM-216 · sin confirmar, la R1 se EXCLUYE en vez de salir sin TipoRectificativa', async () => {
  const { count, excluidos } = await build([mkR1()]);
  assert.equal(count, 0);
  assert.equal(excluidos[0].number, '2026-CF-R-001');
  assert.match(excluidos[0].motivo, /1114/, 'el motivo nombra el error que se evita');
  assert.match(excluidos[0].motivo, /P12/, 'y la fuente que tiene que confirmarlo');
});

test('SCRUM-216 · una factura NORMAL no se ve afectada', async () => {
  // El bloqueo es de rectificativas: una F1 corriente sigue declarándose.
  const f1 = { ...mkR1(), number: '2026-CF-002', type: 'F1', total: '121.00',
    lines: ORIGINAL.lines, rectifies: null };
  const { count, excluidos } = await build([f1]);
  assert.equal(count, 1);
  assert.deepEqual(excluidos, []);
});

// ── 2 · LAS DOS SALIDAS, construidas y validando ──────────────────────────────────────────

test('SCRUM-216 · modo I (incremental): emite TipoRectificativa I y NO ImporteRectificacion', async () => {
  const { xml, count } = await build([mkR1()], { modoTipoRectificativa: 'INCREMENTAL_I' });
  assert.equal(count, 1);
  assert.match(xml, /<sum1:TipoRectificativa>I<\/sum1:TipoRectificativa>/);
  assert.doesNotMatch(xml, /ImporteRectificacion/,
    '🔴 AEAT 1119: si NO es por sustitución, ImporteRectificacion no debe llevar valor');

  const { valido, errores } = await validarRegistrosXml(xml, 'r1-incremental.xml');
  assert.equal(valido, true, `🔴 la R1 incremental no valida:\n${errores.join('\n')}`);
});

test('SCRUM-216 · modo S (sustitutiva): emite TipoRectificativa S CON ImporteRectificacion', async () => {
  const { xml, count } = await build([mkR1()], { modoTipoRectificativa: 'SUSTITUTIVA_S' });
  assert.equal(count, 1);
  assert.match(xml, /<sum1:TipoRectificativa>S<\/sum1:TipoRectificativa>/);
  // AEAT 1118: el bloque es OBLIGATORIO, con la base y cuota SUSTITUIDAS — las de la factura
  // RECTIFICADA (100,00 / 21,00), no las de la R1.
  assert.match(xml, /<sum1:BaseRectificada>100\.00<\/sum1:BaseRectificada>/);
  assert.match(xml, /<sum1:CuotaRectificada>21\.00<\/sum1:CuotaRectificada>/);

  const { valido, errores } = await validarRegistrosXml(xml, 'r1-sustitutiva.xml');
  assert.equal(valido, true, `🔴 la R1 sustitutiva no valida:\n${errores.join('\n')}`);
});

test('SCRUM-216 · el ORDEN del XSD: TipoRectificativa antes de FacturasRectificadas, y el importe después', async () => {
  const { xml } = await build([mkR1()], { modoTipoRectificativa: 'SUSTITUTIVA_S' });
  const i = (t) => xml.indexOf(t);
  assert.ok(i('<sum1:TipoFactura>') < i('<sum1:TipoRectificativa>'), 'TipoRectificativa va tras TipoFactura');
  assert.ok(i('<sum1:TipoRectificativa>') < i('<sum1:FacturasRectificadas>'), 'y antes de FacturasRectificadas');
  assert.ok(i('<sum1:FacturasRectificadas>') < i('<sum1:ImporteRectificacion>'), 'el importe va después');
});

// ── 3 · LO QUE NO SE INVENTA ──────────────────────────────────────────────────────────────

test('SCRUM-216 · modo S sin poder calcular el importe sustituido: BLOQUEA, no emite S a medias', async () => {
  // Si la factura rectificada no tiene líneas, no hay base ni cuota sustituidas. Emitir S sin
  // el bloque es un 1118 seguro; emitirlo con ceros sería inventarse la declaración.
  const sinLineas = mkR1({ rectifies: { ...ORIGINAL, lines: null } });
  const { count, excluidos } = await build([sinLineas], { modoTipoRectificativa: 'SUSTITUTIVA_S' });
  assert.equal(count, 0);
  assert.match(excluidos[0].motivo, /1118/);
});

// ── 4 · EL RATCHET ────────────────────────────────────────────────────────────────────────

test('SCRUM-216 · la constante sigue SIN CONFIRMAR', async () => {
  const { MODO_TIPO_RECTIFICATIVA } = await import('../dist/modules/fiscal/verifactu/registro.builder.js');
  assert.equal(
    MODO_TIPO_RECTIFICATIVA,
    'SIN_CONFIRMAR',
    '🔴 Alguien ha elegido entre S (sustitutiva) e I (incremental). Antes de dar eso por ' +
      'bueno: P12 dice que nuestras R1 consignan el TOTAL CORREGIDO (→ S), pero el código las ' +
      'crea con el total en NEGATIVO (→ I). Si se confirma S, además de esta constante hay que ' +
      'cambiar cómo se CREAN las R1 en invoicesAdmin.routes.ts — una S que consigne el delta ' +
      'declara un importe que no es el corregido, y eso queda sellado en la huella.',
  );
});
