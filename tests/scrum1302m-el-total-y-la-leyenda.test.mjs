// SCRUM-1302m · EL TOTAL Y LA LEYENDA DEL PRESUPUESTO DICEN LO MISMO.
//
// El defecto, medido con el PDF de verdad antes de tocar nada (docs/master/evidencias/scrum1302m):
// una línea de 100,00 al 21 % en modo `no_incluido` salía
//
//     Revision  1  100,00  21%  121,00
//     Total presupuesto: 121,00 EUR
//     IVA NO INCLUIDO
//
// La leyenda es la del modo que el profesional eligió (SCRUM-656). La cifra no: `Quote.total` se
// guarda SIEMPRE con el IVA de sus líneas dentro, y el PDF la pintaba a secas.
//
// Sin gate: genera el PDF por la cadena de las tres puertas y LEE su texto. Ni base ni red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';

const { generateQuotePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const { paramsDePresupuestoParaPdf } = await import('../dist/modules/quotes/domain/presupuestoParaPdf.js');
const { calcTotal } = await import('../dist/core/utils/utils.js');
const { LEYENDA_IVA_NO_INCLUIDO } = await import('../dist/modules/quotes/domain/presentacionIva.js');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// SCRUM-1302n · el banco de este ticket vive en el catálogo del meta-guard (SCRUM-1387): las cinco
// mutaciones se declaran AQUÍ, `npm run meta:mutaciones` las ejecuta en el CI, y el guion
// `docs/master/evidencias/scrum1302m/mutaciones.mjs` las lee de aquí en vez de llevar su lista.
// Cada una quita un trozo del arreglo y nombra el caso que TIENE que caer.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // M1 · el total vuelve a ser el guardado a secas.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: '? Number(params.total) - ivaDentroDelImporte(params.lines, params.discountGlobalAmount ?? null)',
    a: '? Number(params.total)',
    cae: 'el guardado sigue mandando: se le resta su IVA, no se recalcula',
  },
  {
    // M2 · el importe de la línea vuelve a llevar el IVA. SCRUM-1446e: la línea de la tabla va sin
    // IVA en los dos modos (SCRUM-1446 c.20917, P4), así que el ancla es la línea entera de hoy;
    // antes era `(1 + (ivaFueraDelPapel ? 0 : l.tax))`.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'const lineTotal = l.qty * l.price;',
    a: 'const lineTotal = l.qty * l.price * (1 + l.tax);',
    cae: 'el total que se lee NO lleva el IVA dentro',
  },
  {
    // M3 · el total de cada opción vuelve a ser el guardado.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'Number(tier.total) - ivaDentroDelImporte(tier.lines)',
    a: 'Number(tier.total)',
    cae: 'con tres opciones, cada caja y el total van sin IVA',
  },
  {
    // M4 · la línea de cada opción vuelve a llevar el IVA.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: '(ivaFueraDelPapel ? 0 : (l.tax ?? 0))',
    a: '(l.tax ?? 0)',
    cae: 'con tres opciones, cada caja y el total van sin IVA',
  },
  {
    // M5 · el IVA de dentro se calcula sin el descuento global.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'ivaDentroDelImporte(params.lines, params.discountGlobalAmount ?? null)',
    a: 'ivaDentroDelImporte(params.lines)',
    cae: 'con céntimos, dos tipos y descuentos: sale la base, calculada A MANO',
  },
];

let siguienteId = 13020100;

/** La fila tal como la guarda `POST /quote/create`: el total sale de `calcTotal`, no de aquí. */
function fila({ lines, ivaModo, tiers = null, descuentoGlobal = null, total = null }) {
  siguienteId += 1;
  return {
    id: siguienteId, merchantId: 71, customerId: 71, status: 'sent', currency: 'EUR',
    total: total ?? calcTotal(lines, descuentoGlobal).toFixed(2),
    lines, ivaModo, tiers, discountGlobalAmount: descuentoGlobal, quoteNumber: 7, revision: 0,
    docFields: null, docHeaderText: null, docFooterText: null, clausulasExcluidas: null,
    acceptedAt: null, signatureUrl: null, evidenciaFirma: null,
    createdAt: new Date(), updatedAt: new Date(),
    merchant: { id: 71, name: 'Oficio', legalName: null, logoUrl: null, address: null,
      country: 'ES', timezone: 'Europe/Madrid', clausulasPresupuesto: null },
    customer: { name: 'Cliente' },
  };
}

