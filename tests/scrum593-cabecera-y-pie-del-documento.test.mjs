// tests/scrum593-cabecera-y-pie-del-documento.test.mjs — SCRUM-593 (DOC-03)
//
// CABECERA Y PIE DEL DOCUMENTO, y que salgan como BLOQUES SEPARADOS.
//
// Dos textos libres: uno bajo la cabecera y otro al final, que se presenta como «Observaciones»
// (rótulo APROBADO por el fundador el 2-sep-2026; el de la cabecera sigue sin firmar y sale con
// marcador). Los dos son MULTILÍNEA desde el principio, que es lo que exige SCRUM-655 (T6).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SE COMPRUEBA CON `lineasDePdf` (SCRUM-659), NO CON EL LECTOR DE TEXTO
//
// `extraerTextoPdf` concatena sin separador: `'ALFA\nBETA'` y `'ALFABETA'` le dan lo mismo. Con
// él, un bloque pintado PEGADO a otro pasaría en verde. Por eso se lee por LÍNEAS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 HUECO DECLARADO · «BYTE-IDÉNTICO» NO SE PUEDE COMPROBAR, Y ESTÁ MEDIDO
//
// El control negativo pedía que un documento sin estos campos saliera byte a byte como el de hoy.
// **No es posible:** dos PDF del MISMO contenido no son byte-idénticos — PDFKit escribe
// `/CreationDate`. Medido: mismo tamaño (1967 = 1967 bytes) y `Buffer.compare !== 0`.
//
// Lo que sí se puede, y es lo que se hace: **mismo TEXTO, mismas LÍNEAS y mismo TAMAÑO**. Un
// bloque que se colara sin pedirlo cambiaría las tres cosas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lineasDePdf, lineasConPdf, extraerTextoPdf } from './_texto-del-pdf.mjs';

const {
  generateQuotePdf, TITULO_OBSERVACIONES, MARCADOR_MICROCOPY_CABECERA_DOC,
} = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');

const BASE = {
  merchant: { name: 'QA Fontanería', legalName: 'QA SL', taxId: 'B00000000' },
  customer: { name: 'Cliente QA' },
  currency: 'EUR', total: '72.60',
  lines: [{ concept: 'Mano de obra', qty: 2, price: 30, tax: 0.21 }],
  signatureData: null, country: 'ES',
};
let siguienteId = 99593100;

