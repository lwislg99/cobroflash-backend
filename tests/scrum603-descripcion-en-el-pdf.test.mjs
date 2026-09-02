// tests/scrum603-descripcion-en-el-pdf.test.mjs — SCRUM-603 (DOC-13)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA DESCRIPCIÓN BAJO EL CONCEPTO, Y LO QUE DE VERDAD FALLABA
//
// El ticket dice que la casilla «Incluir descripción en el PDF» no hace nada. Medido leyendo el
// documento generado: **la descripción SÍ llegaba al PDF**. La cadena estaba completa de punta a
// punta — `Product.description` → `searchProducts` → `/admin/products/autocomplete` →
// `selectItem` → el editor la concatena al concepto detrás de un `\n` → el PDF la imprime.
//
// Lo que fallaba es OTRA cosa, y sólo en la FACTURA: imprimía el concepto ENTERO de una vez, así
// que la descripción salía —el salto de línea se respeta— pero con el MISMO tamaño y el mismo
// peso. No se leía como descripción: se leía como concepto largo. El PDF de PRESUPUESTO ya la
// separaba bien desde antes.
//
// 🔴 Y LA REGLA DE SCRUM-604, APLICADA: la partición vivía UNA vez, en el bloque del
// presupuesto. Escribirla otra vez en el de la factura habría hecho DOS. Se sacó a
// `conceptoLinea.ts` y la usan los dos. **Copias antes: 1. Copias después: 0.**
//
// ⚠️ LÍMITE DECLARADO DEL INSTRUMENTO (ya dicho en SCRUM-623): `_texto-del-pdf.mjs` lee el TEXTO
// del PDF, no lo renderiza. Sirve para saber QUÉ se imprime y qué no —que es lo que decide si la
// casilla cumple su promesa— pero **no para juzgar cómo queda colocado**. Que la descripción vaya
// a 8 pt en gris y en su propia línea se comprueba aquí sobre el CÓDIGO; que se vea bien es
// juicio visual y queda como hueco.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';
import { partirConceptoYDescripcion } from '../dist/modules/invoicing/infra/pdf/conceptoLinea.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const FUENTE_PDF = 'src/modules/invoicing/infra/pdf/pdf.service.ts';

// Caracteres que muerden en un PDF: acentos, eñe, comillas tipográficas y raya.
const CONCEPTO = 'Sustitución de grifo monomando — baño';
const DESC = 'Incluye desmontaje del antiguo, sellado y prueba de estanqueidad, «con garantía» y añadido de latiguillos.';
const DESC_LARGA = ('Descripción muy larga que tiene que partirse en varias líneas dentro de la '
  + 'columna del concepto sin comerse el resto de la fila ni pisar la línea siguiente. ').repeat(3).trim();

async function textoDe(gen, lines, extra) {
  const { outPath } = await gen({ ...extra, lines });
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}`);
    return r.texto;
  } finally { fs.rmSync(outPath, { force: true }); }
}

const FACTURA = { number: 'F-2026-QA603', merchant: { name: 'QA' }, customer: { name: 'C' }, currency: 'EUR', total: '121.00', qrData: 'x', type: 'F1' };
const PRESUP = { quoteId: 99960300, quoteNumber: 603, merchant: { name: 'QA' }, customer: { name: 'C' }, currency: 'EUR', total: '121.00', country: 'ES', signatureData: null };

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA FUNCIÓN PURA · una sola, y sus bordes
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-603 · sin salto de línea, TODO es título y no hay descripción', () => {
  const r = partirConceptoYDescripcion('Mano de obra');
  assert.deepEqual(r, { titulo: 'Mano de obra', descripcion: '' },
    '🔴 una línea sin descripción tiene que salir EXACTAMENTE como salía antes: es la mayoría');
});

test('SCRUM-603 · con salto, la primera es título y TODO el resto es descripción', () => {
  const r = partirConceptoYDescripcion('Concepto\nprimera\nsegunda');
  assert.equal(r.titulo, 'Concepto');
  assert.equal(r.descripcion, 'primera\nsegunda',
    '🔴 se ha recortado la descripción a la segunda línea: perder el resto es perder texto del documento');
});

test('SCRUM-603 · las líneas VACÍAS se descartan, las que tienen contenido no', () => {
  const r = partirConceptoYDescripcion('Concepto\n\n  \nDescripción');
  assert.deepEqual(r, { titulo: 'Concepto', descripcion: 'Descripción' },
    '🔴 un `\\n\\n` de más abriría un hueco en un documento que el cliente recibe');
});

test('SCRUM-603 · lo que no es texto no revienta ni devuelve `undefined`', () => {
  for (const malo of [null, undefined, 42, {}, []]) {
    assert.deepEqual(partirConceptoYDescripcion(malo), { titulo: '', descripcion: '' },
      `🔴 \`${JSON.stringify(malo)}\` no ha dado el resultado vacío: un \`undefined\` circulando llega al pintado`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL CONTROL QUE DECIDE · con y SIN descripción, en los dos documentos
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-603 · 🔴 FACTURA: con descripción aparece; SIN ella NO aparece', async () => {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const con = await textoDe(generateInvoicePdf, [{ concept: `${CONCEPTO}\n${DESC}`, qty: 1, price: 100, tax: 0.21 }], FACTURA);
  assert.ok(con.includes(CONCEPTO), '🔴 la factura ha dejado de imprimir el concepto');
  assert.ok(con.includes(DESC), '🔴 la factura NO imprime la descripción: la casilla vuelve a prometer algo que no pasa');

  const sin = await textoDe(generateInvoicePdf, [{ concept: CONCEPTO, qty: 1, price: 100, tax: 0.21 }], { ...FACTURA, number: 'F-2026-QA603b' });
  assert.ok(sin.includes(CONCEPTO), '🔴 sin descripción se ha perdido el concepto');
  assert.equal(sin.includes(DESC), false,
    '🔴 LA DESCRIPCIÓN SALE SIEMPRE. Eso no es conectar la casilla: es cambiar el documento.');
});

