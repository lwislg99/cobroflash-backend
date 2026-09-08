// tests/scrum604-desglose-en-el-pdf.test.mjs — SCRUM-604 (DOC-14)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUE IMPRIME HOY EL BLOQUE DE TOTALES DE LA FACTURA. Medido leyendo el PDF de verdad.
//
// 🔴 EL TICKET DABA POR HECHO QUE NO EXISTIA, Y SI EXISTE. La evidencia de SCRUM-604 dice «el
// PDF muestra `Total presupuesto: 1210 EUR` y nada más», y el propio ticket declara dos veces
// «no se ha abierto el repositorio». Abierto: **el PDF de FACTURA ya pinta las tres líneas**
// (`pdf.service.ts`, bloque «4. TOTALES»). El que no las pinta es el de PRESUPUESTO — que es
// justo el documento del que habla la evidencia (`#32`, «Total presupuesto»).
//
// Así que esto no construye el desglose: lo CARACTERIZA, y deja escritos los dos defectos que
// aparecen al mirarlo con números reales. Cambiar lo que imprime un documento fiscal necesita
// GO del fundador (reglas 29/38); esto sólo LEE, que es lo que la regla 38 permite sin pedirlo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS DEFECTOS, MEDIDOS
//
// ① LA BASE AL 0 % NO SE IMPRIME. `pdf.service.ts` salta la fila cuando la cuota es cero
//    (`if (g.vat === 0) return;`). Con el caso de suplido de SCRUM-619 —60,00 al 21 % más
//    45,00 al 0 %— el documento dice:
//
//        Base imponible: 105,00 EUR      IVA 21%: 12,60 EUR      TOTAL: 117,60 EUR
//
//    El total CUADRA (105 + 12,60 = 117,60), así que no es un error de dinero. Lo que falla es
//    que el desglose **no deja reconstruir qué parte de la base lleva qué tipo**: quien lo lea
//    ve 105,00 de base y 12,60 de IVA al 21 %, y 105 × 21 % son 22,05. Los 45,00 al 0 % no
//    aparecen en ninguna parte. En una factura el desglose es contenido obligatorio, y este
//    está incompleto exactamente en el caso que el producto vende como ventaja (el suplido).
//
// ② EL TOTAL IMPRESO SE RECALCULA, Y GANA AL GUARDADO. Habiendo líneas, el PDF ignora
//    `params.total` y pinta su propia suma. Medido: con `total: '999.99'` y unas líneas que
//    suman 122,10, el documento imprime **122,10**. Si alguna vez el total almacenado —el que
//    se SELLA— y esta suma se separan, el papel dice una cosa y el registro otra, y el papel
//    no avisa.
//
// Ninguno de los dos se arregla aquí. Se fijan, para que un cambio los mueva delante de alguien.
//
// ⚠️ SI ESTE FICHERO SALE EN ROJO: alguien ha cambiado lo que imprime una factura. Puede ser un
// arreglo bueno (①/② resueltos con GO) o un accidente. En los dos casos hay que MIRARLO: lo que
// no vale es actualizar las cifras de abajo sin saber cuál de las dos cosas ha pasado.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extraerTextoPdf, vecesEnPdf } from './_texto-del-pdf.mjs';

/** Genera una factura de verdad y devuelve su TEXTO. Borra el fichero siempre. */
async function textoDeFactura(sufijo, lines, total) {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA604${sufijo}`,
    merchant: { name: 'QA Fontanería', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total, qrData: 'x', type: 'F1', lines,
  });
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF (${sufijo}): ${r.motivo}. `
      + 'Un texto vacío se leería como «el documento no dice eso», que es un falso verde: '
      + 'antes de tocar nada, arregla el extractor.');
    return r.texto;
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

