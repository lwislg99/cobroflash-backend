// SCRUM-1868f · recorrido en STAGING de la tarjeta «Eliminar este cliente» (cuenta QA, comercio 2). Solo staging.
// Copiado de docs/master/evidencias/SCRUM-1833/staging-recorrido.mjs (jv-j2fi, 1833e) y adaptado; aquel no se toca.
//
// Uso, desde la raíz del árbol (con el `.env` del árbol):
//   node docs/master/evidencias/SCRUM-1868/staging-recorrido.mjs > <fuera del árbol>/salida.txt
//
// · El secreto de `POST /auth/test-login` se LEE del `.env` por código y ni él ni la cookie se imprimen ni se escriben.
// · Se niega a correr si la URL no es la de staging, y CORTA en el navegador cualquier petición a
//   `send-*`, `resend-*`, `confirm-bizum` o `/auth/logout` (las cuenta: tienen que salir 0).
// · Los clics van por `el.click()` en la página: `html { scroll-behavior: smooth }` cuelga el `click()` de puppeteer.
// · Solo se pulsa «Eliminar» en un modal cuya fila dice «La ficha de [QA-…»: nunca se borra otro cliente.
// · Los literales se LEEN de la ficha de microcopy (docs/microcopy/2026-11-26-SCRUM-1868-eliminar-cliente.md), no se
//   copian aquí: lo visto se coteja contra ella. Los nombres de los clientes (a) y (b) no salen: van como «{nombre}».
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
const CLIENTE = '[QA-1868f] Cliente de pruebas';
const CLIENTE_1833 = '[QA-1833e] Cliente de pruebas';
const PROHIBIDAS = /\/(send-[^/?]*|resend-[^/?]*|confirm-bizum)(\/|\?|$)|\/auth\/logout/;

// ── los literales, leídos de la ficha ─────────────────────────────────────────────────────────────
const FICHA = 'docs/microcopy/2026-11-26-SCRUM-1868-eliminar-cliente.md';
const fichaTxt = fs.readFileSync(FICHA, 'utf8');
const [aprob, retir] = fichaTxt.split('## Retirados');
const LIT = aprob.split('\n').filter((l) => l.startsWith('> ')).map((l) => l.slice(2).trim());
const RETIRADOS = [...(retir || '').matchAll(/~~(.+?)~~/g)].map((m) => m[1]);
const L = (empieza) => { const x = LIT.filter((s) => s.startsWith(empieza)); if (x.length !== 1) throw new Error(`ficha: «${empieza}» casa ${x.length} veces`); return x[0]; };
const LT = (exacto) => { if (!LIT.includes(exacto)) throw new Error(`ficha: sin «${exacto}»`); return exacto; };
const T = {
  tarjetaTitulo: LT('Eliminar este cliente'), tarjetaTexto: L('Se borra su ficha'), soloAdmin: L('Solo lo ve'),
  boton: LT('Eliminar cliente'), subtitulo: L('Revisa lo que'), seBorra: LT('Se borra'), filaFicha: L('La ficha de'),
  documentos: LT('Documentos adjuntos'), sitios: LT('Sitios'), equipos: LT('Equipos'), historial: LT('Historial de actividad'),
  solicitudes: LT('Solicitudes de presupuesto'), nota: L('Este cliente no tiene'), irreversible: LT('Esto no se puede deshacer.'),
  cancelar: LT('Cancelar'), confirmar: LT('Eliminar'), bloqueo: L('No se puede eliminar a {nombre}. Tiene {n}'),
  bloqueoTrabajos: L('No se puede eliminar a {nombre}. Tiene trabajos'), loImpide: LT('Lo que lo impide'),
  tiene_facturas: LT('Facturas emitidas'), tiene_presupuestos: LT('Presupuestos'), tiene_trabajos: LT('Trabajos'),
  tiene_partes: LT('Partes de trabajo'), tiene_mantenimientos: LT('Mantenimientos'), salida: L('Puedes fusionarlo'),
  cerrar: LT('Cerrar'), exito: LT('Cliente eliminado'),
};
const CUENTA = { tiene_facturas: 'facturas', tiene_presupuestos: 'presupuestos', tiene_trabajos: 'trabajos', tiene_partes: 'partes', tiene_mantenimientos: 'mantenimientos' };
// La derivación que declara la ficha («singular, plural y solo una de las dos, sin palabras nuevas»), escrita aquí
// desde la ficha y no copiada del código: si las dos discrepan, el cotejo lo dice.
function alertaEsperada(motivos, c) {
  const n = motivos.includes('tiene_facturas') ? c.facturas : 0;
  const m = motivos.includes('tiene_presupuestos') ? c.presupuestos : 0;
  if (!n && !m) return T.bloqueoTrabajos;
  let t = T.bloqueo;
  if (n === 1) t = t.replace('{n} facturas emitidas', '1 factura emitida');
  if (m === 1) t = t.replace('{m} presupuestos', '1 presupuesto');
  if (!m) t = t.replace(' y {m} presupuestos', '');
  if (!n) t = t.replace('{n} facturas emitidas y ', '').replace(', y una factura emitida no se borra.', '.');
  return t.replace('{n}', String(n)).replace('{m}', String(m));
}