test('SCRUM-603 · 🔴 PRESUPUESTO: con descripción aparece; SIN ella NO aparece', async () => {
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const con = await textoDe(generateQuotePdf, [{ concept: `${CONCEPTO}\n${DESC}`, qty: 1, price: 100, tax: 0.21 }], PRESUP);
  assert.ok(con.includes(CONCEPTO) && con.includes(DESC), '🔴 el presupuesto ha dejado de imprimir concepto o descripción');

  const sin = await textoDe(generateQuotePdf, [{ concept: CONCEPTO, qty: 1, price: 100, tax: 0.21 }], { ...PRESUP, quoteId: 99960301 });
  assert.equal(sin.includes(DESC), false, '🔴 la descripción sale sin haberla pedido');
});

test('SCRUM-603 · una descripción LARGA no se trunca ni se come el documento', async () => {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const t = await textoDe(generateInvoicePdf, [{ concept: `${CONCEPTO}\n${DESC_LARGA}`, qty: 1, price: 100, tax: 0.21 }], { ...FACTURA, number: 'F-2026-QA603c' });
  // Se comprueba el FINAL del texto largo: si se truncara, el principio seguiría estando.
  const cola = DESC_LARGA.slice(-60);
  assert.ok(t.includes(cola),
    `🔴 la descripción larga se ha truncado: no encuentro su final (${JSON.stringify(cola)})`);
  assert.ok(t.includes('Base imponible'),
    '🔴 la fila larga se ha comido el bloque de totales: la altura de fila no cuenta la descripción');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// UNA SOLA PARTICIÓN · la regla de SCRUM-604
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-603 · 🔴 la partición está UNA vez: los dos documentos llaman a la misma', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, FUENTE_PDF), 'utf8');
  // DOS llamadas: la de la factura y la del presupuesto. El `import` no cuenta porque no lleva
  // paréntesis — lo comprobó el propio test cuando puse 3 a ojo y salieron 2.
  const llamadas = fuente.split('partirConceptoYDescripcion(').length - 1;
  assert.equal(llamadas, 2,
    `🔴 esperaba 2 llamadas —factura y presupuesto— y hay ${llamadas}. Si BAJA, uno de los dos `
    + 'documentos ha dejado de separar la descripción; si SUBE sin un documento nuevo, alguien ha '
    + 'vuelto a escribir la partición a mano y hay dos copias otra vez.');
  assert.ok(fuente.includes("import { partirConceptoYDescripcion } from './conceptoLinea'"),
    '🔴 ya no se importa la función compartida: cada bloque estaría partiendo por su cuenta');
  // Y que no quede ningún `split` de concepto a mano en el fichero: eso sería la copia de vuelta.
  assert.equal(fuente.split(".concept || '').trim());").length - 1 <= 1, true,
    '🔴 hay más de un troceado de concepto a mano en el fichero');
});
