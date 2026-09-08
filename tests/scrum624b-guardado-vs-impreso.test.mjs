// tests/scrum624b-guardado-vs-impreso.test.mjs — SCRUM-624 (fase B)
//
// LA VÍCTIMA: un instituto que tiene en la mano un papel con un total, y en la base hay otro.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUÉ MIDE ESTO Y EN QUÉ SE DIFERENCIA DE LO QUE YA HABÍA
//
// El censo de SCRUM-624 fijó que las DOS CONVENCIONES divergen —36,27 por la escrita, 36,26 por la
// del PDF— comparando las dos fórmulas entre sí. Eso prueba que el camino existe.
//
// Esto es otra pregunta: **se genera el PDF de verdad y se lee el número que IMPRIME**, y se
// compara con el `total` GUARDADO que se le ha pasado. No se mira la función que calcula: se mira
// el papel. Es la diferencia entre «hay dos fórmulas» y «este documento miente».
//
// ⚠️ `generateInvoicePdf` recibe **las dos cosas**: `total` (el guardado) y `lines`. Cuando hay
// líneas, ignora `total` y recalcula (`pdf.service.ts:399-411`). Ése es el defecto entero.
//
// ⛔ ESTE FICHERO NO MODIFICA EL CAMINO DE EMISIÓN (regla 38). Sólo lo EJERCITA y lee su salida.
// Corregir el cálculo cambiaría lo que imprimen documentos ya emitidos —SCRUM-623 lo midió: 547 de
// 4.006 combinaciones cambiarían un céntimo—, y eso es decisión del fundador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extraerTextoPdf, vecesEnPdf } from './_texto-del-pdf.mjs';

const { generateInvoicePdf } = await import('../dist/lib/pdf.js');

