// SCRUM-1868h · recorrido en STAGING, segunda parte: el estado «bloqueado por trabajos» de «Eliminar este cliente»
// (cuenta QA, comercio 2). Solo staging. Copiado de docs/master/evidencias/SCRUM-1868/staging-recorrido.mjs (jv-j2ft,
// 1868f) y adaptado; aquel no se toca.
//
// Uso, desde la raíz del árbol (con el `.env` del árbol):
//   node docs/master/evidencias/SCRUM-1868/staging-recorrido-h.mjs > <fuera del árbol>/salida.txt
//
// · El secreto de `POST /auth/test-login` se LEE del `.env` por código y ni él ni la cookie se imprimen ni se escriben.
// · Siembra por la UI el cliente «[QA-1868h] Cliente de pruebas» y UN trabajo suyo (Trabajos → «Nuevo trabajo»); no crea
//   presupuestos ni facturas. Si el cliente ya existe (una pasada anterior), lo reutiliza; si ya tiene trabajo, no crea otro.
// · Solo se pulsa «Eliminar» en un modal cuya fila dice «La ficha de [QA-…»: nunca se borra otro cliente.
// · Los literales se LEEN de la ficha de microcopy (docs/microcopy/2026-11-26-SCRUM-1868-eliminar-cliente.md).
//
// EL CONTADOR DE DELETE DE 1868f (daba 0 con dos borrados reales). Hipótesis: `public/sw.js` contesta a `/admin/*` con
// `fetch(event.request)` DESDE el service worker, y la intercepción de puppeteer de la PÁGINA no ve esas peticiones, así
// que ni el contador ni la cerradura (que vive en el mismo `page.on('request')`) las veían. Este guion lo MIDE antes de
// arreglarlo, sin escribir nada: fase «con-sw» (el SW controla la página) y fase «sin-sw» (`page.setBypassServiceWorker`).
// En cada una, dos sondas independientes de las peticiones a `/admin/`: lo que ve puppeteer y lo que la propia página
// apunta en Resource Timing; y una sonda SEMBRADA para la cerradura: un GET a una ruta que no existe y que casa con el
// patrón prohibido (`/qa-1868h-sonda/send-sonda`). Si la cerradura funciona, la corta (la página ve el fetch rechazado);
// si no, llega a staging y contesta lo que conteste una ruta inexistente. El arreglo queda puesto para todo el recorrido,
// y su comprobación es un borrado REAL de un segundo cliente sembrado, «[QA-1868h] Control del contador»: el contador
// tiene que decir 1 y `GET /admin/customers/<id>` → 404.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';

const BASE = 'https://yaqu-staging-production.up.railway.app';
if (!/^https:\/\/yaqu-staging-production\.up\.railway\.app$/.test(BASE)) throw new Error('solo staging');
const HOST = new URL(BASE).host;
const EMAIL = 'qa@staging.yaqu';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const CLIENTE = '[QA-1868h] Cliente de pruebas';
const CONTROL = '[QA-1868h] Control del contador';
const PROHIBIDAS = /\/(send-[^/?]*|resend-[^/?]*|confirm-bizum)(\/|\?|$)|\/auth\/logout/;
const SONDA = '/qa-1868h-sonda/send-sonda';
if (!PROHIBIDAS.test(SONDA)) throw new Error('la sonda de la cerradura no casa con el patrón prohibido');

