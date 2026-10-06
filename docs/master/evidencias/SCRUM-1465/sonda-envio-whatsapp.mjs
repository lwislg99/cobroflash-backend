// Sonda: qué contesta la ruta REAL `POST /admin/quotes/:id/send-whatsapp` de dist/ en cada rama.
// Uso: node sonda-envio.mjs <ruta ABSOLUTA del worktree>
// La base y Meta van dobladas con el arnés de la casa (tests/_envio-doblado.mjs). No sale nada a la red.
// ⚠️ Lo que pongo YO en cada caso (baja, topes, respuesta de Meta) lo fabrico; lo que se mide es la ruta.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const raiz = process.argv[2];
if (!raiz || !path.isAbsolute(raiz)) { console.error('falta la ruta absoluta del worktree'); process.exit(2); }
const arnes = await import(pathToFileURL(path.join(raiz, 'tests', '_envio-doblado.mjs')).href);
const requiere = createRequire(pathToFileURL(path.join(raiz, 'tests', 'x.mjs')).href);
const RUTA = '../dist/modules/system/app/routes/quotesAdmin.routes.js';
const WA = '../dist/integrations/whatsapp.js';
const TEL = '34000000001';

function presupuesto({ merchantId = arnes.MERCHANT, country = 'ES', cliente = {} } = {}) {
  return {
    id: 7, merchantId, customerId: arnes.CLIENTE, status: 'sent', quoteNumber: 12, total: '150.00', currency: 'EUR',
    decisionToken: 'tok-de-laboratorio',
    merchant: { id: merchantId, name: 'Taller de prueba', legalName: null, country },
    customer: { id: arnes.CLIENTE, name: 'Cliente de prueba', phone: TEL, mobile: null, ...cliente },
  };
}

async function caso(nombre, { respuestas = {}, quote = presupuesto(), merchantId = arnes.MERCHANT, metaFalla = undefined }) {
  arnes.inyectarBase({ 'quote.findUnique': () => quote, ...respuestas }, [RUTA]);
  if (metaFalla !== undefined) {
    const f = requiere.resolve(WA);
    const real = requiere(WA);
    requiere.cache[f] = { id: f, filename: f, loaded: true, exports: { ...real, sendWhatsAppWindowFirst: async () => metaFalla } };
    delete requiere.cache[requiere.resolve('../dist/modules/quotes/domain/sendQuote.service.js')];
    delete requiere.cache[requiere.resolve(RUTA)];
  }
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  const mod = arnes.moduloDeDist(RUTA);
  const router = Object.values(mod).find((v) => v && Array.isArray(v.stack));
  if (!router) throw new Error('CIEGO: no encuentro el router de quotesAdmin');
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id/send-whatsapp' && l.route.methods.post);
  if (!capa) throw new Error('CIEGO: no encuentro POST /:id/send-whatsapp');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, cuerpo: null };
  const res = { status(s) { r.status = s; return res; }, json(b) { r.cuerpo = b; return res; } };
  const mudo = console.error; const mudo2 = console.warn;
  console.error = () => {}; console.warn = () => {};
  try { await h({ params: { id: '7' }, merchantId, userRole: 'admin', body: {}, headers: {} }, res); }
  finally { console.error = mudo; console.warn = mudo2; delete globalThis.__waDryRunOutbox; }
  const c = r.cuerpo || {};
  console.log(`\n■ ${nombre}\n   HTTP ${r.status} · ok=${c.ok} · sent=${c.sent} · error=${c.error} · salieron ${buzon.length} mensaje(s)\n   message: ${c.message === undefined ? '(no hay)' : `«${c.message}»`}`);
  return { r, buzon };
}

console.log('POBLACIÓN: 9 casos sobre la ruta POST /admin/quotes/:id/send-whatsapp de dist/');
const control = await caso('0 · CONTROL: nada lo impide → sale', {});
if (!(control.r.cuerpo?.sent === true && control.buzon.length === 1)) { console.error('🔴 CIEGO: el control no sale; la sonda no mide'); process.exit(1); }

await caso('1 · BAJA (el cliente con ese teléfono se dio de baja)', { respuestas: { 'customer.findMany': () => [{ phone: TEL, mobile: null }] } });
await caso('2 · TOPE DIARIO del negocio (100 plantillas hoy)', { respuestas: { 'whatsAppMessage.count': (a) => (a?.where?.customerId ? 0 : 100) } });
await caso('3 · TOPE DIARIO por cliente (3 plantillas hoy a ese cliente)', { respuestas: { 'whatsAppMessage.count': (a) => (a?.where?.customerId ? 3 : 0) } });
await caso('4 · DEMO (merchant 1, número fuera de la lista)', { quote: presupuesto({ merchantId: 1 }), merchantId: 1 });
await caso('5 · META RECHAZA (la forma que devuelve whatsapp.ts:446 con el cuerpo de Meta)', { metaFalla: { ok: false, via: 'template', error: { error: { message: '(#131026) Message undeliverable', code: 131026 } } } });
await caso('6 · FALLO DE RED hacia Meta (whatsapp.ts:446 con err.message; el plazo real es de 10 s, whatsapp.ts:423)', { metaFalla: { ok: false, via: 'template', error: 'timeout of 10000ms exceeded' } });
await caso('7 · WhatsApp SIN CONFIGURAR (reason not_configured, sin error)', { metaFalla: { ok: false, via: 'template', reason: 'not_configured' } });
await caso('8 · LA BAJA NO SE PUEDE COMPROBAR (la consulta lanza; fail-closed de SCRUM-1262)', { respuestas: { 'customer.findMany': () => { throw new Error('la base no contesta'); } } });
await caso('5b · META RECHAZA, negocio de México (la palabra del país)', { quote: presupuesto({ country: 'MX' }), metaFalla: { ok: false, via: 'template', error: { error: { message: '(#131026) Message undeliverable' } } } });
console.log('\nEXIT=0');