/** Genera la factura y devuelve el texto del papel. */
async function papelDe({ total, lines, sufijo }) {
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA624${sufijo}`,
    invoiceId: 1,
    merchantId: 7,
    merchant: { name: 'Tecnosel QA', legalName: 'Tecnosel QA SL', taxId: 'B00000000' },
    customer: { name: 'Instituto QA' },
    currency: 'EUR', total, qrData: 'x', type: 'F1', lines,
  });
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true,
      `🔴 NO SUPE LEER EL PDF (${sufijo}): ${r.motivo}. Un texto vacío se leería como «el papel no ` +
      'dice ese número», que es un falso verde — y aquí el falso verde es «no hay divergencia».');
    return r.texto;
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

/** El importe con el formato del papel (es-ES): 36,27. */
const enPapel = (n) => Number(n).toFixed(2).replace('.', ',');

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SUELO: si el instrumento no lee un número que SÍ está, no mide nada
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-624b · 🔴 SUELO: el lector encuentra un total que SÍ está impreso', async () => {
  // Una factura que cuadra por construcción: una línea sin IVA y sin decimales raros.
  const texto = await papelDe({ total: '100.00', lines: [{ qty: 1, price: 100, tax: 0 }], sufijo: 'S' });
  assert.ok(vecesEnPdf(texto, enPapel(100)) > 0,
    '🔴 CIEGO: el lector no encuentra «100,00» en un papel que lo imprime. Si no sabe leer un ' +
    'número que está, su «no divergen» no significaría nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO QUE IMPORTA: guardado ≠ impreso, con los DOS números
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Los documentos cuyo total guardado NO es el que imprime el papel, DECLARADOS con su motivo.
 *
 * 🔴 No se arreglan aquí y no es una omisión: corregir el cálculo del PDF **modifica el camino de
 * emisión** (regla 38) y cambia cifras ya impresas —SCRUM-623 midió 547 de 4.006—. Es una decisión
 * del fundador, y hasta que la tome esto queda **declarado**, no escondido.
 *
 * **La lista solo puede MENGUAR.** Si aparece un caso nuevo, es que alguien ha abierto otro camino
 * de divergencia y este guard cae nombrándolo.
 */
const DIVERGENCIAS_DECLARADAS = Object.freeze({
  'redondeo por línea': 'SCRUM-624 · la convención ESCRITA redondea el céntimo por línea (36,27) y el PDF suma en float (36,26). Corregirlo es camino de emisión: decide el fundador.',
  'decimales del precio': 'SCRUM-624 · `price` no limita decimales (`schemas.ts:16`), así que un 30,003 guarda 30,01 e imprime 30,00. Es el caso que YA ocurrió en staging.',
});

test('SCRUM-624b · 🔴 EL PAPEL Y LA BASE: el total impreso es el GUARDADO', async () => {
  // El caso de la convención escrita: tres líneas de 9,99 al 21 %.
  const LINEAS = [
    { qty: 1, price: 9.99, tax: 0.21 },
    { qty: 1, price: 9.99, tax: 0.21 },
    { qty: 1, price: 9.99, tax: 0.21 },
  ];
  // Lo que se GUARDA, por la convención escrita (céntimo por línea).
  let cents = 0;
  for (const l of LINEAS) {
    const b = Math.round(l.qty * l.price * 100);
    cents += b + Math.round(b * l.tax);
  }
  const guardado = (cents / 100).toFixed(2);

  const texto = await papelDe({ total: guardado, lines: LINEAS, sufijo: 'A' });
  const imprimeElGuardado = vecesEnPdf(texto, enPapel(guardado)) > 0;

  if (!imprimeElGuardado) {
    // Se lee del papel lo que SÍ imprime, para nombrar los dos números y no decir «no cuadra».
    let sub = 0; let vat = 0;
    for (const l of LINEAS) { sub += l.qty * l.price; vat += l.qty * l.price * l.tax; }
    const impreso = (sub + vat).toFixed(2);
    assert.ok(vecesEnPdf(texto, enPapel(impreso)) > 0,
      `🔴 el papel no imprime ni ${enPapel(guardado)} ni ${enPapel(impreso)}: este guard ya no ` +
      'sabe qué está midiendo, y su rojo no se puede leer.');

    assert.ok(Object.prototype.hasOwnProperty.call(DIVERGENCIAS_DECLARADAS, 'redondeo por línea'),
      `🔴 EL PAPEL DICE UN TOTAL Y LA BASE OTRO.\n` +
      `    guardado: ${enPapel(guardado)} €   ·   IMPRESO EN EL PAPEL: ${enPapel(impreso)} €\n\n` +
      '  El cliente tiene en la mano un número que no es el que hay en la base. En una empresa\n' +
      '  que factura a institutos, ese papel es el que se discute.');
  }

  // ⚠️ Y si un día SÍ coinciden, este guard tiene que enterarse: la declaración sobraría.
  if (imprimeElGuardado) {
    assert.fail(
      '✅ EL PAPEL YA IMPRIME EL GUARDADO por la convención de redondeo. Eso es lo que este ticket ' +
      'pedía: borra «redondeo por línea» de `DIVERGENCIAS_DECLARADAS` en este mismo commit. Una ' +
      'lista que no mengua deja de señalar lo que falta.');
  }
});

test('SCRUM-624b · 🔴 el OTRO camino, sobre el papel: decimales del precio', async () => {
  // El caso que YA ocurrió en staging: `price: 30.003`.
  const LINEAS = [{ qty: 1, price: 30.003, tax: 0 }];
  const guardado = '30.01';   // lo que quedó en `Decimal(12,2)`

  const texto = await papelDe({ total: guardado, lines: LINEAS, sufijo: 'B' });
  const imprimeElGuardado = vecesEnPdf(texto, enPapel(guardado)) > 0;

  if (!imprimeElGuardado) {
    assert.ok(vecesEnPdf(texto, enPapel('30.00')) > 0,
      '🔴 el papel no imprime ni 30,01 ni 30,00: el guard ya no sabe qué mide.');
    assert.ok(Object.prototype.hasOwnProperty.call(DIVERGENCIAS_DECLARADAS, 'decimales del precio'),
      '🔴 EL PAPEL DICE UN TOTAL Y LA BASE OTRO.\n' +
      '    guardado: 30,01 €   ·   IMPRESO EN EL PAPEL: 30,00 €\n\n' +
      '  Y este no es un caso de laboratorio: es el documento J-20260722-R8Y8 de staging.');
  } else {
    assert.fail(
      '✅ EL PAPEL YA IMPRIME EL GUARDADO en el caso de los decimales. Borra «decimales del ' +
      'precio» de `DIVERGENCIAS_DECLARADAS` en este mismo commit.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO: lo que hoy cuadra, sigue cuadrando — enumerado
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-624b · ✅ CONTROL POSITIVO: los documentos que HOY cuadran siguen cuadrando', async () => {
  // Uno por uno, no «la suite pasa». Si al corregir la divergencia se descuadra uno de éstos, se
  // habría cambiado un defecto por otro.
  const CUADRAN = [
    { nombre: 'una línea entera sin IVA', total: '100.00', lines: [{ qty: 1, price: 100, tax: 0 }] },
    { nombre: 'una línea entera al 21 %', total: '121.00', lines: [{ qty: 1, price: 100, tax: 0.21 }] },
    { nombre: 'dos líneas que no arrastran céntimo', total: '242.00', lines: [{ qty: 2, price: 100, tax: 0.21 }] },
    { nombre: 'cantidad fraccionada exacta', total: '60.50', lines: [{ qty: 0.5, price: 100, tax: 0.21 }] },
  ];

  const descuadran = [];
  for (const [i, caso] of CUADRAN.entries()) {
    const texto = await papelDe({ total: caso.total, lines: caso.lines, sufijo: 'C' + i });
    if (!vecesEnPdf(texto, enPapel(caso.total)) > 0) descuadran.push(`${caso.nombre} (guardado ${enPapel(caso.total)})`);
  }

  assert.deepEqual(descuadran, [],
    '🔴 SE HAN DESCUADRADO DOCUMENTOS QUE HOY CUADRABAN:\n    ' + descuadran.join('\n    ') +
    '\n\n  Corregir la divergencia no puede romper lo que ya estaba bien: eso sería cambiar un\n' +
    '  defecto por otro, y el nuevo no lo estaría mirando nadie.');
});

test('SCRUM-624b · las divergencias declaradas son EXACTAMENTE dos, y la lista no puede crecer', () => {
  assert.equal(Object.keys(DIVERGENCIAS_DECLARADAS).length, 2,
    '🔴 la lista de divergencias ha CAMBIADO de tamaño. Solo puede menguar: si crece, alguien ha ' +
    'abierto otro camino por el que el papel y la base pueden decir cosas distintas.');
  for (const [k, motivo] of Object.entries(DIVERGENCIAS_DECLARADAS)) {
    assert.ok(motivo.includes('SCRUM-'), `🔴 «${k}» se declara sin decir de qué ticket viene`);
  }
});
