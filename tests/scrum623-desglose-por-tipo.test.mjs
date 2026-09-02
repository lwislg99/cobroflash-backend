// tests/scrum623-desglose-por-tipo.test.mjs — SCRUM-623
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA FACTURA NO PODÍA EXPRESAR MÁS DE UN TIPO DE IVA.
//
// Medido leyendo el TEXTO del PDF (instrumento de SCRUM-604), no su tamaño:
//
//     Base imponible: 105,00   IVA 21%: 12,60   TOTAL: 117,60
//
// El total CUADRA y el cliente paga bien. Lo que no se puede es cuadrarlo DESDE EL PAPEL:
// 105 × 21 % = 22,05, no 12,60. Faltan 9,45 € que el documento no explica.
//
// ⚠️ EL ENUNCIADO EXACTO, porque el del encargo no lo era del todo. Medidos los cuatro casos,
// son DOS defectos y sólo uno hace que las filas no se multipliquen:
//   ① la fila del tipo con CUOTA CERO se saltaba (`if (g.vat === 0) return`), así que con
//      21 % + 0 % salía UNA fila, igual que con un solo tipo. Ése es el caso que midió S2.
//   ② con 21 % + 10 % sí salían DOS filas — pero con UNA sola base agregada, así que tampoco
//      se sabía qué base iba con qué tipo.
// La propiedad que falla en TODOS los casos mixtos, y la que se arregla aquí, es:
// **las BASES no se imprimían por tipo.**
//
// 🔴 LO QUE ESTE TICKET NO TOCA, Y ESTÁ MEDIDO: ni una cifra. Las bases por tipo salen del
// MISMO mapa que el PDF ya calculaba y no imprimía. Ver `docs/master/SCRUM-623.md` para el
// hallazgo grave que apareció midiendo esto y que NO se ha arreglado aquí.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extraerTextoPdf, vecesEnPdf } from './_texto-del-pdf.mjs';

const MARCADOR = '[PENDIENTE microcopy oficial]';

async function textoDeFactura(sufijo, lines, total) {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA623${sufijo}`,
    merchant: { name: 'QA Fontanería', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total, qrData: 'x', type: 'F1', lines,
  });
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF (${sufijo}): ${r.motivo}. Un texto vacío se `
      + 'leería como «el documento no dice eso», que es un falso verde.');
    return r.texto;
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

/** El bloque de totales, recortado igual que en SCRUM-604, para comparar ENTERO con `===`. */
function bloqueDeTotales(texto) {
  const ini = texto.indexOf('Base imponible');
  if (ini === -1) return '(NO HAY BLOQUE DE TOTALES)';
  const fin = texto.indexOf('Escanea', ini);
  return texto.slice(ini, fin === -1 ? undefined : fin).trim();
}

/**
 * Las filas del desglose, LEÍDAS DEL PAPEL. Devuelve `{ tipo, base, cuota }` con los números
 * que un humano vería, no los que el código calculó.
 */
function filasDelPapel(bloque) {
  const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
  const out = [];
  const re = /(\d+)%([\d.,]+) EURIVA \1%:([\d.,]+) EUR/g;
  let m;
  while ((m = re.exec(bloque)) !== null) {
    out.push({ tipo: Number(m[1]), base: num(m[2]), cuota: num(m[3]) });
  }
  return out;
}

const UN_TIPO = [{ concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 }];
const CON_CERO = [
  { concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 },
  { concept: 'Tasa municipal', qty: 1, price: 45, tax: 0 },
];
const TRES_TIPOS = [
  { concept: 'A', qty: 1, price: 100, tax: 0.21 },
  { concept: 'B', qty: 1, price: 100, tax: 0.10 },
  { concept: 'C', qty: 1, price: 100, tax: 0.04 },
];

test('SCRUM-623 · SUELO: el instrumento lee un PDF de verdad', async () => {
  const t = await textoDeFactura('S', UN_TIPO, '72.60');
  assert.ok(t.length > 100, `🔴 EXTRACTOR CIEGO: sólo he leído ${t.length} caracteres.`);
  assert.equal(vecesEnPdf(t, 'FACTURA'), 1, '🔴 EXTRACTOR CIEGO: no encuentro ni el título.');
  // Control negativo del extractor: no puede encontrar lo que no está.
  assert.equal(vecesEnPdf(t, 'ALBARÁN'), 0, '🔴 el extractor dice ver texto que el documento no tiene.');
});

test('SCRUM-623 · 🔴 CONTROL NEGATIVO: con UN SOLO tipo el papel no ha cambiado', async () => {
  const bloque = bloqueDeTotales(await textoDeFactura('N', UN_TIPO, '72.60'));

  // La cadena ENTERA, con `===` y fijada a lo que imprimía ANTES de este ticket. Si aparece
  // aquí una fila de desglose o el marcador, se ha movido algo que ya estaba bien: con un solo
  // tipo el papel YA era reconstruible (60,00 × 21 % = 12,60) y no había nada que arreglar.
  assert.equal(bloque, 'Base imponible:60,00 EURIVA 21%:12,60 EURTOTAL:72,60 EUR',
    '🔴 la factura de UN SOLO tipo ya no se imprime como antes.');
  assert.equal(vecesEnPdf(bloque, MARCADOR), 0,
    '🔴 el marcador de microcopy sale en una factura que no lo necesita.');
});

