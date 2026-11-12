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
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

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
  const codigo = fs.readFileSync(path.join(RAIZ, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const rutas = [...codigo.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)].map((m) => `${m[1]} ${m[2]}`);
  // Control positivo: el escáner ve las rutas del fichero, y entre ellas la que sirve el PDF.
  assert.ok(rutas.includes('get /:id/pdf'), `🔴 ESCÁNER CIEGO: no veo \`get /:id/pdf\` en ${rel} (${rutas.length} rutas leídas)`);
  const vivas = rutas.filter((r) => /regenerate-pdf/.test(r));
  assert.deepEqual(vivas, [], `🔴 ${rel} sigue montando ${vivas.join(', ')}`);
});
