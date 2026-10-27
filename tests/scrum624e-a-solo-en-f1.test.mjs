// tests/scrum624e-a-solo-en-f1.test.mjs — SCRUM-624e
//
// LA VÍCTIMA: quien tiene en la mano una factura cuyo TOTAL no es el que su registro declara a
// Hacienda.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ARREGLO A, SÓLO EN LA F1 — y la R1 y el justificante, QUIETOS
//
// Decisión del fundador: SCRUM-624 c.20775 (arreglo A, autorizado) y c.20817 («A solo en
// facturas normales»). En una F1, el bloque de totales del PDF imprime la base y la cuota por tipo
// de `calcVatBreakdown` y el TOTAL GUARDADO, en vez de recalcularlos. La R1 se queda como hoy: su
// total guardado es −original.total y su desglose no siempre lo suma (SCRUM-624d).
//
// Se genera el PDF DE VERDAD y se lee su texto: no se mira la función, se mira el papel.
//
// ① ROJO PRIMERO (medido con el `dist/` de main antes del cambio): 3 × 9,99 al 21 % con 36,27
//    guardado imprimía TOTAL 36,26; dos tipos con 0,03 guardado imprimía 0,04.
// ② La R1 y el justificante imprimen EXACTAMENTE el bloque que imprimían (texto copiado de la
//    salida de main `bcfc99b0d`, no escrito a mano).
// ③ El caso 15,13 + 15,13 de SCRUM-1446 es CONTROL, no rojo: su TOTAL (30,25) ya era el guardado,
//    y A no toca la columna de líneas.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { lineasDePdf } from './_texto-del-pdf.mjs';

const require = createRequire(import.meta.url);
const { generateInvoicePdf } = require('../dist/lib/pdf.js');
const { calcVatBreakdown } = require('../dist/modules/invoicing/domain/vat.service.js');

// La mutación que imita el defecto que este fichero promete cazar: A aplicado también a la R1.
// `dist/` está en `.gitignore`: no puede llegar a un commit.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'dist/modules/invoicing/infra/pdf/pdf.service.js',
    de: "const leeElRegistro = (params.type ?? 'F1') === 'F1';",
    a: "const leeElRegistro = (params.type ?? 'F1') !== 'JUST';",
    cae: 'la R1 imprime EXACTAMENTE el bloque de totales que imprimía',
  },
];

const L = (price, tax, qty = 1) => ({ concept: 'L624e', qty, price, tax });
let serie = 0;

/** El bloque de totales del papel: de «Base imponible:» a «TOTAL:» (o «TOTAL COBRADO:»). */
async function bloque(type, total, lines) {
  serie += 1;
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA624E-${serie}`, invoiceId: 1, merchantId: 7,
    merchant: { name: 'QA 624e', legalName: 'QA 624e SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' }, currency: 'EUR', total, qrData: 'x', type, lines, zona: null,
  });
  let r;
  try {
    r = lineasDePdf(fs.readFileSync(outPath));
  } finally {
    fs.rmSync(outPath, { force: true });
  }
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un papel sin leer no dice ningún importe.`);
  const t = r.lineas.map((l) => l.texto);
  const i = t.findIndex((x) => x.startsWith('Base imponible:'));
  const j = t.findIndex((x) => /^TOTAL( COBRADO)?:/.test(x));
  assert.ok(i >= 0 && j > i, '🔴 CIEGO: no encuentro el bloque de totales en el papel.');
  return t.slice(i, j + 1);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-624e · SUELO: una F1 que cuadra imprime su base, su cuota y su total', async () => {
  assert.deepEqual(await bloque('F1', '121.00', [L(100, 0.21)]),
    ['Base imponible:100,00 EUR', 'IVA 21%:21,00 EUR', 'TOTAL:121,00 EUR'],
    '🔴 CIEGO: el lector no saca el bloque de la factura más simple.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① LA F1 IMPRIME EL REGISTRO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-624e · ① F1: 3 × 9,99 al 21 % con 36,27 guardado imprime TOTAL 36,27, no 36,26', async () => {
  assert.deepEqual(await bloque('F1', '36.27', [L(9.99, 0.21), L(9.99, 0.21), L(9.99, 0.21)]),
    ['Base imponible:29,97 EUR', 'IVA 21%:6,29 EUR', 'TOTAL:36,27 EUR'],
    '🔴 EL PAPEL DE LA F1 NO IMPRIME EL TOTAL GUARDADO (SCRUM-624): el de main imprimía 36,26.');
});