/**
 * EL BLOQUE DE TOTALES, recortado, para poder compararlo ENTERO con `===`.
 *
 * 🔴 NACE DE UN ROJO. La primera versión afirmaba con `includes()` —«el texto contiene
 * `IVA 21%:12,60 EUR`»— y al romper el cálculo a propósito el test caía **sin decir qué imprime
 * ahora**: el mensaje sólo podía informar de que la cadena esperada no estaba. Quien lo viera en
 * rojo tenía que ir a generar el PDF a mano para saber qué había pasado. Y además `includes()`
 * está prohibido para verificar textos: se comparan con `===`.
 *
 * Comparando el bloque ENTERO, el fallo enseña las dos versiones y el defecto se lee solo.
 */
function bloqueDeTotales(texto) {
  const desde = ['Base imponible', 'Total: '].map((m) => texto.indexOf(m)).filter((i) => i !== -1);
  if (desde.length === 0) return '(NO HAY BLOQUE DE TOTALES)';
  const ini = Math.min(...desde);
  const fin = texto.indexOf('Escanea', ini);
  return texto.slice(ini, fin === -1 ? undefined : fin).trim();
}

// Los tres casos. El del SUPLIDO va SIEMPRE: es el único con DOS bases, y el caso simple de un
// tipo único no distingue un desglose correcto de uno que sólo sabe sumar.
const UNA_TASA = [{ concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 }];
const CON_SUPLIDO = [
  { concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 },
  { concept: 'Tasa municipal', qty: 1, price: 45, tax: 0 },   // el suplido: base al 0 %
];
const DOS_TASAS = [
  { concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 },
  { concept: 'Material', qty: 1, price: 45, tax: 0.10 },
];

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO · el instrumento tiene que leer un PDF de verdad. Si no, todo lo de abajo pasa en vacío.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-604 · SUELO: sé leer el texto de un PDF de factura', async () => {
  const texto = await textoDeFactura('S', UNA_TASA, '72.60');
  assert.ok(texto.length > 100, `🔴 EXTRACTOR CIEGO: sólo he leído ${texto.length} caracteres`);
  assert.equal(vecesEnPdf(texto, 'FACTURA'), 1, '🔴 EXTRACTOR CIEGO: no encuentro ni el título del documento');
  // CONTROL NEGATIVO del extractor: no puede encontrar lo que no está. Sin esto, un extractor
  // que devolviera «todo» daría verde en cualquier aserción de presencia.
  assert.equal(vecesEnPdf(texto, 'ALBARÁN'), 0, '🔴 el extractor dice ver texto que el documento no tiene');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE IMPRIME · las tres formas, con sus cifras
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-604 · un solo tipo: el bloque de totales, entero', async () => {
  const bloque = bloqueDeTotales(await textoDeFactura('A', UNA_TASA, '72.60'));
  assert.equal(bloque, 'Base imponible:60,00 EURIVA 21%:12,60 EURTOTAL:72,60 EUR',
    '🔴 cambió lo que imprime el bloque de totales de una factura de un solo tipo');
});

test('SCRUM-604 · dos tipos CON cuota: una fila por tipo, con SU BASE (SCRUM-623)', async () => {
  const bloque = bloqueDeTotales(await textoDeFactura('B', DOS_TASAS, '122.10'));
  // 🔴 ACTUALIZADO POR SCRUM-623, con el GO que este mismo fichero pedía unas líneas más abajo.
  // Cada fila lleva ahora SU BASE además de su cuota. **Ninguna cifra de las que ya se
  // imprimían ha cambiado** —105,00 · 12,60 · 4,50 · 122,10 siguen ahí, en el mismo sitio—:
  // lo único que ocurre es que se añaden las bases por tipo, que antes no salían.
    assert.equal(bloque, 'Base imponible:105,00 EUR[PENDIENTE microcopy oficial]21%60,00 EURIVA 21%:12,60 EUR10%45,00 EURIVA 10%:4,50 EURTOTAL:122,10 EUR',
    '🔴 cambió el bloque de totales con dos tipos que sí llevan cuota');
});

