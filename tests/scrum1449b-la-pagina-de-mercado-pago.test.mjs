// tests/scrum1449b-la-pagina-de-mercado-pago.test.mjs — SCRUM-1449b (carril J2)
//
// 🔴 EL CLIENTE FINAL LEÍA JERGA EN TEXTO PLANO. `GET /pay/mp/:token` contestaba el 503 con
// «Mercado Pago no está configurado para este merchant.» y el 502 con su frase, los dos sin página;
// y la página de resultado prometía «Te notificaremos pronto.», que se cumple en 3 de 12 casos
// (medido en SCRUM-1449, registro de J1). El fundador firmó los tres textos en Jira, c.18285.
//
// ── LOS LITERALES NO ESTÁN TECLEADOS AQUÍ ──────────────────────────────────────────────────
// Salen de `docs/master/evidencias/SCRUM-1449/firma-c18285.json`, los nodos ADF del comentario.
// Su cotejo contra los bytes del código anterior está en `procedencia.mjs` (al lado).
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Los handlers REALES de `dist/`, con la base doblada y `createMpPreference` doblado. Se lee lo
// que sale: estado HTTP, cabecera y cuerpo. Población: 4 casos de `GET /pay/mp/:token` (503, 502,
// redirección al pago y cobro ya pagado) y 1 de la página de resultado (pendiente).
//
// ⚠️ Lo que NO mide: si producción tiene `MP_ACCESS_TOKEN` (es una clave), ni cómo se ve en un
// navegador. Y que la decisión del 503/502 no cambió lo dicen los casos de redirección: con el
// token la ruta sigue mandando al pago, y sin él sigue sin llamar a Mercado Pago.
process.env.WHATSAPP_DRY_RUN = '1';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/billing/app/routes/payMp.routes.ts', de: "    res.setHeader('Content-Type', 'text/html; charset=utf-8');\n    return res.status(503)", a: '    return res.status(503)',
    cae: 'SCRUM-1449b · 🔴 sin token de Mercado Pago: 503 en página' },
  { fichero: 'src/modules/billing/app/routes/payMp.routes.ts', de: "    res.setHeader('Content-Type', 'text/html; charset=utf-8');\n    return res.status(502)", a: '    return res.status(502)',
    cae: 'SCRUM-1449b · 🔴 Mercado Pago no contesta: 502 en página' },
  { fichero: 'src/modules/billing/app/routes/payMp.routes.ts', de: 'res.status(503).send(avisoMpHtml(MSG_MP_NO_DISPONIBLE))', a: 'res.status(503).send(MSG_MP_NO_DISPONIBLE)',
    cae: 'SCRUM-1449b · 🔴 sin token de Mercado Pago: 503 en página' },
  { fichero: 'src/modules/billing/app/routes/payMp.routes.ts', de: "'Ahora mismo no se puede pagar con Mercado Pago. Contacta con el profesional.'", a: "'Mercado Pago no está configurado para este merchant.'",
    cae: 'SCRUM-1449b · 🔴 sin token de Mercado Pago: 503 en página' },
  { fichero: 'src/modules/billing/app/routes/payMp.routes.ts', de: "'Error al conectar con Mercado Pago. Inténtalo de nuevo.'", a: "'Error al conectar con Mercado Pago. Intentalo de nuevo.'",
    cae: 'SCRUM-1449b · 🔴 Mercado Pago no contesta: 502 en página' },
  { fichero: 'src/modules/billing/app/routes/payMp.routes.ts', de: "msg: 'Tu pago está siendo procesado.',", a: "msg: 'Tu pago está siendo procesado. Te notificaremos pronto.',",
    cae: 'SCRUM-1449b · 🔴 cobro pendiente: la página dice el recorte firmado' },
  { fichero: 'src/modules/billing/app/routes/payMp.routes.ts', de: '  if (!accessToken) {\n', a: '  if (!accessToken && false) {\n',
    cae: 'SCRUM-1449b · 🔴 sin token de Mercado Pago: 503 en página' },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const firma = JSON.parse(readFileSync(path.join(RAIZ, 'docs/master/evidencias/SCRUM-1449/firma-c18285.json'), 'utf8')).nodos;
const L503 = firma['503_blockquote'].content[0].content[0].text;
const L502 = /«([^»]+)»/.exec(firma['502_texto'].text)?.[1];
const LPENDIENTE = firma.pending_blockquote.content[0].content[0].text;

const banco = { cobro: null, mpFalla: false, preferencias: 0 };
function reiniciar(status = 'pending') {
  banco.mpFalla = false; banco.preferencias = 0;
  banco.cobro = {
    id: 2449, merchantId: 4449, customerId: 57, status, amount: '1419.87', currency: 'EUR', method: 'card',
    concept: 'Factura F260007', intentId: null, receiptToken: 'tok_1449b', reference: null,
    customer: { id: 57, name: 'Cliente de prueba', phone: null, mobile: null, email: null },
    merchant: { id: 4449, name: 'Taller de prueba' },
  };
}