test('SCRUM-623 · con un tipo al 0 %, su base YA SE IMPRIME', async () => {
  const bloque = bloqueDeTotales(await textoDeFactura('C', CON_CERO, '117.60'));
  const filas = filasDelPapel(bloque);

  assert.equal(filas.length, 2,
    `🔴 el papel enseña ${filas.length} fila(s) de desglose y la factura tiene DOS bases.`);
  assert.deepEqual(filas, [
    { tipo: 21, base: 60, cuota: 12.6 },
    { tipo: 0, base: 45, cuota: 0 },
  ], '🔴 las filas del desglose no son las de esta factura.');

  // 🔴 Y LAS CIFRAS QUE YA SE IMPRIMÍAN, INTACTAS. Es la condición de este ticket: el defecto
  // era de REPRESENTACIÓN. Si alguna de estas tres se mueve, se ha tocado el cálculo.
  assert.equal(vecesEnPdf(bloque, 'Base imponible:105,00 EUR'), 1);
  assert.equal(vecesEnPdf(bloque, 'IVA 21%:12,60 EUR'), 1);
  assert.equal(vecesEnPdf(bloque, 'TOTAL:117,60 EUR'), 1);
});

test('SCRUM-623 · 🔴 LA PROPIEDAD: el papel se puede CUADRAR sin abrir el sistema', async () => {
  // Se lee del PDF y se comprueba la aritmética que haría una persona con el documento delante.
  // No usa ninguna función del producto: si la usara, mediría el código consigo mismo.
  for (const [suf, lines, total] of [['P1', CON_CERO, '117.60'], ['P2', TRES_TIPOS, '335.00']]) {
    const bloque = bloqueDeTotales(await textoDeFactura(suf, lines, total));
    const filas = filasDelPapel(bloque);
    assert.ok(filas.length >= 2, `🔴 ${suf}: no hay desglose que cuadrar.`);

    for (const f of filas) {
      const esperada = Math.round(f.base * f.tipo) / 100;
      assert.equal(f.cuota, esperada,
        `🔴 ${suf}: la fila del ${f.tipo} % dice base ${f.base} y cuota ${f.cuota}, y `
        + `${f.base} × ${f.tipo} % son ${esperada}. El papel NO se puede cuadrar.`);
    }

    // Y las bases del desglose suman la base imponible impresa.
    const suma = Math.round(filas.reduce((a, f) => a + f.base, 0) * 100) / 100;
    const m = /Base imponible:([\d.,]+) EUR/.exec(bloque);
    const impresa = Number(m[1].replace(/\./g, '').replace(',', '.'));
    assert.equal(suma, impresa,
      `🔴 ${suf}: las bases del desglose suman ${suma} y la base imponible impresa es ${impresa}.`);
  }
});

test('SCRUM-623 · sirve para N tipos, no para exactamente dos', async () => {
  const bloque = bloqueDeTotales(await textoDeFactura('T', TRES_TIPOS, '335.00'));
  const filas = filasDelPapel(bloque);
  assert.equal(filas.length, 3, '🔴 con TRES tipos el papel no enseña tres filas.');
  assert.deepEqual(filas.map((f) => f.tipo), [21, 10, 4],
    '🔴 el orden de las filas no es descendente por tipo: dos documentos con las mismas líneas '
    + 'en distinto orden saldrían con las filas cambiadas de sitio.');
});

test('SCRUM-623 · el rótulo nuevo va MARCADO, y sólo donde hace falta', async () => {
  const mixta = bloqueDeTotales(await textoDeFactura('M', CON_CERO, '117.60'));
  const simple = bloqueDeTotales(await textoDeFactura('M2', UN_TIPO, '72.60'));

  // Una sola marca: la fila la describen el tipo y el importe, que son dato y no copy.
  assert.equal(vecesEnPdf(mixta, MARCADOR), 1,
    '🔴 el rótulo del desglose tiene que salir marcado exactamente UNA vez: la palabra no está '
    + 'escrita y no me toca escribirla (regla 30).');
  assert.equal(vecesEnPdf(simple, MARCADOR), 0);
});

test('SCRUM-623 · SCRUM-619: la fila se rotula por su TIPO, nunca por su naturaleza', async () => {
  // 🔴 ESTO ES LO QUE HACE QUE LA MAQUETA SIRVA A LAS DOS RESPUESTAS DE LA ASESORÍA.
  //
  // Sigue abierto si el suplido va DENTRO de la base imponible (hoy, como una base al 0 %) o
  // FUERA. El bloque está cerrado sobre TIPOS IMPOSITIVOS: si la respuesta es «fuera», esa fila
  // desaparece de aquí y el suplido baja a una línea propia, sin tocar la forma del bloque.
  //
  // Si alguien rotulara la fila como «suplido», la respuesta «fuera» rompería la maqueta. Y
  // además el dato NO distingue hoy un suplido de una exención: los dos son una línea al 0 %.
  const bloque = bloqueDeTotales(await textoDeFactura('S619', CON_CERO, '117.60'));
  for (const palabra of ['uplido', 'xento', 'xenta', 'eembolso']) {
    assert.equal(vecesEnPdf(bloque, palabra), 0,
      `🔴 el desglose rotula una fila como «${palabra}». Eso decide la pregunta abierta de `
      + 'SCRUM-619 por su cuenta, y la rompe si la asesoría contesta lo otro.');
  }
  // Control positivo: el bloque SÍ se está leyendo, y sí lleva la fila del 0 %.
  assert.equal(vecesEnPdf(bloque, '0%45,00 EUR'), 1,
    '🔴 no encuentro la fila del 0 %: las cuatro comprobaciones de arriba pasarían en vacío.');
});
