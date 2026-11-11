// tests/scrum1650c-pdf-y-whatsapp-del-albaran-leen-lo-congelado.test.mjs — SCRUM-1650 (tramo c)
//
// 🔴 EL PAPEL Y EL WHATSAPP DEL ALBARÁN NOMBRABAN AL CLIENTE CON LA FICHA DE HOY.
//
// Un albarán congela al cliente al emitirse (`albaranEmision.ts`, SCRUM-729). 1650 (listado y
// buscador) y 1650b (la sugerencia del firmante) ya leen lo que quedó escrito. Quedaban tres:
//
//   · `ensureAlbaranPdf`            → el cliente que imprime el PDF de un albarán SIN FIRMAR
//   · `sendAlbaranParaFirmarWhatsApp` → «Hola {{1}}» del envío para firmar
//   · `sendAlbaranFirmadoWhatsApp`  → «Hola {{1}}» del envío del albarán firmado
//
// GO del fundador del 10-nov-2026 (cita y localizador en docs/master/SCRUM-1650.md, tramo c).
//
// ── LO QUE ESTE TEST NO DICE ──────────────────────────────────────────────────────────────
// · No mira el SELLO (`buildFirmaEvidencia`): su `cliente` es fuente del sellador y lo sujeta
//   SCRUM-371 al barrido. Fuera de este tramo, a propósito.
// · No mira el teléfono: el canal sigue siendo la ficha de hoy (`canalDeWhatsApp`), sólo cambia
//   el NOMBRE. Ni la plantilla de Meta.
// · Un albarán FIRMADO imprime lo que su sobre dice (v:3 su bloque; v:1/v:2 las fuentes vivas con
//   que se selló): el último caso fija que eso NO cambia.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// El servicio REAL de `dist/` con la base doblada (`_envio-doblado.mjs`) y Meta en dry-run: el
// mensaje que se mira es el que de verdad saldría (`__waDryRunOutbox`), después de todos los guards.
// Los dobles PROYECTAN el `select` como Prisma: lo que el lector no pide no viaja. Sin eso, un
// lector que olvida pedir la columna congelada pasaría igual, y ése es justo el defecto.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { textoDePdf, contiene } from './_pdf-texto.mjs';

const SERVICIO = '../dist/modules/jobs/domain/albaran.service.js';
const ENVIO = '../dist/modules/jobs/domain/albaranWhatsApp.service.js';

const DE_HOY = 'Ficha Renombrada Hoy';
const AL_EMITIR = 'Cliente Al Emitir';

/** Sólo viaja lo que el `select` pide, como en Prisma. */
function proyecta(fila, select) {
  if (!fila) return null;
  if (!select) return { ...fila };
  const sale = {};
  for (const [clave, pide] of Object.entries(select)) if (pide === true) sale[clave] = fila[clave];
  return sale;
}

const FICHA = { id: CLIENTE, merchantId: MERCHANT, name: DE_HOY, legalName: null, taxId: null, email: null,
  phone: '34000001650', mobile: null, waOptOut: false }; // rango imposible (SCRUM-262)
const TRABAJO = { id: 77, merchantId: MERCHANT, customerId: CLIENTE, titulo: 'Baño 1650c', direccion: null, quoteId: null };
const COMERCIO = { id: MERCHANT, name: 'Fontanería 1650c', legalName: null, taxId: null, address: null, logoUrl: null,
  whatsappPhone: null, timezone: 'Europe/Madrid', country: 'ES', email: null };

