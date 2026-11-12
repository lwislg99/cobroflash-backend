// SCRUM-1442c · LA TARJETA DE OPCIÓN DEL PDF DEL PRESUPUESTO NO PINTA «× undefined» NI «NaN».
//
// El defecto, reproducido con el PDF de verdad antes de tocar nada (docs/master/evidencias/SCRUM-1442,
// `antes-*`): una opción con una cabecera de apartado —el esquema la guarda como
// `{"concept":"Fase 1","tax":0,"apartado":true}`, sin `qty` ni `price` (SCRUM-655)— salía
//
//     Fase 1 × undefined
//                 NaN EUR
//
// La vía es la decidida el 18-oct-2026 para la página pública (1442b): la cabecera pinta su
// concepto y el importe vacío. GO del fundador para tocar SOLO esta tarjeta: SCRUM-1442 c.21648.
//
// Sin gate: el cuerpo pasa por `CreateQuoteSchema`, y el PDF por `paramsDePresupuestoParaPdf` →
// `generateQuotePdf`, la cadena de las rutas. Lee su texto. Ni base ni red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { extraerTextoPdf, lineasDePdf } from './_texto-del-pdf.mjs';

const { generateQuotePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const { paramsDePresupuestoParaPdf } = await import('../dist/modules/quotes/domain/presupuestoParaPdf.js');
const { calcTotal } = await import('../dist/core/utils/utils.js');
const { CreateQuoteSchema } = await import('../dist/core/validation/schemas.js');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Las corre el meta-guard (SCRUM-1387). Cada campo, LITERAL: el lector no resuelve constantes.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { // M1 · la cabecera vuelve a pintar «× undefined».
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: "const text = conImporte ? `${l.concept} × ${l.qty}` : String(l.concept ?? '');",
    a: 'const text = `${l.concept} × ${l.qty}`;',
    cae: 'SCRUM-1442c · ① una cabecera de apartado dentro de una opción',
  },
  { // M2 · la cabecera vuelve a pintar «NaN EUR».
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'if (conImporte) doc.text(`${fmtImporte(importe)} ${params.currency}`',
    a: 'doc.text(`${fmtImporte(importe)} ${params.currency}`',
    cae: 'SCRUM-1442c · ① una cabecera de apartado dentro de una opción',
  },
  { // M3 · las líneas normales pierden su importe (el control tiene que verlo).
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'const conImporte = Number.isFinite(importe);',
    a: 'const conImporte = false;',
    cae: 'SCRUM-1442c · ② control',
  },
  { // M4 · cada tarjeta vuelve a arrancar donde acabó la anterior (escalera).
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: 'const yStart = yTarjetas;',
    a: 'const yStart = doc.y;',
    cae: 'SCRUM-1442c · ④ las tres tarjetas',
  },
  { // M5 · la recomendada deja de dibujar su estrella.
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: "doc.polygon(...puntas).fill('#ffffff');",
    a: 'void puntas;',
    cae: 'SCRUM-1442c · ⑤ la opción recomendada',
  },
];

const linea = (concept, price) => ({ concept, qty: 1, price, tax: 0.21 });

async function bytesDelPdf(conCabecera, recomendada = true) {
  const v = CreateQuoteSchema.safeParse({
    merchant_id: 71, customer_id: 71, currency: 'EUR',
    tiers: [
      { id: 'good', label: 'Básica', lines: [linea('Revisión', 100)] },
      { id: 'better', label: 'Completa', ...(recomendada ? { recommended: true } : {}),
        lines: [...(conCabecera ? [{ concept: 'Fase 1', apartado: true }] : []), linea('Revisión', 100), linea('Cambio de pieza', 80)] },
      { id: 'best', label: 'Integral', lines: [linea('Revisión', 100), linea('Cambio de pieza', 80), linea('Garantía', 50)] },
    ],
  });
  assert.equal(v.success, true, 'CIEGO: el esquema rechaza el cuerpo, y lo que sigue no mediría la ruta');
  const tiers = v.data.tiers.map((t) => ({ ...t, total: calcTotal(t.lines, null) }));
  const q = {
    id: 1442, merchantId: 71, customerId: 71, status: 'sent', currency: 'EUR',
    total: tiers[1].total.toFixed(2), lines: tiers[1].lines, ivaModo: 'sumar', tiers,
    discountGlobalAmount: null, quoteNumber: 7, revision: 0,
    docFields: null, docHeaderText: null, docFooterText: null, clausulasExcluidas: null,
    acceptedAt: null, signatureUrl: null, evidenciaFirma: null,
    createdAt: new Date(), updatedAt: new Date(),
    merchant: { id: 71, name: 'Oficio', legalName: null, logoUrl: null, address: null,
      country: 'ES', timezone: 'Europe/Madrid', clausulasPresupuesto: null },
    customer: { name: 'Cliente' },
  };
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote: q, merchant: q.merchant, customer: q.customer }));
  try { return fs.readFileSync(outPath); } finally { fs.rmSync(outPath, { force: true }); }
}

