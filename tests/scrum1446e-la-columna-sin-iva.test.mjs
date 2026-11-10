// tests/scrum1446e-la-columna-sin-iva.test.mjs — SCRUM-1446e
//
// LA VÍCTIMA: quien tiene en la mano una factura y suma la columna de las líneas con una
// calculadora. Hasta hoy, dos líneas de 12,50 al 21 % imprimían 15,13 + 15,13 = 30,26, y el pie
// decía 30,25: cada línea llevaba su IVA redondeado por su cuenta.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA DECISIÓN: SCRUM-1446 comentario 20917 (P1, P2, P4 y P5).
//   · P1 ✅ en la F1 la columna de cada línea va SIN IVA y suma la «Base imponible» del pie. Su
//     cabecera dice «IMPORTE» (literal firmado en ese mismo comentario).
//   · P2 ❌ el TOTAL sigue siendo el guardado (SCRUM-624e): este fichero lo comprueba también.
//   · P4 ✅ el presupuesto en PDF, igual: su columna va sin IVA. Su cabecera dice también «IMPORTE»
//     desde SCRUM-1446f: el fundador extendió el literal al presupuesto en SCRUM-1446 comentario 20939.
//   · La R1 y el justificante, COMO HOY: con IVA y «TOTAL». Lo fija el caso ③.
//
// Se genera el PDF DE VERDAD (`generateInvoicePdf`, `generateQuotePdf`) en memoria y se lee con
// el lector de la casa. Ninguna base, ningún importe guardado, ningún XML.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { lineasDePdf } from './_texto-del-pdf.mjs';

const require = createRequire(import.meta.url);
const { generateInvoicePdf, generateQuotePdf } = require('../dist/lib/pdf.js');
const { grossOfLines, stageLinesReconciled } = require('../dist/modules/invoicing/domain/invoiceLines.service.js');
const { distributeStageAmounts } = require('../dist/modules/quotes/domain/billingPlan.js');
const { calcTotal, precioConDto } = require('../dist/core/utils/utils.js');

// Lo que tiene que tumbar a este fichero. Las corre el meta-guard (`aplicarUna`), y cada una cae en
// el caso que nombra: la cabecera, la columna de la F1, la R1 que no se toca y el presupuesto.
// Cada campo, LITERAL: el lector de declaraciones no resuelve constantes (con una, leía 0).
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts', de: "doc.text(columnaSinIva ? 'IMPORTE' : 'TOTAL', XT,", a: "doc.text(columnaSinIva ? 'TOTAL' : 'TOTAL', XT,",
    cae: 'SCRUM-1446e · ① la cabecera de la columna de la F1' },
  { fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts', de: 'qty * price * (1 + (columnaSinIva ? 0 : taxR))', a: 'qty * price * (1 + taxR)',
    cae: 'SCRUM-1446e · ① la F1 de dos líneas' },
  { fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts', de: "const columnaSinIva = (params.type ?? 'F1') === 'F1';", a: 'const columnaSinIva = true;',
    cae: 'SCRUM-1446e · ③ la R1 y el justificante' },
  { fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts', de: 'const lineTotal = l.qty * l.price;', a: 'const lineTotal = l.qty * l.price * (1 + l.tax);',
    cae: 'SCRUM-1446e · ④ el presupuesto' },
  { fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts', de: ".text('IMPORTE', X_TOTAL, doc.y - 12,", a: ".text('Total', X_TOTAL, doc.y - 12,",
    cae: 'SCRUM-1446e · ④ el presupuesto' },
  // SCRUM-1446g · el reparto de los tramos: a la ÚLTIMA línea (la opción A, rechazada en c.20945),
  // el desempate al revés, sin detectar el tramo, y sin respetar el tramo que ya suma.
  { fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts', de: '.sort((a, b) => restos[b] - restos[a] || a - b)', a: '.sort((a, b) => b - a)',
    cae: 'SCRUM-1446e · ⑦ en 70 tramos' },
  { fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts', de: 'restos[b] - restos[a] || a - b)', a: 'restos[b] - restos[a] || b - a)',
    cae: 'SCRUM-1446e · ⑤ ARREGLADO' },
  { fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts', de: 'if (!deTramo) return null;', a: 'if (deTramo) return null;',
    cae: 'SCRUM-1446e · ⑤ ARREGLADO' },
  { fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts', de: 'if (idx.reduce((a, i) => a + cents[i], 0) === objetivo) continue;', a: '',
    cae: 'SCRUM-1446e · ⑥ un tramo que YA suma' },
];

