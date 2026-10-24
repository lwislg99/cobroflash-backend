// SCRUM-1589 · EN EL PDF DEL ALBARÁN, LA FIRMA NO PISA EL NOMBRE DE QUIEN FIRMA.
//
// Visto en producción (23-oct-2026, albarán QA #47): la imagen de la firma se dibuja en una caja de
// 180×70 pt y después el papel bajaba con `moveDown(5)`, que a 10 pt son 59,5 pt. La imagen llega a
// 70 pt, así que el tercio de abajo del trazo caía encima de «Firmado por: …». El pad de firma es
// de ≤470×190 px (`signaturePad.js`), o sea que TODA firma real llega a los 70 pt: no es un caso raro.
//
// Se genera el PDF de VERDAD y se mide dónde lo pinta pdfkit, envolviendo su prototipo DESDE FUERA
// en el proceso hijo (el servicio lo importa del mismo `node_modules`). No se toca ni una línea de
// `src/` para poder mirar.
//
// ⚠️ GEMELO, NO cubierto aquí: `src/modules/invoicing/infra/pdf/pdf.service.ts` (firma del
// presupuesto, J1, camino de emisión) tiene el mismo `moveDown(5)` tras `fit: [180, 70]`.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { casosEscritos } from './_casos-escritos.mjs';
import { ALBARAN_ROTULOS } from '../dist/modules/jobs/domain/albaranFirmante.js';

const HIJO = `
  import fs from 'node:fs';
  import zlib from 'node:zlib';
  import { createRequire } from 'node:module';
  const require = createRequire(import.meta.url);
  const PDFDocument = require('pdfkit');
  const { generateAlbaranPdf } = await import('./dist/modules/jobs/infra/albaranPdf.service.js');

  // PNG transparente de W×H con un trazo negro horizontal: lo que manda el pad de firma.
  function png(W, H) {
    const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
    const trozo = (tipo, datos) => { const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const td = Buffer.concat([Buffer.from(tipo), datos]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
    const filas = [];
    for (let y = 0; y < H; y++) { const f = Buffer.alloc(1 + W * 4); if (y === Math.floor(H * 0.8)) for (let x = 0; x < W; x++) f[1 + x * 4 + 3] = 255; filas.push(f); }
    return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(Buffer.concat(filas))), trozo('IEND', Buffer.alloc(0))]).toString('base64');
  }

  // Dónde pinta pdfkit: la caja REAL de cada imagen (la matriz que aplica) y la y de cada texto.
  const marcas = [];
  let enImagen = false;
  const P = PDFDocument.prototype;
  const image = P.image, transform = P.transform, text = P.text;
  P.image = function (...a) { enImagen = true; try { return image.apply(this, a); } finally { enImagen = false; } };
  P.transform = function (m11, m12, m21, m22, dx, dy) {
    if (enImagen) { const h = -m22; marcas.push({ que: 'imagen', arriba: dy - h, abajo: dy, pagina: this.page }); enImagen = false; }
    return transform.apply(this, arguments);
  };
  P.text = function (t, ...a) { if (typeof t === 'string') marcas.push({ que: 'texto', t, y: typeof a[1] === 'number' ? a[1] : this.y, pagina: this.page }); return text.call(this, t, ...a); };

  const [W, H] = JSON.parse(process.argv[1]);
  const { outPath } = await generateAlbaranPdf({
    merchantId: 990000 + Math.floor(Math.random() * 9000),
    numero: 'ALB-T1589-' + Math.random().toString(36).slice(2, 8),
    fecha: new Date('2026-10-23T10:00:00Z'), emisionAt: new Date('2026-10-23T10:00:00Z'), version: 1, modoValoracion: 'SIN_VALORAR',
    merchant: { timezone: 'Europe/Madrid' }, customer: { taxId: null },
    emisor: 'Torres SL', emisorNif: 'B12345678', cliente: 'Ana Pérez', obra: 'C/ Mayor 1',
    fechaEntrega: null, referenciaTrabajo: null,
    lineas: [{ concepto: 'Mano de obra', cantidad: 1, unidad: 'h' }], totales: null, notas: null,
    signatureData: png(W, H),
    firmadoAt: new Date('2026-10-23T10:00:00Z'), firmadoPorNombre: 'Paco', firmadoPorCalidad: 'encargado_o_personal_de_obra', evidencia: null,
  });
  try { fs.unlinkSync(outPath); } catch {}
  process.stdout.write(JSON.stringify(marcas.map(({ pagina, ...m }) => m)));
`;