// ── los literales, leídos de la ficha ─────────────────────────────────────────────────────────────
const FICHA = 'docs/microcopy/2026-11-26-SCRUM-1868-eliminar-cliente.md';
const fichaTxt = fs.readFileSync(FICHA, 'utf8');
const [aprob, retir] = fichaTxt.split('## Retirados');
const LIT = aprob.split('\n').filter((l) => l.startsWith('> ')).map((l) => l.slice(2).trim());
const RETIRADOS = [...(retir || '').matchAll(/~~(.+?)~~/g)].map((m) => m[1]);
const L = (empieza) => { const x = LIT.filter((s) => s.startsWith(empieza)); if (x.length !== 1) throw new Error(`ficha: «${empieza}» casa ${x.length} veces`); return x[0]; };
const LT = (exacto) => { if (!LIT.includes(exacto)) throw new Error(`ficha: sin «${exacto}»`); return exacto; };
const T = {
  boton: LT('Eliminar cliente'), filaFicha: L('La ficha de'), cancelar: LT('Cancelar'), confirmar: LT('Eliminar'),
  bloqueo: L('No se puede eliminar a {nombre}. Tiene {n}'), bloqueoTrabajos: L('No se puede eliminar a {nombre}. Tiene trabajos'),
  loImpide: LT('Lo que lo impide'), tiene_facturas: LT('Facturas emitidas'), tiene_presupuestos: LT('Presupuestos'),
  tiene_trabajos: LT('Trabajos'), tiene_partes: LT('Partes de trabajo'), tiene_mantenimientos: LT('Mantenimientos'),
  salida: L('Puedes fusionarlo'), enlaceFusion: LT('fusionarlo con otro cliente'), cerrar: LT('Cerrar'), exito: LT('Cliente eliminado'),
  nota: L('Este cliente no tiene'),
};

function secretoDelEnv() {
  const txt = fs.readFileSync('.env', 'utf8');
  const m = txt.match(/^E2E_TEST_LOGIN_SECRET=(.*)$/m);
  if (!m) throw new Error('sin E2E_TEST_LOGIN_SECRET en .env');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

const out = [];
const log = (s) => { out.push(s); console.log(s); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1 · login por fetch (UN intento) ───────────────────────────────────────────────────────────
const h = await fetch(BASE + '/version');
log(`staging /version = ${(await h.json()).version} · Date ${h.headers.get('date')}`);
log(`ficha de microcopy: ${LIT.length} literales aprobados · ${RETIRADOS.length} retirados`);
const l = await fetch(BASE + '/auth/test-login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, secret: secretoDelEnv() }),
});
const sc = (l.headers.getSetCookie ? l.headers.getSetCookie() : []).map((c) => c.split(';')[0]);
const sesion = sc.find((c) => c.startsWith('pf_session='));
log(`login ${l.status} · cookie pf_session ${sesion ? 'recibida' : 'NO recibida'} · Date ${l.headers.get('date')}`);
if (l.status !== 200 || !sesion) { log('CIEGO: sin sesión (un 404 no distingue flag, secreto o allowlist). PARO.'); process.exit(2); }
const api = async (ruta) => { const r = await fetch(BASE + ruta, { headers: { cookie: sesion } }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, j, date: r.headers.get('date') }; };

// ── 2 · lo que hay antes de empezar: los «[QA-…]» del comercio ──────────────────────────────────────
const lista = await api('/admin/customers');
if (lista.status !== 200 || !Array.isArray(lista.j)) { log(`CIEGO: GET /admin/customers → ${lista.status}. PARO.`); process.exit(2); }
const qaAntes = lista.j.filter((c) => /^\[QA-/.test(c.name || ''));
log(`GET /admin/customers → ${lista.status} · ${lista.j.length} clientes · «[QA-…]»: ${JSON.stringify(qaAntes.map((c) => ({ id: c.id, nombre: c.name })))} · Date ${lista.date}`);
const yaEstan = lista.j.filter((c) => c.name === CLIENTE);
if (yaEstan.length > 1) { log(`CIEGO: «${CLIENTE}» está ${yaEstan.length} veces; no sé cuál medir. PARO.`); process.exit(2); }
if (lista.j.some((c) => c.name === CONTROL)) { log(`CIEGO: «${CONTROL}» ya existe (pasada anterior a medias): el control del contador no sería limpio. PARO.`); process.exit(2); }

// ── 3 · navegador ────────────────────────────────────────────────────────────────────────────
const nav = await lanzarNavegador(puppeteer, { headless: 'new' });
if (!nav) { log('CIEGO: el navegador no arrancó'); process.exit(3); }
const page = await nav.newPage();
page.setDefaultTimeout(30000);
await page.evaluateOnNewDocument(() => { try { performance.setResourceTimingBufferSize(20000); } catch {} });
await page.setCookie({ name: 'pf_session', value: sesion.slice('pf_session='.length), domain: HOST, path: '/', httpOnly: true, secure: true });
await page.setRequestInterception(true);
let fase = 'arranque';
const vistas = []; const cortadas = []; const errores = []; const hosts = {}; const borrados = []; const escrituras = [];
let trabajoCreado = null;
page.on('request', (r) => {
  const u = new URL(r.url());
  hosts[u.host] = (hosts[u.host] || 0) + 1;
  if (u.host === HOST) vistas.push({ fase, m: r.method(), p: u.pathname });
  if (u.host === HOST && PROHIBIDAS.test(u.pathname)) { cortadas.push(`${fase} · ${r.method()} ${u.pathname}`); return r.abort(); }
  if (u.host === HOST && r.method() === 'DELETE') borrados.push(`${fase} · DELETE ${u.pathname}`);
  return r.continue();
});
page.on('response', async (r) => {
  const u = new URL(r.url());
  if (u.host !== HOST) return;
  const m = r.request().method();
  if (r.status() >= 400) errores.push(`${fase} · ${m} ${u.pathname} → ${r.status()}`);
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') escrituras.push(`${fase} · ${m} ${u.pathname} → ${r.status()} · Date ${r.headers().date}`);
  if (m === 'DELETE') borrados.push(`${fase} ·   → ${r.status()} · Date ${r.headers().date}`);
  if (m === 'POST' && u.pathname === '/admin/jobs' && r.status() < 300) {
    try { const j = await r.json(); trabajoCreado = { id: j.id, status: j.status ?? null, customerId: j.customerId ?? j.customer_id ?? j.customer?.id ?? null }; } catch {}
  }
});
const consola = [];
page.on('console', (m) => { if (m.type() === 'error') consola.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => consola.push('pageerror: ' + String(e.message).slice(0, 200)));
const dialogos = [];
page.on('dialog', async (d) => { dialogos.push({ tipo: d.type(), texto: d.message() }); await d.dismiss(); });

async function paso(nombre, fn) {
  try { return await fn(); } catch (e) {
    await page.screenshot({ path: path.join(DIR, `staging-h-fallo-${nombre}.png`) }).catch(() => {});
    throw new Error(`PASO «${nombre}»: ${e.message}`);
  }
}
const clicEn = (sel, texto) => page.evaluate((s, t) => {
  const n = [...document.querySelectorAll(s)].find((x) => !t || x.textContent.trim().startsWith(t));
  if (!n) return false; n.click(); return true;
}, sel, texto || null);
const animaciones = () => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null)))).catch(() => null);