const IMPORTE = '-?[\\d.]+,\\d{2}';
const aCent = (s) => Math.round(Number(String(s).replace(/\./g, '').replace(',', '.')) * 100);
const L = (price, tax, qty = 1) => ({ qty, price, tax });
const conNombre = (lines) => lines.map((l, i) => ({ concept: `L${i + 1}Z`, ...l }));
const suma = (xs) => xs.reduce((a, b) => a + b, 0);
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
function unico(textos, patron, que) {
  const hallados = textos.map((t) => t.match(patron)).filter(Boolean);
  assert.equal(hallados.length, 1, `🔴 esperaba UNA línea con ${que} y hay ${hallados.length}: no sé qué estoy leyendo.`);
  return hallados[0];
}
/** La columna de cada línea, en céntimos: lo que va detrás del rótulo del tipo. */
function columna(textos, ancla) {
  const vistas = textos.map((t) => t.match(new RegExp(`^L\\d+Z${ancla}(${IMPORTE})$`))).filter(Boolean);
  return vistas.map((m) => aCent(m[1]));
}

/** El papel de una factura del tipo dado. */
async function papelFactura(type, lines, total) {
  serie += 1;
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA1446E-${serie}`, invoiceId: 1, merchantId: 7,
    merchant: { name: 'QA 1446e', legalName: 'QA 1446e SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' }, currency: 'EUR', total, qrData: 'x', type,
    rectifiesNumber: type === 'R1' ? 'F-2026-QA1446E-0' : undefined,
    lines: conNombre(lines),
  });
  const textos = leer(outPath);
  return {
    cabecera: unico(textos, /^CONCEPTOCANT\.PRECIO UNITIVA %(.*)$/, 'la cabecera de la tabla')[1],
    lineas: columna(textos, '.*,\\d{2}(?:[\\d,]+%|—)'),
    base: aCent(unico(textos, new RegExp(`^Base imponible:(${IMPORTE}) EUR$`), 'la base')[1]),
    total: aCent(unico(textos, new RegExp(`^TOTAL(?: COBRADO)?:(${IMPORTE}) EUR$`), 'el total')[1]),
  };
}

/** El papel de un presupuesto. */
async function papelPresupuesto(lines, total) {
  serie += 1;
  const { outPath } = await generateQuotePdf({
    quoteId: 914461000 + serie, quoteNumber: 1, merchant: { name: 'QA 1446e' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', total, lines: conNombre(lines), country: 'ES',
  });
  const textos = leer(outPath);
  return {
    cabecera: unico(textos, /^(.*)IVA%PrecioCant\.$/, 'la cabecera de la tabla')[1],
    lineas: columna(textos, '.*,\\d{2}(?:[\\d,]+%)'),
    base: aCent(unico(textos, new RegExp(`^Base imponible: (${IMPORTE}) EUR$`), 'la base')[1]),
    total: aCent(unico(textos, new RegExp(`^Total presupuesto: (${IMPORTE}) EUR$`), 'el total')[1]),
  };
}

const DOCE_CINCUENTA = [L(12.5, 0.21), L(12.5, 0.21)];
const CIEN = [L(100, 0.21)];

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① LA F1: la columna sin IVA suma la base del pie, y el TOTAL es el guardado
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1446e · ① la F1 de dos líneas de 12,50 al 21 %: 12,50 + 12,50 = Base 25,00, y TOTAL 30,25 (el guardado)', async () => {
  const p = await papelFactura('F1', DOCE_CINCUENTA, grossOfLines(DOCE_CINCUENTA).toFixed(2));
  assert.deepEqual(
    { lineas: p.lineas, sumaALaVista: suma(p.lineas), base: p.base, total: p.total },
    { lineas: [1250, 1250], sumaALaVista: 2500, base: 2500, total: 3025 },
    '🔴 la columna de la F1 ya no suma la «Base imponible» del pie, o el TOTAL ha dejado de ser el ' +
    'guardado. Decisión del fundador: SCRUM-1446 c.20917 (P1 ✅, P2 ❌).');
});

test('SCRUM-1446e · ① CONTROL: 1 × 100 al 21 % — la línea, la base y el total salen como siempre cuadraron', async () => {
  const p = await papelFactura('F1', CIEN, grossOfLines(CIEN).toFixed(2));
  assert.deepEqual({ lineas: p.lineas, base: p.base, total: p.total }, { lineas: [10000], base: 10000, total: 12100 },
    '🔴 en la factura más simple la columna no dice 100,00 o el pie no dice 100,00 + IVA = 121,00.');
});

test('SCRUM-1446e · ① la cabecera de la columna de la F1 es «IMPORTE», byte a byte (SCRUM-1446 c.20917)', async () => {
  const p = await papelFactura('F1', CIEN, '121.00');
  assert.equal(p.cabecera, 'IMPORTE',
    '🔴 la cabecera de la columna de la F1 no es el literal firmado «IMPORTE» (SCRUM-1446 c.20917).');
  assert.deepEqual([...Buffer.from(p.cabecera, 'utf8')], [0x49, 0x4d, 0x50, 0x4f, 0x52, 0x54, 0x45]);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② LA PROPIEDAD, sobre una población: con precios de 2 decimales y cantidades enteras, la columna
// de la F1 suma la base SIEMPRE. El control a cero sale de la MISMA población con la columna que
// había (con IVA): tiene que haber casos que no sumen, o la propiedad no mide nada.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1446e · ② en 60 F1 de dos líneas (21 % y 10 %), la columna suma la base en las 60; con IVA, no', async () => {
  let medidas = 0;
  let conIvaNoSumaria = 0;
  for (const tax of [0.21, 0.10]) {
    for (let c = 1; c <= 30; c += 1) {
      const precio = (c * 37 + 5) / 100;          // 0,42 · 0,79 · … 11,15: sin semilla al azar
      const lines = [L(precio, tax), L(precio, tax, 2)];
      const p = await papelFactura('F1', lines, grossOfLines(lines).toFixed(2));
      assert.equal(suma(p.lineas), p.base, `🔴 F1 ${precio} al ${tax * 100} %: la columna suma ${suma(p.lineas)} y la base es ${p.base}.`);
      assert.equal(p.total, Math.round(grossOfLines(lines) * 100), '🔴 el TOTAL no es el guardado');
      const conIva = lines.map((l) => Math.round(l.qty * l.price * (1 + tax) * 100));
      if (suma(conIva) !== p.total) conIvaNoSumaria += 1;
      medidas += 1;
    }
  }
  assert.equal(medidas, 60, 'esperaba medir 60 facturas');
  assert.ok(conIvaNoSumaria > 0,
    '🔴 CIEGO: en esta población la columna CON IVA también sumaría el total, así que la propiedad no distingue nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ LA R1 Y EL JUSTIFICANTE, COMO HOY: con IVA por línea y cabecera «TOTAL»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1446e · ③ la R1 y el justificante NO cambian: la columna con IVA (15,13 + 15,13) y «TOTAL»', async () => {
  const visto = {};
  for (const type of ['R1', 'JUST']) {
    const p = await papelFactura(type, DOCE_CINCUENTA, grossOfLines(DOCE_CINCUENTA).toFixed(2));
    visto[type] = { cabecera: p.cabecera, lineas: p.lineas, base: p.base, total: p.total };
  }
  assert.deepEqual(visto, {
    R1: { cabecera: 'TOTAL', lineas: [1513, 1513], base: 2500, total: 3025 },
    JUST: { cabecera: 'TOTAL', lineas: [1513, 1513], base: 2500, total: 3025 },
  },
  '🔴 ha cambiado el papel de la R1 o del justificante. SCRUM-1446e sólo toca la F1: la R1 espera al ' +
  'asesor y del justificante primero se mide si alguien lo crea (SCRUM-1446 c.20917, P6/P7).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ EL PRESUPUESTO (P4): su columna va sin IVA, y su cabecera dice «IMPORTE» (SCRUM-1446f, c.20939)
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1446e · ④ el presupuesto de dos líneas de 12,50 al 21 %: 12,50 + 12,50 = Base 25,00, Total 30,25', async () => {
  const q = await papelPresupuesto(DOCE_CINCUENTA, calcTotal(DOCE_CINCUENTA).toFixed(2));
  assert.deepEqual(
    { cabecera: q.cabecera, lineas: q.lineas, sumaALaVista: suma(q.lineas), base: q.base, total: q.total },
    { cabecera: 'IMPORTE', lineas: [1250, 1250], sumaALaVista: 2500, base: 2500, total: 3025 },
    '🔴 la columna del presupuesto ya no va sin IVA, o ha cambiado su cabecera o su Total ' +
    '(SCRUM-1446 c.20917, P4; cabecera «IMPORTE», c.20939). La cabecera no cambia sin un literal firmado.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ ⑥ ⑦ LOS TRAMOS (SCRUM-1446g): las líneas guardadas llevan fracciones de céntimo (SCRUM-624
// c.20049), y hasta 1446g la columna no sumaba la base en un 32-48 % de los tramos. Decisión del
// fundador: SCRUM-1446 c.20945, opción B — el céntimo que falta va a la línea de MAYOR RESTO.
// Desempate (c.20944 no lo fija): el primero en orden de línea. Un tramo que ya suma, no se toca.
// ═════════════════════════════════════════════════════════════════════════════════════════

const tramo = (deTramo, pcts, i) => {
  const plan = pcts.map((percentage, index) => ({ index, percentage, label: '' }));
  return stageLinesReconciled(deTramo, plan, i, distributeStageAmounts(calcTotal(deTramo), plan)[i]);
};

test('SCRUM-1446e · ⑤ ARREGLADO (1446g): un tramo al 50 % de 2,11 + 3,33 al 21 % — 1,06 + 1,66 = Base 2,72', async () => {
  const lines = tramo([L(2.11, 0.21), L(3.33, 0.21)], [0.5, 0.5], 1);
  const p = await papelFactura('F1', lines, grossOfLines(lines).toFixed(2));
  assert.deepEqual({ lineas: p.lineas, sumaALaVista: suma(p.lineas), base: p.base }, TRAMO_REPARTIDO,
    '🔴 la columna del tramo ya no suma la base, o el céntimo ha ido a otra línea. Guarda 1,055 y 1,665: ' +
    'las dos fracciones empatan y el céntimo va a la PRIMERA (SCRUM-1446 c.20945, desempate de 1446g).');
});
// Medido el 26-oct-2026 con este mismo papel, ANTES de 1446g: 1,06 + 1,67 = 2,73 sobre una base de 2,72.
const TRAMO_REPARTIDO = Object.freeze({ lineas: [106, 166], sumaALaVista: 272, base: 272 });

test('SCRUM-1446e · ⑥ un tramo que YA suma no cambia: 30 % de 1,65 + 3,45 al 21 % sigue 0,49 + 1,04 = 1,53', async () => {
  const lines = tramo([L(1.65, 0.21), L(3.45, 0.21)], [0.3, 0.7], 0);
  const p = await papelFactura('F1', lines, grossOfLines(lines).toFixed(2));
  // Guarda 0,495 y 1,035: empatan, y el mayor resto a secas daría 0,50 + 1,03 — también suma 1,53,
  // pero movería dos líneas que hoy ya cuadran. Encontrado barriendo, no razonado.
  assert.deepEqual({ lineas: p.lineas, base: p.base }, { lineas: [49, 104], base: 153 },
    '🔴 el reparto ha movido un tramo cuya columna ya sumaba la base (SCRUM-1446 c.20944: el desempate ' +
    '«que respete el redondeo de hoy»).');
});

test('SCRUM-1446e · ⑦ en 70 tramos (50/50, 30/70, 30/40/30) la columna suma la base en los 70; antes, no', async () => {
  let medidos = 0;
  let antesNoSumaba = 0;
  for (const pcts of [[0.5, 0.5], [0.3, 0.7], [0.3, 0.4, 0.3]]) {
    for (let c = 1; c <= 10; c += 1) {
      const deTramo = [L((c * 4321 + 107) / 100, 0.21), L((c * 997 + 233) / 100, 0.21), L((c * 59 + 11) / 100, 0.21)];
      for (let i = 0; i < pcts.length; i += 1) {
        const lines = tramo(deTramo, pcts, i);
        const p = await papelFactura('F1', lines, grossOfLines(lines).toFixed(2));
        assert.equal(suma(p.lineas), p.base, `🔴 tramo ${i} de ${pcts.join('/')} (c=${c}): la columna suma ${suma(p.lineas)} y la base es ${p.base}.`);
        lines.forEach((l, j) => assert.ok(Math.abs(p.lineas[j] - l.qty * l.price * 100) < 1,
          `🔴 la línea ${j + 1} se aleja un céntimo o más de su importe exacto: el reparto carga de más.`));
        // Mayor resto: ninguna línea que BAJÓ al céntimo tiene más fracción que una que SUBIÓ.
        const exacto = lines.map((l) => l.qty * l.price * 100);
        const fr = exacto.map((e) => e - Math.floor(e + 1e-6));
        const subio = exacto.map((e, j) => p.lineas[j] > e + 1e-6);
        const minSube = Math.min(...fr.filter((_, j) => subio[j]));
        const maxBaja = Math.max(...fr.filter((_, j) => !subio[j] && fr[j] > 1e-6));
        assert.ok(!(maxBaja > minSube + 1e-6),
          `🔴 tramo ${i} de ${pcts.join('/')} (c=${c}): el céntimo no fue a la de mayor resto (${p.lineas.join(' + ')}).`);
        if (suma(lines.map((l) => Math.round(l.qty * l.price * 100))) !== p.base) antesNoSumaba += 1;
        medidos += 1;
      }
    }
  }
  assert.equal(medidos, 70, 'esperaba medir 70 tramos (10 × 2 + 10 × 2 + 10 × 3)');
  assert.ok(antesNoSumaba > 0, '🔴 CIEGO: en esta población cada línea redondeada por su cuenta ya sumaría la base.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1446h · SIN TRAMOS TAMBIÉN. Decisión del fundador: SCRUM-1446 comentario 20964 (Q1 de
// c.20961): el reparto de mayor resto vale para TODA F1 cuya columna sin IVA no sume la base. Lo
// que lo dispara es un importe con fracción de céntimo, venga de un tramo, de un descuento por
// línea o de un precio de tres decimales (la API admite cuatro, SCRUM-712).
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1446e · ⑧ (1446h) sin tramos, dos líneas de 3,33 con un 10 % de descuento al 21 % — 3,00 + 2,99 = Base 5,99', async () => {
  const precio = precioConDto(3.33, 10);
  assert.ok(Math.abs(precio - 2.997) < 1e-9, `CIEGO: 3,33 con un 10 % debería guardar 2,997 y guarda ${precio}`);
  const lines = [L(precio, 0.21), L(precio, 0.21)];
  const p = await papelFactura('F1', lines, grossOfLines(lines).toFixed(2));
  // Medido el 27-oct-2026 con este mismo papel y el reparto quitado (la columna de 1446e): 3,00 + 3,00 = 6,00 sobre 5,99.
  assert.deepEqual({ lineas: p.lineas, base: p.base }, { lineas: [300, 299], base: 599 },
    '🔴 una F1 sin tramos con descuento por línea ya no suma la base en su columna (SCRUM-1446 c.20964).');
});

test('SCRUM-1446e · ⑨ (1446h) sin tramos, dos líneas de 4,125 € al 21 % — 4,13 + 4,12 = Base 8,25', async () => {
  // 4,125 es exacto en binario (33/8): el medio céntimo no depende de cómo se guarde el número.
  const lines = [L(4.125, 0.21), L(4.125, 0.21)];
  const p = await papelFactura('F1', lines, grossOfLines(lines).toFixed(2));
  // Medido el 27-oct-2026 con este mismo papel y el reparto quitado (la columna de 1446e): 4,13 + 4,13 = 8,26 sobre 8,25.
  assert.deepEqual({ lineas: p.lineas, base: p.base }, { lineas: [413, 412], base: 825 },
    '🔴 una F1 sin tramos con un precio de tres decimales ya no suma la base en su columna (SCRUM-1446 c.20964).');
});
