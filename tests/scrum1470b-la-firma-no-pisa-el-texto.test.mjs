// SCRUM-1470b · EN EL PDF DEL PRESUPUESTO, LA FIRMA NO PISA «Firmado digitalmente por…».
//
// Medido por S1 en su gemelo del albarán (SCRUM-1589, SCRUM-1470 c.20507): la firma se dibuja en una
// caja de 180×70 pt y después el papel bajaba con `moveDown(5)`, que a 10 pt son 59,5 pt. La imagen
// llega a 70 pt, así que el trazo caía 10,5 pt encima de la línea de debajo. El pad de firma es de
// ≤470×190 px (`signaturePad.js`): TODA firma real llena la caja de alto.
//
// Se genera el PDF de VERDAD (`generateQuotePdf` con los parámetros de su constructor,
// `paramsDePresupuestoParaPdf`) y se mide dónde pinta pdfkit, envolviendo su prototipo DESDE FUERA
// en el proceso hijo. No se toca ni una línea de `src/` para poder mirar.
//
// Y la segunda mitad: bajar el cursor 14,5 pt más es justo lo que puede partir el bloque de la firma
// en dos páginas. La reserva del salto (`doc.y + N`) se LEE del fuente, y se comprueba de dos formas:
// el bloque medido cabe en ella, y un barrido de presupuestos de 0 a N líneas no lo parte nunca.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

const HIJO = `
  import fs from 'node:fs';
  import zlib from 'node:zlib';
  import { createRequire } from 'node:module';
  const require = createRequire(import.meta.url);
  const PDFDocument = require('pdfkit');
  const { generateQuotePdf } = require('./dist/modules/invoicing/infra/pdf/pdf.service.js');
  const { paramsDePresupuestoParaPdf } = require('./dist/modules/quotes/domain/presupuestoParaPdf.js');

  // PNG transparente de W×H con un trazo negro horizontal: lo que manda el pad de firma.
  function png(W, H) {
    const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
    const trozo = (tipo, datos) => { const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const td = Buffer.concat([Buffer.from(tipo), datos]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
    const filas = [];
    for (let y = 0; y < H; y++) { const f = Buffer.alloc(1 + W * 4); if (y === Math.floor(H * 0.8)) for (let x = 0; x < W; x++) f[1 + x * 4 + 3] = 255; filas.push(f); }
    return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(Buffer.concat(filas))), trozo('IEND', Buffer.alloc(0))]).toString('base64');
  }

  // Dónde pinta pdfkit: la caja REAL de cada imagen (la matriz que aplica), la y de cada texto con la
  // y en que deja el cursor, cada raya, y en qué página va cada cosa.
  let marcas = [];
  let enImagen = false;
  let paginas = 0;
  const P = PDFDocument.prototype;
  const image = P.image, transform = P.transform, text = P.text, moveTo = P.moveTo, addPage = P.addPage;
  let fondo = null;
  P.addPage = function (...a) { paginas += 1; const r = addPage.apply(this, a); fondo = this.page.height - this.page.margins.bottom; return r; };
  P.image = function (...a) { enImagen = true; try { return image.apply(this, a); } finally { enImagen = false; } };
  P.transform = function (m11, m12, m21, m22, dx, dy) {
    if (enImagen) { const h = -m22; marcas.push({ que: 'imagen', arriba: dy - h, abajo: dy, pagina: paginas }); enImagen = false; }
    return transform.apply(this, arguments);
  };
  P.moveTo = function (x, y) { marcas.push({ que: 'raya', y, pagina: paginas }); return moveTo.apply(this, arguments); };
  P.text = function (t, ...a) {
    const y = typeof a[1] === 'number' ? a[1] : this.y;
    const r = text.call(this, t, ...a);
    if (typeof t === 'string') marcas.push({ que: 'texto', t, y, despues: this.y, pagina: paginas });
    return r;
  };

  const { firmas, lineas } = JSON.parse(process.argv[1]);
  let n = 0;
  async function generar(firma, nLineas, nObservaciones = 0) {
    marcas = []; paginas = 0;
    const cuando = new Date('2026-10-23T10:00:00Z');
    const merchant = {
      id: 14700, name: 'Taller', legalName: 'Taller SL', email: 'taller@test.local', logoUrl: null, address: null,
      country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: null, flags: {},
      connectStatus: 'none', stripeAccountId: null, iban: null, clabe: null, bizumPhone: null,
      clausulasPresupuesto: null, timezone: 'Europe/Madrid',
    };
    const quote = {
      id: 1470900 + (n += 1) + Math.floor(Math.random() * 1000) * 100, quoteNumber: 7, revision: 0, status: 'accepted', currency: 'EUR',
      total: { toString: () => '121.00' },
      lines: Array.from({ length: nLineas }, (_, i) => ({ concept: 'Partida ' + (i + 1), qty: 1, price: 100, tax: 0.21 })),
      createdAt: cuando, validUntil: null, acceptedAt: cuando, rejectedAt: null, signatureUrl: png(firma[0], firma[1]),
      evidenciaFirma: null, merchant, customer: { name: 'Ana' },
      docFooterText: nObservaciones ? Array.from({ length: nObservaciones }, (_, i) => 'Nota ' + (i + 1)).join('\\n') : null,
    };
    const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote, merchant, customer: quote.customer }));
    try { fs.unlinkSync(outPath); } catch {}
    return marcas;
  }
  const salida = { firmas: [], lineas: [] };
  for (const f of firmas) salida.firmas.push(await generar(f, 1));
  for (const [k, o] of lineas) salida.lineas.push({ nLineas: k, nObservaciones: o, fondo: null, marcas: await generar([470, 190], k, o) }), salida.lineas.at(-1).fondo = fondo;
  process.stdout.write(JSON.stringify(salida));
`;

