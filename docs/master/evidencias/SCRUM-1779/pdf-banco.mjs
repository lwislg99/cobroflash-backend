// docs/master/evidencias/SCRUM-1779/pdf-banco.mjs — SCRUM-1779a, punto 2 (SOLO LECTURA)
//
// PREGUNTA: con un comercio ES NO-demo (id 5304, email lugo@ejemplo.invalid), INVOICING_ES_ENABLED
// ON por merchant y SIF_ENABLED OFF, ¿qué IMPRIME el PDF real de una F1 sellada con dos tipos
// (21 % y 10 %) y el de su R1?
//
// BANCO: el mismo de vias-banco.mjs (`tests/_banco-emision-con-estado.mjs`). Ese banco dobla
// `dist/lib/pdf.js`; AQUÍ, sólo en la memoria de este proceso, se vuelve a poner en esa entrada de la
// caché el generador REAL (`dist/modules/invoicing/infra/pdf/pdf.service.js`) para que
// `ensureInvoicePdf` (dist/lib/invoicing.js, el llamador real de «Abrir PDF» y del correo) pinte de
// verdad. Nada se escribe en `dist/`.
//
// Los PDF van a `<cwd>/storage/invoices` (invoicesDir = process.cwd()): este script SE LANZA CON EL
// cwd EN EL TEMPORAL DEL SISTEMA para que los binarios no caigan en el árbol. Si el cwd es el árbol,
// el script se niega.
//
// Lector de texto: `tests/_texto-del-pdf.mjs` (el de la casa). QR: se compara el píxel de la imagen
// embebida con el PNG que `qrcode` saca de `Invoice.qrData`.
delete process.env.SIF_ENABLED;
delete process.env.INVOICING_ES_ENABLED;

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  banco, prisma, reiniciar as reiniciarBanco, requiere, rutaDe, asentar, M_ES, CLIENTE,
} from '../../../../tests/_banco-emision-con-estado.mjs';
import { extraerTextoPdf, lineasDePdf, vecesEnPdf } from '../../../../tests/_texto-del-pdf.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
if (path.resolve(process.cwd()).toLowerCase().startsWith(RAIZ.toLowerCase())) {
  process.stderr.write('Se lanza con el cwd FUERA del árbol (los PDF caen en <cwd>/storage/invoices).\n');
  process.exit(2);
}

const salida = [];
const di = (...x) => { const l = x.join(' '); salida.push(l); process.stdout.write(l + '\n'); };
let fallos = 0;
const comprueba = (ok, texto) => { if (!ok) fallos++; di(`${ok ? 'OK  ' : 'FALLO'} ${texto}`); };

const voces = { log: console.log, warn: console.warn, error: console.error };
const avisos = [];
console.log = () => {}; console.warn = (...a) => avisos.push(a.map(String).join(' ')); console.error = (...a) => avisos.push(a.map(String).join(' '));

// ── El generador REAL en la entrada que el banco dobla (sólo en memoria) ─────────────────────
const pdfReal = requiere(rutaDe('dist/modules/invoicing/infra/pdf/pdf.service.js'));
const fPdf = rutaDe('dist/lib/pdf.js');
requiere.cache[fPdf].exports = { generateInvoicePdf: pdfReal.generateInvoicePdf, generateQuotePdf: pdfReal.generateQuotePdf };