/** Las marcas de pdfkit al generar el albarán con una firma de W×H px. */
function marcas(W, H) {
  const salida = execFileSync(process.execPath, ['--input-type=module', '-e', HIJO, JSON.stringify([W, H])],
    { encoding: 'utf8', cwd: path.resolve(import.meta.dirname, '..'), maxBuffer: 1 << 24 });
  return JSON.parse(salida);
}

// Lo que dibuja el pad: el ancho va de 240 a 470 px (según la pantalla) y el alto es 190.
// Y el 1×1, que es el trazo de prueba que dejan los tests y lo que se vio en el albarán QA #47.
const FIRMAS = [
  { nombre: 'pad en escritorio, 470×190', W: 470, H: 190 },
  { nombre: 'pad en un móvil estrecho, 240×190', W: 240, H: 190 },
  { nombre: 'firma cuadrada, 1×1', W: 1, H: 1 },
];

const caso = casosEscritos(FIRMAS, (f) => `SCRUM-1589 · ${f.nombre}: «${ALBARAN_ROTULOS.pdfFirmadoPor.trim()}» empieza DEBAJO de la firma, no encima`, (f) => {
  {
    const m = marcas(f.W, f.H);
    const imagenes = m.filter((x) => x.que === 'imagen');
    // La firma es la única imagen del papel de prueba (sin logo): si aparece otra, el test mira mal.
    assert.equal(imagenes.length, 1, `🔴 CIEGO: esperaba UNA imagen (la firma) y pdfkit pintó ${imagenes.length}`);
    const firma = imagenes[0];
    assert.ok(firma.abajo - firma.arriba > 50, `🔴 CIEGO: la firma mide ${firma.abajo - firma.arriba} pt de alto; esperaba cerca de 70`);
    const iFirma = m.indexOf(firma);
    const nombre = m.slice(iFirma).find((x) => x.que === 'texto' && x.t === ALBARAN_ROTULOS.pdfFirmadoPor);
    assert.ok(nombre, `🔴 CIEGO: no encuentro «${ALBARAN_ROTULOS.pdfFirmadoPor}» después de la firma`);
    assert.ok(nombre.y >= firma.abajo,
      `🔴 la firma (de ${firma.arriba.toFixed(1)} a ${firma.abajo.toFixed(1)} pt) pisa «${ALBARAN_ROTULOS.pdfFirmadoPor.trim()}», `
      + `que empieza en ${nombre.y.toFixed(1)}: ${(firma.abajo - nombre.y).toFixed(1)} pt de solape`);
    // Y nada se queda colgando lejos: el nombre va pegado a la firma (menos de una línea de hueco).
    assert.ok(nombre.y - firma.abajo < 12, `🔴 el nombre se ha ido ${(nombre.y - firma.abajo).toFixed(1)} pt por debajo de la firma`);
  }
});
test('SCRUM-1589 · pad en escritorio, 470×190: «Firmado por:» empieza DEBAJO de la firma, no encima', caso(0));
test('SCRUM-1589 · pad en un móvil estrecho, 240×190: «Firmado por:» empieza DEBAJO de la firma, no encima', caso(1));
test('SCRUM-1589 · firma cuadrada, 1×1: «Firmado por:» empieza DEBAJO de la firma, no encima', caso(2));
caso.todos();