test('SCRUM-624e · ① F1 con dos tipos: las cuotas son las del desglose y el TOTAL el guardado', async () => {
  const lines = [L(0.02, 0.21), L(0.01, 0.10)];
  const d = calcVatBreakdown(lines);
  assert.deepEqual({ base: d.base, cuota: d.cuota }, { base: 0.03, cuota: 0 },
    'ha cambiado el desglose de estas líneas: el caso ya no mide lo que dice');
  assert.deepEqual(await bloque('F1', '0.03', lines), [
    'Base imponible:0,03 EUR', '[PENDIENTE microcopy oficial]',
    '21%0,02 EURIVA 21%:0,00 EUR', '10%0,01 EURIVA 10%:0,00 EUR', 'TOTAL:0,03 EUR',
  ], '🔴 la F1 de dos tipos no imprime el desglose del registro: el de main imprimía TOTAL 0,04.');
});

test('SCRUM-624e · ① F1 sin `type` es F1 (el valor por defecto de la columna)', async () => {
  const lines = [L(9.99, 0.21), L(9.99, 0.21), L(9.99, 0.21)];
  assert.deepEqual(await bloque(undefined, '36.27', lines), await bloque('F1', '36.27', lines));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② LA R1 Y EL JUSTIFICANTE NO CAMBIAN
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-624e · ② la R1 imprime EXACTAMENTE el bloque de totales que imprimía', async () => {
  // La R1 de 12,50 al 21 % (SCRUM-624d): guarda −15,13 y su desglose da −12,50 − 2,62. Con A
  // imprimiría −2,62; hoy imprime −2,63, y así se queda hasta el GO de su creación.
  assert.deepEqual(await bloque('R1', '-15.13', [L(-12.5, 0.21)]),
    ['Base imponible:-12,50 EUR', 'IVA 21%:-2,63 EUR', 'TOTAL:-15,13 EUR'],
    '🔴 HA CAMBIADO EL PAPEL DE LA R1, y c.20817 dice que se queda como hoy.');
  assert.deepEqual(await bloque('R1', '-0.03', [L(-0.02, 0.21), L(-0.01, 0.10)]), [
    'Base imponible:-0,03 EUR', '[PENDIENTE microcopy oficial]',
    '21%-0,02 EURIVA 21%:-0,00 EUR', '10%-0,01 EURIVA 10%:-0,00 EUR', 'TOTAL:-0,04 EUR',
  ], '🔴 HA CAMBIADO EL PAPEL DE LA R1 de dos tipos, y c.20817 dice que se queda como hoy.');
});

test('SCRUM-624e · ② el justificante imprime EXACTAMENTE el bloque de totales que imprimía', async () => {
  assert.deepEqual(await bloque('JUST', '36.27', [L(9.99, 0.21), L(9.99, 0.21), L(9.99, 0.21)]),
    ['Base imponible:29,97 EUR', 'IVA 21%:6,29 EUR', 'TOTAL COBRADO:36,26 EUR'],
    '🔴 HA CAMBIADO EL PAPEL DEL JUSTIFICANTE: A es sólo para la F1.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ CONTROL: lo que ya cuadraba
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-624e · ③ CONTROL: 15,13 + 15,13 (SCRUM-1446) sigue con TOTAL 30,25, antes y después', async () => {
  assert.deepEqual(await bloque('F1', '30.25', [L(12.5, 0.21), L(12.5, 0.21)]),
    ['Base imponible:25,00 EUR', 'IVA 21%:5,25 EUR', 'TOTAL:30,25 EUR'],
    'Ha cambiado el bloque de un caso que ya cuadraba: A no podía moverlo.');
});
