// Sonda: `POST /admin/quotes/:id/send-whatsapp` cuando el WhatsApp SALE y falla marcar el borrador como enviado.
// Uso: node sonda-wa-despues.mjs <ruta ABSOLUTA del worktree>. Base y Meta dobladas; no sale nada a la red.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const raiz = process.argv[2];
const arnes = await import(pathToFileURL(path.join(raiz, 'tests', '_envio-doblado.mjs')).href);
const RUTA = '../dist/modules/system/app/routes/quotesAdmin.routes.js';

async function caso(nombre, actualizar) {
  const quote = {
    id: 7, merchantId: arnes.MERCHANT, customerId: arnes.CLIENTE, status: 'draft', quoteNumber: 12, total: '150.00', currency: 'EUR',
    decisionToken: 'tok-de-laboratorio', merchant: { id: arnes.MERCHANT, name: 'Taller de prueba', legalName: null, country: 'ES' },
    customer: { id: arnes.CLIENTE, name: 'Cliente de prueba', phone: '34000000001', mobile: null },
  };
  arnes.inyectarBase({ 'quote.findUnique': () => quote, 'quote.update': actualizar }, [RUTA]);
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  const mod = arnes.moduloDeDist(RUTA);
  const router = Object.values(mod).find((v) => v && Array.isArray(v.stack));
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id/send-whatsapp' && l.route.methods.post);
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, cuerpo: null };
  const res = { status(s) { r.status = s; return res; }, json(b) { r.cuerpo = b; return res; } };
  const e = console.error; const w = console.warn; console.error = () => {}; console.warn = () => {};
  try { await h({ params: { id: '7' }, merchantId: arnes.MERCHANT, userRole: 'admin', body: {}, headers: {} }, res); }
  finally { console.error = e; console.warn = w; delete globalThis.__waDryRunOutbox; }
  console.log(`\n■ ${nombre}\n   WhatsApp que SALIERON: ${buzon.length} · HTTP ${r.status} · ${JSON.stringify(r.cuerpo)}`);
  return { r, buzon };
}
console.log('POBLACIÓN: 2 casos sobre POST /admin/quotes/:id/send-whatsapp de dist/, presupuesto en borrador');
const c = await caso('0 · CONTROL: sale y la base contesta', () => ({}));
if (!(c.r.cuerpo?.sent === true && c.buzon.length === 1)) { console.error('🔴 CIEGO: el control no sale'); process.exit(1); }
await caso('1 · el WhatsApp SÍ sale y falla marcar el borrador como enviado', () => { throw new Error('la base no contesta'); });
console.log('\nEXIT=0');