const { allocateInvoiceNumber } = requiere(rutaDe('dist/modules/invoicing/domain/invoiceNumber.service.js'));
const { crearFacturaEmitida } = requiere(rutaDe('dist/modules/invoicing/domain/crearFacturaEmitida.js'));
const { congelarCliente } = requiere(rutaDe('dist/modules/invoicing/domain/clienteCongelado.js'));
const { congelarEmisorDesdeFicha } = requiere(rutaDe('dist/modules/invoicing/domain/emisorCongelado.js'));
const { sellarTrasEmision } = requiere(rutaDe('dist/modules/invoicing/domain/selladoEstado.js'));
const { isDemoMerchant, getEmissionMode } = requiere(rutaDe('dist/modules/invoicing/domain/emission.service.js'));
const { calcVatBreakdown } = requiere(rutaDe('dist/modules/invoicing/domain/vat.service.js'));
const { ensureInvoicePdf } = requiere(rutaDe('dist/lib/invoicing.js'));
const { invoicesDir } = requiere(rutaDe('dist/core/storage/dirs.js'));
const QRCode = requiere('qrcode');
const { PNG } = createReqDesde(requiere.resolve('qrcode'))('pngjs');
function createReqDesde(f) { return (m) => requiere(requiere.resolve(m, { paths: [path.dirname(f)] })); }

const NIF = 'B27000001';
const L = (concept, price, tax, qty = 1) => ({ concept, qty, price, tax });
const LINEAS = [L('Arreglo de una fuga', 36.03, 0.21), L('Material de fontanería', 12.35, 0.10, 3)];
const bd = calcVatBreakdown(LINEAS);
const TOTAL = (bd.base + bd.cuota).toFixed(2);
const LINEAS_R1 = LINEAS.map((x) => ({ ...x, qty: -x.qty }));
const bdR = calcVatBreakdown(LINEAS_R1);
const TOTAL_R1 = (bdR.base + bdR.cuota).toFixed(2);

reiniciarBanco();
const merchant = () => banco.tablas.merchant.find((x) => x.id === M_ES);
Object.assign(merchant(), { flags: { INVOICING_ES_ENABLED: true }, llevaLibrosPorSii: false, taxId: NIF, defaultCurrency: 'EUR', merchantCriterioCaja: null });
Object.assign(banco.tablas.customer[0], { merchantId: M_ES, taxId: '12345678Z', legalName: 'Clienta de prueba SL', address: 'Calle 1, Lugo', tipoDestinatario: null });

async function nucleo({ camino, rectifying = false, type = 'F1', status, rectifiesId = null, total, lines }) {
  const m = merchant();
  const cliente = await congelarCliente(prisma, M_ES, CLIENTE);
  const emisor = congelarEmisorDesdeFicha(m);
  const inv = await prisma.$transaction(async (tx) => {
    const number = await allocateInvoiceNumber(tx, M_ES, { camino, rectifying, actor: { tipo: 'propietario' } });
    return crearFacturaEmitida(tx, cliente, emisor, {
      merchantId: M_ES, customerId: CLIENTE, quoteId: null, number, type, total, currency: 'EUR', lines,
      ...(status ? { status } : {}), ...(rectifiesId ? { rectifiesId } : {}),
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', registerId: null,
    });
  });
  const sello = await sellarTrasEmision(inv, m, prisma);
  await asentar();
  return { inv: banco.tablas.invoice.find((f) => f.id === inv.id), sello };
}

// El banco sólo resuelve relaciones de `charge`; `ensureInvoicePdf` pide merchant/customer/rectifies.
const prismaConRelaciones = new Proxy(prisma, {
  get(t, p) {
    const v = t[p];
    if (p !== 'invoice') return v;
    return new Proxy(v, { get(mod, op) {
      if (op !== 'findUnique') return mod[op];
      return async (args = {}) => {
        const f = await mod.findUnique({ where: args.where });
        if (!f) return f;
        return {
          ...f,
          merchant: banco.tablas.merchant.find((x) => x.id === f.merchantId) ?? null,
          customer: banco.tablas.customer.find((x) => x.id === f.customerId) ?? null,
          rectifies: f.rectifiesId ? { number: banco.tablas.invoice.find((x) => x.id === f.rectifiesId)?.number ?? null } : null,
        };
      };
    } });
  },
});

async function pintar(inv) {
  const fila = banco.tablas.invoice.find((f) => f.id === inv.id);
  fila.pdfUrl = 'PENDING_PDF';
  const r = await ensureInvoicePdf(inv.id, prismaConRelaciones);
  const buf = fs.readFileSync(r.diskPath);
  return { buf, nombre: path.basename(r.diskPath), diskPath: r.diskPath };
}