const MODAL = '[data-rol="modal-borrar-cliente"] .modal';
const TARJETA = '[data-rol="borrar-cliente"]';
const medidas = {};
async function medir(estado, raizSel) {
  for (const ancho of [390, 1280]) {
    await page.setViewport({ width: ancho, height: 900 });
    await dormir(500);
    await page.evaluate((s) => { const n = document.querySelector(s); if (n) n.scrollIntoView({ block: 'center', behavior: 'instant' }); }, raizSel);
    await animaciones();
    await dormir(200);
    const m = await page.evaluate((s) => {
      const de = document.documentElement;
      const raiz = document.querySelector(s);
      if (!raiz) return { falta: true, scroll: de.scrollWidth, vista: de.clientWidth };
      const vis = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
      const inter = [...raiz.querySelectorAll('button, input, select, textarea, a[href]')].filter(vis);
      const pequenos = inter.map((n) => { const r = n.getBoundingClientRect(); return { q: (n.dataset.accion || n.textContent || '').trim().slice(0, 30), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; })
        .filter((x) => x.h < 44 || x.w < 44);
      const fuera = [...raiz.querySelectorAll('*')].filter((n) => vis(n) && n.getBoundingClientRect().right > window.innerWidth + 0.5).length;
      const botones = inter.filter((n) => n.tagName === 'BUTTON').map((n) => { const r = n.getBoundingClientRect(); return `${n.textContent.trim()}${n.disabled ? ' (desactivado)' : ''} ${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10}`; });
      const enlaces = inter.filter((n) => n.tagName === 'A').map((n) => { const r = n.getBoundingClientRect(); return `${n.textContent.trim()} ${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10}`; });
      const conf = raiz.querySelector('[data-accion="confirmar-borrado"]');
      const canc = raiz.querySelector('[data-accion="cancelar-borrado"]');
      const cer = raiz.querySelector('[data-accion="cerrar-borrado"]');
      return { scroll: de.scrollWidth, vista: de.clientWidth, interactivos: inter.length, pequenos, fuera, botones, enlaces, texto: raiz.innerText,
        confirmarVisible: !!conf && vis(conf) && !conf.hidden, cancelarVisible: !!canc && vis(canc) && !canc.hidden, cerrarVisible: !!cer && vis(cer) && !cer.hidden };
    }, raizSel);
    await page.screenshot({ path: path.join(DIR, `staging-${estado}-${ancho}.png`) });
    if (m.falta) { log(`${estado}@${ancho} · 🔴 sin ${raizSel} en pantalla`); continue; }
    log(`${estado}@${ancho} · scroll ${m.scroll}/${m.vista} · interactivos ${m.interactivos} · botones ${JSON.stringify(m.botones.join(' | '))} · enlaces ${JSON.stringify(m.enlaces.join(' | '))} · visibles: Eliminar ${m.confirmarVisible} · Cancelar ${m.cancelarVisible} · Cerrar ${m.cerrarVisible} · se salen ${m.fuera} · <44 (caja): ${JSON.stringify(m.pequenos)}`);
    log(`   texto[${estado}@${ancho}] = ${JSON.stringify(m.texto)}`);
    medidas[`${estado}@${ancho}`] = m;
  }
}
async function abrirFicha(id) {
  await page.evaluate((i) => window.renderAppView('customer-360', { customerId360: i }), id);
  await page.waitForFunction((s, i) => { const t = document.querySelector(s); return t && !t.dataset.visto && Number(window.appState?.customerId360) === i; }, {}, TARJETA, id);
  await page.evaluate((s) => { document.querySelector(s).dataset.visto = '1'; }, TARJETA);
}
async function abrirModal() {
  if (!(await clicEn(`${TARJETA} [data-accion="abrir-borrado"]`))) throw new Error('sin «Eliminar cliente» en la tarjeta');
  await page.waitForFunction((s) => { const m = document.querySelector(s); if (!m) return false;
    const conf = m.querySelector('[data-accion="confirmar-borrado"]'); const cer = m.querySelector('[data-accion="cerrar-borrado"]'); const av = m.querySelector('[data-rol="aviso-borrar"]');
    return (conf && !conf.disabled) || (cer && !cer.hidden) || (av && av.textContent.trim()); }, {}, MODAL);
}
const modalAbierto = () => page.evaluate((s) => !!document.querySelector(s), MODAL);
async function crearClientePorUI(nombre) {
  if (!(await clicEn('.nav-item[data-view="customers"]'))) throw new Error('sin «Clientes» en el menú');
  await page.waitForFunction(() => [...document.querySelectorAll('button.btn-primary')].some((x) => x.textContent.includes('Nuevo cliente')), { timeout: 15000 });
  if (!(await clicEn('button.btn-primary', 'Nuevo cliente'))) throw new Error('sin botón «Nuevo cliente»');
  await page.waitForSelector('input[name="name"]', { visible: true, timeout: 10000 });
  await page.evaluate((v) => { const i = [...document.querySelectorAll('input[name="name"]')].find((x) => x.offsetParent !== null); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, nombre);
  const ok = await page.evaluate(() => { const i = [...document.querySelectorAll('input[name="name"]')].find((x) => x.offsetParent !== null); const b = i.form?.querySelector('button[type="submit"]'); if (!b) return false; b.click(); return true; });
  if (!ok) throw new Error('sin «Guardar» en el alta de cliente');
  await page.waitForFunction((n) => document.querySelector('.c360-pestanas') || [...document.querySelectorAll('tr')].some((t) => t.textContent.includes(n)), { timeout: 20000 }, nombre);
  if (!(await page.$('.c360-pestanas'))) {
    const abierta = await page.evaluate((n) => { const t = [...document.querySelectorAll('tr')].find((x) => x.textContent.includes(n)); if (!t) return false; t.click(); return true; }, nombre);
    if (!abierta) throw new Error('el cliente nuevo no aparece en la lista');
  }
  await page.waitForSelector(TARJETA, { timeout: 20000 });
  const id = await page.evaluate(() => Number(window.appState?.customerId360) || null);
  await page.evaluate((s) => { document.querySelector(s).dataset.visto = '1'; }, TARJETA);
  return id;
}
async function borrarQA(id, nombreEsperado) {
  await abrirFicha(id);
  await abrirModal();
  const fila = await page.evaluate((s) => document.querySelector(s).innerText, MODAL);
  if (!fila.includes(`La ficha de ${nombreEsperado}`) || !nombreEsperado.startsWith('[QA-')) throw new Error(`el modal no es el de «${nombreEsperado}»: no se pulsa`);
  const listo = await page.evaluate((s) => { const b = document.querySelector(s + ' [data-accion="confirmar-borrado"]'); return !!b && !b.disabled; }, MODAL);
  if (!listo) throw new Error(`«Eliminar» desactivado para «${nombreEsperado}»: texto ${JSON.stringify(fila)}`);
  await page.evaluate((s) => document.querySelector(s + ' [data-accion="confirmar-borrado"]').click(), MODAL);
  const toast = await page.waitForFunction((t) => { const n = [...document.querySelectorAll('body *')].find((x) => x.children.length === 0 && x.textContent.trim() === t); return n ? `${n.tagName.toLowerCase()}.${n.className}` : false; }, { timeout: 15000 }, T.exito).then((x) => x.jsonValue());
  const vista = await page.waitForFunction((s) => !document.querySelector(s) && [...document.querySelectorAll('button.btn-primary')].some((x) => x.textContent.includes('Nuevo cliente')), { timeout: 15000 }, TARJETA)
    .then(() => 'lista de clientes (botón «Nuevo cliente» y sin tarjeta)').catch(() => 'NO volvió a la lista en 15 s');
  return { toast, vista };
}

// Las dos sondas de una fase: lo que ve puppeteer y lo que apunta la página (Resource Timing), y la cerradura.
async function sondasDeFase() {
  const controlado = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
  if (!(await clicEn('.nav-item[data-view="customers"]'))) throw new Error('sin «Clientes» en el menú');
  await page.waitForFunction(() => [...document.querySelectorAll('button.btn-primary')].some((x) => x.textContent.includes('Nuevo cliente')), { timeout: 15000 });
  await dormir(1500);
  const pagina = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => new URL(e.name).pathname).filter((p) => p.startsWith('/admin/')));
  const pup = vistas.filter((v) => v.fase === fase && v.p.startsWith('/admin/'));
  const cortadasAntes = cortadas.length;
  const sonda = await page.evaluate(async (u) => { try { const r = await fetch(u, { cache: 'no-store' }); return `llegó a staging: ${r.status}`; } catch (e) { return `rechazada en el navegador (${e.name})`; } }, SONDA);
  await dormir(300);
  log(`fase «${fase}» · SW controla la página: ${controlado} · peticiones a /admin/: puppeteer ve ${pup.length} · la página apunta ${pagina.length} (de ellas GET /admin/customers: puppeteer ${pup.filter((v) => v.p === '/admin/customers').length}, página ${pagina.filter((p) => p === '/admin/customers').length})`);
  log(`   sonda de la cerradura GET ${SONDA}: ${sonda} · cortadas por la cerradura en esta fase: ${cortadas.length - cortadasAntes}`);
  return { controlado, pup: pup.length, pagina: pagina.length, sonda, cortadas: cortadas.length - cortadasAntes };
}

