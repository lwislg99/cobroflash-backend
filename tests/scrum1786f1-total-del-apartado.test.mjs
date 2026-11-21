// tests/scrum1786f1-total-del-apartado.test.mjs — SCRUM-1786f1
//
// EL ENCARGO: en el PDF del PRESUPUESTO (`generateQuotePdf`), una fila «Total del apartado» bajo cada
// apartado, con la suma de sus líneas. Decisión del fundador: SCRUM-1786 c.22329 («1-Sí lánzalo»).
// Literal firmado en c.22269: `Total del apartado`. El PDF de FACTURA no se toca; el modo agrupado no
// entra (depende de los tramos d/e).
//
// QUÉ SUMA LA FILA: la columna IMPORTE de las líneas del apartado, que va SIN IVA y SIN el `dto` de
// línea (SCRUM-1446e). La cifra sale de `calcVatBreakdown(...).base` sobre esas líneas: la MISMA
// primitiva y el mismo redondeo que dan la base del pie (`pieDePresupuesto`). Por eso, sin
// descuentos, los totales de los apartados suman la «Base imponible»; con descuentos suman la
// «Suma de líneas», que es la fila del pie que está antes de restarlos (caso ④).
//
// CÓMO SE MIDE: el PDF de verdad, leído con `lineasDePdf` (texto y posición de cada línea). En el PDF
// la `y` crece hacia ARRIBA: una fila que va «debajo» tiene la `y` menor.
//
// DATOS FABRICADOS: ningún teléfono ni dato real (el presupuesto no lleva teléfono de cliente).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { lineasDePdf } from './_texto-del-pdf.mjs';

const require = createRequire(import.meta.url);
const { generateQuotePdf } = require('../dist/lib/pdf.js');
const { calcTotal } = require('../dist/core/utils/utils.js');

/** Mutaciones que este test tiene que tumbar (se aplican con `aplicarUna`, scripts/meta-guard-mutaciones.mjs). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La fila desaparece: el cierre del apartado no pinta nada.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: '  if (apartadoAbierto) pintarTotalDelApartado(apartadoAbierto);',
    a: '  if (apartadoAbierto) void apartadoAbierto;',
    cae: 'cada apartado lleva su Total del apartado',
  },
  {
    // Suma mal: el total del apartado deja fuera su última línea.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: '  const importe = calcVatBreakdown(lineasDelApartado as any).base;',
    a: '  const importe = calcVatBreakdown(lineasDelApartado.slice(0, -1) as any).base;',
    cae: 'cada apartado lleva su Total del apartado',
  },
];

const ROTULO = 'Total del apartado';
const cab = (concept) => ({ concept, apartado: true });
const L = (concept, qty, price, tax, extra = {}) => ({ concept, qty, price, tax, ...extra });

// Dos apartados × 3 y 2 líneas, con dos tipos de IVA dentro del primero.
const CON_APARTADOS = [
  cab('Salón'),
  L('Pintura plástica', 2, 100, 0.21), L('Aire acondicionado', 1, 50.5, 0.21), L('Mano de obra', 3, 12.25, 0.1),
  cab('Cocina'),
  L('Alicatado', 1, 300, 0.21), L('Silicona', 4, 7.5, 0.21),
];
const SIN_APARTADOS = CON_APARTADOS.filter((l) => !l.apartado);

let serie = 0;
async function lineasDelPresupuesto(lines, extra = {}) {
  serie += 1;
  const { outPath } = await generateQuotePdf({
    quoteId: 917861000 + serie, quoteNumber: 1, merchant: { name: 'QA 1786f1' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', total: String(calcTotal(lines, extra.discountGlobalAmount ?? null)), lines, country: 'ES',
    ...extra,
  });
  try {
    const r = lineasDePdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Sin líneas no hay nada que medir.`);
    return r.lineas;
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

const aCent = (s) => Math.round(Number(s.replace(/\./g, '').replace(',', '.')) * 100);
const IMPORTE = '-?[\\d.]+,\\d{2}';

/** La línea cuyo texto EMPIEZA por `inicio`. Exactamente una, o el instrumento está ciego. */
function una(lineas, inicio) {
  const l = lineas.filter((x) => x.texto.startsWith(inicio));
  assert.equal(l.length, 1, `🔴 CIEGO: esperaba 1 línea que empiece por «${inicio}» y hay ${l.length}`);
  return l[0];
}

/** Las filas «Total del apartado», en orden de arriba abajo, con su importe en céntimos. */
function totalesDeApartado(lineas) {
  return lineas
    .filter((l) => l.texto.startsWith(ROTULO))
    .map((l) => {
      const m = l.texto.match(new RegExp(`^${ROTULO}(${IMPORTE})$`));
      assert.ok(m, `🔴 la fila «${l.texto}» no es «${ROTULO}» + importe`);
      return { y: l.y, cent: aCent(m[1]) };
    });
}

