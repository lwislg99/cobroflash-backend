// docs/master/evidencias/SCRUM-1302/revision-vieja/revision-vieja.mjs — SCRUM-1302
//
// EL DEFECTO DEL ENLACE DE UNA REVISIÓN ANTIGUA, corrido el 13-oct-2026 (comentario 19451). Vivía en un
// temporal; se sube tal cual se corrió. Es el control de lo que se construya: mientras salga
// «formulario» y «200», el defecto sigue vivo.
//
// Uso (después de `npm run build`): node docs/master/evidencias/SCRUM-1302/revision-vieja/revision-vieja.mjs <ruta ABSOLUTA del árbol>
//
// ¿Mira la página pública (GET) o la decisión (POST) si el presupuesto tiene una revisión más nueva?
// Rutas reales de `dist`, base doblada. El grupo tiene DOS filas: la .0 (la del enlace, `sent`) y la
// .1 (más nueva, `sent`). Se cuenta cuántas veces alguien pregunta por el grupo.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const arbol = process.argv[2];
process.env.WHATSAPP_DRY_RUN = '1';
const { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } = await import(pathToFileURL(path.join(arbol, 'tests', '_envio-doblado.mjs')).href);
const RUTAS = '../dist/modules/quotes/app/routes/quotes.routes.js';
const LANDING = '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
const TOKEN = 'e'.repeat(32);
const copia = (x) => JSON.parse(JSON.stringify(x));
const base = (revision, token) => ({
  id: 100 + revision, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', total: revision ? '242.00' : '121.00', currency: 'EUR',
  lines: [{ concept: 'Revisión', qty: 1, price: revision ? 200 : 100, tax: 0.21 }], quoteNumber: 12, revision,
  decisionToken: token, validUntil: new Date(Date.now() + 10 * 86400000), paymentTerms: 'FULL_UPFRONT', tiers: null,
  discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, rejectionReason: null, jobId: null, createdAt: new Date(), updatedAt: new Date(),
  merchant: { id: MERCHANT, name: 'Fontanería', legalName: null, taxId: null, country: 'ES', whatsappPhone: null, defaultCurrency: 'EUR', flags: null, timezone: 'Europe/Madrid', brandColor: null },
  customer: { id: CLIENTE, name: 'Cliente', phone: null }, Invoice: [],
});
const vieja = base(0, TOKEN);
const nueva = base(1, 'f'.repeat(32));
const cuenta = { porGrupo: 0, escrituras: 0 };
const esLaVieja = (where) => where?.decisionToken === TOKEN || where?.id === vieja.id;
inyectarBase({
  'quote.findUnique': ({ where }) => (esLaVieja(where) ? copia(vieja) : null),
  'quote.findFirst': ({ where }) => { if (esLaVieja(where)) return copia(vieja); cuenta.porGrupo += 1; return copia(nueva); },
  'quote.findMany': () => { cuenta.porGrupo += 1; return [copia(vieja), copia(nueva)]; },
  'quote.count': () => { cuenta.porGrupo += 1; return 2; },
  'quote.update': ({ data }) => { cuenta.escrituras += 1; Object.assign(vieja, copia(data)); return copia(vieja); },
}, [RUTAS, LANDING, '../dist/modules/system/customerEvents.service.js']);
globalThis.__waDryRunOutbox = [];

const { quoteDecisionLandingRouter } = moduloDeDist(LANDING);
const capaGet = quoteDecisionLandingRouter.stack.find((l) => l.route && [].concat(l.route.path).includes('/quote/:token') && l.route.methods.get);
let html = '';
const resG = { status() { return resG; }, setHeader() { return resG; }, redirect() { return resG; }, send(b) { html = String(b); return resG; } };
await capaGet.route.stack.at(-1).handle({ params: { token: TOKEN }, query: {}, headers: {}, ip: '127.0.0.1', socket: {} }, resG);
console.log(`GET  enlace de la .0 habiendo .1 → formulario de firma pintado: ${html.includes('id="btn-accept"')} · total que enseña: ${/121,00/.test(html) ? '121,00 (el de la vieja)' : '?'} · preguntas por el grupo: ${cuenta.porGrupo}`);

const router = moduloDeDist(RUTAS).default;
const capaPost = router.stack.find((l) => l.route && l.route.path === '/:token/decision');
const r = { status: 200, data: null };
const resP = { status(s) { r.status = s; return resP; }, json(j) { r.data = j; return resP; }, setHeader() {} };
await capaPost.route.stack.at(-1).handle({ params: { token: TOKEN }, body: { decision: 'accept' }, headers: {}, ip: '127.0.0.1', socket: {} }, resP);
await new Promise((x) => setTimeout(x, 80));
console.log(`POST aceptar la .0 habiendo .1 → ${r.status} ${JSON.stringify(r.data).slice(0, 90)} · estado de la .0: ${vieja.status} · escrituras: ${cuenta.escrituras} · preguntas por el grupo: ${cuenta.porGrupo}`);
// Control del contador: si alguien pregunta por el grupo, se ve.
const { prisma } = moduloDeDist('../dist/core/db/prisma.js');
await prisma.quote.findMany({ where: { quoteNumber: 12 } });
console.log(`control · una pregunta por el grupo hecha a mano → el contador pasa a ${cuenta.porGrupo}`);
process.exit(0);