async function textoDelPdf(conCabecera) {
  const r = extraerTextoPdf(await bytesDelPdf(conCabecera));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un vacío se leería como «no lo dice».`);
  return r.texto;
}

/** Cuántos operadores de trazo `l` (lineTo) hay en los flujos de contenido, inflados. */
function trazosL(buf) {
  const s = buf.toString('latin1');
  let n = 0;
  let flujos = 0;
  let i = 0;
  while ((i = s.indexOf('stream', i)) !== -1) {
    if (s.slice(i - 3, i) === 'end') { i += 6; continue; }
    let ini = i + 6;
    if (s[ini] === '\r') ini += 1;
    if (s[ini] === '\n') ini += 1;
    const fin = s.indexOf('endstream', ini);
    if (fin === -1) break;
    let plano;
    try { plano = zlib.inflateSync(buf.subarray(ini, fin)).toString('latin1'); } catch { plano = s.slice(ini, fin); }
    flujos += 1;
    n += plano.split('\n').filter((ln) => / l$/.test(ln.trim())).length;
    i = fin + 9;
  }
  assert.ok(flujos > 0, 'CIEGO: no he encontrado ni un flujo en el PDF');
  return n;
}

/** Los bytes de control (todos menos TAB, LF y CR, más DEL) de un texto. */
const bytesDeControl = (t) => [...t].filter((c) => { const k = c.charCodeAt(0); return (k < 32 && k !== 9 && k !== 10 && k !== 13) || k === 127; });

test('SCRUM-1442c · ① una cabecera de apartado dentro de una opción pinta su concepto, sin «undefined» ni «NaN»', async () => {
  const pdf = await textoDelPdf(true);
  assert.ok(pdf.includes('Fase 1'), `CIEGO: la cabecera no está en el papel, y su ausencia no probaría nada:\n  ${pdf}`);
  assert.ok(!pdf.includes('undefined'), `🔴 «undefined» en el PDF que recibe el cliente:\n  ${pdf}`);
  assert.ok(!pdf.includes('NaN'), `🔴 «NaN» en el PDF que recibe el cliente:\n  ${pdf}`);
  assert.ok(!pdf.includes('Fase 1 ×'), `🔴 la cabecera lleva cantidad: no la tiene\n  ${pdf}`);
  // El total de la opción no cambia por llevar la cabecera: 121,00 + 96,80.
  assert.ok(pdf.includes('Total: 217,80 EUR'), pdf);
});

test('SCRUM-1442c · ② control: sin cabecera, las tres tarjetas pintan cantidad e importe como siempre', async () => {
  const pdf = await textoDelPdf(false);
  // El positivo de las negaciones de ①, con las MISMAS líneas: «× 1» y su importe siguen saliendo.
  assert.equal(pdf.split('Revisión × 1121,00 EUR').length - 1, 3, `🔴 faltan líneas normales con su importe:\n  ${pdf}`);
  assert.equal(pdf.split('Cambio de pieza × 196,80 EUR').length - 1, 2, pdf);
  assert.ok(pdf.includes('Garantía × 160,50 EUR'), pdf);
  for (const t of ['Total: 121,00 EUR', 'Total: 217,80 EUR', 'Total: 278,30 EUR']) assert.ok(pdf.includes(t), `falta «${t}»:\n  ${pdf}`);
  assert.ok(!pdf.includes('undefined') && !pdf.includes('NaN'), pdf);
});

test('SCRUM-1442c · ③ el arreglo vive en el PRESUPUESTO, no en la factura', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), 'utf8');
  const sf = ts.createSourceFile('pdf.ts', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const cuerpos = {};
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) cuerpos[n.name.text] = n.body.getText(sf);
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok((cuerpos.generateInvoicePdf || '').length > 2000, 'CIEGO: no encuentro el cuerpo de `generateInvoicePdf`');
  assert.ok((cuerpos.generateQuotePdf || '').includes('conImporte'), 'control: `conImporte` está en el presupuesto');
  assert.ok(!cuerpos.generateInvoicePdf.includes('conImporte'), '🔴 el arreglo de la tarjeta ha llegado a la factura');
});

// ── Segundo GO del fundador (SCRUM-1442 c.21717): las tarjetas en ESCALERA y la ★ que sale como «&».

test('SCRUM-1442c · ④ las tres tarjetas empiezan a la MISMA altura, no en escalera', async () => {
  const r = lineasDePdf(await bytesDelPdf(false));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER LAS LÍNEAS DEL PDF: ${r.motivo}`);
  const cabeceras = r.lineas.filter((l) => /Básica|Completa|Integral/.test(l.texto) && !l.texto.includes('×'));
  assert.ok(cabeceras.length > 0, `CIEGO: no encuentro ninguna cabecera de tarjeta:\n  ${r.lineas.map((l) => l.texto).join('\n  ')}`);
  assert.equal(cabeceras.length, 1,
    `🔴 las cabeceras de las tarjetas salen en ${cabeceras.length} alturas distintas (escalera):\n  `
    + cabeceras.map((l) => `y=${l.y} · ${l.texto}`).join('\n  '));
  for (const n of ['Básica', 'Completa', 'Integral']) assert.ok(cabeceras[0].texto.includes(n), `falta «${n}» en la fila de cabeceras: ${cabeceras[0].texto}`);
  // Lo que va DETRÁS de las tarjetas no se monta encima de la más alta: la frase del pie va por
  // debajo del último total.
  const pie = r.lineas.find((l) => l.texto.startsWith('El cliente puede elegir'));
  const totales = r.lineas.filter((l) => l.texto.includes('Total: '));
  assert.ok(pie && totales.length > 0, 'CIEGO: no encuentro el pie o los totales de las tarjetas');
  const yDelPie = r.lineas.indexOf(pie);
  for (const t of totales) assert.ok(r.lineas.indexOf(t) < yDelPie, `🔴 el pie «${pie.texto}» se pinta antes que «${t.texto}»`);
});

