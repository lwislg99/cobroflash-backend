// SCRUM-1833e · recorrido en STAGING de la pestaña «Equipos» (cuenta QA, comercio 2). Solo staging.
//
// Uso, desde la raíz del árbol (con el `.env` del árbol):
//   node docs/master/evidencias/SCRUM-1833/staging-recorrido.mjs > <fuera del árbol>/salida.txt
//
// · El secreto de `POST /auth/test-login` se LEE del `.env` por código (patrón de
//   docs/master/evidencias/SCRUM-1771/cierres14.mjs) y ni él ni la cookie se imprimen ni se escriben.
// · Se niega a correr si la URL no es la de staging, y CORTA en el navegador cualquier petición a
//   `send-*`, `resend-*`, `confirm-bizum` o `/auth/logout` (las cuenta: tienen que salir 0).
// · Los clics van por `el.click()` en la página: `html { scroll-behavior: smooth }` cuelga el
//   `click()` de puppeteer en «scrolling into view» (trampa medida de la casa).
// · Cada paso exige su elemento y su texto, o lanza con el nombre del paso (cicatriz J2 de SCRUM-1784:
//   un clic que falla en silencio da una captura igual a la anterior).
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
const CLIENTE = '[QA-1833e] Cliente de pruebas';
const PROHIBIDAS = /\/(send-[^/?]*|resend-[^/?]*|confirm-bizum)(\/|\?|$)|\/auth\/logout/;

// Los literales firmados, COPIADOS de SCRUM-1833 c.22798 §3 (firma c.22811). No de la ficha ni del código.
const FIRMADOS = {
  pestana: 'Equipos',
  nuevo: '+ Nuevo equipo',
  vacio: 'Todavía no hay equipos guardados para este cliente.',
  type: 'Tipo de equipo',
  ejemploTipo: 'Caldera / Aire acondicionado / Cuadro eléctrico',
  name: 'Nombre del equipo',
  ejemploNombre: 'Caldera de la cocina',
  brand: 'Marca',
  modelName: 'Modelo',
  serialNumber: 'Número de serie',
  installedOn: 'Fecha de instalación',
  warrantyUntil: 'Garantía hasta',
  garantia: 'Garantía hasta {fecha}',
  obligatorios: 'Escribe el tipo y el nombre del equipo.',
  errorCarga: 'No se pudieron cargar los equipos guardados. Inténtalo de nuevo.',
  generico: 'No se ha podido completar la acción. Vuelve a intentarlo.',
  editar: 'Editar',
  eliminar: '🗑 Eliminar',
  guardar: 'Guardar',
  cancelar: 'Cancelar',
  confirmarBorrar: '¿Borrar el equipo "{nombre}"? Los trabajos ligados a él lo perderán de su historial. Esta acción no se puede deshacer.',
};
const EQUIPO = {
  type: 'Aire acondicionado de conductos con bomba de calor y recuperador de energía',
  name: '[QA-1833e] Equipo de pruebas con un nombre largo para medir el ajuste de la fila',
  brand: 'Mitsubishi Electric Climatización Industrial',
  modelName: 'PUZ-ZM100YKA-R32-CONDUCTOS-EDICION-LARGA',
  serialNumber: 'SN-QA1833E-00000000000000000000000000000001',
  installedOn: '2026-03-15',
  warrantyUntil: '2029-03-15',
};
const MARCA_EDITADA = 'Daikin [QA-1833e editada]';

