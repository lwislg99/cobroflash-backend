// docs/master/evidencias/scrum665c/tamano-con-logo.mjs — SCRUM-665c (el coste de la opción A)
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// QUÉ MIDE, Y QUÉ NO
//
// El banco del 16-sep (`../scrum665b/coste-de-los-dos-caminos.mjs`) midió el PDF de factura SIN
// logo y dejó escrito que el logo «es el factor que más puede mover este número» y que no lo
// medía. Esto mide ese hueco, con el `generateInvoicePdf` real de `dist/`:
//
//   ① la BASE sin logo, otra vez (si ya no es 5209 B, la plantilla ha cambiado desde el 16-sep);
//   ② el mismo PDF con tres logos reales del repo y uno FABRICADO como peor caso;
//   ③ que el logo ENTRA de verdad: cuenta los XObject `/Subtype /Image` del fichero.
//
// El peor caso se deriva del producto, no se elige: `settingsView.js` reescala el logo a 512 px
// de lado como máximo y lo guarda como PNG (con transparencia) o JPEG 0,85; el esquema
// (`schemas.ts`, `logoUrl`) admite hasta 1.500.000 caracteres de data URI. Un PNG RGBA de
// 512×512 de RUIDO no se comprime: es el techo de lo que el producto deja subir.
//
// ⛔ No toca `src/`, ni la base, ni la red. `generateInvoicePdf` escribe en `storage/invoices/`
//    (ignorado por git): cada fichero se copia a un temporal y el original se BORRA.
//
// 🔴 EL CONTROL SEMBRADO (cicatriz ②): un logo con base64 BASURA. `loadLogoBuffer` y PDFKit lo
// ignoran EN SILENCIO (`catch { /* logo inválido */ }`), así que el PDF sale igual que sin logo.
// El instrumento tiene que decirlo: «logo NO embebido». Si dijera «embebido», el recuento de
// imágenes no distingue nada y el banco sale CIEGO (código 3).
// ═══════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { temporal } from '../../../../tests/_temporal.mjs';

const RAIZ = new URL('../../../../', import.meta.url);
const { generateInvoicePdf } = await import(new URL('dist/modules/invoicing/infra/pdf/pdf.service.js', RAIZ).href);

const TMP = temporal('scrum665c-');
const di = (s = '') => console.log(s);

/** La MISMA fixture que el 15 y el 16-sep, para que las tres tandas sean comparables. */
const FACTURA = (logoUrl) => ({
  number: '2026-CF-0007',
  invoiceId: 90007,
  merchantId: 9001,
  merchant: {
    name: 'Fontaneria QA', legalName: 'Fontaneria QA S.L.', taxId: 'B12345678',
    address: 'Calle Mayor 1, 28001 Madrid', logoUrl, phone: null, email: 'pro@ejemplo.test',
  },
  customer: { name: 'Ferreteria Pepe', legalName: 'Ferreteria Pepe SL', taxId: 'B99999999', email: null, phone: null },
  currency: 'EUR',
  total: '480.00',
  qrData: 'INV:2026-CF-0007|AMOUNT:480.00|CUR:EUR',
  vfHash: 'abc123def456',
  createdAt: new Date('2026-06-15T10:00:00Z'),
  lines: [{ description: 'Reparacion de bajante', qty: 1, price: 396.69, tax: 0.21 }],
  type: 'F1',
  rectifiesNumber: null,
  watermark: null,
  stageLabel: null,
});

/** XObject de imagen dentro del PDF (el QR es uno; un logo con alfa suma dos: imagen + SMask). */
const imagenes = (buf) => (buf.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length;

async function generar(nombre, logoUrl) {
  const { outPath } = await generateInvoicePdf(FACTURA(logoUrl));
  const destino = path.join(TMP, nombre);
  fs.copyFileSync(outPath, destino);
  fs.unlinkSync(outPath);
  const buf = fs.readFileSync(destino);
  return { bytes: buf.length, imagenes: imagenes(buf) };
}

const dataUri = (mime, buf) => `data:${mime};base64,${buf.toString('base64')}`;

/** Peor caso fabricado: PNG RGBA 512×512 de ruido (semilla fija → reproducible). */
function pngDeRuido(lado) {
  const png = new PNG({ width: lado, height: lado });
  let x = 0x665c;
  // `Math.imul`, no `*`: el producto de dos enteros de 32 bits pasa de 2^53 y en coma flotante
  // pierde los bits bajos — la primera pasada de este banco «midió» un ruido que no lo era.
  for (let i = 0; i < png.data.length; i++) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; png.data[i] = x >>> 24; }
  return PNG.sync.write(png);
}