let fallo = null;
let idQA = yaEstan[0]?.id ?? null;
let idControl = null;
const diag = {};
let previaQA = null;
try {
  await page.setViewport({ width: 1280, height: 900 });
  // ⓪ el contador, medido antes de arreglarlo (solo lectura: GET y la sonda a una ruta que no existe)
  await paso('diagnostico-con-sw', async () => {
    fase = 'carga-1';
    const r = await page.goto(BASE + '/dashboard/', { waitUntil: 'networkidle2', timeout: 60000 });
    log(`GET /dashboard/ → ${r.status()} · url final ${new URL(page.url()).pathname}`);
    const listo = await page.evaluate(() => (navigator.serviceWorker ? Promise.race([navigator.serviceWorker.ready.then(() => 'listo'), new Promise((s) => setTimeout(() => s('no listo en 10 s'), 10000))]) : 'sin navigator.serviceWorker'));
    log(`service worker tras la primera carga: ${listo}`);
    fase = 'con-sw';
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.nav-item[data-view="customers"]');
    log(`window.appUserRole = ${await page.evaluate(() => window.appUserRole || null)}`);
    diag.conSw = await sondasDeFase();
  });
  await paso('diagnostico-sin-sw', async () => {
    await page.setBypassServiceWorker(true);
    fase = 'sin-sw';
    await page.goto(BASE + '/dashboard/', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.nav-item[data-view="customers"]');
    diag.sinSw = await sondasDeFase();
  });
  fase = 'recorrido';
  // ① el cliente QA, por la UI (o el de una pasada anterior)
  await paso('crear-cliente', async () => {
    if (idQA) { log(`① «${CLIENTE}» ya existía (pasada anterior): id ${idQA}; no se crea otro`); return; }
    idQA = await crearClientePorUI(CLIENTE);
    log(`① cliente «${CLIENTE}» creado por la UI · id ${idQA}`);
  });
  // ①bis su trabajo, por la UI de Trabajos («Nuevo trabajo» → elegir cliente → «Abrir trabajo»)
  await paso('crear-trabajo', async () => {
    const pre = await api(`/admin/customers/${idQA}/borrado-previa`);
    log(`   previa del QA antes del trabajo → ${pre.status} · ${JSON.stringify(pre.j)}`);
    if ((pre.j?.cuenta?.trabajos || 0) >= 1) { log('①bis el QA ya tiene trabajo (pasada anterior): no se crea otro'); return; }
    if (!(await clicEn('.nav-item[data-view="jobs"]'))) throw new Error('sin «Trabajos» en el menú');
    await page.waitForSelector('#jobs-nuevo-btn', { visible: true, timeout: 15000 });
    const rotulo = await page.$eval('#jobs-nuevo-btn', (b) => b.textContent.trim());
    await page.evaluate(() => document.querySelector('#jobs-nuevo-btn').click());
    await page.waitForFunction((i) => !!document.querySelector(`#tn-cliente option[value="${i}"]`), { timeout: 15000 }, idQA);
    const etiquetas = await page.evaluate(() => [...document.querySelectorAll('.modal-overlay label')].map((x) => x.textContent.trim()));
    await page.evaluate((i) => { const s = document.querySelector('#tn-cliente'); s.value = String(i); s.dispatchEvent(new Event('change', { bubbles: true })); }, idQA);
    const elegido = await page.evaluate(() => { const s = document.querySelector('#tn-cliente'); return s.options[s.selectedIndex]?.textContent || null; });
    if (elegido !== CLIENTE) throw new Error(`el desplegable eligió «${elegido}», no el QA: no se pulsa`);
    const boton = await page.$eval('#tn-crear', (b) => b.textContent.trim());
    await page.evaluate(() => document.querySelector('#tn-crear').click());
    const salio = await page.waitForFunction(() => !document.querySelector('#tn-crear'), { timeout: 20000 }).then(() => true).catch(() => false);
    if (!salio) { const a = await page.evaluate(() => document.querySelector('#tn-alert')?.textContent || ''); throw new Error(`el modal de trabajo no se cerró · alerta «${a}»`); }
    await dormir(800);
    log(`①bis trabajo creado por la UI: botón «${rotulo}» → modal (campos ${JSON.stringify(etiquetas)}) → cliente «${elegido}» → «${boton}» · respuesta ${JSON.stringify(trabajoCreado)}`);
  });
  // ② servidor antes que pantalla
  await paso('previa', async () => {
    const p = await api(`/admin/customers/${idQA}/borrado-previa`);
    previaQA = p.j;
    log(`② GET /admin/customers/${idQA}/borrado-previa → ${p.status} · ${JSON.stringify(p.j)} · Date ${p.date}`);
    const c = p.j?.cuenta || {};
    const esperado = p.j?.bloqueado === true && JSON.stringify(p.j?.motivos) === '["tiene_trabajos"]' && c.trabajos === 1
      && !c.facturas && !c.presupuestos && !c.partes && !c.mantenimientos;
    log(`   ¿bloqueado, motivos = ["tiene_trabajos"], cuenta.trabajos = 1 y facturas, presupuestos, partes y mantenimientos a 0? ${esperado}`);
    if (trabajoCreado?.id) { const j = await api(`/admin/jobs/${trabajoCreado.id}`); log(`   GET /admin/jobs/${trabajoCreado.id} → ${j.status} · status ${j.j?.status ?? '?'}`); }
  });
  // ③ pantalla: ficha → tarjeta → «Eliminar cliente» → modal bloqueado por trabajos
  await paso('bloqueado-trabajos', async () => {
    await page.setViewport({ width: 1280, height: 900 });
    await abrirFicha(idQA); await abrirModal();
    await medir('bloqueado-trabajos', MODAL);
    await clicEn(`${MODAL} [data-accion="cerrar-borrado"]`);
    await dormir(300);
    const g = await api(`/admin/customers/${idQA}`);
    log(`③ tras «Cerrar»: modal abierto ${await modalAbierto()} · GET /admin/customers/${idQA} → ${g.status}`);
  });
  // ④ deshacer la siembra: ¿deja la UI borrar el trabajo? (si este paso falla se dice y se sigue: el ⑤ no depende de él)
  await paso('borrar-trabajo', async () => {
    const jobId = trabajoCreado?.id;
    if (!jobId) { log('④ sin id del trabajo (no se creó en esta pasada): no se busca su borrado en la UI'); return; }
    await page.evaluate((i) => window.renderAppView('jobs-detail', { jobId: i }), jobId);
    await page.waitForFunction((n) => document.body.innerText.includes(n), { timeout: 20000 }, CLIENTE);
    await dormir(1000);
    const b = await page.evaluate(() => {
      const todos = [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"]')];
      const casa = (n) => /elimin|borr|suprim/i.test(n.textContent || '') || /elimin|borr|delete|suprim/i.test(n.dataset?.accion || '') || /elimin|borr|delete/i.test(n.getAttribute('aria-label') || '');
      return { total: todos.length, casan: todos.filter(casa).map((n) => `${n.tagName.toLowerCase()} «${(n.textContent || '').trim().slice(0, 40)}» ${n.dataset?.accion || ''}`) };
    });
    log(`④ ficha del trabajo ${jobId}: ${b.total} botones/enlaces en el DOM · los que dicen eliminar/borrar/suprimir: ${b.casan.length} ${JSON.stringify(b.casan)}`);
  }).catch((e) => log(`④ 🔴 NO medido: ${e.message}`));
  // ⑤ el arreglo del contador, comprobado con un borrado REAL de un segundo QA sembrado
  await paso('control-del-contador', async () => {
    await page.setViewport({ width: 1280, height: 900 });
    const antes = borrados.filter((x) => x.startsWith('recorrido · DELETE')).length;
    idControl = await crearClientePorUI(CONTROL);
    log(`⑤ «${CONTROL}» creado por la UI · id ${idControl} · DELETE vistos en el recorrido hasta aquí: ${antes}`);
    const r = await borrarQA(idControl, CONTROL);
    await dormir(500);
    const g = await api(`/admin/customers/${idControl}`);
    const vistos = borrados.filter((x) => x.startsWith('recorrido · DELETE'));
    log(`   «Eliminar» pulsado · toast «${T.exito}» en ${r.toast} · ${r.vista} · GET /admin/customers/${idControl} → ${g.status} · Date ${g.date}`);
    log(`   contador de DELETE del recorrido: ${vistos.length} ${JSON.stringify(vistos)} · ¿es 1 y es DELETE /admin/customers/${idControl}? ${vistos.length === 1 && vistos[0].endsWith(`DELETE /admin/customers/${idControl}`)}`);
  });
} catch (e) {
  fallo = e.message;
  log('🔴 ' + fallo);
}

// ── cotejo de textos: lo VISTO (innerText a 1280 y a 390) contra la ficha ────────────────────────
const coteja = [];
for (const ancho of [1280, 390]) {
  const m = medidas[`bloqueado-trabajos@${ancho}`];
  if (!m) continue;
  const e = `bloqueado-trabajos@${ancho}`;
  const ver = (clave, literal) => coteja.push([e, clave, literal, m.texto.includes(literal)]);
  const noVer = (clave, literal) => coteja.push([e, `NO ${clave}`, literal, !!m.texto && !m.texto.includes(literal)]);
  ver('titulo', T.boton);
  ver('alerta', T.bloqueoTrabajos.replace('{nombre}', CLIENTE));
  ver('loImpide', T.loImpide);
  ver('fila tiene_trabajos', `${T.tiene_trabajos}\t1`);
  ver('salida', T.salida);
  ver('cerrar', T.cerrar);
  noVer('alerta de facturas', 'factura emitida no se borra');
  for (const k of ['tiene_facturas', 'tiene_partes', 'tiene_mantenimientos']) noVer(`fila ${k}`, `${T[k]}\t`);
  noVer('fila tiene_presupuestos', `${T.tiene_presupuestos}\t`);
  noVer('nota de «se puede eliminar»', T.nota);
  for (const r of RETIRADOS) noVer('retirado', r);
  coteja.push([e, 'solo «Cerrar» (Eliminar y Cancelar no visibles)', '-', m.cerrarVisible && !m.confirmarVisible && !m.cancelarVisible]);
}
const ok = coteja.filter((c) => c[3]).length;
log(`cotejo con la ficha: ${ok} de ${coteja.length} comprobaciones casan (sobre ${LIT.length} literales de la ficha)`);
for (const [e, k, lit, v] of coteja) if (!v) log(`   NO casa: ${e} · ${k} = ${JSON.stringify(lit)}`);

// ── el estado final ──────────────────────────────────────────────────────────────────────────────
if (idQA) { const p = await api(`/admin/customers/${idQA}/borrado-previa`); log(`final · «${CLIENTE}» id ${idQA}: previa → ${p.status} · ${JSON.stringify(p.j)}`); }
const lista2 = await api('/admin/customers');
log(`final · «[QA-…]» en el comercio: ${JSON.stringify((Array.isArray(lista2.j) ? lista2.j : []).filter((c) => /^\[QA-/.test(c.name || '')).map((c) => ({ id: c.id, nombre: c.name })))}`);
log(`diagnóstico del contador: ${JSON.stringify(diag)}`);
log(`DELETE emitidos por el navegador (todas las fases): ${JSON.stringify(borrados)}`);
log(`escrituras (no GET) que vio el navegador: ${escrituras.length} ${JSON.stringify(escrituras)}`);
log(`diálogos: ${JSON.stringify(dialogos)}`);
log(`peticiones cortadas por la cerradura (send-*/resend-*/confirm-bizum/logout): ${cortadas.length} ${JSON.stringify(cortadas)}`);
log(`respuestas >= 400 de staging: ${errores.length} ${JSON.stringify(errores)}`);
log(`errores de consola: ${consola.length} ${JSON.stringify(consola)}`);
log(`hosts pedidos: ${JSON.stringify(hosts)} · peticiones a staging que vio puppeteer por fase: ${JSON.stringify(vistas.reduce((a, v) => ((a[v.fase] = (a[v.fase] || 0) + 1), a), {}))}`);
await nav.close();
const d = await fetch(BASE + '/version');
log(`fin · staging /version = ${(await d.json()).version} · Date ${d.headers.get('date')} · ${fallo ? 'CON FALLO' : 'completo'}`);
process.exit(fallo ? 1 : 0);