function secretoDelEnv() {
  const txt = fs.readFileSync('.env', 'utf8');
  const m = txt.match(/^E2E_TEST_LOGIN_SECRET=(.*)$/m); // nombre LITERAL (cicatriz J2 de 1732f)
  if (!m) throw new Error('sin E2E_TEST_LOGIN_SECRET en .env');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

const out = [];
const log = (s) => { out.push(s); console.log(s); };
const fecha = (ymd) => { const [a, m, d] = ymd.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('es-ES'); };

// ── 1 · login por fetch (UN intento) ───────────────────────────────────────────────────────────
const h = await fetch(BASE + '/version');
log(`staging /version = ${(await h.json()).version} · Date ${h.headers.get('date')}`);
const l = await fetch(BASE + '/auth/test-login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, secret: secretoDelEnv() }),
});
const sc = (l.headers.getSetCookie ? l.headers.getSetCookie() : []).map((c) => c.split(';')[0]);
const sesion = sc.find((c) => c.startsWith('pf_session='));
log(`login ${l.status} · cookie pf_session ${sesion ? 'recibida' : 'NO recibida'} · Date ${l.headers.get('date')}`);
if (l.status !== 200 || !sesion) { log('CIEGO: sin sesión (un 404 no distingue flag, secreto o allowlist). PARO.'); process.exit(2); }

