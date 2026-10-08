// tests/scrum1446-los-tres-importes-del-pdf.test.mjs — SCRUM-1446, SCRUM-1447 y SCRUM-1448
//
// LA VÍCTIMA: quien tiene en la mano una factura o un presupuesto y hace la cuenta con el papel.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUÉ ES ESTO: LA MEDICIÓN DE TRES DEFECTOS, FIJADA. NO ES SU ARREGLO.
//
// Se genera el PDF DE VERDAD (`generateInvoicePdf`, `generateQuotePdf`) y se lee lo que imprime.
// Cada caso de abajo fija los importes EXACTOS que salen hoy, incluidos los que salen mal:
//
//   ① SCRUM-1446 · la columna TOTAL de las líneas no suma el TOTAL impreso.
//   ② SCRUM-1447 · el tipo se redondea a entero: el 7,5 % —que el servidor ADMITE— sale «8%».
//      Y no sólo en el papel de la factura: el pie del presupuesto CALCULA la cuota al 8 %, y el
//      desglose del registro de facturación lleva `TipoImpositivo` 8 con la cuota del 7,5 %.
//   ③ SCRUM-1448 · la factura con líneas RECALCULA su total y la que no tiene líneas imprime el
//      guardado; con dos tipos, con tramos o con descuento de línea, los dos números se separan.
//
// ⛔ ESTE FICHERO NO MODIFICA EL CAMINO DE EMISIÓN (regla 38): lo ejecuta y lee su salida. Corregir
// cualquiera de los tres cambia una cifra impresa en un documento fiscal, y eso es regla 40: lo
// decide el fundador. Hasta entonces quedan DECLARADOS aquí, con su importe.
//
// Si un caso deja de dar el importe declarado, este fichero cae y lo nombra. Si es porque el
// defecto se ha arreglado, se borra su entrada de `DECLARADOS` y se fija el importe nuevo, en el
// mismo commit. La lista sólo puede menguar.
//
// La medición entera, con sus recuentos: `docs/master/SCRUM-1446.md` y
// `docs/master/evidencias/SCRUM-1446/medir-los-tres-importes.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { lineasDePdf } from './_texto-del-pdf.mjs';

const require = createRequire(import.meta.url);
const { generateInvoicePdf, generateQuotePdf } = require('../dist/lib/pdf.js');
const { TIPOS_IVA_ES_BP, invalidTipoIva } = require('../dist/core/validation/fiscalInput.js');
const { tipoIvaNoEmitible } = require('../dist/core/validation/tiposIvaEmitibles.js');
const { calcVatBreakdown } = require('../dist/modules/invoicing/domain/vat.service.js');
const { grossOfLines, stageLinesReconciled, lineasParaFacturar } = require('../dist/modules/invoicing/domain/invoiceLines.service.js');
const { clasificarDetalleDesglose } = require('../dist/modules/fiscal/verifactu/registro.builder.js');
const { distributeStageAmounts } = require('../dist/modules/quotes/domain/billingPlan.js');
const { calcTotal } = require('../dist/core/utils/utils.js');

/** Los defectos que este fichero fija sin arreglar, con el ticket que los lleva. */
const DECLARADOS = Object.freeze({
  'la columna no suma el total': 'SCRUM-1446 · cada línea se redondea al imprimirse y el TOTAL sale de la suma sin redondear.',
  'el 7,5 % se imprime «8%»': 'SCRUM-1447 · `(tax*100).toFixed(0)` en la fila y en el pie de la factura y en la fila del presupuesto.',
  'el presupuesto calcula la cuota al 8 %': 'SCRUM-1447 · `pieDePresupuesto` multiplica por `calcVatBreakdown().rate`, que es `Math.round(tax*100)`.',
  'el registro lleva TipoImpositivo 8': 'SCRUM-1447 · `clasificarDetalleDesglose` escribe `String(rate)` con ese mismo `rate` redondeado.',
  'el total impreso no es el guardado': 'SCRUM-1448 y SCRUM-624 · la factura con líneas recalcula; el guardado es `grossOfLines`.',
});

const IMPORTE = '-?[\\d.]+,\\d{2}';
const aCent = (s) => Math.round(Number(String(s).replace(/\./g, '').replace(',', '.')) * 100);
const L = (price, tax, qty = 1) => ({ qty, price, tax });
const conNombre = (lines) => lines.map((l, i) => ({ concept: `L${i + 1}Z`, ...l }));
let serie = 0;