async function textoDelPdf(q) {
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote: q, merchant: q.merchant, customer: q.customer }));
  try {
    const r = extraerTextoPdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un vacío se leería como «no lo dice».`);
    return r.texto;
  } finally { fs.rmSync(outPath, { force: true }); }
}

const UNA_AL_21 = [{ concept: 'Revision', qty: 1, price: 100, tax: 0.21 }];

test('SCRUM-1302m · control del banco: en `sumar` el papel lleva base, cuota y total con IVA', async () => {
  const pdf = await textoDelPdf(fila({ lines: UNA_AL_21, ivaModo: 'sumar' }));
  // Si esto cae, la línea fabricada no es «100 al 21 %» y nada de lo de abajo mide lo que dice.
  assert.ok(pdf.includes('Base imponible: 100,00 EUR'), pdf);
  assert.ok(pdf.includes('IVA 21%: 21,00 EUR'), pdf);
  assert.ok(pdf.includes('Total presupuesto: 121,00 EUR'), pdf);
  assert.ok(!pdf.includes(LEYENDA_IVA_NO_INCLUIDO), '🔴 `sumar` pinta la leyenda del otro modo');
});

test('SCRUM-1302m · 🔴 en `no_incluido` el total que se lee NO lleva el IVA dentro', async () => {
  const q = fila({ lines: UNA_AL_21, ivaModo: 'no_incluido' });
  assert.equal(q.total, '121.00', 'control: el guardado SÍ lleva el IVA, en los dos modos');
  const pdf = await textoDelPdf(q);
  assert.ok(pdf.includes(LEYENDA_IVA_NO_INCLUIDO), '🔴 falta la leyenda del modo');
  assert.ok(pdf.includes('Total presupuesto: 100,00 EUR'),
    '🔴 EL PAPEL DICE «IVA NO INCLUIDO» BAJO UN TOTAL QUE LO LLEVA DENTRO.\n'
    + '  Guardado: 121,00 (100,00 + 21,00 de IVA). En este modo el total que se pinta es 100,00.\n  ' + pdf);
  assert.ok(!pdf.includes('121,00'),
    '🔴 queda un 121,00 en el papel: el importe de la línea o el total siguen con el IVA sumado, '
    + 'y la leyenda de debajo habla de todos los importes.\n  ' + pdf);
});

test('SCRUM-1302m · 🔴 con céntimos, dos tipos y descuentos: sale la base, calculada A MANO', async () => {
  //   3 × 37,19 = 111,57 (21 %)  ·  1 × 12,35 (10 %)             → base 123,92
  const dosTipos = [
    { concept: 'Mano de obra', qty: 3, price: 37.19, tax: 0.21 },
    { concept: 'Material', qty: 1, price: 12.35, tax: 0.10 },
  ];
  const a = await textoDelPdf(fila({ lines: dosTipos, ivaModo: 'no_incluido' }));
  assert.ok(a.includes('Total presupuesto: 123,92 EUR'), a);

  //   200,00 con 10 % de descuento de línea = 180,00 · descuento global 30,00 → base 150,00
  //   150,00 × 1,21 = 181,50 es lo guardado.
  const conDto = [{ concept: 'Obra', qty: 1, price: 200, tax: 0.21, dto: 10 }];
  const q = fila({ lines: conDto, ivaModo: 'no_incluido', descuentoGlobal: 30 });
  assert.equal(q.total, '181.50', 'control: el guardado con los dos descuentos y el IVA');
  const b = await textoDelPdf(q);
  assert.ok(b.includes('Total presupuesto: 150,00 EUR'), b);
});

test('SCRUM-1302m · una línea al 0 % en `no_incluido` sale como salía', async () => {
  const pdf = await textoDelPdf(fila({ lines: [{ concept: 'Revision', qty: 1, price: 100, tax: 0 }], ivaModo: 'no_incluido' }));
  assert.ok(pdf.includes('Total presupuesto: 100,00 EUR'), pdf);
  assert.ok(pdf.includes(LEYENDA_IVA_NO_INCLUIDO));
});

test('SCRUM-1302m · el guardado sigue mandando: se le resta su IVA, no se recalcula', async () => {
  // Un guardado que NO es la suma de sus líneas (125,00 con una línea de 100 al 21 %). El papel
  // no lo sustituye por la suma: le quita los 21,00 de IVA que `calcTotal` ve en las líneas.
  const pdf = await textoDelPdf(fila({ lines: UNA_AL_21, ivaModo: 'no_incluido', total: '125.00' }));
  assert.ok(pdf.includes('Total presupuesto: 104,00 EUR'), pdf);
});

test('SCRUM-1302m · 🔴 con tres opciones, cada caja y el total van sin IVA en `no_incluido` — y con él en `sumar`', async () => {
  const opcion = (id, precio) => ({
    id, label: id, description: null, recommended: id === 'better',
    lines: [{ concept: 'Obra', qty: 1, price: precio, tax: 0.21 }],
    total: calcTotal([{ concept: 'Obra', qty: 1, price: precio, tax: 0.21 }], null),
  });
  const tiers = [opcion('good', 100), opcion('better', 200), opcion('best', 300)];
  const base = { lines: tiers[1].lines, tiers, total: tiers[1].total.toFixed(2) };

  const sin = await textoDelPdf(fila({ ...base, ivaModo: 'no_incluido' }));
  for (const neto of ['Total: 100,00 EUR', 'Total: 200,00 EUR', 'Total: 300,00 EUR', 'Total presupuesto: 200,00 EUR']) {
    assert.ok(sin.includes(neto), `🔴 falta «${neto}» en el papel de \`no_incluido\`:\n  ${sin}`);
  }
  for (const conIva of ['121,00', '242,00', '363,00']) {
    assert.ok(!sin.includes(conIva), `🔴 «${conIva}» lleva el IVA dentro y sale bajo «${LEYENDA_IVA_NO_INCLUIDO}»:\n  ${sin}`);
  }

  // El positivo de esas negaciones, con los MISMOS importes: en `sumar` siguen saliendo.
  const con = await textoDelPdf(fila({ ...base, ivaModo: 'sumar' }));
  for (const conIva of ['Total: 121,00 EUR', 'Total: 242,00 EUR', 'Total: 363,00 EUR', 'Total presupuesto: 242,00 EUR']) {
    assert.ok(con.includes(conIva), `🔴 \`sumar\` ha dejado de pintar «${conIva}»:\n  ${con}`);
  }
});