di('═══ ① BASE · sin logo, tres pasadas (el 16-sep: 5209 · 5209 · 5209) ═══');
const base = [];
for (let i = 1; i <= 3; i++) base.push(await generar(`base-${i}.pdf`, null));
di('   ' + base.map((b) => b.bytes).join(' · ') + ' bytes · imágenes en el PDF: ' + base[0].imagenes);
if (!base[0].bytes || base[0].imagenes < 1) { di('🔴 CIEGO: la base no tiene ni el QR. No afirmo nada.'); process.exit(3); }
const estable = base.every((b) => b.bytes === base[0].bytes);
di('   ¿tamaño estable? ' + (estable ? '✅ sí' : '⚠️ NO — se da como rango'));
di('');

// SUELO del peor caso: ruido de verdad NO se comprime. Si el PNG sale muy por debajo de los
// 512×512×4 bytes en crudo, el generador no fabrica ruido y la fila «peor caso» mediría otra cosa
// (pasó en la primera pasada: 29 KB de PDF con un «ruido» de periodo corto).
const RUIDO = pngDeRuido(512);
const CRUDO = 512 * 512 * 4;
di(`   suelo del peor caso: PNG de ruido ${RUIDO.length} B sobre ${CRUDO} B en crudo (${(100 * RUIDO.length / CRUDO).toFixed(1)} %)`);
if (RUIDO.length < 0.95 * CRUDO) { di('🔴 CIEGO: el «ruido» se comprime; no es el peor caso.'); process.exit(3); }
di('');

const LOGOS = [
  ['icon-192.png del repo (192×192)', 'image/png', fs.readFileSync(new URL('public/icons/icon-192.png', RAIZ))],
  ['icon-512.png del repo (512×512, el tope del reescalado)', 'image/png', fs.readFileSync(new URL('public/icons/icon-512.png', RAIZ))],
  ['PEOR CASO fabricado: PNG RGBA 512×512 de ruido', 'image/png', RUIDO],
];

di('═══ ② CON LOGO · bytes del PDF y cuánto añade sobre la base ═══');
const filas = [];
for (const [etiqueta, mime, buf] of LOGOS) {
  const uri = dataUri(mime, buf);
  const r = await generar(etiqueta.replace(/[^a-z0-9]+/gi, '-') + '.pdf', uri);
  const embebido = r.imagenes > base[0].imagenes;
  filas.push({ etiqueta, logo: buf.length, uri: uri.length, ...r, embebido });
  di(`   ${String(r.bytes).padStart(8)} B PDF · logo ${String(buf.length).padStart(8)} B · data URI ${String(uri.length).padStart(8)} car. ` +
     `· imágenes ${r.imagenes} · ${embebido ? 'embebido' : '🔴 NO embebido'} · ${etiqueta}`);
}
di('');

di('═══ ③ CONTROL SEMBRADO · logo con base64 BASURA → tiene que salir «NO embebido» ═══');
const basura = await generar('basura.pdf', 'data:image/png;base64,' + Buffer.from('esto no es un png').toString('base64'));
const basuraEmbebido = basura.imagenes > base[0].imagenes;
di(`   ${basura.bytes} B · imágenes ${basura.imagenes} · ${basuraEmbebido ? '🔴 «embebido»' : '✅ NO embebido'}`);
if (basuraEmbebido) { di('🔴 CIEGO: el recuento de imágenes no distingue un logo real de uno roto.'); process.exit(3); }
if (filas.some((f) => !f.embebido)) { di('🔴 CIEGO: algún logo real no entró en el PDF; su fila no mide el logo.'); process.exit(3); }
di('');

const techo = filas.reduce((a, b) => (b.bytes > a.bytes ? b : a));
di('═══ LECTURA ═══');
di(`   población: 1 fixture × (3 base + ${filas.length} logos + 1 basura) = ${3 + filas.length + 1} PDF generados con dist/.`);
di(`   techo medido: ${techo.bytes} B (${(techo.bytes / 1024).toFixed(1)} KiB) por PDF con el peor logo que el producto deja subir.`);
di(`   ¿cabe el peor caso en el límite del esquema (1.500.000 car.)? ${techo.uri <= 1_500_000 ? 'sí' : 'NO — el peor caso real es menor'}`);