function leer(outPath) {
  try {
    const r = lineasDePdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un papel sin leer no dice ningún importe.`);
    return r.lineas.map((l) => l.texto);
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}
function filasDe(textos) {
  const filas = [];
  for (const t of textos) {
    const m = t.match(new RegExp(`^(L\\d+Z).*,\\d{2}(\\d+%|—)(${IMPORTE})$`));
    if (m) filas.push({ rotulo: m[2], total: aCent(m[3]) });
  }
  return filas;
}
function unico(textos, patron, que) {
  const hallados = textos.map((t) => t.match(patron)).filter(Boolean);
  assert.equal(hallados.length, 1, `🔴 esperaba UNA línea con ${que} y hay ${hallados.length}: no sé qué estoy leyendo.`);
  return hallados[0];
}

/** El papel de una factura: filas, pie por tipo y total, en céntimos. */
async function papelFactura(lines, total) {
  serie += 1;
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA1446-${serie}`, invoiceId: 1, merchantId: 7,
    merchant: { name: 'QA 1446', legalName: 'QA 1446 SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' }, currency: 'EUR', total, qrData: 'x', type: 'F1',
    lines: conNombre(lines),
  });
  const textos = leer(outPath);
  const pie = textos
    .map((t) => t.match(new RegExp(`^(?:\\d+%${IMPORTE} EUR)?IVA (\\d+%):(${IMPORTE}) EUR$`)))
    .filter(Boolean).map((m) => ({ rotulo: m[1], cuota: aCent(m[2]) }));
  const conLineas = textos.map((t) => t.match(new RegExp(`^TOTAL:(${IMPORTE}) EUR$`))).filter(Boolean);
  const sinLineas = textos.map((t) => t.match(new RegExp(`^Total: (${IMPORTE}) EUR$`))).filter(Boolean);
  assert.equal(conLineas.length + sinLineas.length, 1, '🔴 esperaba UN total en el papel de la factura.');
  return { filas: filasDe(textos), pie, total: aCent((conLineas[0] || sinLineas[0])[1]), ramaSinLineas: sinLineas.length === 1 };
}