test('SCRUM-604 · ✅ DEFECTO ① RESUELTO (SCRUM-623): la base al 0 % ya se imprime', async () => {
  const conSuplido = bloqueDeTotales(await textoDeFactura('C', CON_SUPLIDO, '117.60'));

  // 🔴 ESTE TEST CARACTERIZABA EL DEFECTO Y AHORA FIJA SU ARREGLO. El GO es SCRUM-623, que es
  // exactamente la condición que este mismo bloque pedía: «si ha cambiado, o se arregló el
  // defecto ① (bien, pero es un cambio en documento fiscal y necesita constar con su GO) o se
  // rompió el cálculo». Se arregló, y **el cálculo no se ha tocado**: 105,00 · 12,60 · 117,60
  // son las mismas tres cifras que imprimía antes, en el mismo sitio. Lo que se añade son las
  // dos bases por tipo, que es lo que faltaba para poder cuadrarlo desde el papel.
    assert.equal(conSuplido, 'Base imponible:105,00 EUR[PENDIENTE microcopy oficial]21%60,00 EURIVA 21%:12,60 EUR0%45,00 EURIVA 0%:0,00 EURTOTAL:117,60 EUR',
    'Si esto cambia, o se ha movido la maqueta del desglose (SCRUM-623) o se ha roto el cálculo. '
    + 'Las dos cosas son graves en un documento fiscal y ninguna se hace de paso.');

  // ✅ LA PROPIEDAD, INVERTIDA, y sigue dicha como propiedad y no como cifra: un documento de
  // DOS bases ya NO puede salir con la misma forma que uno de una sola. Sobrevive a cualquier
  // cambio de importes, que es justo lo que una cifra fijada no haría.
  const unaSola = bloqueDeTotales(await textoDeFactura('A2', UNA_TASA, '72.60'));
  const filas = (b) => b.split('IVA ').length - 1;
  assert.notEqual(filas(conSuplido), filas(unaSola),
    '🔴 la factura con DOS bases vuelve a imprimir el MISMO número de filas que la de una sola: '
    + 'el defecto ① ha regresado y el desglose vuelve a ser irreconstruible desde el papel.');
  assert.equal(filas(conSuplido), 2, '🔴 el caso con suplido debe imprimir DOS filas: 21 % y 0 %.');
  assert.equal(filas(unaSola), 1, '🔴 la de un solo tipo debe seguir imprimiendo UNA.');
});

test('SCRUM-604 · 🔴 DEFECTO ②: el total IMPRESO se recalcula e ignora el guardado', async () => {
  // Se le pasa un total que NO cuadra con las líneas — «una base que no cuadra con sus líneas»,
  // el caso que pide el encargo. Sirve para saber QUIÉN gana: el papel o el registro.
  const bloque = bloqueDeTotales(await textoDeFactura('D', DOS_TASAS, '999.99'));
  // Cadena actualizada por SCRUM-623 (las bases por tipo). LA CARACTERIZACIÓN NO CAMBIA: el total
  // impreso sigue siendo el recalculado y sigue ignorando el guardado — 122,10, no 999,99.
  assert.equal(bloque, 'Base imponible:105,00 EUR[PENDIENTE microcopy oficial]21%60,00 EURIVA 21%:12,60 EUR10%45,00 EURIVA 10%:4,50 EURTOTAL:122,10 EUR',
    'CARACTERIZACIÓN: con líneas, el PDF recalcula y el total GUARDADO (999,99) no llega al papel. '
    + 'Si el total sellado y la suma de las líneas se separasen, el documento diría una cosa y el '
    + 'registro otra, y el documento no avisa.');
});

test('SCRUM-604 · sin líneas, el PDF sí imprime el total guardado (el otro camino)', async () => {
  // El `else` del bloque: facturas antiguas sin líneas copiadas. Va aquí porque es la única rama
  // donde `params.total` llega al papel, y por tanto la que hace falsa cualquier afirmación
  // general de «el PDF nunca usa el total guardado».
  const bloque = bloqueDeTotales(await textoDeFactura('E', undefined, '318.45'));
  assert.equal(bloque, 'Total: 318,45 EUR',
    'CARACTERIZACIÓN: sin líneas no hay desglose que imprimir — no hay de dónde sacarlo.');
});