function secretoDelEnv() {
  const txt = fs.readFileSync('.env', 'utf8');
  const m = txt.match(/^E2E_TEST_LOGIN_SECRET=(.*)$/m);
  if (!m) throw new Error('sin E2E_TEST_LOGIN_SECRET en .env');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

const out = [];
const log = (s) => { out.push(s); console.log(s); };
const NOMBRES = []; // nombres de (a) y (b): se sustituyen por «{nombre}» en todo lo que se imprime
const tapa = (s) => NOMBRES.reduce((acc, n) => (n ? acc.split(n).join('{nombre}') : acc), String(s));

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

// ── 2 · servidor antes que pantalla: la previa de cada cliente del comercio ───────────────────────
const lista = await api('/admin/customers');
if (lista.status !== 200 || !Array.isArray(lista.j)) { log(`CIEGO: GET /admin/customers → ${lista.status}. PARO.`); process.exit(2); }
log(`GET /admin/customers → ${lista.status} · ${lista.j.length} clientes · Date ${lista.date}`);
const previas = [];
for (const c of lista.j) { const p = await api(`/admin/customers/${c.id}/borrado-previa`); previas.push({ id: c.id, name: c.name, status: p.status, p: p.j }); }
const clase = (x) => {
  if (x.status !== 200 || !x.p) return `http ${x.status}`;
  if (!x.p.bloqueado) return 'libre';
  const mo = x.p.motivos || [];
  if (mo.includes('tiene_facturas') || mo.includes('tiene_presupuestos')) return 'bloqueado-facturas-o-presupuestos';
  return 'bloqueado-solo-trabajos-partes-mantenimientos';
};
const recuento = {};
for (const x of previas) recuento[clase(x)] = (recuento[clase(x)] || 0) + 1;
log(`previas: ${previas.length} pedidas · ${JSON.stringify(recuento)}`);
const qa = previas.filter((x) => /^\[QA-/.test(x.name || ''));
log(`clientes «[QA-…]» en el comercio: ${qa.length} · ${JSON.stringify(qa.map((x) => ({ id: x.id, nombre: x.name, clase: clase(x) })))}`);
const cand = (f) => previas.filter((x) => !/^\[QA-/.test(x.name || '') && f(x));
const A = cand((x) => clase(x) === 'bloqueado-facturas-o-presupuestos')
  .sort((x, y) => (y.p.motivos.length - x.p.motivos.length) || (x.id - y.id))[0];
const Bc = cand((x) => clase(x) === 'bloqueado-solo-trabajos-partes-mantenimientos' && x.p.motivos.includes('tiene_trabajos')).sort((x, y) => x.id - y.id)[0];
if (A) NOMBRES.push(A.name);
if (Bc) NOMBRES.push(Bc.name);
NOMBRES.sort((x, y) => y.length - x.length);
log(`(a) con facturas o presupuestos: ${A ? `id ${A.id} · previa ${JSON.stringify(A.p)}` : 'NINGUNO'}`);
log(`(b) con trabajos y sin facturas ni presupuestos: ${Bc ? `id ${Bc.id} · previa ${JSON.stringify(Bc.p)}` : 'NINGUNO'}`);
const todosB = cand((x) => clase(x) === 'bloqueado-solo-trabajos-partes-mantenimientos');
log(`(b) población: ${todosB.length} clientes · ${JSON.stringify(todosB.map((x) => ({ id: x.id, motivos: x.p.motivos, cuenta: { trabajos: x.p.cuenta.trabajos, partes: x.p.cuenta.partes, mantenimientos: x.p.cuenta.mantenimientos } })))}`);
log(`(b) ¿alguno con tiene_facturas? ${todosB.some((x) => x.p.motivos.includes('tiene_facturas'))}`);

// ── 3 · navegador ────────────────────────────────────────────────────────────────────────────
const nav = await lanzarNavegador(puppeteer, { headless: 'new' });
if (!nav) { log('CIEGO: el navegador no arrancó'); process.exit(3); }
const page = await nav.newPage();
page.setDefaultTimeout(30000);
await page.setCookie({ name: 'pf_session', value: sesion.slice('pf_session='.length), domain: HOST, path: '/', httpOnly: true, secure: true });
await page.setRequestInterception(true);
const cortadas = []; const errores = []; const hosts = {}; const borrados = [];
page.on('request', (r) => {
  const u = new URL(r.url());
  hosts[u.host] = (hosts[u.host] || 0) + 1;
  if (u.host === HOST && PROHIBIDAS.test(u.pathname)) { cortadas.push(`${r.method()} ${u.pathname}`); return r.abort(); }
  if (u.host === HOST && r.method() === 'DELETE') borrados.push(`DELETE ${u.pathname}`);
  return r.continue();
});
page.on('response', (r) => {
  const u = new URL(r.url());
  if (u.host === HOST && r.status() >= 400) errores.push(`${r.request().method()} ${u.pathname} → ${r.status()}`);
  if (u.host === HOST && r.request().method() === 'DELETE') borrados.push(`  → ${r.status()} · Date ${r.headers().date}`);
});
const consola = [];
page.on('console', (m) => { if (m.type() === 'error') consola.push(tapa(m.text().slice(0, 200))); });
page.on('pageerror', (e) => consola.push('pageerror: ' + tapa(String(e.message).slice(0, 200))));
const dialogos = [];
page.on('dialog', async (d) => { dialogos.push({ tipo: d.type(), texto: tapa(d.message()) }); await d.dismiss(); });

async function paso(nombre, fn) {
  try { return await fn(); } catch (e) {
    await page.screenshot({ path: path.join(DIR, `staging-fallo-${nombre}.png`) }).catch(() => {});
    throw new Error(`PASO «${nombre}»: ${e.message}`);
  }
}
const clicEn = (sel, texto) => page.evaluate((s, t) => {
  const n = [...document.querySelectorAll(s)].find((x) => !t || x.textContent.trim().startsWith(t));
  if (!n) return false; n.click(); return true;
}, sel, texto || null);

const MODAL = '[data-rol="modal-borrar-cliente"] .modal';
const TARJETA = '[data-rol="borrar-cliente"]';
const medidas = {};
// Lo que se mide en cada captura (el bloque de SCRUM-1833/medir-390-1280.js, sobre la tarjeta o el modal).
async function medir(estado, raizSel, conTexto = true) {
  for (const ancho of [390, 1280]) {
    await page.setViewport({ width: ancho, height: 900 });
    await new Promise((r) => setTimeout(r, 500));
    await page.evaluate((s) => { const n = document.querySelector(s); if (n) n.scrollIntoView({ block: 'center', behavior: 'instant' }); }, raizSel);
    await new Promise((r) => setTimeout(r, 200));
    const m = await page.evaluate((s) => {
      const de = document.documentElement;
      const raiz = document.querySelector(s);
      if (!raiz) return { falta: true, scroll: de.scrollWidth, vista: de.clientWidth };
      const vis = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
      const inter = [...raiz.querySelectorAll('button, input, select, textarea, a[href]')].filter(vis);
      const pequenos = inter.map((n) => { const r = n.getBoundingClientRect(); return { q: (n.dataset.accion || n.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
        .filter((x) => x.h < 44 || x.w < 44);
      const fuera = [...raiz.querySelectorAll('*')].filter((n) => vis(n) && n.getBoundingClientRect().right > window.innerWidth + 0.5).length;
      const botones = inter.filter((n) => n.tagName === 'BUTTON').map((n) => { const r = n.getBoundingClientRect(); return `${n.textContent.trim()}${n.disabled ? ' (desactivado)' : ''} ${Math.round(r.width)}x${Math.round(r.height)}`; });
      return { scroll: de.scrollWidth, vista: de.clientWidth, interactivos: inter.length, pequenos, fuera, botones, texto: raiz.innerText };
    }, raizSel);
    await page.screenshot({ path: path.join(DIR, `staging-${estado}-${ancho}.png`) });
    if (m.falta) { log(`${estado}@${ancho} · 🔴 sin ${raizSel} en pantalla`); continue; }
    log(`${estado}@${ancho} · scroll ${m.scroll}/${m.vista} · interactivos ${m.interactivos} · botones ${JSON.stringify(tapa(m.botones.join(' | ')))} · se salen ${m.fuera} · <44: ${tapa(JSON.stringify(m.pequenos))}`);
    if (ancho === 1280 && conTexto) log(`   texto[${estado}] = ${tapa(JSON.stringify(m.texto))}`);
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

let fallo = null;
let idQA = null;
try {
  await page.setViewport({ width: 1280, height: 900 });
  await paso('entrar', async () => {
    const r = await page.goto(BASE + '/dashboard/', { waitUntil: 'networkidle2', timeout: 60000 });
    log(`GET /dashboard/ → ${r.status()} · url final ${new URL(page.url()).pathname}`);
    await page.waitForSelector('.nav-item[data-view="customers"]');
    log(`window.appUserRole = ${await page.evaluate(() => window.appUserRole || null)}`);
  });
  // ① cliente NUEVO por la UI (como en 1833e)
  await paso('crear-cliente', async () => {
    if (!(await clicEn('.nav-item[data-view="customers"]'))) throw new Error('sin «Clientes» en el menú');
    await page.waitForFunction(() => [...document.querySelectorAll('button.btn-primary')].some((x) => x.textContent.includes('Nuevo cliente')), { timeout: 15000 });
    if (!(await clicEn('button.btn-primary', 'Nuevo cliente'))) throw new Error('sin botón «Nuevo cliente»');
    await page.waitForSelector('input[name="name"]', { visible: true, timeout: 10000 });
    await page.evaluate((v) => { const i = [...document.querySelectorAll('input[name="name"]')].find((x) => x.offsetParent !== null); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, CLIENTE);
    const ok = await page.evaluate(() => { const i = [...document.querySelectorAll('input[name="name"]')].find((x) => x.offsetParent !== null); const b = i.form?.querySelector('button[type="submit"]'); if (!b) return false; b.click(); return true; });
    if (!ok) throw new Error('sin «Guardar» en el alta de cliente');
    await page.waitForFunction((n) => document.querySelector('.c360-pestanas') || [...document.querySelectorAll('tr')].some((t) => t.textContent.includes(n)), { timeout: 20000 }, CLIENTE);
    if (!(await page.$('.c360-pestanas'))) {
      const abierta = await page.evaluate((n) => { const t = [...document.querySelectorAll('tr')].find((x) => x.textContent.includes(n)); if (!t) return false; t.click(); return true; }, CLIENTE);
      if (!abierta) throw new Error('el cliente nuevo no aparece en la lista');
    }
    await page.waitForSelector(TARJETA, { timeout: 20000 });
    idQA = await page.evaluate(() => Number(window.appState?.customerId360) || null);
    await page.evaluate((s) => { document.querySelector(s).dataset.visto = '1'; }, TARJETA);
    log(`① cliente «${CLIENTE}» creado por la UI · id ${idQA} · ficha abierta`);
    const p = await api(`/admin/customers/${idQA}/borrado-previa`);
    log(`   previa del QA → ${p.status} · ${JSON.stringify(p.j)}`);
  });
  // ② la tarjeta, al final de la ficha
  await paso('tarjeta', async () => { await medir('tarjeta', TARJETA); });
  // ③ modal libre → «Cancelar» → el cliente sigue
  await paso('revisar', async () => {
    await page.setViewport({ width: 1280, height: 900 });
    await abrirModal();
    await medir('revisar', MODAL);
    if (!(await clicEn(`${MODAL} [data-accion="cancelar-borrado"]`))) throw new Error('sin «Cancelar»');
    await new Promise((r) => setTimeout(r, 300));
    const g = await api(`/admin/customers/${idQA}`);
    log(`③ tras «Cancelar»: modal abierto ${await modalAbierto()} · GET /admin/customers/${idQA} → ${g.status} · DELETE emitidos hasta aquí: ${borrados.length}`);
  });
  // ④ bloqueado por facturas o presupuestos
  if (A) await paso('bloqueado-facturas', async () => {
    await page.setViewport({ width: 1280, height: 900 });
    await abrirFicha(A.id); await abrirModal();
    await medir('bloqueado-facturas', MODAL);
    await clicEn(`${MODAL} [data-accion="cerrar-borrado"]`);
    log(`④ tras «Cerrar»: modal abierto ${await modalAbierto()}`);
  }); else log('④ SIN CLIENTE (a): no medido');
  // ⑤ bloqueado solo por trabajos (1868d/e)
  if (Bc) await paso('bloqueado-trabajos', async () => {
    await page.setViewport({ width: 1280, height: 900 });
    await abrirFicha(Bc.id); await abrirModal();
    await medir('bloqueado-trabajos', MODAL);
    await clicEn(`${MODAL} [data-accion="cerrar-borrado"]`);
    log(`⑤ tras «Cerrar»: modal abierto ${await modalAbierto()}`);
  }); else log('⑤ SIN CLIENTE (b): no medido');
  // ⑥ borrado real del QA de pruebas
  await paso('borrado', async () => {
    await page.setViewport({ width: 1280, height: 900 });
    const r = await borrarQA(idQA, CLIENTE);
    log(`⑥ «Eliminar» pulsado · toast «${T.exito}» visto en ${r.toast} · vista tras borrar: ${r.vista}`);
    await medir('borrado', 'body', false); // sin texto: la lista lleva los nombres del comercio
    const enLista = await page.evaluate((n) => document.body.innerText.includes(n), CLIENTE);
    const g = await api(`/admin/customers/${idQA}`);
    log(`   «${CLIENTE}» en la pantalla tras borrar: ${enLista} · GET /admin/customers/${idQA} → ${g.status} · Date ${g.date}`);
  });
  // ⑥bis el cliente que dejó 1833e, si sigue
  const viejo = qa.find((x) => x.name === CLIENTE_1833);
  if (viejo) await paso('borrado-1833e', async () => {
    if (clase(viejo) !== 'libre') { log(`⑥bis «${CLIENTE_1833}» id ${viejo.id} NO se borra: previa ${JSON.stringify(viejo.p)}`); return; }
    await page.setViewport({ width: 1280, height: 900 });
    const r = await borrarQA(viejo.id, CLIENTE_1833);
    const g = await api(`/admin/customers/${viejo.id}`);
    log(`⑥bis «${CLIENTE_1833}» id ${viejo.id} borrado por la UI · toast en ${r.toast} · GET /admin/customers/${viejo.id} → ${g.status} · Date ${g.date}`);
  }); else log(`⑥bis «${CLIENTE_1833}»: no está en el comercio`);
} catch (e) {
  fallo = tapa(e.message);
  log('🔴 ' + fallo);
}

// ── cotejo de textos: lo VISTO (innerText a 1280) contra la ficha ────────────────────────────────
const txt = (e) => (medidas[`${e}@1280`] || {}).texto || '';
const coteja = [];
const ver = (estado, clave, literal) => coteja.push([estado, clave, literal, txt(estado).includes(literal)]);
const noVer = (estado, clave, literal) => coteja.push([estado, `NO ${clave}`, literal, !!txt(estado) && !txt(estado).includes(literal)]);
for (const k of ['tarjetaTitulo', 'tarjetaTexto', 'soloAdmin', 'boton']) ver('tarjeta', k, T[k]);
for (const r of RETIRADOS) noVer('tarjeta', 'retirado', r);
ver('revisar', 'titulo', T.boton);
for (const k of ['subtitulo', 'seBorra', 'documentos', 'sitios', 'equipos', 'historial', 'solicitudes', 'nota', 'irreversible', 'cancelar', 'confirmar']) ver('revisar', k, T[k]);
ver('revisar', 'filaFicha', T.filaFicha.replace('{nombre}', CLIENTE));
for (const r of RETIRADOS) noVer('revisar', 'retirado', r);
for (const [estado, X] of [['bloqueado-facturas', A], ['bloqueado-trabajos', Bc]]) {
  if (!X) continue;
  const al = alertaEsperada(X.p.motivos, X.p.cuenta).replace('{nombre}', X.name);
  ver(estado, 'alerta', al);
  for (const k of ['loImpide', 'salida', 'cerrar']) ver(estado, k, T[k]);
  for (const mo of X.p.motivos) ver(estado, `fila ${mo}`, `${T[mo]}\t${X.p.cuenta[CUENTA[mo]]}`);
  noVer(estado, 'cancelar (oculto)', T.cancelar);
}
if (Bc) noVer('bloqueado-trabajos', 'alerta de facturas', 'factura emitida no se borra');
const ok = coteja.filter((c) => c[3]).length;
log(`cotejo con la ficha: ${ok} de ${coteja.length} comprobaciones casan (sobre ${LIT.length} literales de la ficha)`);
for (const [e, k, lit, v] of coteja) if (!v) log(`   NO casa: ${e} · ${k} = ${tapa(JSON.stringify(lit))}`);
log(`DELETE emitidos por el navegador: ${JSON.stringify(borrados)}`);
log(`diálogos: ${JSON.stringify(dialogos)}`);
log(`peticiones cortadas por la cerradura (send-*/resend-*/confirm-bizum/logout): ${cortadas.length} ${JSON.stringify(cortadas)}`);
log(`respuestas >= 400 de staging: ${errores.length} ${JSON.stringify(errores)}`);
log(`errores de consola: ${consola.length} ${JSON.stringify(consola)}`);
log(`hosts pedidos: ${JSON.stringify(hosts)}`);
await nav.close();
const d = await fetch(BASE + '/version');
log(`fin · staging /version = ${(await d.json()).version} · Date ${d.headers.get('date')} · ${fallo ? 'CON FALLO' : 'completo'}`);
process.exit(fallo ? 1 : 0);
