#!/usr/bin/env node
// scripts/guard-firma-con-tramos.mjs — SCRUM-892
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA FIRMA DE «3 OPCIONES», DIBUJADA EN UN NAVEGADOR DE VERDAD.
//
// En «3 opciones» el bloque de firma nace oculto (`display:none` hasta que la cliente elige). El
// lienzo se dimensionaba al cargar, medía 0×0 y se quedaba así: la cliente dibujaba sin ver nada y
// se enviaba `data:,`. Medido en staging (SCRUM-882b) y en local con el código de entonces:
//
//   tramos · al mostrarse: interno 0x0 · pantalla 304x150 · envía «data:,» (6 caracteres)
//   normal · al mostrarse: interno 304x150 · pantalla 304x150 · envía un PNG de 5.770
//
// Esto solo se ve con layout real: un lienzo oculto mide 0 porque el navegador no lo pinta. Por
// eso vive fuera de `npm test`, como el resto de guards de navegador. La red que SÍ corre siempre
// es `tests/scrum892-firma-vacia.test.mjs`: el servidor rechaza la firma sin trazo aunque este
// guard no corra.
//
// Qué se hace: se renderiza la página de aceptación con la RUTA REAL compilada (Prisma doblado,
// sin base), se sirve en local y se abre a 390 px táctil con densidad 1 y 3. Se elige opción, se
// dibuja con el ratón, se pulsa aceptar y se intercepta el envío. Lo que se envía se juzga con
// `firmaTieneTrazo`, el mismo criterio que usa el servidor.
//
// SUELO: el modo normal es el CONTROL. Si en modo normal tampoco sale una firma con trazo, el
// instrumento no está dibujando y el guard dice que NO SUPO MIRAR, no que «3 opciones» esté bien.
import http from 'node:http';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';
import { firmaTieneTrazo } from '../dist/modules/quotes/domain/firmaConTrazo.js';
import { prisma } from '../dist/core/db/prisma.js';
import { quoteDecisionLandingRouter } from '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';

let PUERTO = Number(process.env.FIRMA_TRAMOS_PUERTO || 0);
const TOKEN = 'a'.repeat(32);

const TRAMOS = [
  { id: 'good', label: 'Básico', recommended: false, description: 'A', lines: [{ concept: 'Cuadro', qty: 1, price: 380, tax: 0 }], total: 380 },
  { id: 'better', label: 'Estándar', recommended: true, description: 'B', lines: [{ concept: 'Cuadro', qty: 1, price: 590, tax: 0 }], total: 590 },
  { id: 'best', label: 'Premium', recommended: false, description: 'C', lines: [{ concept: 'Cuadro', qty: 1, price: 890, tax: 0 }], total: 890 },
];

function presupuesto(tiers) {
  return {
    id: 7, quoteNumber: 7, merchantId: 7, status: 'sent', currency: 'EUR', total: 590,
    lines: [{ concept: 'Cuadro', qty: 1, price: 590, tax: 0 }], tiers, paymentTerms: 'FULL_UPFRONT',
    validUntil: new Date(Date.now() + 30 * 864e5), decisionToken: TOKEN,
    discountGlobalAmount: null, billingPlan: null, customBillingPlan: null,
    merchant: { name: 'QA', country: 'ES', timezone: 'Europe/Madrid' }, customer: { name: 'Cliente QA' },
  };
}

/** El HTML que sirve HOY `GET /pay/quote/:token`, sacado del handler compilado. */
async function paginaDeAceptacion(tiers) {
  prisma.quote = { findUnique: async () => presupuesto(tiers), findFirst: async () => presupuesto(tiers) };
  const capa = quoteDecisionLandingRouter.stack.find((l) => [].concat(l.route?.path).includes('/quote/:token'));
  if (!capa) throw new Error('no encuentro GET /quote/:token en quoteDecisionLanding.routes');
  let html = null;
  const res = { setHeader() { return this; }, status() { return this; }, send(b) { html = b; return this; }, json(b) { html = JSON.stringify(b); return this; } };
  await capa.route.stack[capa.route.stack.length - 1].handle({ params: { token: TOKEN }, query: {}, headers: {} }, res, () => {});
  if (typeof html !== 'string' || !html.includes('sig-canvas')) throw new Error('la página renderizada no trae el lienzo de firma');
  return html;
}

const CASOS = [];
for (const modo of ['normal', 'tramos']) for (const dpr of [1, 3]) CASOS.push({ modo, dpr });