const BUSCAS = [
  ['VeriFactu / VERI*FACTU', /veri\s*\*?\s*factu/i],
  ['AEAT', /AEAT/],
  ['Agencia Tributaria', /agencia\s+tributaria|agenciatributaria/i],
  ['QR', /\bQR\b/],
  ['verificable', /verificable/i],
  ['Huella', /huella/i],
  ['código seguro / CSV', /c[oó]digo\s+seguro|\bCSV\b/i],
  ['RD 1007/2023 / Real Decreto', /1007\/2023|real\s+decreto/i],
  ['Hacienda', /hacienda/i],
  ['fiscal', /fiscal/i],
  ['DEMO', /DEMO/],
  // (1ª pasada: /RIVA/i casaba con «EURIVA» del desglose: falso positivo, se acota a la cita legal)
  ['rectificativa / artículo', /rectific|art[íi]culo|\bart\.\s*\d|\b(LIVA|RIVA|ROF|RRSIF)\b/i],
];

function leer(buf, etiqueta) {
  let r = lineasDePdf(buf);
  let modo = 'lineasDePdf';
  if (!r.ok) {
    const t = extraerTextoPdf(buf);
    if (!t.ok) { di(`  🔴 CIEGO ${etiqueta}: ${r.motivo} / ${t.motivo}`); fallos++; return null; }
    di(`  aviso ${etiqueta}: lineasDePdf no pudo (${r.motivo}); se usa extraerTextoPdf (sin saltos)`);
    r = { ok: true, lineas: [{ texto: t.texto }], texto: t.texto }; modo = 'extraerTextoPdf';
  }
  return { lineas: r.lineas.map((l) => l.texto), texto: r.texto, modo };
}

function menciones(lineas) {
  const fuera = [];
  lineas.forEach((t, i) => {
    const que = BUSCAS.filter(([, re]) => re.test(t)).map(([n]) => n);
    if (que.length) fuera.push(`    L${String(i + 1).padStart(2, '0')} [${que.join(', ')}] «${t}»`);
  });
  return fuera;
}

// ── Imágenes del PDF: objetos /Subtype /Image, y el operador Do en el contenido ─────────────
function imagenes(buf) {
  const s = buf.toString('latin1');
  const fuera = [];
  let i = 0;
  while ((i = s.indexOf(' obj', i)) !== -1) {
    const fin = s.indexOf('endobj', i);
    if (fin === -1) break;
    const cuerpo = s.slice(i, fin);
    const iniS = cuerpo.indexOf('stream');
    const cab = iniS === -1 ? cuerpo : cuerpo.slice(0, iniS);
    if (/\/Subtype\s*\/Image/.test(cab)) {
      const num = (k) => { const m = cab.match(new RegExp(`/${k}\\s+(\\d+)`)); return m ? Number(m[1]) : null; };
      const desde = iniS + 'stream'.length + (cuerpo[iniS + 6] === '\r' ? 2 : 1);
      const hasta = cuerpo.indexOf('endstream', desde);
      const crudo = Buffer.from(cuerpo.slice(desde, hasta), 'latin1');
      let datos = null;
      try { datos = cab.includes('FlateDecode') ? zlib.inflateSync(crudo) : crudo; } catch { datos = null; }
      fuera.push({ ancho: num('Width'), alto: num('Height'), espacio: (cab.match(/\/ColorSpace\s*\/(\w+)/) || [])[1] ?? '?', smask: /\/SMask/.test(cab), predictor: /\/Predictor/.test(cab), datos });
    }
    i = fin + 6;
  }
  return fuera;
}
function operadoresDo(buf) {
  const s = buf.toString('latin1');
  let n = 0; let i = 0;
  while ((i = s.indexOf('stream', i)) !== -1) {
    const desde = i + 6 + (s[i + 6] === '\r' ? 2 : 1);
    const hasta = s.indexOf('endstream', desde);
    if (hasta === -1) break;
    try { const t = zlib.inflateSync(Buffer.from(s.slice(desde, hasta), 'latin1')).toString('latin1'); n += (t.match(/\/I\w*\s+Do\b/g) || []).length; } catch { /* no comprimido o no contenido */ }
    i = hasta + 9;
  }
  return n;
}
async function rgbDeQr(texto) {
  const png = PNG.sync.read(await QRCode.toBuffer(texto, { type: 'png', width: 200 }));
  const rgb = Buffer.alloc(png.width * png.height * 3);
  for (let p = 0, q = 0; p < png.data.length; p += 4, q += 3) { rgb[q] = png.data[p]; rgb[q + 1] = png.data[p + 1]; rgb[q + 2] = png.data[p + 2]; }
  return { ancho: png.width, alto: png.height, rgb };
}
async function qrDibujado(buf, qrData) {
  const ims = imagenes(buf);
  const dos = operadoresDo(buf);
  const esperado = await rgbDeQr(qrData);
  const otro = await rgbDeQr('https://ejemplo.invalid/no-es-este-qr');
  const igual = ims.some((im) => im.datos && im.datos.equals(esperado.rgb));
  const igualOtro = ims.some((im) => im.datos && im.datos.equals(otro.rgb));
  return { imagenes: ims.map((im) => `${im.ancho}x${im.alto} ${im.espacio}${im.smask ? ' +SMask' : ''}${im.predictor ? ' +Predictor' : ''} ${im.datos ? im.datos.length + ' B' : 'sin leer'}`), dos, igual, igualOtro, esperado: `${esperado.ancho}x${esperado.alto}` };
}

