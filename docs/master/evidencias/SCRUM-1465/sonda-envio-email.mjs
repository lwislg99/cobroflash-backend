// Sonda: `POST /admin/quotes/:id/send-email` de dist/ cuando el correo SALE y falla lo de después.
// Uso: node sonda-email.mjs <ruta ABSOLUTA del worktree>. La base y el correo van doblados; no sale nada.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const raiz = process.argv[2];
const arnes = await import(pathToFileURL(path.join(raiz, 'tests', '_envio-doblado.mjs')).href);
const requiere = createRequire(pathToFileURL(path.join(raiz, 'tests', 'x.mjs')).href);
const RUTA = '../dist/modules/system/app/routes/quotesAdmin.routes.js';
const CORREO = '../dist/modules/messaging/domain/email.service.js';

async function caso(nombre, { correo, actualizar }) {
  const enviados = [];
  arnes.inyectarBase({
    'quote.findFirst': () => ({ id: 7, quoteNumber: 12, status: 'draft', total: '150.00', currency: 'EUR', merchantId: arnes.MERCHANT, customerId: arnes.CLIENTE, customer: { email: 'cliente@example.invalid' } }),
    'quote.update': actualizar,
  }, [RUTA]);
  const f = requiere.resolve(CORREO);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports: { sendQuoteEmail: async (a) => { const r = await correo(a); enviados.push(a.quoteId); return r; } } };
  const mod = arnes.moduloDeDist(RUTA);
  const router = Object.values(mod).find((v) => v && Array.isArray(v.stack));
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id/send-email' && l.route.methods.post);
  if (!capa) throw new Error('CIEGO: no encuentro POST /:id/send-email');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const r = { status: 200, cuerpo: null };
  const res = { status(s) { r.status = s; return res; }, json(b) { r.cuerpo = b; return res; } };
  const mudo = console.error; console.error = () => {};
  try { await h({ params: { id: '7' }, merchantId: arnes.MERCHANT, userRole: 'admin', body: {}, headers: {} }, res); }
  finally { console.error = mudo; }
  const c = r.cuerpo || {};
  console.log(`\n■ ${nombre}\n   correos que SALIERON: ${enviados.length} · HTTP ${r.status} · sent=${c.sent} · error=${c.error}\n   message: ${c.message === undefined ? '(no hay)' : `«${c.message}»`}`);
  return { r, enviados };
}

console.log('POBLACIÓN: 3 casos sobre POST /admin/quotes/:id/send-email de dist/');
const control = await caso('0 · CONTROL: el correo sale y la base contesta', { correo: async () => ({}), actualizar: () => ({}) });
if (!(control.r.cuerpo?.sent === true && control.enviados.length === 1)) { console.error('🔴 CIEGO: el control no sale'); process.exit(1); }
await caso('1 · el correo NO sale (el proveedor lanza)', { correo: async () => { throw new Error('resend 500'); }, actualizar: () => ({}) });
await caso('2 · el correo SÍ sale y falla marcar el presupuesto como enviado', { correo: async () => ({}), actualizar: () => { throw new Error('la base no contesta'); } });
console.log('\nEXIT=0');
