// SCRUM-1402 Ⓖ · SONDA (evidencia, no test): qué hace HOY el webhook de Stripe con un evento que llega
// SIN `metadata.plan` (o con él vacío), y con `merchant_id` pero sin plan. Sólo MIDE: no toca `src/`.
//
// Mismo banco que `tests/scrum1402-plan-inexistente-no-se-escribe.test.mjs`: el router de producción
// montado como en `src/app.ts` (`/webhooks/stripe`, `rawBody`, `router`), el evento FIRMADO con un HMAC
// local (no viaja nada a Stripe) y la base doblada con `tests/_envio-doblado.mjs` (SIN estado: lo que se
// mide es qué se ESCRIBE, no la fila después).
//
// Uso (desde la raíz del árbol, con `dist/` emitido):
//   node docs/master/evidencias/scrum1402/sonda-1402g.mjs [<dir dist>] [<etiqueta>]
//
// 🔴 CONTROL POSITIVO SEMBRADO: la variante `plan=pro` por las puertas que escriben TIENE que escribir
//    `plan: 'pro'`. Si no escribe, la sonda no ve nada y lo dice: CIEGA, código 2.
// 🔵 CONTROL A CERO DERIVADO: `plan sin merchant` no puede escribir en ninguna puerta (todas exigen
//    `merchant_id` entero). Si escribe, el banco miente: código 3.
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RAIZ = process.cwd();
const DIST = process.argv[2] || 'dist';
const ETIQUETA = process.argv[3] || DIST;
const requiere = createRequire(path.join(RAIZ, 'package.json'));
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const CLAVE_JUGUETE = 'sk_test_' + 'f'.repeat(24);
const WHSEC_JUGUETE = 'whsec_' + crypto.randomBytes(12).toString('hex');
process.env.STRIPE_SECRET_KEY = CLAVE_JUGUETE;
process.env.STRIPE_WEBHOOK_SECRET = WHSEC_JUGUETE;

const { dobleDeLaBase } = await import(pathToFileURL(path.join(RAIZ, 'tests/_envio-doblado.mjs')).href);

const M = 14027;
const visto = { escrituras: [], registro: [], premios: 0, correos: 0 };
const limpiar = () => Object.assign(visto, { escrituras: [], registro: [], premios: 0, correos: 0 });
const doble = dobleDeLaBase({
  'merchant.update': (a) => { visto.escrituras.push(a); return { email: 'duena@example.invalid' }; },
  'gatewayEvent.create': (a) => { visto.registro.push(['create', a]); return {}; },
  'gatewayEvent.update': (a) => { visto.registro.push(['update', a]); return {}; },
});
function doblar(r, exp) {
  const f = rutaDe(r);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports: exp };
}
doblar(`${DIST}/core/db/prisma.js`, { prisma: doble });
doblar(`${DIST}/modules/auth/domain/referral.service.js`, { rewardReferralOnFirstPayment: async () => { visto.premios += 1; } });
doblar(`${DIST}/modules/messaging/domain/lifecycle.service.js`, { sendFirstPaymentEmail: async () => { visto.correos += 1; return null; } });

const ruta = requiere(rutaDe(`${DIST}/modules/billing/app/routes/stripe.routes.js`));
const express = requiere('express');
const Stripe = requiere('stripe');
const firmador = new Stripe(CLAVE_JUGUETE, { apiVersion: '2024-06-20' });

const app = express();
app.use('/webhooks/stripe', ruta.rawBody, ruta.router);
const servidor = app.listen(0);
await new Promise((r) => servidor.once('listening', r));
const puerto = servidor.address().port;