const ESCRITOS = {};
async function informe(etiqueta, inv, fichero) {
  const { buf, nombre } = await pintar(inv);
  const fila = banco.tablas.invoice.find((f) => f.id === inv.id);
  di(`\n═══ ${etiqueta}: ${fila.number} (${fila.type}) · status=${fila.status} · vfEstado=${fila.vfEstado} · total=${fila.total} · huella=${fila.vfHash ? fila.vfHash.slice(0, 16) + '…' : 'no'}`);
  di(`  qrData guardado: ${fila.qrData}`);
  di(`  merchant: id=${merchant().id} email=${merchant().email} · isDemoMerchant=${isDemoMerchant(merchant())} · getEmissionMode=${getEmissionMode(merchant())}`);
  di(`  PDF: ${nombre} (${buf.length} B, en <tmp>/storage/invoices)`);
  const r = leer(buf, etiqueta);
  if (!r) return null;
  di(`  texto leído con ${r.modo}: ${r.lineas.length} líneas`);
  if (fichero) {
    fs.writeFileSync(path.join(AQUI, fichero), r.lineas.map((t, i) => `L${String(i + 1).padStart(2, '0')}\t${t}`).join('\n') + '\n', 'utf8');
    ESCRITOS[fichero] = r.lineas.length;
  }
  const ms = menciones(r.lineas);
  di(`  menciones (${ms.length} líneas):`);
  for (const m of ms) di(m);
  const q = await qrDibujado(buf, fila.qrData);
  di(`  imágenes en el PDF: ${q.imagenes.length} → ${q.imagenes.join(' | ')} · operadores «/I… Do» en contenido: ${q.dos}`);
  di(`  QR: píxeles de una imagen del PDF == QRCode.toBuffer(qrData) (${q.esperado}): ${q.igual} · control negativo (QR de otra URL) coincide: ${q.igualOtro}`);
  return { ...r, q, fila };
}

