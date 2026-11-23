// SCRUM-665e · EL PDF DE UNA FACTURA EMITIDA SE GENERA UNA VEZ Y SE SIRVE SIEMPRE ÉSE.
//
// GO del fundador: SCRUM-665 c.21182 (opción A: se guarda al emitir y se sirve siempre ése;
// se retira `regenerate-pdf`; huella en `pdf_sha256`) y c.21191 (las emitidas sin huella se
// congelan la PRIMERA vez que se pide su PDF, y nunca más se regeneran).
//
// Con el código de antes, una emitida cuyo fichero faltaba en disco se REGENERABA con el código
// y los datos de hoy, y la copia «conservada» dejaba de ser la expedida (regla 29, c.16647).
// Este test cae contra ese código (caso ③: genera por segunda vez) y pasa con el congelado.
//
// El generador real se sustituye por uno que escribe bytes DISTINTOS en cada llamada, para que
// una regeneración se vea en el recuento y en la huella. Lo que se prueba es `ensureInvoicePdf`
// entera, desde `dist/`, con un Prisma falso que guarda el estado de la fila entre llamadas.
// SCRUM-1779d · este banco AFIRMA el sellado: con SIF_ENABLED en OFF (el defecto) la emisión ya no sella (SCRUM-1779 c.22239), así que se enciende aquí y lo afirmado no cambia (puesto al juntar main en 665e, 23-nov-2026).
process.env.SIF_ENABLED = 'true';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// Antes de cargar `invoicing.js`: el módulo compilado lee `pdf_1.generateInvoicePdf` en cada
// llamada, y `lib/pdf.js` lo reexporta con un getter que lee `pdf.service.js` en cada acceso;
// así que basta con cambiar la propiedad en las exportaciones del módulo de origen.
const pdfMod = require('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const { invoicesDir } = require('../dist/core/storage/dirs.js');
let generaciones = 0;
pdfMod.generateInvoicePdf = async (args) => {
  generaciones += 1;
  const fileName = `${args.merchantId}-${args.number}.pdf`;
  const diskPath = path.join(invoicesDir, fileName);
  fs.mkdirSync(invoicesDir, { recursive: true });
  // Un respiro para que dos peticiones simultáneas se crucen de verdad si no hay cerrojo.
  await new Promise((r) => setTimeout(r, 20));
  fs.writeFileSync(diskPath, `%PDF-falso generacion=${generaciones} ${crypto.randomUUID()}\n`);
  return { diskPath, publicUrlPath: `/admin/invoices/${args.invoiceId}/pdf` };
};
const invoicing = require('../dist/lib/invoicing.js');
const { ensureInvoicePdf } = invoicing;

// Merchant NO español: el portón deja salir el documento sin huella fiscal (SCRUM-206), así que
// lo único que decide aquí es el congelado del PDF.
const MERCHANT = { id: 7, name: 'Taller Prueba 665e', legalName: null, taxId: 'X1', country: 'PT', address: null,
  logoUrl: null, whatsappPhone: null, email: null, timezone: 'Europe/Lisbon' };
let siguiente = 0;

/** Prisma falso con UNA fila de factura que recuerda lo que se le escribe. */
function prismaConFila({ pdfSha256 = null, updateRevienta = false } = {}) {
  siguiente += 1;
  const fila = {
    id: 66500 + siguiente, number: `T665E-${process.pid}-${siguiente}`, merchantId: 7, customerId: 1,
    lines: [], total: { toString: () => '121.00' }, currency: 'EUR', createdAt: new Date(),
    pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', vfHash: null, type: 'F1', stageLabel: null,
    rectifies: null, pdfSha256,
  };
  const escrituras = [];
  return {
    fila, escrituras,
    invoice: {
      findUnique: async () => ({ ...fila, merchant: { ...MERCHANT }, customer: { id: 1, name: 'Cliente', email: null, phone: null } }),
      update: async (args) => {
        if (updateRevienta) throw new Error('base_caida_al_guardar_la_huella');
        escrituras.push(args.data);
        Object.assign(fila, args.data);
        return { ...fila };
      },
    },
  };
}
const rutaDe = (fila) => path.join(invoicesDir, `${fila.merchantId}-${fila.number}.pdf`);
const sha = (ruta) => crypto.createHash('sha256').update(fs.readFileSync(ruta)).digest('hex');
const limpiar = (fila) => fs.rmSync(rutaDe(fila), { force: true });

test('SCRUM-665e · ① sin huella: se genera UNA vez y se guarda el sha256 del fichero en disco', async (t) => {
  const p = prismaConFila();
  t.after(() => limpiar(p.fila));
  const antes = generaciones;
  const r = await ensureInvoicePdf(p.fila.id, p);
  assert.equal(generaciones - antes, 1, 'debió generar exactamente una vez');
  assert.equal(r.diskPath, rutaDe(p.fila));
  assert.match(String(p.fila.pdfSha256 ?? ''), /^[0-9a-f]{64}$/,
    '🔴 la primera generación no guardó `pdfSha256`: el PDF no queda congelado (c.21182 punto 4)');
  assert.equal(p.fila.pdfSha256, sha(r.diskPath), 'la huella guardada no es la del fichero que se sirve');
});

test('SCRUM-665e · ② con huella y fichero intacto: se sirve ése y NO se regenera', async (t) => {
  const p = prismaConFila();
  t.after(() => limpiar(p.fila));
  await ensureInvoicePdf(p.fila.id, p);
  const bytes = fs.readFileSync(rutaDe(p.fila));
  const antes = generaciones;
  for (let i = 0; i < 3; i++) await ensureInvoicePdf(p.fila.id, p);
  assert.equal(generaciones - antes, 0, 'se regeneró un PDF ya congelado');
  assert.deepEqual(fs.readFileSync(rutaDe(p.fila)), bytes, 'los bytes servidos cambiaron');
});

test('SCRUM-665e · ③ con huella y SIN fichero: falla cerrado y NO regenera (regla 29)', async (t) => {
  const p = prismaConFila();
  t.after(() => limpiar(p.fila));
  await ensureInvoicePdf(p.fila.id, p);
  const huella = p.fila.pdfSha256;
  fs.rmSync(rutaDe(p.fila));
  const antes = generaciones;
  await assert.rejects(() => ensureInvoicePdf(p.fila.id, p),
    (e) => e?.message === 'pdf_congelado_sin_fichero',
    '🔴 una emitida sin su fichero NO falló cerrado con `pdf_congelado_sin_fichero`');
  assert.equal(generaciones - antes, 0,
    '🔴 SE REGENERÓ el PDF de una emitida: la copia servida ya no es la expedida (c.16647)');
  assert.equal(fs.existsSync(rutaDe(p.fila)), false, 'apareció un fichero nuevo');
  assert.equal(p.fila.pdfSha256, huella, 'la huella guardada cambió');
});

test('SCRUM-665e · ④ con huella y fichero ALTERADO: falla cerrado y no lo sirve', async (t) => {
  const p = prismaConFila();
  t.after(() => limpiar(p.fila));
  await ensureInvoicePdf(p.fila.id, p);
  fs.appendFileSync(rutaDe(p.fila), 'un byte de mas');
  const antes = generaciones;
  await assert.rejects(() => ensureInvoicePdf(p.fila.id, p),
    (e) => e?.message === 'pdf_congelado_alterado',
    '🔴 un fichero que no cuadra con su `pdf_sha256` se sirvió igual');
  assert.equal(generaciones - antes, 0);
});

test('SCRUM-665e · ⑤ si no se puede guardar la huella, falla cerrado (no devuelve PDF)', async (t) => {
  const p = prismaConFila({ updateRevienta: true });
  t.after(() => limpiar(p.fila));
  await assert.rejects(() => ensureInvoicePdf(p.fila.id, p), /base_caida_al_guardar_la_huella/,
    '🔴 se devolvió un PDF cuya huella no quedó guardada');
  assert.equal(p.fila.pdfSha256, null);
});

test('SCRUM-665e · ⑥ dos primeras peticiones a la vez generan UNA sola vez (cerrojo)', async (t) => {
  const p = prismaConFila();
  t.after(() => limpiar(p.fila));
  const antes = generaciones;
  const [a, b] = await Promise.all([ensureInvoicePdf(p.fila.id, p), ensureInvoicePdf(p.fila.id, p)]);
  assert.equal(generaciones - antes, 1, '🔴 dos generaciones: la segunda pisa los bytes ya congelados');
  assert.equal(a.diskPath, b.diskPath);
  assert.equal(p.fila.pdfSha256, sha(a.diskPath));
});

test('SCRUM-665e · ⑦ la ruta `regenerate-pdf` ya no se monta (c.21182 punto 3)', () => {
  const rel = 'src/modules/system/app/routes/invoicesAdmin.routes.ts';
  const codigo = soloCodigo(fs.readFileSync(path.join(RAIZ, rel), 'utf8'), rel);
  const rutas = [...codigo.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)].map((m) => `${m[1]} ${m[2]}`);
  // Control positivo: el escáner ve las rutas del fichero, y entre ellas la que sirve el PDF.
  assert.ok(rutas.includes('get /:id/pdf'), `🔴 ESCÁNER CIEGO: no veo \`get /:id/pdf\` en ${rel} (${rutas.length} rutas leídas)`);
  const vivas = rutas.filter((r) => /regenerate-pdf/.test(r));
  assert.deepEqual(vivas, [], `🔴 ${rel} sigue montando ${vivas.join(', ')}`);
});

