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
//    `params.total` y pinta su propia suma. Medido: con `total: '117.10'` y unas líneas que
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
test('SCRUM-604 · un solo tipo: base, cuota y total, y las tres cuadran', async () => {
  const texto = await textoDeFactura('A', UNA_TASA, '72.60');
  assert.ok(texto.includes('Base imponible:60,00 EUR'), `🔴 cambió la base impresa. Texto: ${texto.slice(0, 300)}`);
  assert.ok(texto.includes('IVA 21%:12,60 EUR'), '🔴 cambió la cuota impresa al 21 %');
  assert.ok(texto.includes('TOTAL:72,60 EUR'), '🔴 cambió el total impreso');
});

test('SCRUM-604 · dos tipos CON cuota: sale una fila por tipo', async () => {
  const texto = await textoDeFactura('B', DOS_TASAS, '122.10');
  assert.ok(texto.includes('Base imponible:105,00 EUR'), '🔴 cambió la base impresa con dos tipos');
  assert.ok(texto.includes('IVA 21%:12,60 EUR'), '🔴 falta o cambió la fila del 21 %');
  assert.ok(texto.includes('IVA 10%:4,50 EUR'), '🔴 falta o cambió la fila del 10 %');
  assert.ok(texto.includes('TOTAL:122,10 EUR'), '🔴 cambió el total impreso con dos tipos');
});

test('SCRUM-604 · 🔴 DEFECTO ①: con un SUPLIDO, la base al 0 % NO se imprime', async () => {
  const texto = await textoDeFactura('C', CON_SUPLIDO, '117.60');

  // Lo que SÍ dice, y cuadra como aritmética.
  assert.ok(texto.includes('Base imponible:105,00 EUR'), '🔴 cambió la base con suplido');
  assert.ok(texto.includes('IVA 21%:12,60 EUR'), '🔴 cambió la cuota con suplido');
  assert.ok(texto.includes('TOTAL:117,60 EUR'), '🔴 cambió el total con suplido');

  // 🔴 Y lo que NO dice. Se afirma como CARACTERIZACIÓN, no como aprobación: el día que
  // aparezca, este test cae — y esa caída será la buena noticia de que ① se arregló.
  assert.equal(vecesEnPdf(texto, 'IVA 0%'), 0,
    'CARACTERIZACIÓN: hoy la fila del 0 % NO se imprime (`if (g.vat === 0) return;`). '
    + 'Si esto falla es que YA se imprime: bien, pero es un cambio en un documento fiscal '
    + 'y tiene que constar con su GO.');
  // ⚠️ ACOTADO AL BLOQUE DE TOTALES, y la primera versión de este test NO lo acotaba: decía
  // «los 45,00 no aparecen por ningún lado» y cayó, porque SÍ aparecen — en la tabla de líneas,
  // donde tienen que estar. La afirmación ancha era falsa y la estrecha es la que importa: el
  // importe está en el detalle y NO en el desglose, que es justo lo que lo hace irreconstruible.
  const bloqueTotales = texto.slice(texto.indexOf('Base imponible'));
  assert.equal(vecesEnPdf(bloqueTotales, '45,00'), 0,
    'CARACTERIZACIÓN: los 45,00 del suplido no aparecen en el BLOQUE DE TOTALES. Quien lea el '
    + 'documento ve 105,00 de base y 12,60 de IVA al 21 %, y no puede reconstruir qué parte de '
    + 'esa base lleva qué tipo.');
});

test('SCRUM-604 · 🔴 DEFECTO ②: el total IMPRESO se recalcula e ignora el total guardado', async () => {
  // Se le pasa un total que NO cuadra con las líneas. Es «una base que no cuadra con sus
  // líneas», el caso que pide el encargo — y aquí sirve para saber QUIÉN gana.
  const texto = await textoDeFactura('D', DOS_TASAS, '999.99');
  assert.ok(texto.includes('TOTAL:122,10 EUR'),
    '🔴 cambió quién gana: hasta hoy el PDF recalcula desde las líneas.');
  assert.equal(vecesEnPdf(texto, '999,99'), 0,
    'CARACTERIZACIÓN: el total GUARDADO no se imprime cuando hay líneas. Si el total sellado y '
    + 'la suma de las líneas se separasen, el papel diría una cosa y el registro otra — y el '
    + 'papel no avisa. Si esto falla, es que ahora manda el guardado: es un cambio de qué '
    + 'número ve el cliente.');
});

test('SCRUM-604 · sin líneas, el PDF sí imprime el total guardado (el otro camino)', async () => {
  // El `else` del bloque: facturas antiguas sin líneas copiadas. Va aquí porque es la única
  // rama donde `params.total` llega al papel, y por tanto la que hace falsa cualquier
  // afirmación general de «el PDF nunca usa el total guardado».
  const texto = await textoDeFactura('E', undefined, '318.45');
  assert.ok(texto.includes('Total: 318,45 EUR'), `🔴 cambió el camino sin líneas. Texto: ${texto.slice(0, 300)}`);
  assert.equal(vecesEnPdf(texto, 'Base imponible'), 0,
    'CARACTERIZACIÓN: sin líneas no hay desglose que imprimir — no hay de dónde sacarlo.');
});