function importeDelPie(lineas, rotulo) {
  const m = una(lineas, rotulo).texto.match(new RegExp(`^${rotulo} (${IMPORTE}) EUR$`));
  assert.ok(m, `🔴 la fila del pie «${rotulo}» no tiene la forma esperada`);
  return aCent(m[1]);
}

/** Huella de texto + posición de todas las líneas: lo que el control sin apartados compara. */
const huella = (lineas) => crypto.createHash('sha256')
  .update(JSON.stringify(lineas.map((l) => [l.x.toFixed(2), l.y.toFixed(2), l.texto])))
  .digest('hex');

// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1786f1 ① cada apartado lleva su Total del apartado, con la suma de sus líneas', async () => {
  const lineas = await lineasDelPresupuesto(CON_APARTADOS);
  const totales = totalesDeApartado(lineas);
  // Salón: 200,00 + 50,50 + 36,75 = 287,25 · Cocina: 300,00 + 30,00 = 330,00
  assert.deepEqual(totales.map((t) => t.cent), [28725, 33000]);

  // Y cada uno va DEBAJO de la última línea de su apartado y ENCIMA de lo que sigue.
  const ultimaSalon = una(lineas, 'Mano de obra');
  const cocina = una(lineas, 'Cocina');
  const ultimaCocina = una(lineas, 'Silicona');
  const base = una(lineas, 'Base imponible:');
  assert.ok(totales[0].y < ultimaSalon.y && totales[0].y > cocina.y,
    `el total de «Salón» (y=${totales[0].y}) no está entre su última línea (${ultimaSalon.y}) y «Cocina» (${cocina.y})`);
  assert.ok(totales[1].y < ultimaCocina.y && totales[1].y > base.y,
    `el total de «Cocina» (y=${totales[1].y}) no está entre su última línea (${ultimaCocina.y}) y el pie (${base.y})`);
});

test('SCRUM-1786f1 ② los totales de los apartados suman la base imponible del documento', async () => {
  const lineas = await lineasDelPresupuesto(CON_APARTADOS);
  const totales = totalesDeApartado(lineas);
  assert.equal(totales.length, 2, `población: 2 apartados, salen ${totales.length} filas`);
  const base = importeDelPie(lineas, 'Base imponible:');
  assert.equal(base, 61725);
  assert.equal(totales.reduce((a, t) => a + t.cent, 0), base);
});

test('SCRUM-1786f1 ③ control: sin apartados, el texto y las posiciones no cambian', async () => {
  const lineas = await lineasDelPresupuesto(SIN_APARTADOS);
  assert.equal(lineas.filter((l) => l.texto.includes(ROTULO)).length, 0);
  // Población declarada: 17 líneas. Huella tomada del código de ANTES del cambio (main 8de57b45a).
  assert.equal(lineas.length, 17);
  assert.equal(huella(lineas), HUELLA_SIN_APARTADOS);

  const conDescuento = await lineasDelPresupuesto(
    SIN_APARTADOS.map((l, i) => (i === 0 ? { ...l, dto: 10 } : l)),
    { discountGlobalAmount: 5, modoIva: 'no_incluido' },
  );
  assert.equal(conDescuento.filter((l) => l.texto.includes(ROTULO)).length, 0);
  assert.equal(huella(conDescuento), HUELLA_SIN_APARTADOS_NO_INCLUIDO);
});

test('SCRUM-1786f1 ④ con descuentos, el total del apartado suma su columna IMPORTE (antes del descuento) y los apartados suman la «Suma de líneas»', async () => {
  const lineas = await lineasDelPresupuesto(
    CON_APARTADOS.map((l) => (l.concept === 'Pintura plástica' ? { ...l, dto: 10 } : l)),
    { discountGlobalAmount: 5 },
  );
  const totales = totalesDeApartado(lineas);
  assert.deepEqual(totales.map((t) => t.cent), [28725, 33000]);
  const sumaDeLineas = importeDelPie(lineas, 'Suma de líneas:');
  assert.equal(totales.reduce((a, t) => a + t.cent, 0), sumaDeLineas);
  // Y la base, ya con los descuentos restados, NO es esa suma: el pie los resta debajo.
  assert.equal(importeDelPie(lineas, 'Base imponible:'), 61725 - 2000 - 500);
});

// Huellas medidas sobre el código ANTES del cambio (ver el registro, tramo SCRUM-1786f1).
const HUELLA_SIN_APARTADOS = '5ecf73de9272c5cf9b046d242e54d654f0d9aa256beff12df79ba4b13fc64c8e';
const HUELLA_SIN_APARTADOS_NO_INCLUIDO = '6b50bf08ae3d8677f61e35967e04973b828fe0c88207fa61f2a3a7e4b32c9021';
