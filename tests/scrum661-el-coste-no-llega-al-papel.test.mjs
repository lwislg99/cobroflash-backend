// tests/scrum661-el-coste-no-llega-al-papel.test.mjs — SCRUM-661 (condición 1)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL COSTE DEL PROFESIONAL NO LLEGA AL PAPEL QUE FIRMA SU CLIENTE.
//
// Es lo más importante del ticket, y no es un fallo estético: si el coste unitario aparece en el
// presupuesto o en la factura, el cliente ve el margen y la negociación se acabó.
//
// 🔴 SE LEE EL PDF DE VERDAD, no el objeto que se le pasa al generador. Que un dato no esté en la
// plantilla NO prueba que no salga; que salga en el papel SÍ prueba que sale. El instrumento es
// `lineasDePdf` (SCRUM-659), que además dice DÓNDE está cada texto.
//
// ⚠️ POR QUÉ ESTE GUARD ENTRA HOY AUNQUE EL COSTE TODAVÍA NO SE GUARDE (ver la entrada de máster:
// el front no lo envía y `searchProducts` ni siquiera lo devuelve): porque protege la forma, no el
// dato. El día que el coste viaje en la línea, la fuga ya es imposible — y ese día nadie se
// acordará de comprobarlo. Un guard que llega después del dato llega tarde.
//
// ⛔ `pdf.service.ts` NO se toca: es de S3. Aquí se LEE su salida.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lineasDePdf, extraerTextoPdf, vecesEnPdf } from './_texto-del-pdf.mjs';

/**
 * Un coste RECONOCIBLE e improbable: si aparece en el papel, no es coincidencia.
 * Se busca en las tres grafías que puede tomar un importe en este árbol.
 */
const COSTE = 1234.56;
const GRAFIAS = ['1234.56', '1234,56', '1.234,56'];

const LINEAS_CON_COSTE = [
  // El coste viaja como campo EXTRA de la línea: es la forma que tendría si se congelara.
  { concept: 'Mano de obra', qty: 2, price: 100, tax: 0.21, costeUnitario: COSTE },
  { concept: 'Material', qty: 1, price: 50, tax: 0.21, costeUnitario: COSTE },
];

async function pdfDePresupuesto(id, lines) {
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateQuotePdf({
    quoteId: id,
    merchant: { name: 'QA Fontanería', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '302.50', lines,
  });
  try { return fs.readFileSync(outPath); } finally { fs.rmSync(outPath, { force: true }); }
}

async function pdfDeFactura(sufijo, lines) {
  const { generateInvoicePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA661${sufijo}`,
    merchant: { name: 'QA Fontanería', legalName: 'QA SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' },
    currency: 'EUR', total: '302.50', qrData: 'x', type: 'F1', lines,
  });
  try { return fs.readFileSync(outPath); } finally { fs.rmSync(outPath, { force: true }); }
}

/** Cuántas veces aparece el coste en el papel, en cualquiera de sus grafías. */
function vecesQueAparece(texto) {
  return GRAFIAS.reduce((n, g) => n + vecesEnPdf(texto, g), 0);
}

test('SCRUM-661 · SUELO: el lector VE líneas de un PDF de verdad', async () => {
  const buf = await pdfDePresupuesto(6610, LINEAS_CON_COSTE);
  const r = lineasDePdf(buf);
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un lector que no lee diría que el `
    + 'coste no está por el mismo motivo por el que no ve nada — y eso es un falso verde.');
  assert.ok(r.lineas.length > 5,
    `🔴 LECTOR CIEGO: sólo ${r.lineas.length} líneas. «No está el coste» y «no supe mirar» son el `
    + 'mismo resultado con significados opuestos.');
});

test('SCRUM-661 · 🔴 CONTROL NEGATIVO: lo que SÍ debe salir, sale', async () => {
  // Sin esto, un lector que devolviera texto vacío pasaría el guard de abajo sin mirar nada.
  const texto = extraerTextoPdf(await pdfDePresupuesto(6611, LINEAS_CON_COSTE)).texto;
  assert.equal(vecesEnPdf(texto, 'Mano de obra') > 0, true, '🔴 no encuentro ni el concepto.');
  assert.equal(vecesEnPdf(texto, '100,00') > 0, true, '🔴 no encuentro ni el precio de la línea.');
  // Y el detector del coste, sobre este mismo documento, distingue: encuentra el precio y NO el coste.
  assert.equal(vecesQueAparece(texto), 0);
});

test('SCRUM-661 · 🔴 EL COSTE NO LLEGA AL PRESUPUESTO', async () => {
  const texto = extraerTextoPdf(await pdfDePresupuesto(6612, LINEAS_CON_COSTE)).texto;
  assert.equal(vecesQueAparece(texto), 0,
    `🔴 EL COSTE DEL PROFESIONAL ESTÁ EN EL PAPEL QUE FIRMA SU CLIENTE (${COSTE}). No es un fallo `
    + 'de maquetación: el cliente ve el margen y la negociación se acabó.');
  // Y tampoco el NOMBRE del campo, que delataría igual.
  for (const n of ['costeUnitario', 'coste', 'Coste']) {
    assert.equal(vecesEnPdf(texto, n), 0, `🔴 el documento nombra «${n}».`);
  }
});

test('SCRUM-661 · 🔴 EL COSTE NO LLEGA A LA FACTURA', async () => {
  const texto = extraerTextoPdf(await pdfDeFactura('A', LINEAS_CON_COSTE)).texto;
  assert.equal(vecesQueAparece(texto), 0,
    `🔴 EL COSTE DEL PROFESIONAL ESTÁ EN LA FACTURA (${COSTE}).`);
  for (const n of ['costeUnitario', 'coste', 'Coste']) {
    assert.equal(vecesEnPdf(texto, n), 0, `🔴 la factura nombra «${n}».`);
  }
});

test('SCRUM-661 · 🔴 EL ROJO: el guard CAE cuando el coste SÍ sale', async () => {
  // «Un guard de fuga que no se ha visto caer ante la fuga no protege nada.» Aquí se provoca la
  // fuga por el único camino disponible sin tocar `pdf.service.ts` (que es de S3): se mete el
  // número del coste en un campo que el documento SÍ imprime.
  //
  // ⚠️ ESTO PRUEBA EL DETECTOR, no que `pdf.service` filtre. Es la distinción honesta: demuestra
  // que si el coste llegara al papel, este guard lo vería — que es lo que hay que poder afirmar.
  const conFuga = [{ concept: `Mano de obra ${COSTE}`, qty: 1, price: 100, tax: 0.21, costeUnitario: COSTE }];
  const texto = extraerTextoPdf(await pdfDePresupuesto(6613, conFuga)).texto;

  assert.ok(vecesQueAparece(texto) > 0,
    '🔴 EL DETECTOR NO VE UNA FUGA QUE ESTÁ DELANTE. Con el coste impreso en el papel, este guard '
    + 'ha dado verde: no protege nada y hay que arreglarlo ANTES de fiarse de los casos de arriba.');

  // Y dice DÓNDE está, que es lo que sirve dentro de tres meses.
  const r = lineasDePdf(await pdfDePresupuesto(6614, conFuga));
  const donde = r.lineas.filter((l) => GRAFIAS.some((g) => l.texto.includes(g)));
  assert.ok(donde.length > 0, '🔴 el lector de líneas no sabe decir en qué línea está la fuga.');
});