const base = {
  merchantId: MERCHANT, jobId: 77, version: 1, lineas: [{ concepto: 'Revisión', cantidad: 1, unidad: 'ud' }],
  modoValoracion: 'SIN_VALORAR', ocultarPreciosEnDocumento: false, signatureUrl: null, firmadoAt: null,
  evidenciaFirma: null, firmadoPorNombre: null, firmadoPorCalidad: null, contentHash: null, notas: null,
  docHeaderText: null, fechaEntrega: null, lugarEntrega: null, pdfUrl: null, enviadoParaFirmaAt: null,
  fecha: new Date('2026-11-01T10:00:00Z'), createdAt: new Date('2026-11-01T10:00:00Z'), updatedAt: new Date('2026-11-01T10:00:00Z'),
  customerLegalName: null, customerTaxId: null, customerEmail: null, customerPhone: null,
};
// Emitido con el nombre de entonces; la ficha se renombró después.
const CONGELADO = { ...base, id: 201, numero: 'AL-1650C-1', estado: 'emitido', firmaToken: 'c'.repeat(32), customerName: AL_EMITIR };
// Anterior al escritor (columnas a NULL): la ficha de hoy es lo único que hay — excepción DECLARADA.
const ANTERIOR = { ...base, id: 202, numero: 'AL-1650C-2', estado: 'emitido', firmaToken: 'd'.repeat(32), customerName: null };
const FIRMADO_CONGELADO = { ...CONGELADO, id: 203, numero: 'AL-1650C-3', estado: 'firmado' };
const FIRMADO_ANTERIOR = { ...ANTERIOR, id: 204, numero: 'AL-1650C-4', estado: 'firmado' };
// Firmado con un sobre v:1: su hash se recalcula con las fuentes VIVAS, así que el papel imprime
// la ficha aunque la fila lleve columnas (fila artificial: en la población real un v:1 las tiene a NULL).
const FIRMADO_V1 = { ...CONGELADO, id: 205, numero: 'AL-1650C-5', estado: 'firmado', firmadoAt: new Date('2026-11-02T10:00:00Z'),
  evidenciaFirma: { v: 1, canal: 'remoto', firmadoAt: '2026-11-02T10:00:00.000Z', firmante: DE_HOY, hashAlg: 'sha256', contentHash: 'ab'.repeat(32) } };
const FILAS = new Map([CONGELADO, ANTERIOR, FIRMADO_CONGELADO, FIRMADO_ANTERIOR, FIRMADO_V1].map((a) => [a.id, a]));

inyectarBase({
  'albaran.findUnique': ({ where, select }) => proyecta(FILAS.get(where.id), select),
  'albaran.update': ({ where, data }) => ({ ...FILAS.get(where.id), ...data }),
  'job.findFirst': ({ select }) => proyecta(TRABAJO, select),
  'job.findUnique': ({ select }) => proyecta(TRABAJO, select),
  'customer.findFirst': ({ select }) => proyecta(FICHA, select),
  'customer.findUnique': ({ select }) => proyecta(FICHA, select),
  'merchant.findUnique': ({ select }) => proyecta(COMERCIO, select),
}, [SERVICIO, ENVIO]);

const servicio = moduloDeDist(SERVICIO);
const envio = moduloDeDist(ENVIO);

// El buzón del dry-run apunta destino y plantilla, NO las variables. Así que se envuelve el
// emisor (export CJS de `dist`, que `albaranWhatsApp` resuelve al llamar) para quedarse con los
// `components`, y se sigue llamando al ORIGINAL: los guards corren igual que en producción.
// «Para firmar» va por `sendWhatsAppWindowFirst` (ventana abierta → texto; cerrada → plantilla):
// se envuelven los DOS emisores y se mira todo lo que se les pasa (texto de ventana + plantilla).
const wa = moduloDeDist('../dist/integrations/whatsapp.js');
let componentes = [];
for (const emisor of ['sendWhatsAppTemplate', 'sendWhatsAppWindowFirst']) {
  const deVerdad = wa[emisor];
  assert.equal(typeof deVerdad, 'function', `CIEGO: \`${emisor}\` ya no se exporta de whatsapp.js`);
  wa[emisor] = async (p) => { componentes.push({ windowText: p.windowText, windowCta: p.windowCta, components: p.components ?? p.template?.components }); return deVerdad(p); };
}

/** Las variables del mensaje que de verdad saldría hacia Meta, tras los guards. */
async function loQueSale(fn) {
  const buzon = [];
  componentes = [];
  globalThis.__waDryRunOutbox = buzon;
  try {
    const r = await fn();
    assert.equal(r.ok, true, `CIEGO: el envío no salió (${r.reason}): sin mensaje no hay nombre que mirar`);
    assert.equal(buzon.length, 1, 'CIEGO: el dry-run no apuntó el mensaje: no pasó los guards');
    assert.equal(componentes.length, 1, 'CIEGO: el envoltorio no vio la llamada a sendWhatsAppTemplate');
    return JSON.stringify(componentes[0]);
  } finally {
    delete globalThis.__waDryRunOutbox;
  }
}