/** Genera un presupuesto y devuelve sus líneas leídas del PDF. Borra el fichero siempre. */
async function lineasDe(extra) {
  const id = siguienteId++;
  const { outPath } = await generateQuotePdf({ ...BASE, quoteId: id, quoteNumber: 593, ...extra });
  try {
    const buf = fs.readFileSync(outPath);
    const r = lineasDePdf(buf);
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un vacío se leería como «no lo dice».`);
    return { ...r, bytes: buf.length, texto: extraerTextoPdf(buf).texto };
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS BLOQUES SALEN, Y EN SU SITIO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593 · 🔴 los dos bloques SALEN en el PDF del presupuesto', async () => {
  const r = await lineasDe({
    docHeaderText: 'Aviso de la cabecera',
    docFooterText: 'Texto final del documento',
  });
  assert.equal(lineasConPdf(r.lineas, MARCADOR_MICROCOPY_CABECERA_DOC), 1,
    `🔴 el rótulo de la cabecera no sale una vez: ${JSON.stringify(r.lineas.map((l) => l.texto))}`);
  assert.equal(lineasConPdf(r.lineas, 'Aviso de la cabecera'), 1, '🔴 el texto de cabecera no sale.');
  assert.equal(lineasConPdf(r.lineas, TITULO_OBSERVACIONES), 1,
    '🔴 el bloque «Observaciones» no sale una vez.');
  assert.equal(lineasConPdf(r.lineas, 'Texto final del documento'), 1, '🔴 el texto final no sale.');
});

test('SCRUM-593 · 🔴 y en SU SITIO: la cabecera arriba del detalle, el pie DESPUÉS del total', async () => {
  const r = await lineasDe({ docHeaderText: 'AVISO_CABECERA', docFooterText: 'TEXTO_FINAL' });
  const idx = (aguja) => r.lineas.findIndex((l) => l.texto.includes(aguja));
  const cabecera = idx('AVISO_CABECERA');
  const detalle = idx('Detalle del');
  const total = idx('Total ');
  const pie = idx('TEXTO_FINAL');
  assert.ok(cabecera !== -1 && detalle !== -1 && total !== -1 && pie !== -1,
    `🔴 SUELO: falta alguna de las cuatro marcas — ${JSON.stringify({ cabecera, detalle, total, pie })}`);
  assert.ok(cabecera < detalle, `🔴 la cabecera no está ANTES del detalle (${cabecera} vs ${detalle}).`);
  assert.ok(pie > total, `🔴 el pie no está DESPUÉS del total (${pie} vs ${total}).`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO DEL SALTO: bloques SEPARADOS, no pegados
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593 · 🔴 el rótulo y su texto son LÍNEAS DISTINTAS, no una pegada', async () => {
  // Es justo para lo que se construyó `lineasDePdf`: con el lector de texto, «Observacionesalgo»
  // y «Observaciones» + «algo» son la MISMA cadena, y un bloque pegado pasaría en verde.
  const r = await lineasDe({ docHeaderText: 'CAB', docFooterText: 'PIE' });
  const conRotulo = r.lineas.find((l) => l.texto.includes(TITULO_OBSERVACIONES));
  assert.ok(conRotulo, '🔴 no encuentro la línea del rótulo.');
  assert.equal(conRotulo.texto.includes('PIE'), false,
    `🔴 el rótulo y su texto salen PEGADOS en la misma línea: ${JSON.stringify(conRotulo.texto)}`);
  const conCab = r.lineas.find((l) => l.texto.includes(MARCADOR_MICROCOPY_CABECERA_DOC));
  assert.equal(conCab.texto.includes('CAB'), false,
    `🔴 el rótulo de cabecera y su texto salen pegados: ${JSON.stringify(conCab.texto)}`);
});

test('SCRUM-593 · 🔴 MULTILÍNEA: un texto de tres líneas ocupa TRES líneas en el PDF', async () => {
  const r = await lineasDe({ docFooterText: 'UNO_A\nDOS_B\nTRES_C' });
  for (const marca of ['UNO_A', 'DOS_B', 'TRES_C']) {
    assert.equal(lineasConPdf(r.lineas, marca), 1, `🔴 «${marca}» no está en su propia línea.`);
  }
  const l = (m) => r.lineas.findIndex((x) => x.texto.includes(m));
  assert.ok(l('UNO_A') < l('DOS_B') && l('DOS_B') < l('TRES_C'),
    '🔴 las tres líneas no salen en orden.');
  // 🔴 Y EL CONTROL DE QUE ESTO MIDE ALGO: el mismo texto SIN saltos ocupa UNA sola línea.
  const pegado = await lineasDe({ docFooterText: 'UNO_ADOS_BTRES_C' });
  assert.equal(lineasConPdf(pegado.lineas, 'UNO_ADOS_BTRES_C'), 1,
    '🔴 el mismo texto sin saltos no sale en una línea: el instrumento no distingue.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO: sin los campos, el documento no cambia
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593 · 🔴 SIN los campos, el documento sale como hasta hoy', async () => {
  const sin = await lineasDe({});
  const nulos = await lineasDe({ docHeaderText: null, docFooterText: undefined });
  const vacios = await lineasDe({ docHeaderText: '', docFooterText: '   ' });

  for (const [n, r] of [['sin pasarlos', sin], ['a null', nulos], ['vacíos', vacios]]) {
    assert.equal(lineasConPdf(r.lineas, TITULO_OBSERVACIONES), 0,
      `🔴 (${n}) sale «Observaciones» en un documento que no la pidió.`);
    assert.equal(lineasConPdf(r.lineas, MARCADOR_MICROCOPY_CABECERA_DOC), 0,
      `🔴 (${n}) sale un MARCADOR DE MICROCOPY en un documento que no lo pidió.`);
  }
  // Lo más fuerte que se puede afirmar (ver el hueco declarado arriba): mismo texto, mismas
  // líneas y mismo tamaño. Un bloque colado cambiaría las tres cosas.
  assert.equal(sin.texto, nulos.texto, '🔴 pasar `null` cambia lo que dice el documento.');
  assert.equal(sin.lineas.length, vacios.lineas.length,
    '🔴 un texto en blanco añade líneas: se está pintando un bloque vacío.');
  assert.equal(sin.bytes, nulos.bytes, '🔴 pasar `null` cambia el tamaño del documento.');
});

test('SCRUM-593 · CONTROL NEGATIVO del suelo: el detector NO ve lo que no está', async () => {
  // Sin esto, los ceros de arriba también saldrían si `lineasConPdf` estuviera roto.
  const r = await lineasDe({ docFooterText: 'PIE' });
  assert.equal(lineasConPdf(r.lineas, 'FACTURA RECTIFICATIVA'), 0,
    '🔴 dice ver una línea que el documento no imprime.');
  assert.equal(lineasConPdf(r.lineas, 'PIE'), 1,
    '🔴 SUELO: y sí ve la que sí está. Si no, sus ceros no significarían nada.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL ALBARÁN — el rótulo aprobado, y el campo que NO se duplica
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593 · el ALBARÁN usa el rótulo aprobado y NO crea un segundo campo de pie', () => {
  // 🕳️ HUECO DECLARADO: esto se ancla en el CONTENIDO del fuente, no sobre un PDF de albarán
  // generado. Levantar uno exige el sobre entero de `albaranPdf.service` y este ticket no lo
  // construye; el control del PDF de verdad está hecho sobre el presupuesto, que comparte
  // exactamente el mismo rótulo y el mismo mecanismo de pintado.
  const src = fs.readFileSync(new URL('../src/modules/jobs/infra/albaranPdf.service.ts', import.meta.url), 'utf8');
  assert.match(src, /text\(TITULO_OBSERVACIONES\)/,
    '🔴 el albarán no usa el rótulo aprobado; si sigue con «Notas:», hay dos palabras para lo mismo.');
  assert.equal(/text\('Notas:'\)/.test(src), false, '🔴 sigue el rótulo viejo en el albarán.');
  assert.match(src, /if \(params\.notas\)/,
    '🔴 el CAMPO del pie ha cambiado. `notas` ya existía y se REUTILIZA: crear otro lo duplicaría.');
  assert.equal(/docFooterText/.test(src), false,
    '🔴 se ha creado un segundo campo de pie en el albarán. El pie de ese documento es `notas`.');
});