// ═══ AL EMITIR (c.21182 punto 1) ════════════════════════════════════════════════════════════════
// Las 11 llamadas a `sellarTrasEmision` de `src/` pasan por ella, así que el congelado vive ahí:
// un punto, no once. Con el código anterior, emitir dejaba la huella del PDF a NULL hasta que
// alguien lo abría (caen ⑧ y ⑨).
const sellado = require('../dist/modules/invoicing/domain/selladoEstado.js');

/** Doble de Prisma con el que el sellado ES de verdad llega a `sellado` (mismo banco que SCRUM-1296). */
function dobleQueSella({ rompe = false } = {}) {
  const fila = { id: 66599, number: '2026-CF-0665', total: '121.00', createdAt: new Date('2026-11-12T10:00:00Z'),
    merchantId: 77, type: 'F1', vfHash: null, vfPrevHash: null, vfTimestamp: null, lines: [{ concept: 'Obra', qty: 1, price: 100, tax: 0.21 }],
    customer: { name: 'Cliente', taxId: 'A11111111' }, rectifies: null };
  const orden = [];
  const respuestas = {
    'invoice.findUnique': () => fila,
    'invoice.findFirst': () => null,
    'invoice.update': (a) => { orden.push(`update:${Object.keys(a?.data ?? {}).join(',')}`); Object.assign(fila, a?.data ?? {}); return fila; },
    'merchant.findUnique': () => { if (rompe) throw new Error('cadena_caida'); return ({ id: 77, country: 'ES', taxId: 'B12345678', name: 'F', legalName: 'F S.L.', timezone: null }); },
  };
  const modelo = (m) => new Proxy({}, { get: (_, met) => async (a) => {
    const r = respuestas[`${m}.${String(met)}`];
    if (r) return r(a);
    if (met === 'findMany') return [];
    if (met === 'count') return 0;
    return { id: 1, ...(a?.data ?? {}) };
  } });
  const cliente = new Proxy({}, { get: (_, k) => {
    if (k === '$transaction') return async (fn) => fn(cliente);
    if (k === '$executeRaw' || k === '$executeRawUnsafe') return async () => 1;
    if (k === 'then' || typeof k === 'symbol') return undefined;
    return modelo(String(k));
  } });
  return { cliente, fila, orden };
}

