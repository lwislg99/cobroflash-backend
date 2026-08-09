// SCRUM-207 · el clasificador de la conciliación fiscal (HUECO 3), probado rama a rama.
//
// POR QUÉ ESTE TEST EXISTE. La primera ejecución real del script contra STAGING dio
// `H3-A = 0` — y ese verde no valía nada: staging tiene 6 documentos y los 6 son
// justificantes `J-…`, así que la rama fiscal NUNCA se pisó. Un contador que sale a cero
// sin haber contado es indistinguible de uno roto. Aquí los seis cubos se ejercitan con
// datos sintéticos, incluido el que importa (H3-A) y los tres que NO deben contarse como
// agujero.
//
// PURO: sin BD, sin gate. Solo necesita `dist/` (por `isReceiptNumber`), igual que la tanda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificarDocumentos, CUBOS } from '../scripts/_conciliacion-fiscal.mjs';

const LINEAS = [{ desc: 'Mano de obra', qty: 1, price: 100 }];

const MERCHANTS = [
  { id: 1, country: 'ES', taxId: 'B00000001', email: 'demo@yaqu.app' },   // demo (regla 8)
  { id: 7, country: 'ES', taxId: 'B12345678', email: 'pro@fontanero.es' }, // ES con NIF
  { id: 8, country: 'ES', taxId: null,        email: 'sinnif@x.es' },      // ES sin NIF
  { id: 9, country: 'PT', taxId: 'PT999',     email: 'pt@x.pt' },          // no-ES
];

const doc = (o) => ({
  id: o.id, merchantId: o.merchantId, number: o.number,
  vfHash: o.vfHash ?? null, lines: o.lines ?? LINEAS,
  type: 'F1', status: 'pending', createdAt: new Date('2026-07-01T10:00:00Z'), vfAnulHash: null,
});

test('SCRUM-207 · los seis cubos, uno por rama', () => {
  const docs = [
    doc({ id: 1, merchantId: 7, number: 'J-20260701-AB12' }),          // justificante
    doc({ id: 2, merchantId: 9, number: '2026-0001' }),                // no-ES
    doc({ id: 3, merchantId: 8, number: '2026-0002' }),                // ES sin NIF
    doc({ id: 4, merchantId: 7, number: '2026-0003', vfHash: 'AB12' }),// sellada
    doc({ id: 5, merchantId: 7, number: '2026-0004', lines: [] }),     // sin líneas → H3-B
    doc({ id: 6, merchantId: 1, number: '2026-0005' }),                // demo → H3-D  // MERCHANT DEMO A PROPOSITO (SCRUM-409): este cubo ES el del demo
    doc({ id: 7, merchantId: 7, number: '2026-0006' }),                // ⬅️ H3-A, el agujero
  ];

  const c = clasificarDocumentos(docs, MERCHANTS);

  assert.deepEqual(c.justificante.map((d) => d.id), [1]);
  assert.deepEqual(c.noEspanaOSinNif.map((d) => d.id), [2, 3]);
  assert.deepEqual(c.selladas.map((d) => d.id), [4]);
  assert.deepEqual(c.huecoSinLineas.map((d) => d.id), [5]);
  assert.deepEqual(c.huecoDemo.map((d) => d.id), [6]);
  assert.deepEqual(c.huecoReal.map((d) => d.id), [7], 'H3-A debe cazar exactamente la factura fiscal con líneas y sin huella');

  // Ningún documento se pierde ni se cuenta dos veces.
  const total = CUBOS.reduce((n, k) => n + c[k].length, 0);
  assert.equal(total, docs.length, 'cada documento cae en un cubo y solo en uno');
});

test('SCRUM-207 · el ORDEN de los if es el criterio: un justificante sin líneas NO es agujero', () => {
  // Si `huecoSinLineas` se evaluara antes que `justificante`, este documento contaría como
  // hueco. Un J-… nunca debió sellarse: no puede aparecer en ningún cubo de «hueco».
  const c = clasificarDocumentos(
    [doc({ id: 1, merchantId: 7, number: 'J-20260701-ZZ99', lines: [] })],
    MERCHANTS,
  );
  assert.deepEqual(c.justificante.map((d) => d.id), [1]);
  assert.equal(c.huecoSinLineas.length, 0);
  assert.equal(c.huecoReal.length, 0);
});

test('SCRUM-207 · merchant desconocido no se cuenta como agujero (fail-safe hacia el lado prudente)', () => {
  // Un documento cuyo merchant no aparece en la lista no puede afirmarse fiscal: sin país ni
  // NIF no se sabe si el código habría intentado sellarlo. Sale por `noEspanaOSinNif`, no por
  // H3-A — inventar un agujero es tan malo como esconderlo.
  const c = clasificarDocumentos([doc({ id: 1, merchantId: 999, number: '2026-0001' })], MERCHANTS);
  assert.deepEqual(c.noEspanaOSinNif.map((d) => d.id), [1]);
  assert.equal(c.huecoReal.length, 0);
});

test('SCRUM-207 · country con espacios/minúsculas y NIF en blanco se normalizan', () => {
  const merchants = [
    { id: 10, country: ' es ', taxId: 'B1', email: 'a@b.es' },   // debe contar como ES
    { id: 11, country: 'ES', taxId: '   ', email: 'c@d.es' },     // NIF en blanco = sin NIF
  ];
  const c = clasificarDocumentos(
    [doc({ id: 1, merchantId: 10, number: '2026-1' }), doc({ id: 2, merchantId: 11, number: '2026-2' })],
    merchants,
  );
  assert.deepEqual(c.huecoReal.map((d) => d.id), [1]);
  assert.deepEqual(c.noEspanaOSinNif.map((d) => d.id), [2]);
});