const paginas = { normal: await paginaDeAceptacion(null), tramos: await paginaDeAceptacion(TRAMOS) };
const srv = http.createServer((req, res) => {
  const pagina = paginas[req.url.replace(/^\//, '')];
  if (!pagina) { res.writeHead(404); return res.end(''); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(pagina);
});
PUERTO = await levantarServidor(srv, PUERTO);

const filas = [];
const ciegos = [];
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const caso of CASOS) {
    const pag = await navegador.newPage();
    await pag.emulate({ userAgent: 'scrum892', viewport: { width: 390, height: 844, deviceScaleFactor: caso.dpr, isMobile: true, hasTouch: true } });
    const errores = [];
    pag.on('pageerror', (e) => errores.push(String(e.message || e)));
    let enviado = null;
    await pag.setRequestInterception(true);
    pag.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/decision')) {
        try { enviado = JSON.parse(r.postData() || '{}'); } catch { enviado = {}; }
        return r.respond({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      }
      return r.continue();
    });
    await pag.goto(`http://127.0.0.1:${PUERTO}/${caso.modo}`, { waitUntil: 'load' });
    if (caso.modo === 'tramos') {
      await pag.$eval('.btn-tier', (b) => b.click());
      await new Promise((ok) => setTimeout(ok, 900));
    }
    const lienzo = await pag.$eval('#sig-canvas', (c) => {
      const r = c.getBoundingClientRect();
      return { ancho: c.width, alto: c.height, anchoPantalla: Math.round(r.width), altoPantalla: Math.round(r.height), dpr: globalThis.devicePixelRatio };
    });
    const caja = await (await pag.$('#sig-canvas')).boundingBox();
    if (!caja || caja.width < 10) {
      ciegos.push(`${caso.modo} · densidad ${caso.dpr} → el lienzo no está a la vista (caja ${JSON.stringify(caja)})`);
      await pag.close();
      continue;
    }
    await pag.mouse.move(caja.x + 40, caja.y + 80);
    await pag.mouse.down();
    for (let i = 0; i < 20; i++) await pag.mouse.move(caja.x + 40 + i * 12, caja.y + 80 + Math.sin(i / 2) * 30, { steps: 2 });
    await pag.mouse.up();
    await pag.$eval('#btn-accept', (b) => b.click());
    await new Promise((ok) => setTimeout(ok, 800));
    await pag.close();
    const firma = enviado ? enviado.signatureData : undefined;
    filas.push({ caso, lienzo, llegoAEnviar: !!enviado, largo: typeof firma === 'string' ? firma.length : null, conTrazo: firmaTieneTrazo(firma), errores });
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log('');
console.log('  SCRUM-892 · LA FIRMA DIBUJADA A 390 px, POR MODO Y DENSIDAD');
console.log('  ' + '─'.repeat(100));
for (const f of filas) {
  const l = f.lienzo;
  console.log(`  ${f.conTrazo ? '✔' : '🔴'} ${f.caso.modo.padEnd(6)} · densidad ${f.caso.dpr} · lienzo interno ${l.ancho}×${l.alto} · en pantalla ${l.anchoPantalla}×${l.altoPantalla}`
    + ` · ${f.llegoAEnviar ? `envía ${f.largo ?? '—'} caracteres, ${f.conTrazo ? 'con trazo' : 'SIN trazo'}` : 'NO LLEGÓ A ENVIAR'}`
    + (f.errores.length ? ` · errores: ${f.errores.join(' | ')}` : ''));
}
console.log('  ' + '─'.repeat(100));

const controles = filas.filter((f) => f.caso.modo === 'normal');
for (const f of filas) {
  if (!f.llegoAEnviar) ciegos.push(`${f.caso.modo} · densidad ${f.caso.dpr} → pulsar «aceptar» no llegó a enviar nada`);
}
if (controles.length < 2 || controles.some((f) => !f.conTrazo)) {
  ciegos.push('el CONTROL (modo normal) no produce una firma con trazo: el instrumento no está dibujando');
}
if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MIRAR — esto NO es «la firma de 3 opciones funciona»:\n');
  for (const c of [...new Set(ciegos)]) console.error('     · ' + c);
  process.exit(1);
}

const malas = filas.filter((f) => f.caso.modo === 'tramos' && (!f.conTrazo || f.errores.length
  || f.lienzo.ancho !== Math.round(f.lienzo.anchoPantalla * f.lienzo.dpr)));
if (malas.length) {
  console.error(`\n  🔴 «3 OPCIONES»: LA CLIENTE DIBUJA Y NO QUEDA FIRMA (${malas.length} de ${filas.length - controles.length}).\n`);
  console.error('  El bloque de firma nace oculto y el lienzo no toma tamaño al mostrarse. El modo normal,');
  console.error('  con el mismo lienzo y el mismo trazo, sí firma: la diferencia es cuándo se mide.');
  console.error('  Mira `resize()` y su ResizeObserver en `quoteDecisionLanding.routes.ts` (SIG_JS).\n');
  process.exit(1);
}

console.log('\n  ✔ «3 opciones» firma igual que el modo normal: el lienzo toma su tamaño al mostrarse y lo');
console.log('    que se envía tiene trazo, a densidad 1 y 3. El modo normal hizo de control.\n');