// Lo que dibuja el pad: el ancho va de 240 a 470 px (según la pantalla) y el alto es 190. Y el 1×1,
// el trazo de prueba que dejan los tests.
const FIRMAS = [
  { nombre: 'pad en escritorio, 470×190', W: 470, H: 190 },
  { nombre: 'pad en un móvil estrecho, 240×190', W: 240, H: 190 },
  { nombre: 'firma cuadrada, 1×1', W: 1, H: 1 },
];
// El barrido del salto de página. Una fila de la tabla baja el bloque 18 pt y una línea de
// observaciones 11,56: combinadas, el bloque se acerca al borde de la reserva en pasos de ~5 pt (lo
// que se acerca de verdad lo MIDE el test y lo exige, no se supone). Medido el 23-oct: el bloque
// salta de la página 1 entre 22 y 23 filas sin observaciones.
const RESOLUCION_PT = 6;
const LINEAS = [];
for (let k = 14; k <= 26; k++) for (let o = 0; o <= 6; o++) LINEAS.push([k, o]);

let memo = null;
function medir() {
  if (memo) return memo;
  const salida = execFileSync(process.execPath, ['--input-type=module', '-e', HIJO,
    JSON.stringify({ firmas: FIRMAS.map((f) => [f.W, f.H]), lineas: LINEAS })],
  { encoding: 'utf8', cwd: RAIZ, maxBuffer: 1 << 26 });
  memo = JSON.parse(salida);
  assert.equal(memo.firmas.length, FIRMAS.length, '🔴 CIEGO: el hijo no generó todas las firmas');
  assert.equal(memo.lineas.length, LINEAS.length, '🔴 CIEGO: el hijo no generó todo el barrido');
  return memo;
}

/** El bloque de la firma dentro de las marcas de UN papel: raya, rótulo, imagen y la línea de debajo. */
function bloque(m) {
  const imagenes = m.filter((x) => x.que === 'imagen');
  // La firma es la única imagen del papel de prueba (sin logo): si aparece otra, el test mira mal.
  assert.equal(imagenes.length, 1, `🔴 CIEGO: esperaba UNA imagen (la firma) y pdfkit pintó ${imagenes.length}`);
  const firma = imagenes[0];
  assert.ok(firma.abajo - firma.arriba > 50, `🔴 CIEGO: la firma mide ${firma.abajo - firma.arriba} pt de alto; esperaba cerca de 70`);
  const iFirma = m.indexOf(firma);
  const iRotulo = m.slice(0, iFirma).map((x) => x.que === 'texto' && x.t === 'Firma del cliente:').lastIndexOf(true);
  assert.notEqual(iRotulo, -1, '🔴 CIEGO: no encuentro «Firma del cliente:» antes de la firma');
  const iRaya = m.slice(0, iRotulo).map((x) => x.que === 'raya').lastIndexOf(true);
  assert.notEqual(iRaya, -1, '🔴 CIEGO: no encuentro la raya que abre el bloque de la firma');
  // La línea de debajo es el PRIMER texto que se pinta tras la firma, y es la de quién firmó.
  const debajo = m.slice(iFirma).find((x) => x.que === 'texto');
  assert.ok(debajo && debajo.t.startsWith('Firmado digitalmente por Ana el '),
    `🔴 CIEGO: el primer texto tras la firma no es «Firmado digitalmente por Ana el …»: ${debajo && debajo.t}`);
  return { raya: m[iRaya], rotulo: m[iRotulo], firma, debajo };
}