const doble = dobleDeLaBase({
  'charge.findUnique': () => (banco.cobro ? { ...banco.cobro } : null),
  'charge.update': (a) => { Object.assign(banco.cobro, a?.data ?? {}); return { ...banco.cobro }; },
});
const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
const fMp = rutaDe('dist/integrations/mercadopago.js');
requiere.cache[fMp] = {
  id: fMp, filename: fMp, loaded: true,
  exports: {
    createMpPreference: async () => {
      banco.preferencias += 1;
      if (banco.mpFalla) throw new Error('ECONNRESET (doblado)');
      return { checkoutUrl: 'https://mp.invalid/checkout', preferenceId: 'pref_1449b' };
    },
  },
};

const { config } = requiere(rutaDe('dist/core/config/env.js'));
const handlerDe = (modulo, metodo, ruta) => {
  const m = requiere(rutaDe(modulo));
  const router = m.default || m;
  const capa = router.stack.find((l) => l.route?.path === ruta && l.route.methods[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en ${modulo}`);
  return capa.route.stack.at(-1).handle;
};
const pagarH = handlerDe('dist/modules/billing/app/routes/payMp.routes.js', 'get', '/mp/:token');
const resultadoH = handlerDe('dist/modules/billing/app/routes/payMp.routes.js', 'get', '/mp/:token/result');

async function llamar(handle, token) {
  const r = { status: 200, cuerpo: null, tipo: null, redirige: null };
  const res = {
    status(c) { r.status = c; return res; },
    send(x) { r.cuerpo = x; return res; },
    setHeader(k, v) { if (/content-type/i.test(k)) r.tipo = v; return res; },
    redirect(a, b) { r.redirige = b ?? a; r.status = b ? a : 302; return res; },
  };
  const antes = config.MP_ACCESS_TOKEN;
  const mudo = console.error; console.error = () => {};
  config.MP_ACCESS_TOKEN = token;
  try { await handle({ params: { token: 'tok_1449b' }, query: {}, headers: {} }, res, (e) => { if (e) throw e; }); }
  finally { config.MP_ACCESS_TOKEN = antes; console.error = mudo; }
  return r;
}

/** Es la página de la casa: HTML con su cabecera, y el literal firmado como titular. */
function esPaginaConTitular(r, literal) {
  assert.match(String(r.tipo), /^text\/html; charset=utf-8$/, `🔴 sin cabecera HTML (Content-Type «${r.tipo}»)`);
  assert.ok(typeof r.cuerpo === 'string' && /^<!doctype html>/i.test(r.cuerpo), `🔴 texto plano, no página: «${String(r.cuerpo).slice(0, 80)}»`);
  assert.equal((/<h1\b[^>]*>([^<]*)<\/h1>/.exec(r.cuerpo) || [])[1], literal);
  assert.ok(r.cuerpo.includes('href="/fonts/inter.css"'), '🔴 la página no carga la Inter de la casa');
}
const RELLENO = 'relleno-de-test'; // no es una credencial: Mercado Pago está doblado

test('SCRUM-1449b · los tres literales salen del comentario firmado (control del instrumento)', () => {
  assert.equal(typeof L503, 'string'); assert.ok(L503.length > 40, `🔴 CIEGO: 503 vacío «${L503}»`);
  assert.equal(typeof L502, 'string'); assert.ok(L502.includes('Mercado Pago'), `🔴 CIEGO: 502 «${L502}»`);
  assert.equal(typeof LPENDIENTE, 'string'); assert.ok(LPENDIENTE.endsWith('.'), `🔴 CIEGO: pendiente «${LPENDIENTE}»`);
});

test('SCRUM-1449b · 🔴 sin token de Mercado Pago: 503 en página, con el literal firmado y sin «merchant»', async () => {
  reiniciar();
  const r = await llamar(pagarH, '');
  assert.equal(r.status, 503);
  esPaginaConTitular(r, L503);
  assert.ok(!/merchant/i.test(r.cuerpo), '🔴 la página le enseña «merchant» al cliente final');
  assert.equal(banco.preferencias, 0, '🔴 sin token la ruta ha llamado a Mercado Pago: la decisión ha cambiado');
});

test('SCRUM-1449b · 🔴 Mercado Pago no contesta: 502 en página, con el texto de siempre', async () => {
  reiniciar(); banco.mpFalla = true;
  const r = await llamar(pagarH, RELLENO);
  assert.equal(r.status, 502);
  esPaginaConTitular(r, L502);
  assert.equal(banco.preferencias, 1);
});

test('SCRUM-1449b · con token y Mercado Pago contestando, la ruta sigue mandando al pago (la decisión no cambia)', async () => {
  reiniciar();
  const r = await llamar(pagarH, RELLENO);
  assert.equal(r.status, 302);
  assert.equal(r.redirige, 'https://mp.invalid/checkout');
});

test('SCRUM-1449b · un cobro ya pagado sigue yendo al resultado aprobado, tenga o no token', async () => {
  reiniciar('paid');
  const r = await llamar(pagarH, '');
  assert.equal(r.status, 302);
  assert.match(String(r.redirige), /\/pay\/mp\/tok_1449b\/result\?status=approved$/);
});

test('SCRUM-1449b · 🔴 cobro pendiente: la página dice el recorte firmado y no promete aviso', async () => {
  reiniciar('pending');
  const r = await llamar(resultadoH, RELLENO);
  assert.equal((/<p\b[^>]*>([^<]*)<\/p>/.exec(String(r.cuerpo)) || [])[1], LPENDIENTE);
  assert.ok(!r.cuerpo.includes('Te notificaremos'), '🔴 la página sigue prometiendo un aviso');
});