test('SCRUM-1442c · ⑤ la opción recomendada lleva su estrella DIBUJADA, no un «&» ni un byte de control', async () => {
  const conEstrella = await bytesDelPdf(false, true);
  const sinEstrella = await bytesDelPdf(false, false);
  const r = lineasDePdf(conEstrella);
  assert.equal(r.ok, true, `🔴 NO SUPE LEER LAS LÍNEAS DEL PDF: ${r.motivo}`);
  const cabecera = r.lineas.find((l) => l.texto.includes('Completa') && !l.texto.includes('×'));
  assert.ok(cabecera, 'CIEGO: no encuentro la cabecera de la opción recomendada');
  assert.ok(!cabecera.texto.includes('&'), `🔴 la ★ sale como «&»: ${JSON.stringify(cabecera.texto)}`);
  assert.deepEqual(bytesDeControl(r.texto), [], `🔴 bytes de control en el texto del PDF: ${JSON.stringify(r.texto)}`);
  // La estrella es un polígono de 10 puntas: un `m` y nueve `l` más que la misma tarjeta sin recomendar.
  assert.equal(trazosL(conEstrella) - trazosL(sinEstrella), 9,
    `🔴 la recomendada no dibuja su estrella: ${trazosL(conEstrella)} trazos contra ${trazosL(sinEstrella)}`);
});