const caso = casosEscritos(FIRMAS, (f) => `SCRUM-1470b · ${f.nombre}: «Firmado digitalmente por…» empieza DEBAJO de la firma, no encima`, (f) => {
  {
    const { firma, debajo } = bloque(medir().firmas[FIRMAS.indexOf(f)]);
    assert.ok(debajo.y >= firma.abajo,
      `🔴 la firma (de ${firma.arriba.toFixed(1)} a ${firma.abajo.toFixed(1)} pt) pisa «Firmado digitalmente por…», `
      + `que empieza en ${debajo.y.toFixed(1)}: ${(firma.abajo - debajo.y).toFixed(1)} pt de solape`);
    // Y nada se queda colgando lejos: el texto va pegado a la firma (menos de una línea de hueco).
    assert.ok(debajo.y - firma.abajo < 12, `🔴 el texto se ha ido ${(debajo.y - firma.abajo).toFixed(1)} pt por debajo de la firma`);
  }
});
test('SCRUM-1470b · pad en escritorio, 470×190: «Firmado digitalmente por…» empieza DEBAJO de la firma, no encima', caso(0));
test('SCRUM-1470b · pad en un móvil estrecho, 240×190: «Firmado digitalmente por…» empieza DEBAJO de la firma, no encima', caso(1));
test('SCRUM-1470b · firma cuadrada, 1×1: «Firmado digitalmente por…» empieza DEBAJO de la firma, no encima', caso(2));
caso.todos();

/** La reserva del salto de página del bloque de la firma, LEÍDA del fuente de `generateQuotePdf`. */
function reservaDelFuente() {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), 'utf8');
  const desde = fuente.indexOf('export async function generateQuotePdf(');
  assert.notEqual(desde, -1, '🔴 CIEGO: no encuentro `generateQuotePdf` en el fuente');
  const m = /if \(params\.signatureData\) \{[\s\S]*?if \(doc\.y \+ (\d+) > doc\.page\.height - doc\.page\.margins\.bottom\) doc\.addPage\(\);/
    .exec(fuente.slice(desde));
  assert.ok(m, '🔴 CIEGO: no encuentro la reserva del salto de página del bloque de la firma');
  return Number(m[1]);
}

test('SCRUM-1470b · el bloque de la firma, medido, cabe en la reserva del salto de página', () => {
  const reserva = reservaDelFuente();
  for (const [i, m] of medir().firmas.entries()) {
    const { raya, debajo } = bloque(m);
    const alto = debajo.despues - raya.y;
    assert.ok(alto > 70, `🔴 CIEGO (${FIRMAS[i].nombre}): el bloque mide ${alto.toFixed(1)} pt, menos que la propia firma`);
    assert.ok(alto <= reserva,
      `🔴 (${FIRMAS[i].nombre}) el bloque de la firma mide ${alto.toFixed(1)} pt y la reserva es ${reserva}: cerca del pie se parte en dos páginas`);
  }
});


test('SCRUM-1470b · barrido junto al pie de la página: el bloque de la firma nunca se parte en dos páginas', () => {
  const reserva = reservaDelFuente();
  let enLaPrimera = 0;
  let enLaSiguiente = 0;
  let masCerca = Infinity;
  for (const { nLineas, nObservaciones, fondo, marcas } of medir().lineas) {
    const { raya, rotulo, firma, debajo } = bloque(marcas);
    const paginas = new Set([raya.pagina, rotulo.pagina, firma.pagina, debajo.pagina]);
    assert.equal(paginas.size, 1,
      `🔴 con ${nLineas} líneas y ${nObservaciones} de observaciones el bloque de la firma se parte: `
      + `raya p.${raya.pagina}, rótulo p.${rotulo.pagina}, firma p.${firma.pagina}, texto p.${debajo.pagina}`);
    if (raya.pagina === 1) {
      enLaPrimera += 1;
      // Lo que le faltaba al bloque para saltar de página: el borde es `fondo − reserva`.
      masCerca = Math.min(masCerca, (fondo - reserva) - raya.y);
    } else enLaSiguiente += 1;
  }
  // POBLACIÓN: el barrido tiene que pasar por los dos lados del borde, y quedarse a menos de
  // RESOLUCION_PT de él por debajo; si no, su «nunca se parte» no habla del sitio donde se parte.
  assert.ok(enLaPrimera > 0 && enLaSiguiente > 0,
    `🔴 CIEGO: de ${LINEAS.length} papeles, ${enLaPrimera} en la página 1 y ${enLaSiguiente} después: el barrido no cruzó el borde`);
  assert.ok(masCerca >= 0 && masCerca <= RESOLUCION_PT,
    `🔴 CIEGO: el papel que más se acercó al borde de la reserva se quedó a ${masCerca.toFixed(1)} pt (se exige ≤ ${RESOLUCION_PT})`);
});