test('SCRUM-1302m · un presupuesto anterior a la casilla sale idéntico al de `sumar`', async () => {
  const quitarNumero = (s) => s.replace(/#\d+/g, '#');
  const viejo = await textoDelPdf(fila({ lines: UNA_AL_21, ivaModo: null }));
  const sumar = await textoDelPdf(fila({ lines: UNA_AL_21, ivaModo: 'sumar' }));
  assert.ok(viejo.length > 100, 'CIEGO: el PDF sin modo ha salido vacío');
  assert.equal(quitarNumero(viejo), quitarNumero(sumar));
});

test('SCRUM-1302m · 🔴 nada de esto alcanza a la FACTURA', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), 'utf8');
  const sf = ts.createSourceFile('pdf.ts', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const cuerpos = {};
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) cuerpos[n.name.text] = n.body.getText(sf);
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok((cuerpos.generateInvoicePdf || '').length > 2000, 'CIEGO: no encuentro el cuerpo de `generateInvoicePdf`');
  assert.ok((cuerpos.generateQuotePdf || '').length > 2000, 'CIEGO: no encuentro el cuerpo de `generateQuotePdf`');
  for (const marca of ['ivaDentroDelImporte', 'ivaFueraDelPapel']) {
    assert.ok(cuerpos.generateQuotePdf.includes(marca), `control: «${marca}» está en el presupuesto, que es donde vive`);
    assert.ok(!cuerpos.generateInvoicePdf.includes(marca),
      `🔴 «${marca}» aparece en la FACTURA. Una factura lleva base, cuota y total SIEMPRE.`);
  }
});