test('SCRUM-665e · ⑧ emitir una factura SELLADA congela su PDF, después del sellado', async () => {
  const d = dobleQueSella();
  const llamadas = [];
  const r = await sellado.sellarTrasEmision({ ...d.fila, total: { toString: () => '121.00' } },
    { country: 'ES', taxId: 'B12345678' }, d.cliente,
    { congelarPdf: async (id) => { llamadas.push({ id, estadoAlCongelar: d.fila.vfEstado }); d.orden.push('congelar'); } });
  assert.equal(r.estado, 'sellado', `🔴 CIEGO: el banco no llegó a sellar (${JSON.stringify(r)})`);
  assert.deepEqual(llamadas, [{ id: d.fila.id, estadoAlCongelar: 'sellado' }],
    '🔴 una factura sellada al emitir NO congeló su PDF (o lo hizo antes de quedar `sellado`)');
  assert.equal(d.orden.at(-1), 'congelar', `🔴 el congelado no va al final: ${d.orden.join(' → ')}`);
});

test('SCRUM-665e · ⑨ emitir un documento `no_aplica` lo congela con el camino REAL (`ensureInvoicePdf`)', async (t) => {
  const p = prismaConFila();
  t.after(() => limpiar(p.fila));
  const antes = generaciones;
  const r = await sellado.sellarTrasEmision({ ...p.fila }, { country: 'PT', taxId: 'X1' }, p);
  assert.equal(r.estado, 'no_aplica');
  assert.equal(generaciones - antes, 1, '🔴 emitir no generó el PDF: se congelaría al primer pedido, no al emitir');
  assert.equal(p.fila.pdfSha256, sha(rutaDe(p.fila)), '🔴 tras emitir, la huella guardada no es la del fichero');
});