function pedir(payload, firma) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: puerto, path: '/webhooks/stripe', method: 'POST', agent: false,
      headers: { 'content-type': 'application/json', 'stripe-signature': firma, 'content-length': Buffer.byteLength(payload) },
    }, (res) => {
      let d = ''; res.setEncoding('utf8');
      res.on('data', (t) => { d += t; });
      res.on('end', () => resolve({ status: res.statusCode, cuerpo: d }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

let n = 0;
async function emitir(tipo, objeto) {
  limpiar();
  const id = `evt_scrum1402g_${n++}_${crypto.randomBytes(3).toString('hex')}`;
  const payload = JSON.stringify({ id, type: tipo, data: { object: objeto } });
  const firma = firmador.webhooks.generateTestHeaderString({ payload, secret: WHSEC_JUGUETE });
  const avisos = []; const errores = []; const logs = [];
  const orig = { warn: console.warn, error: console.error, log: console.log };
  console.warn = (...a) => avisos.push(a.map(String).join(' '));
  console.error = (...a) => errores.push(a.map(String).join(' '));
  console.log = (...a) => logs.push(a.map(String).join(' '));
  try {
    const res = await pedir(payload, firma);
    await new Promise((r) => setImmediate(r));
    return {
      res, avisos, errores, logs,
      escrituras: visto.escrituras.map((e) => e.data),
      registro: visto.registro.map(([op, a]) => (op === 'create' ? 'abre' : Object.keys(a.data ?? {}).join('+'))),
      premios: visto.premios, correos: visto.correos,
    };
  } finally { Object.assign(console, orig); }
}

const METAS = [
  ['plan=pro (control)', { merchant_id: String(M), plan: 'pro' }],
  ['sin plan', { merchant_id: String(M) }],
  ['plan vacío', { merchant_id: String(M), plan: '' }],
  ['sin metadata', {}],
  ['plan sin merchant (control 0)', { plan: 'pro' }],
  // CONTROL DE VERSIÓN: distingue `main` de la rama de 1402e (#2782). Con un plan que no existe y un
  // impago, `main` no escribe nada y 1402e escribe `{ subscriptionStatus: 'past_due' }`. Si las dos
  // salidas coinciden en esta fila, la sonda no ha cargado el `dist` que dice.
  ['plan desconocido (control versión)', { merchant_id: String(M), plan: 'Equipo' }],
];
const ESTADOS = ['active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete_expired', 'incomplete', 'paused'];
const sub = (status, metadata) => ({
  id: 'sub_scrum1402g', object: 'subscription', status, metadata, customer: 'cus_scrum1402g',
  items: { data: [{ current_period_end: 1893456000 }] },
});

const filas = [];
const anotar = (tipo, estado, meta, r) => filas.push({ tipo, estado, meta, ...r });

for (const [nom, md] of METAS) {
  anotar('checkout.session.completed', 'mode=subscription', nom, await emitir('checkout.session.completed',
    { id: 'cs_scrum1402g', object: 'checkout.session', mode: 'subscription', customer: 'cus_scrum1402g', subscription: 'sub_scrum1402g', metadata: md }));
}
for (const tipo of ['customer.subscription.created', 'customer.subscription.updated']) {
  for (const st of ESTADOS) for (const [nom, md] of METAS) anotar(tipo, st, nom, await emitir(tipo, sub(st, md)));
}
for (const [nom, md] of METAS) anotar('customer.subscription.deleted', 'canceled', nom, await emitir('customer.subscription.deleted', sub('canceled', md)));
servidor.close();

// ── CONTROLES ──────────────────────────────────────────────────────────────────────────
const escribePro = (f) => f.escrituras.some((d) => d.plan === 'pro');
const debenEscribirPro = filas.filter((f) => f.meta.startsWith('plan=pro') && (f.tipo === 'checkout.session.completed'
  || ['active', 'trialing', 'past_due', 'unpaid'].includes(f.estado)));
const positivoVisto = debenEscribirPro.filter(escribePro).length;
const ceroRoto = filas.filter((f) => f.meta.startsWith('plan sin merchant') && f.escrituras.length > 0).length;

const corto = (s, k = 70) => (s.length > k ? s.slice(0, k) + '…' : s);
console.log(`SONDA 1402g · ${ETIQUETA} · ${filas.length} eventos firmados por la ruta montada`);
console.log('tipo | estado Stripe | metadata | HTTP | cuerpo | escrituras en Merchant | gateway_events | avisos | logs | premio | correo');
for (const f of filas) {
  console.log([
    f.tipo.replace('customer.subscription.', 'sub.'), f.estado, f.meta, f.res.status, f.res.cuerpo,
    f.escrituras.length ? f.escrituras.map((d) => JSON.stringify(d)).join(' ; ') : '—',
    f.registro.join(',') || '—',
    f.avisos.length ? `${f.avisos.length}: ${corto(f.avisos[0])}` : '0',
    f.logs.length ? `${f.logs.length}: ${corto(f.logs[0])}` : '0',
    f.premios, f.correos,
  ].join(' | '));
  for (const e of f.errores) console.log(`   error: ${corto(e, 200)}`);
}
console.log(`CONTROL POSITIVO (plan=pro escribe pro en las puertas que escriben): ${positivoVisto} de ${debenEscribirPro.length}`);
console.log(`CONTROL A CERO (plan sin merchant no escribe): ${ceroRoto} filas que escriben (tiene que ser 0)`);
const version = filas.filter((f) => f.meta.startsWith('plan desconocido') && ['past_due', 'unpaid'].includes(f.estado));
const marcaImpago = version.filter((f) => f.escrituras.some((d) => d.subscriptionStatus === 'past_due' && !('plan' in d))).length;
console.log(`CONTROL DE VERSIÓN (plan desconocido + impago escribe sólo past_due): ${marcaImpago} de ${version.length}`
  + ' — main da 0; la rama de 1402e da todas');
if (debenEscribirPro.length === 0 || positivoVisto !== debenEscribirPro.length) { console.log('VEREDICTO: CIEGA'); process.exit(2); }
if (ceroRoto !== 0) { console.log('VEREDICTO: BANCO QUE MIENTE'); process.exit(3); }
console.log('VEREDICTO: MIDE');
process.exit(0);
