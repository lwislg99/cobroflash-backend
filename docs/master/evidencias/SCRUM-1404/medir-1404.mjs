// docs/master/evidencias/SCRUM-1404/medir-1404.mjs — SCRUM-1404
//
// MIDE, EJECUTANDO, qué contestan las dos rutas que sirven el PDF de una factura cuando la factura
// está en `pendiente_de_sellado`. No es un test (no registra ninguno) y no toca nada: carga las
// rutas de `dist/` tal cual, con la base doblada, y les pide el PDF.
//
//   node docs/master/evidencias/SCRUM-1404/medir-1404.mjs        (después de `npm run build`)
//
// Lo que NO se dobla es lo que se mide: `ensureInvoicePdf` (`dist/lib/invoicing.js`), el portón
// (`portonDocumento`) y el `catch` de cada ruta son el código de producción.
//
// Lo que NO mide: el camino que SÍ genera el PDF (una factura sellada). Ejecutarlo escribe un
// fichero en `storage/invoices/` y aquí no se escribe nada.
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from '../../../../tests/_envio-doblado.mjs';
import { reqDeSesion } from '../../../../tests/_arnes-de-router.mjs';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const M = 4404; // no es el 1 (el demo)
const FACTURA = 7;
const TOKEN = 'tok_1404';

const banco = { factura: null };
const facturaCon = (extra) => ({
  id: FACTURA, merchantId: M, customerId: 57, number: 'F260007', status: 'paid', type: 'F1',
  total: '1419.87', currency: 'EUR', lines: [], pdfUrl: 'PENDING_PDF', qrData: 'PENDING',
  vfHash: null, vfEstado: 'pendiente_de_sellado', quoteId: 9, chargeId: 2404,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  merchant: { id: M, name: 'Taller de prueba', legalName: null, taxId: 'B00000000', address: null, country: 'ES' },
  customer: { id: 57, name: 'Cliente de prueba', phone: null, mobile: null, email: null },
  rectifies: null,
  ...extra,
});

const doble = dobleDeLaBase({
  'invoice.findUnique': () => (banco.factura ? { ...banco.factura } : null),
  'invoice.findFirst': () => (banco.factura ? { ...banco.factura } : null),
  'charge.findUnique': () => ({ id: 2404, status: 'paid', receiptToken: TOKEN, events: [] }),
  'quote.findFirst': () => ({ id: 9, chargeId: 2404 }),
});
const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };

const handlerDe = (modulo, ruta) => {
  const m = requiere(rutaDe(modulo));
  const router = m.default || m;
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route.methods.get);
  if (!capa) throw new Error(`CIEGO: no encuentro GET ${ruta} en ${modulo}`);
  return capa.route.stack.at(-1).handle;
};
const panel = handlerDe('dist/modules/system/app/routes/invoicesAdmin.routes.js', '/:id/pdf');
const recibo = handlerDe('dist/modules/billing/app/routes/receipt.routes.js', '/:token/pdf');

async function llamar(handle, req) {
  const r = { status: 200, json: null, html: null, cabeceras: {}, log: [] };
  const res = {
    status(c) { r.status = c; return res; },
    json(x) { r.json = x; return res; },
    send(x) { r.html = x; return res; },
    setHeader(k, v) { r.cabeceras[k] = v; },
    type() { return res; },
  };
  const original = console.error;
  console.error = (...a) => { r.log.push(a.map((x) => (x instanceof Error ? `${x.name}: ${x.message}` : String(x))).join(' ')); };
  try { await handle(req, res, (e) => { if (e) throw e; }); } finally { console.error = original; }
  return r;
}
const titulo = (html) => (/<title[^>]*>([\s\S]*?)<\/title>/.exec(html || '') || [])[1] ?? null;
const h1 = (html) => (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html || '') || [])[1]?.trim() ?? null;

const CASOS = [
  ['① pendiente_de_sellado (ES, con NIF, sin huella): el caso del ticket', facturaCon({})],
  ['② control del catch: `sellado` en la columna pero SIN huella (lo corta el portón)', facturaCon({ vfEstado: 'sellado' })],
  ['③ control de avería: la factura llega sin su cliente', facturaCon({ vfEstado: 'sellado', vfHash: 'h', customer: null })],
];

console.log(`POBLACION=${CASOS.length} casos x 2 rutas = ${CASOS.length * 2} llamadas`);
let hechas = 0;
for (const [nombre, factura] of CASOS) {
  banco.factura = factura;
  console.log(`\n${nombre}`);
  const a = await llamar(panel, reqDeSesion({ rol: 'admin', merchantId: M, headers: {}, params: { id: String(FACTURA) } }));
  hechas += 1;
  console.log(`  PANEL   GET /admin/invoices/:id/pdf → ${a.status} · cuerpo ${JSON.stringify(a.json)}`);
  console.log(`          lo que queda en el log: ${a.log.join(' | ')}`);
  const b = await llamar(recibo, { params: { token: TOKEN }, headers: {}, query: {} });
  hechas += 1;
  console.log(`  CLIENTE GET /recibo/:token/pdf      → ${b.status} · <title> ${JSON.stringify(titulo(b.html))} · <h1> ${JSON.stringify(h1(b.html))}`);
  console.log(`          lo que queda en el log: ${b.log.join(' | ')}`);
}
console.log(`\nHECHAS=${hechas}`);
console.log('EXIT=0');