/** El papel de un presupuesto. */
async function papelPresupuesto(lines, total) {
  serie += 1;
  const { outPath } = await generateQuotePdf({
    quoteId: 914460000 + serie, quoteNumber: 1, merchant: { name: 'QA 1446' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', total, lines: conNombre(lines), country: 'ES',
  });
  const textos = leer(outPath);
  const pie = textos.map((t) => t.match(new RegExp(`^IVA (\\d+%): (${IMPORTE}) EUR$`)))
    .filter(Boolean).map((m) => ({ rotulo: m[1], cuota: aCent(m[2]) }));
  return {
    filas: filasDe(textos), pie,
    base: aCent(unico(textos, new RegExp(`^Base imponible: (${IMPORTE}) EUR$`), 'la base')[1]),
    total: aCent(unico(textos, new RegExp(`^Total presupuesto: (${IMPORTE}) EUR$`), 'el total')[1]),
  };
}

const suma = (filas) => filas.reduce((a, f) => a + f.total, 0);
const ADMITIDOS = [...TIPOS_IVA_ES_BP].map((b) => b / 10000).sort((a, b) => a - b);

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO: el lector ve lo que está, y un papel que cuadra, cuadra
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1446 · SUELO: en un papel que cuadra, la columna suma el TOTAL y el total es el guardado', async () => {
  const lines = [L(100, 0.21), L(100, 0.21)];
  const guardado = grossOfLines(lines);
  const p = await papelFactura(lines, guardado.toFixed(2));
  assert.deepEqual(
    { filas: p.filas, pie: p.pie, total: p.total, sumaDeLaColumna: suma(p.filas), guardado: Math.round(guardado * 100) },
    {
      filas: [{ rotulo: '21%', total: 12100 }, { rotulo: '21%', total: 12100 }],
      pie: [{ rotulo: '21%', cuota: 4200 }],
      total: 24200, sumaDeLaColumna: 24200, guardado: 24200,
    },
    '🔴 CIEGO: en la factura más simple —dos líneas de 100 al 21 %— el lector no saca 121,00 + 121,00 = ' +
    '242,00. Si no sabe leer un papel que cuadra, lo que diga de los que no cuadran no vale.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① SCRUM-1446 · la columna de las líneas no suma el TOTAL
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1446 · ① DECLARADO: dos líneas de 12,50 al 21 % imprimen 15,13 + 15,13 y TOTAL 30,25', async () => {
  assert.ok(DECLARADOS['la columna no suma el total'].includes('SCRUM-1446'));
  const lines = [L(12.5, 0.21), L(12.5, 0.21)];
  const f = await papelFactura(lines, grossOfLines(lines).toFixed(2));
  const q = await papelPresupuesto(lines, calcTotal(lines).toFixed(2));
  assert.deepEqual(
    {
      factura: { lineas: f.filas.map((x) => x.total), sumaALaVista: suma(f.filas), total: f.total },
      presupuesto: { lineas: q.filas.map((x) => x.total), sumaALaVista: suma(q.filas), total: q.total },
    },
    {
      factura: { lineas: [1513, 1513], sumaALaVista: 3026, total: 3025 },
      presupuesto: { lineas: [1513, 1513], sumaALaVista: 3026, total: 3025 },
    },
    'El papel ya no imprime 15,13 + 15,13 con TOTAL 30,25. Si ahora la columna SUMA el total, es lo ' +
    'que SCRUM-1446 pedía: borra «la columna no suma el total» de `DECLARADOS` y fija aquí los ' +
    'importes nuevos. Si ha cambiado por otra cosa, alguien ha movido una cifra impresa.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② SCRUM-1447 · el tipo redondeado a entero
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1447 · ② DECLARADO: de los tipos que el servidor admite, el 7,5 % —y sólo él— sale «8%» en la factura', async () => {
  assert.ok(DECLARADOS['el 7,5 % se imprime «8%»'].includes('SCRUM-1447'));
  // La población sale del validador, no de una lista copiada: si mañana se admite otro tipo con
  // decimales, entra solo en este recorrido.
  assert.deepEqual(ADMITIDOS, [0, 0.02, 0.04, 0.05, 0.075, 0.1, 0.21],
    'Ha cambiado la lista de tipos que admite `invalidTipoIva`: este caso mide sobre ella.');

  const visto = {};
  for (const t of ADMITIDOS) {
    assert.equal(invalidTipoIva(t), null);
    assert.equal(tipoIvaNoEmitible([{ tax: t }]), null);
    const lines = [L(100, t)];
    const p = await papelFactura(lines, grossOfLines(lines).toFixed(2));
    visto[`${Math.round(t * 10000) / 100} %`] = {
      fila: p.filas[0].rotulo,
      pie: p.pie.map((x) => `${x.rotulo} ${x.cuota}`).join(),
    };
  }
  assert.deepEqual(visto, {
    '0 %': { fila: '—', pie: '' },
    '2 %': { fila: '2%', pie: '2% 200' },
    '4 %': { fila: '4%', pie: '4% 400' },
    '5 %': { fila: '5%', pie: '5% 500' },
    '7.5 %': { fila: '8%', pie: '8% 750' },   // ← el defecto: «IVA 8%: 7,50» sobre una base de 100,00
    '10 %': { fila: '10%', pie: '10% 1000' },
    '21 %': { fila: '21%', pie: '21% 2100' },
  },
  'Ha cambiado lo que la factura imprime como tipo. Si el 7,5 % ya sale con su decimal, borra «el ' +
  '7,5 % se imprime «8%»» de `DECLARADOS` y fija aquí el rótulo nuevo (que es texto: lo firma el fundador).');
});

test('SCRUM-1447 · ② DECLARADO: el pie del presupuesto CALCULA la cuota del 7,5 % al 8 %', async () => {
  assert.ok(DECLARADOS['el presupuesto calcula la cuota al 8 %'].includes('SCRUM-1447'));
  const visto = {};
  for (const t of [0.075, 0.10]) {
    const lines = [L(100, t)];
    const q = await papelPresupuesto(lines, calcTotal(lines).toFixed(2));
    visto[`${t * 100} %`] = { fila: q.filas[0].rotulo, base: q.base, pie: q.pie, total: q.total };
  }
  assert.deepEqual(visto, {
    // Base 100,00 + IVA 8,00 = 108,00, y el Total que se firma es 107,50.
    '7.5 %': { fila: '8%', base: 10000, pie: [{ rotulo: '8%', cuota: 800 }], total: 10750 },
    // El control: con un tipo entero, base + cuota = total.
    '10 %': { fila: '10%', base: 10000, pie: [{ rotulo: '10%', cuota: 1000 }], total: 11000 },
  },
  'Ha cambiado el pie del presupuesto para una línea al 7,5 %. Si ya imprime 7,50, borra «el ' +
  'presupuesto calcula la cuota al 8 %» de `DECLARADOS` y fija aquí el pie nuevo.');
});

test('SCRUM-1447 · ② DECLARADO: el desglose del registro de facturación lleva TipoImpositivo 8 con la cuota del 7,5 %', () => {
  assert.ok(DECLARADOS['el registro lleva TipoImpositivo 8'].includes('SCRUM-1447'));
  const de = (t) => {
    const d = clasificarDetalleDesglose(calcVatBreakdown([L(100, t)]).entries[0], 'QA-1446');
    return { tipoImpositivo: d.tipoImpositivo, base: d.baseImponible, cuota: d.cuotaRepercutida };
  };
  assert.deepEqual({ sieteYMedio: de(0.075), diez: de(0.10) }, {
    sieteYMedio: { tipoImpositivo: '8', base: '100.00', cuota: '7.50' },   // 100,00 × 8 % no es 7,50
    diez: { tipoImpositivo: '10', base: '100.00', cuota: '10.00' },        // el control
  },
  'Ha cambiado el desglose que se construye para una línea al 7,5 %. Si el tipo ya viaja con su ' +
  'decimal, borra «el registro lleva TipoImpositivo 8» de `DECLARADOS` y fija aquí el valor nuevo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ SCRUM-1448 · el total recalculado y el guardado
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1448 · ③ DECLARADO: el TOTAL impreso no es el guardado con dos tipos, con tramos y con descuento de línea', async () => {
  assert.ok(DECLARADOS['el total impreso no es el guardado'].includes('SCRUM-1448'));
  const plan = [{ index: 0, percentage: 0.5, label: '' }, { index: 1, percentage: 0.5, label: '' }];
  const deTramo = [L(2.11, 0.21)];
  const casos = {
    // Las líneas de cada caso las construyen las funciones REALES que llaman las rutas.
    'control · una línea de 100 al 21 %': [L(100, 0.21)],
    'dos tipos · 0,02 al 21 % y 0,01 al 10 %': [L(0.02, 0.21), L(0.01, 0.10)],
    'tramo 2 de 2 al 50 % · 2,11 al 21 %': stageLinesReconciled(deTramo, plan, 1, distributeStageAmounts(calcTotal(deTramo), plan)[1]),
    'descuento de línea del 10 % · 1,74 al 21 %': lineasParaFacturar({ lines: [{ ...L(1.74, 0.21), dto: 10 }], discountGlobalAmount: null }),
  };
  const visto = {};
  for (const [nombre, lines] of Object.entries(casos)) {
    const guardado = grossOfLines(lines);
    const p = await papelFactura(lines, guardado.toFixed(2));
    visto[nombre] = { guardado: Math.round(guardado * 100), impreso: p.total };
  }
  assert.deepEqual(visto, {
    'control · una línea de 100 al 21 %': { guardado: 12100, impreso: 12100 },
    'dos tipos · 0,02 al 21 % y 0,01 al 10 %': { guardado: 3, impreso: 4 },
    'tramo 2 de 2 al 50 % · 2,11 al 21 %': { guardado: 127, impreso: 128 },
    'descuento de línea del 10 % · 1,74 al 21 %': { guardado: 190, impreso: 189 },
  },
  'Ha cambiado el total que imprime la factura o el que se guarda. Si ya coinciden, es lo que ' +
  'SCRUM-1448 y SCRUM-624 pedían: borra «el total impreso no es el guardado» de `DECLARADOS` y ' +
  'fija aquí los importes nuevos.');
});

test('SCRUM-1448 · ③ la factura SIN líneas imprime el guardado, y con líneas lo ignora', async () => {
  const sin = await papelFactura([], '123.45');
  const con = await papelFactura([L(100, 0.21)], '999.99');
  assert.deepEqual(
    { sin: { total: sin.total, rama: sin.ramaSinLineas, filas: sin.filas.length }, con: { total: con.total, rama: con.ramaSinLineas } },
    { sin: { total: 12345, rama: true, filas: 0 }, con: { total: 12100, rama: false } },
    'Ha cambiado de dónde sale el total del PDF de la factura. Hoy son dos fuentes en el mismo ' +
    'documento según tenga líneas o no (SCRUM-1448); si pasa a ser una, fija aquí cuál.');
});

test('SCRUM-1446 · los defectos declarados son EXACTAMENTE cinco, y cada uno nombra su ticket', () => {
  assert.equal(Object.keys(DECLARADOS).length, 5,
    'La lista de defectos declarados ha cambiado de tamaño. Sólo puede menguar, y al menguar se ' +
    'cambia este número en el mismo commit.');
  for (const [k, motivo] of Object.entries(DECLARADOS)) {
    assert.match(motivo, /^SCRUM-\d+ /, `«${k}» se declara sin decir de qué ticket viene.`);
  }
});