// ═══ F1 de dos tipos ═════════════════════════════════════════════════════════════════════
di(`Comercio: id=${M_ES} email=${merchant().email} country=${merchant().country} taxId=${NIF} flags=${JSON.stringify(merchant().flags)} llevaLibrosPorSii=${merchant().llevaLibrosPorSii} · env SIF_ENABLED=${process.env.SIF_ENABLED ?? '(sin definir)'}`);
di(`Líneas F1: ${JSON.stringify(LINEAS)} → calcVatBreakdown total ${TOTAL}`);
const f1 = await nucleo({ camino: 'C3', total: TOTAL, lines: LINEAS });
comprueba(f1.sello.estado && f1.inv.vfHash, `F1 sellada: sello=${f1.sello.estado} vfEstado=${f1.inv.vfEstado}`);
const r1 = await nucleo({ camino: 'C5', rectifying: true, type: 'R1', status: 'paid', rectifiesId: f1.inv.id, total: TOTAL_R1, lines: LINEAS_R1 });
comprueba(r1.inv.vfHash, `R1 sellada: ${r1.inv.number} sello=${r1.sello.estado} vfEstado=${r1.inv.vfEstado}`);

const A = await informe('PDF F1 · comercio NO-demo', f1.inv, 'pdf-F1-texto.txt');
const B = await informe('PDF R1 · comercio NO-demo', r1.inv, 'pdf-R1-texto.txt');

// ═══ Controles del barrido ═════════════════════════════════════════════════════════════════
di('\n═══ CONTROLES DEL BARRIDO');
for (const [n, X] of [['F1', A], ['R1', B]]) {
  if (!X) continue;
  comprueba(vecesEnPdf(X.texto, NIF) >= 1, `${n} · positivo sembrado: el NIF fabricado «${NIF}» aparece ${vecesEnPdf(X.texto, NIF)} vez/veces`);
  comprueba(vecesEnPdf(X.texto, 'Z9Z9Z9Z9Q') === 0, `${n} · cero: «Z9Z9Z9Z9Q» aparece ${vecesEnPdf(X.texto, 'Z9Z9Z9Z9Q')} veces`);
  comprueba(vecesEnPdf(X.texto, 'DEMO') === 0, `${n} · «DEMO» en el comercio no-demo: ${vecesEnPdf(X.texto, 'DEMO')} veces`);
  comprueba(X.q.igual && !X.q.igualOtro, `${n} · el QR dibujado es el de qrData y no el de otra URL`);
}

// ═══ CONTROL DEMO: la MISMA F1, el comercio pasa a ser demo por email (isDemoMerchant) ═════
di('\n═══ CONTROL DEMO · misma fila F1; merchant.email = demo@yaqu.app (id sigue 5304)');
const emailReal = merchant().email;
merchant().email = 'demo@yaqu.app';
const C = await informe('PDF F1 · comercio DEMO (control)', f1.inv, 'pdf-demo-control-texto.txt');
merchant().email = emailReal;
if (C) {
  const v = vecesEnPdf(C.texto, 'DEMO');
  const vLit = vecesEnPdf(C.texto, 'DEMO — no válida fiscalmente');
  comprueba(v >= 1, `control demo: «DEMO» aparece ${v} vez/veces; literal DEMO_WATERMARK ${vLit} (si 0 en ambos el extractor estaría CIEGO a la marca)`);
  const soloEnDemo = C.lineas.filter((t) => !A.lineas.includes(t));
  di(`  líneas que están en el control y no en el no-demo: ${JSON.stringify(soloEnDemo)}`);
}

Object.assign(console, voces);
di(`\nAVISOS del dist (${avisos.length}): ${[...new Set(avisos)].map((x) => x.slice(0, 100)).join(' | ') || '(ninguno)'}`);
di(`ajenas: ${[...new Set(banco.ajenas)].join(', ') || '(ninguna)'}`);
di(`ficheros de texto escritos: ${JSON.stringify(ESCRITOS)}`);
di(`\nRESULTADO: ${fallos === 0 ? 'todas las comprobaciones OK' : `${fallos} comprobación(es) en FALLO`}`);
fs.writeFileSync(path.join(AQUI, 'pdf-salida.txt'), salida.join('\n').split(invoicesDir).join('<tmp>/storage/invoices') + '\n', 'utf8');
process.exitCode = fallos === 0 ? 0 : 1;
