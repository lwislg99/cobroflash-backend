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
  generateQuotePdf, TITULO_OBSERVACIONES,
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
  // La cabecera se identifica por SU TEXTO: desde el 2-sep-2026 ese bloque NO tiene rótulo.
  assert.equal(lineasConPdf(r.lineas, 'Aviso de la cabecera'), 1,
    `🔴 el texto de cabecera no sale una vez: ${JSON.stringify(r.lineas.map((l) => l.texto))}`);
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
  // ⚠️ La cabecera ya NO entra aquí, y no es un olvido: desde el 2-sep-2026 no tiene rótulo, así
  // que no hay dos cosas que puedan salir pegadas. Que salga sin rótulo lo comprueba el test de
  // más abajo, por CONTEO DE LÍNEAS.
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
    assert.equal(lineasConPdf(r.lineas, '[PENDIENTE'), 0,
      `🔴 (${n}) sale un MARCADOR DE MICROCOPY en el documento. Ninguno debe llegar al papel: lo `
      + 've el cliente del profesional.');
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL BLOQUE DE CABECERA SE IMPRIME **SIN RÓTULO** — decisión del fundador, 2-sep-2026
//
// Aquí vivía el test contrario: exigía que los DOS rótulos del PDF fueran distintos. **Su premisa
// caducó** el día que se firmó que en el papel la cabecera no lleva rótulo — en el PDF ya sólo hay
// UNO. No se borra: se INVIERTE, y la afirmación contraria tiene que poder fallar.
//
// ── POR QUÉ SE MIDE CONTANDO LÍNEAS Y NO BUSCANDO TEXTO ──────────────────────────────────────
// **Un bloque sin rótulo no se identifica por su rótulo: sólo por su posición.** Buscar «que no
// aparezca X» obligaría a saber qué X escribiría el que se equivoque, y ninguna lista de textos
// prohibidos es exhaustiva. Contar líneas no necesita adivinar: si alguien añade un rótulo —el que
// sea— el documento crece UNA LÍNEA MÁS de lo que pide su texto, y eso se ve siempre.
//
// Es además la lección que costó cinco tests hoy mismo: anclar un guard en el TEXTO lo rompe un
// retoque de copy, y encima con un mensaje que no habla de copy.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593 · 🔴 la CABECERA se imprime SIN RÓTULO: añadirle uno hace caer esto', async () => {
  const sin = await lineasDe({});
  const con = await lineasDe({ docHeaderText: 'UNA_SOLA_LINEA_CAB' });

  // ── SUELO, PRIMERO. Sin esto, «no hay rótulo» y «no hay bloque» dan el MISMO verde, que es el
  //    patrón más caro de la casa: un requisito de ausencia sin suelo es una intención escrita.
  assert.equal(lineasConPdf(con.lineas, 'UNA_SOLA_LINEA_CAB'), 1,
    '🔴 SUELO: el texto de cabecera NO está en el PDF. Entonces «no lleva rótulo» no significa '
    + 'nada: no hay bloque que mirar.');

  // ── Y LA AFIRMACIÓN: un texto de UNA línea añade EXACTAMENTE UNA línea. Con rótulo serían dos.
  const crecio = con.lineas.length - sin.lineas.length;
  assert.equal(crecio, 1,
    `🔴 el bloque de cabecera añade ${crecio} líneas y su texto tiene UNA. Si son 2, se le ha `
    + 'puesto un RÓTULO — y el fundador firmó el 2-sep-2026 que en el papel va sólo el texto. Ese '
    + 'documento lo ve el cliente del profesional.');
});

test('SCRUM-593 · 🔴 y el pie SÍ lleva el suyo: la asimetría es la DECISIÓN, no un descuido', async () => {
  // El control positivo del test de arriba: el instrumento SABE contar un rótulo cuando lo hay.
  // Sin esto, «la cabecera añade 1 línea» también saldría si el contador estuviera roto y siempre
  // devolviera 1.
  const sin = await lineasDe({});
  const con = await lineasDe({ docFooterText: 'UNA_SOLA_LINEA_PIE' });

  assert.equal(lineasConPdf(con.lineas, 'UNA_SOLA_LINEA_PIE'), 1, '🔴 SUELO: el texto del pie no sale.');
  assert.equal(lineasConPdf(con.lineas, TITULO_OBSERVACIONES), 1,
    '🔴 el pie ha perdido su rótulo. «Observaciones» está APROBADO y sigue en el papel.');

  const crecio = con.lineas.length - sin.lineas.length;
  assert.equal(crecio, 2,
    `🔴 el bloque final añade ${crecio} líneas y deberían ser 2 (su rótulo + su texto). Si es 1, ha `
    + 'desaparecido «Observaciones»; si es 3, hay algo de más.');
});

test('SCRUM-593 · 🔴 la cuenta aguanta con TEXTO LARGO: 3 líneas añaden 3, no 4', async () => {
  // El control de que la medida no depende de que el texto quepa en una línea — y de que sigue sin
  // colarse un rótulo cuando el bloque es grande.
  const sin = await lineasDe({});
  const con = await lineasDe({ docHeaderText: 'CAB_A\nCAB_B\nCAB_C' });
  for (const m of ['CAB_A', 'CAB_B', 'CAB_C']) {
    assert.equal(lineasConPdf(con.lineas, m), 1, `🔴 SUELO: «${m}» no está en el PDF.`);
  }
  assert.equal(con.lineas.length - sin.lineas.length, 3,
    '🔴 un texto de tres líneas no ocupa tres: o se ha añadido un rótulo, o se han perdido saltos.');
});