// ── 2 · navegador ────────────────────────────────────────────────────────────────────────────
const nav = await lanzarNavegador(puppeteer, { headless: 'new' });
if (!nav) { log('CIEGO: el navegador no arrancó'); process.exit(3); }
const page = await nav.newPage();
const valor = sesion.slice('pf_session='.length);
await page.setCookie({ name: 'pf_session', value: valor, domain: HOST, path: '/', httpOnly: true, secure: true });
await page.setRequestInterception(true);
const cortadas = [];
const errores = [];
const hosts = {};
page.on('request', (r) => {
  const u = new URL(r.url());
  hosts[u.host] = (hosts[u.host] || 0) + 1;
  if (u.host === HOST && PROHIBIDAS.test(u.pathname)) { cortadas.push(`${r.method()} ${u.pathname}`); return r.abort(); }
  return r.continue();
});
page.on('response', (r) => {
  const u = new URL(r.url());
  if (u.host === HOST && r.status() >= 400) errores.push(`${r.request().method()} ${u.pathname} → ${r.status()}`);
});
const consola = [];
page.on('console', (m) => { if (m.type() === 'error') consola.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => consola.push('pageerror: ' + String(e.message).slice(0, 200)));
const dialogos = [];
page.on('dialog', async (d) => { dialogos.push({ tipo: d.type(), texto: d.message() }); await d.accept(); });

async function paso(nombre, fn) {
  try { return await fn(); } catch (e) {
    await page.screenshot({ path: path.join(DIR, `staging-fallo-${nombre}.png`), fullPage: true }).catch(() => {});
    throw new Error(`PASO «${nombre}»: ${e.message}`);
  }
}
const clicEn = (sel, texto) => page.evaluate((s, t) => {
  // «Empieza por»: el atajo de teclado (`atajoNuevo.etiquetar`) añade su marca al final del texto del
  // botón (1.ª pasada: «sin botón «Nuevo cliente»» con el botón en pantalla).
  const n = [...document.querySelectorAll(s)].find((x) => !t || x.textContent.trim().startsWith(t));
  if (!n) return false; n.click(); return true;
}, sel, texto || null);
const esperarTexto = (sel, texto, ms = 15000) => page.waitForFunction(
  (s, t) => [...document.querySelectorAll(s)].some((x) => x.textContent.includes(t)), { timeout: ms }, sel, texto);

// Lo que se mide en cada captura: el bloque de medir-390-1280.js (jv-j2fi) + el texto de la pestaña.
async function medir(estado) {
  for (const ancho of [390, 1280]) {
    await page.setViewport({ width: ancho, height: 900 });
    await new Promise((r) => setTimeout(r, 400));
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const sel = 'button, input, select, textarea, a[href]';
      const nuevo = document.querySelector('[data-accion="nuevo-equipo"]');
      const card = nuevo?.parentElement;
      const raiz = card?.parentElement || document.body;
      const pequenos = [...raiz.querySelectorAll(sel)].filter((n) => n.offsetParent !== null).map((n) => {
        const r = n.getBoundingClientRect();
        return { q: (n.dataset.accion || n.id || n.textContent || n.type || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
      }).filter((x) => x.h < 44 || x.w < 44);
      const fueraDerecha = [...document.querySelectorAll('li[data-equipo] *')].filter((n) => n.getBoundingClientRect().right > window.innerWidth + 0.5).length;
      const tab = [...document.querySelectorAll('.c360-pestanas > button')].find((b) => b.textContent.trim() === 'Equipos');
      const tr = tab?.getBoundingClientRect();
      return {
        scroll: de.scrollWidth, vista: de.clientWidth, pequenos, fueraDerecha,
        filas: document.querySelectorAll('li[data-equipo]').length,
        eliminar: document.querySelectorAll('[data-accion="eliminar"]').length,
        pestana: tab ? `${Math.round(tr.width)}x${Math.round(tr.height)}` : 'NO ENCONTRADA',
        texto: card ? card.innerText : '(sin pestaña)',
        placeholders: [...(card?.querySelectorAll('input[placeholder]') || [])].map((i) => i.placeholder),
      };
    });
    await page.screenshot({ path: path.join(DIR, `staging-${estado}-${ancho}.png`), fullPage: true });
    log(`${estado}@${ancho} · scroll ${m.scroll}/${m.vista} · filas ${m.filas} · eliminar ${m.eliminar} · pestaña «Equipos» ${m.pestana} · se salen ${m.fueraDerecha} · <44: ${JSON.stringify(m.pequenos)}`);
    if (ancho === 1280) {
      log(`   texto[${estado}] = ${JSON.stringify(m.texto)}`);
      if (m.placeholders.length) log(`   placeholders[${estado}] = ${JSON.stringify(m.placeholders)}`);
    }
    m.estado = estado; m.ancho = ancho;
    medidas.push(m);
  }
}
const medidas = [];
let fallo = null;
let rol = null;

try {
  await page.setViewport({ width: 1280, height: 900 });
  // (a) cliente NUEVO por la UI
  await paso('entrar', async () => {
    const r = await page.goto(BASE + '/dashboard/', { waitUntil: 'networkidle2', timeout: 60000 });
    log(`GET /dashboard/ → ${r.status()} · url final ${new URL(page.url()).pathname}`);
    await page.waitForSelector('.nav-item[data-view="customers"]', { timeout: 30000 });
    rol = await page.evaluate(() => window.appUserRole || null);
    log(`window.appUserRole = ${rol}`);
  });
  await paso('crear-cliente', async () => {
    if (!(await clicEn('.nav-item[data-view="customers"]'))) throw new Error('sin «Clientes» en el menú');
    await esperarTexto('button.btn-primary', 'Nuevo cliente');
    if (!(await clicEn('button.btn-primary', 'Nuevo cliente'))) throw new Error('sin botón «Nuevo cliente»');
    await page.waitForSelector('input[name="name"]', { visible: true, timeout: 10000 });
    await page.evaluate((v) => { const i = [...document.querySelectorAll('input[name="name"]')].find((x) => x.offsetParent !== null); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, CLIENTE);
    const ok = await page.evaluate(() => { const i = [...document.querySelectorAll('input[name="name"]')].find((x) => x.offsetParent !== null); const b = i.form?.querySelector('button[type="submit"]'); if (!b) return false; b.click(); return true; });
    if (!ok) throw new Error('sin «Guardar» en el alta de cliente');
    // Tras guardar: o abre la ficha, o vuelve a la lista; en la lista se abre la fila por su nombre.
    await page.waitForFunction((n) => document.querySelector('.c360-pestanas') || [...document.querySelectorAll('tr')].some((t) => t.textContent.includes(n)), { timeout: 20000 }, CLIENTE);
    if (!(await page.$('.c360-pestanas'))) {
      // Solo la fila que lleva el nombre: nunca «la primera» (sería el cliente de otro).
      const abierta = await page.evaluate((n) => { const t = [...document.querySelectorAll('tr')].find((x) => x.textContent.includes(n)); if (!t) return false; t.click(); return true; }, CLIENTE);
      if (!abierta) throw new Error('el cliente nuevo no aparece en la lista');
      await page.waitForSelector('.c360-pestanas', { timeout: 20000 });
    }
    const cab = await page.evaluate(() => document.body.innerText.includes('[QA-1833e] Cliente de pruebas'));
    log(`(a) cliente creado por la UI y ficha abierta · su nombre en la ficha: ${cab}`);
  });
  // (b) pestaña «Equipos», vacía
  await paso('vacio', async () => {
    const pestanas = await page.evaluate(() => [...document.querySelectorAll('.c360-pestanas > button')].map((b) => b.textContent.trim()));
    log(`pestañas (${pestanas.length}): ${pestanas.join(' · ')}`);
    if (!(await clicEn('.c360-pestanas > button', 'Equipos'))) throw new Error('sin pestaña «Equipos»');
    await page.waitForFunction(() => document.querySelector('.sitios-cliente__vacio') || !document.querySelector('[data-rol="aviso-equipos"]').hidden, { timeout: 15000 });
    await medir('vacio');
  });
  // (c) alta: el formulario, el error de obligatorios (sin petición) y el guardado
  await paso('alta', async () => {
    if (!(await clicEn('[data-accion="nuevo-equipo"]'))) throw new Error('sin «+ Nuevo equipo»');
    await page.waitForSelector('#c360-equipo-type', { visible: true, timeout: 10000 });
    await medir('alta');
    const fijar = (vals) => page.evaluate((v) => { for (const [k, x] of Object.entries(v)) { const i = document.getElementById('c360-equipo-' + k); i.value = x; i.dispatchEvent(new Event('input', { bubbles: true })); } }, vals);
    await fijar({ type: '   ', name: EQUIPO.name });
    await page.evaluate(() => document.querySelector('.sitios-cliente__form button[type="submit"]').click());
    const obl = await page.evaluate(() => { const p = document.querySelector('.sitios-cliente__form .sitios-cliente__error'); return p && !p.hidden ? p.textContent : null; });
    log(`(c) tipo solo con espacios → aviso ${JSON.stringify(obl)}`);
    await fijar(EQUIPO);
    await page.evaluate(() => document.querySelector('.sitios-cliente__form button[type="submit"]').click());
    await page.waitForSelector('li[data-equipo]', { timeout: 15000 });
    await medir('lista');
  });
  // (d) editar: el formulario relleno, un cambio, y la fila cambiada
  await paso('editar', async () => {
    if (!(await clicEn('li[data-equipo] [data-accion="editar"]'))) throw new Error('sin «Editar»');
    await page.waitForSelector('#c360-equipo-brand', { visible: true, timeout: 10000 });
    const rel = await page.evaluate(() => Object.fromEntries(['type', 'name', 'brand', 'modelName', 'serialNumber', 'installedOn', 'warrantyUntil'].map((k) => [k, document.getElementById('c360-equipo-' + k).value])));
    log(`(d) formulario de edición relleno igual que lo guardado: ${JSON.stringify(rel) === JSON.stringify(EQUIPO)}`);
    await medir('editar');
    await page.evaluate((v) => { const i = document.getElementById('c360-equipo-brand'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, MARCA_EDITADA);
    await page.evaluate(() => document.querySelector('.sitios-cliente__form button[type="submit"]').click());
    await esperarTexto('li[data-equipo]', MARCA_EDITADA);
    const fila = await page.evaluate(() => document.querySelector('li[data-equipo]').innerText);
    log(`(d) fila tras editar = ${JSON.stringify(fila)} · marca vieja presente: ${fila.includes(EQUIPO.brand)}`);
  });
  // (e) eliminar con el confirm nativo, y la lista vuelve a vacía
  await paso('eliminar', async () => {
    if (!(await clicEn('li[data-equipo] [data-accion="eliminar"]'))) throw new Error('sin «Eliminar» (¿rol no admin?)');
    await page.waitForSelector('.sitios-cliente__vacio', { timeout: 15000 });
    log(`(e) tras eliminar: filas ${await page.$$eval('li[data-equipo]', (x) => x.length)} · vacío visible: true`);
  });
} catch (e) {
  fallo = e.message;
  log('🔴 ' + fallo);
}

// ── cotejo de textos: lo VISTO contra los literales firmados ───────────────────────────────────
const t = Object.fromEntries(medidas.filter((m) => m.ancho === 1280).map((m) => [m.estado, m]));
const ve = (estado, s) => !!t[estado] && t[estado].texto.includes(s);
const fila = (EQUIPO.serialNumber && `${FIRMADOS.serialNumber}: ${EQUIPO.serialNumber}`);
const coteja = [
  ['pestana', !!medidas.find((m) => m.pestana !== 'NO ENCONTRADA')],
  ['nuevo', ve('vacio', FIRMADOS.nuevo)],
  ['vacio', ve('vacio', FIRMADOS.vacio)],
  ...['type', 'name', 'brand', 'modelName', 'serialNumber', 'installedOn', 'warrantyUntil'].map((k) => [k, ve('alta', FIRMADOS[k])]),
  ['ejemploTipo', !!t.alta?.placeholders.includes(FIRMADOS.ejemploTipo)],
  ['ejemploNombre', !!t.alta?.placeholders.includes(FIRMADOS.ejemploNombre)],
  ['guardar', ve('alta', FIRMADOS.guardar)],
  ['cancelar', ve('alta', FIRMADOS.cancelar)],
  ['obligatorios', out.some((s) => s.includes(JSON.stringify(FIRMADOS.obligatorios)))],
  ['garantia', ve('lista', FIRMADOS.garantia.replace('{fecha}', fecha(EQUIPO.warrantyUntil)))],
  ['editar', ve('lista', FIRMADOS.editar)],
  ['eliminar', ve('lista', FIRMADOS.eliminar)],
  ['confirmarBorrar', dialogos.some((d) => d.tipo === 'confirm' && d.texto === FIRMADOS.confirmarBorrar.replace('{nombre}', EQUIPO.name))],
];
log(`separador «: » (c.22837): «${fila}» ${ve('lista', fila) ? 'VISTO' : 'NO visto'} · «${FIRMADOS.installedOn}: ${fecha(EQUIPO.installedOn)}» ${ve('lista', `${FIRMADOS.installedOn}: ${fecha(EQUIPO.installedOn)}`) ? 'VISTO' : 'NO visto'}`);
log(`textos firmados vistos en staging: ${coteja.filter((c) => c[1]).length} de ${coteja.length} cotejados (de ${Object.keys(FIRMADOS).length} aplicados; errorCarga y generico no se provocan)`);
for (const [k, v] of coteja) if (!v) log(`   NO visto: ${k} = ${JSON.stringify(FIRMADOS[k])}`);
log(`diálogos: ${JSON.stringify(dialogos)}`);
log(`peticiones cortadas por la cerradura (send-*/resend-*/confirm-bizum/logout): ${cortadas.length} ${JSON.stringify(cortadas)}`);
log(`respuestas >= 400 de staging: ${errores.length} ${JSON.stringify(errores)}`);
log(`errores de consola: ${consola.length} ${JSON.stringify(consola)}`);
log(`hosts pedidos: ${JSON.stringify(hosts)}`);
log(`(f) borrar el cliente: NO intentado por la UI (el panel no tiene ninguna llamada a DELETE /admin/customers/:id; medido aparte). Queda «${CLIENTE}» en el comercio 2.`);
await nav.close();
const d = await fetch(BASE + '/version');
log(`fin · staging /version = ${(await d.json()).version} · Date ${d.headers.get('date')} · ${fallo ? 'CON FALLO' : 'completo'}`);
process.exit(fallo ? 1 : 0);