test('SCRUM-665e · ⑩ una factura que se queda PENDIENTE de sellado no congela nada', async () => {
  // El sellado revienta (`merchant.findUnique` lanza): la factura se queda donde nació.
  const d = dobleQueSella({ rompe: true });
  let congelados = 0;
  const r = await sellado.sellarTrasEmision({ ...d.fila, total: { toString: () => '121.00' } },
    { country: 'ES', taxId: 'B12345678' }, d.cliente, { congelarPdf: async () => { congelados += 1; } });
  assert.equal(r.estado, 'pendiente_de_sellado', `🔴 CIEGO: el sellado no falló (${JSON.stringify(r)})`);
  assert.equal(congelados, 0, '🔴 se pidió el PDF de una factura sin sellar');
});

test('SCRUM-665e · ⑪ si congelar falla, la emisión NO falla ni cambia su resultado', async () => {
  const p = prismaConFila();
  const r = await sellado.sellarTrasEmision({ ...p.fila }, { country: 'PT', taxId: 'X1' }, p,
    { congelarPdf: async () => { throw new Error('volumen_lleno'); } });
  assert.deepEqual(r, { estado: 'no_aplica' }, '🔴 un fallo al guardar el PDF cambió o tumbó la emisión');
  assert.equal(p.fila.vfEstado, 'no_aplica');
});

// Decisión del orquestador, SCRUM-665 c.21592 punto 1 (el consumidor nuevo que pedía SCRUM-206 (b)):
// si el PORTÓN rechaza el PDF, el sellado no se deshace ni falla, no se congela nada y se avisa en
// el log con el id y el motivo. El rechazo es el del portón DE VERDAD (`exigirDocumentoEmitible`
// sobre un documento sin huella), no un error inventado.
const { exigirDocumentoEmitible } = require('../dist/modules/invoicing/domain/portonDocumento.js');

test('SCRUM-665e · ⑫ si el portón rechaza el PDF al emitir: sellado intacto, 0 PDF y aviso en el log', async (t) => {
  const d = dobleQueSella();
  const avisos = [];
  t.mock.method(console, 'error', (...a) => { avisos.push(a.map(String).join(' ')); });
  let motivo = null;
  const r = await sellado.sellarTrasEmision({ ...d.fila, total: { toString: () => '121.00' } },
    { country: 'ES', taxId: 'B12345678' }, d.cliente,
    { congelarPdf: async () => {
      try { exigirDocumentoEmitible({ number: d.fila.number, vfHash: null }, { country: 'ES', taxId: 'B12345678' }); } catch (e) { motivo = e.message; throw e; }
      throw new Error('CIEGO: el portón no rechazó');
    } });
  assert.ok(motivo, '🔴 CIEGO: el portón real no rechazó el documento sin huella; el caso no prueba nada');
  assert.deepEqual(r, { estado: 'sellado' }, `🔴 el rechazo del PDF cambió o tumbó el sellado: ${JSON.stringify(r)}`);
  assert.equal(d.fila.vfEstado, 'sellado', '🔴 el rechazo del PDF deshizo el sellado (regla 29)');
  assert.ok(d.fila.vfHash, '🔴 la factura perdió su huella tras el rechazo del PDF');
  assert.equal(d.fila.pdfSha256, undefined, '🔴 se guardó huella de PDF tras un rechazo del portón');
  assert.equal(d.orden.filter((o) => o.includes('pdfSha256')).length, 0, '🔴 se escribió `pdfSha256` tras el rechazo');
  const aviso = avisos.filter((a) => a.includes('PDF NO congelado al emitir'));
  assert.equal(aviso.length, 1, `🔴 el rechazo no se dijo en voz alta (avisos: ${JSON.stringify(avisos)})`);
  assert.ok(aviso[0].includes(String(d.fila.id)) && aviso[0].includes(motivo),
    `🔴 el aviso no lleva el id y el motivo: «${aviso[0]}»`);
});