// El envío del firmado adjunta el PDF: aquí no se mide el papel, así que se le da un fichero hecho.
async function conPdfDeMentira(fn) {
  const original = servicio.ensureAlbaranPdf;
  const ruta = path.join(os.tmpdir(), `scrum1650c-${process.pid}.pdf`);
  fs.writeFileSync(ruta, '%PDF-1.4 1650c');
  servicio.ensureAlbaranPdf = async (id) => ({ diskPath: ruta, pdfUrl: '', numero: FILAS.get(id).numero });
  try { return await fn(); } finally { servicio.ensureAlbaranPdf = original; fs.rmSync(ruta, { force: true }); }
}

test('SCRUM-1650c · WhatsApp «para firmar»: saluda con el nombre del albarán, no con la ficha de hoy', async () => {
  const sale = await loQueSale(() => envio.sendAlbaranParaFirmarWhatsApp(CONGELADO.id));
  assert.ok(sale.includes(AL_EMITIR), `🔴 el mensaje no lleva el nombre que quedó escrito en el albarán: ${sale}`);
  assert.ok(!sale.includes(DE_HOY), '🔴 el mensaje saluda con la ficha de HOY: renombrar la ficha cambia lo que recibe el cliente');
});

test('SCRUM-1650c · WhatsApp «para firmar» de un albarán anterior al escritor: la ficha (excepción declarada)', async () => {
  const sale = await loQueSale(() => envio.sendAlbaranParaFirmarWhatsApp(ANTERIOR.id));
  assert.ok(sale.includes(DE_HOY), `🔴 sin columnas congeladas el nombre tiene que salir de la ficha: ${sale}`);
});

test('SCRUM-1650c · WhatsApp del albarán firmado: el nombre del albarán, no la ficha de hoy', async () => {
  const sale = await conPdfDeMentira(() => loQueSale(() => envio.sendAlbaranFirmadoWhatsApp(FIRMADO_CONGELADO.id)));
  assert.ok(sale.includes(AL_EMITIR), `🔴 el mensaje no lleva el nombre que quedó escrito en el albarán: ${sale}`);
  assert.ok(!sale.includes(DE_HOY), '🔴 el mensaje saluda con la ficha de HOY');
  const anterior = await conPdfDeMentira(() => loQueSale(() => envio.sendAlbaranFirmadoWhatsApp(FIRMADO_ANTERIOR.id)));
  assert.ok(anterior.includes(DE_HOY), '🔴 sin columnas congeladas el nombre tiene que salir de la ficha');
});

/** Genera el PDF REAL y devuelve su texto. */
async function textoDelPapel(id) {
  const { diskPath } = await servicio.ensureAlbaranPdf(id, true);
  try {
    const texto = textoDePdf(diskPath);
    // SUELO: si no sé leer el papel, «no dice el nombre» no significa nada.
    assert.ok(contiene(texto, FILAS.get(id).numero), 'CIEGO: no encuentro ni el número del albarán en el texto del PDF');
    return texto;
  } finally {
    fs.rmSync(diskPath, { force: true });
  }
}

test('SCRUM-1650c · PDF de un albarán sin firmar: imprime el cliente del albarán, no la ficha de hoy', async () => {
  const texto = await textoDelPapel(CONGELADO.id);
  assert.ok(contiene(texto, AL_EMITIR), '🔴 el PDF no imprime el nombre que quedó escrito al emitir');
  assert.ok(!contiene(texto, DE_HOY), '🔴 el PDF imprime la ficha de HOY: renombrarla cambia el papel de un documento ya emitido');
});

test('SCRUM-1650c · PDF de un albarán anterior al escritor: la ficha (excepción declarada)', async () => {
  const texto = await textoDelPapel(ANTERIOR.id);
  assert.ok(contiene(texto, DE_HOY), '🔴 sin columnas congeladas el PDF tiene que imprimir la ficha');
});

test('SCRUM-1650c · PDF de un albarán FIRMADO: manda el sobre, y un v:1 sigue imprimiendo lo vivo con que se selló', async () => {
  // Si esto cae, el papel de un v:1/v:2 diría una cosa y su hash —recalculado con las fuentes
  // vivas— certificaría otra. El tramo c no toca el sellado.
  const texto = await textoDelPapel(FIRMADO_V1.id);
  assert.ok(contiene(texto, DE_HOY), '🔴 el PDF de un v:1 ha dejado de imprimir las fuentes con que se selló');
  assert.ok(!contiene(texto, AL_EMITIR), '🔴 el PDF de un v:1 imprime las columnas congeladas, que su sello no certifica');
});
