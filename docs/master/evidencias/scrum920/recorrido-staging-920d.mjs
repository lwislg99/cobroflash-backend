// SCRUM-920d · RECORRIDO de SOLO LECTURA en STAGING, a 390 px: la lista de Gastos de 920c/920d con datos reales.
// Uso: node docs/master/evidencias/scrum920/recorrido-staging-920d.mjs
// Login de QA (POST /auth/test-login, el secreto se lee en tiempo de ejecucion y no se imprime: regla 9) y despues
// SOLO pantalla: abre Gastos, pulsa chips y el filtro por trabajo, abre el modal de «Nuevo gasto» y lo CIERRA sin
// guardar. No pulsa ninguna fila, ningun «Eliminar», ningun «Guardar». Las peticiones que salen se cuentan: si alguna
// no es GET (salvo el login), el recorrido lo declara y sale con 1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { abrirNavegador } from '../../../../scripts/_banco-lista.mjs';

const BASE = 'https://yaqu-staging-production.up.railway.app';
if (!/yaqu-staging/.test(BASE)) { console.error('no es staging'); process.exit(2); }
const m = fs.readFileSync('D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt', 'utf8').match(/^E2E_TEST_LOGIN_SECRET=(.+)$/m);
if (!m) { console.error('sin clave de login'); process.exit(2); }
const SALIDA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'recorrido-staging-920d');
fs.mkdirSync(SALIDA, { recursive: true });

const filas = [];
const ok = (cond, texto) => { filas.push({ cond: !!cond, texto }); console.log((cond ? '   ✅ ' : '   🔴 ') + texto); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const login = await fetch(BASE + '/auth/test-login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'qa@staging.yaqu', secret: m[1].trim() }),
});
if (login.status !== 200) { console.log('login ' + login.status); console.log('EXIT=1'); process.exit(1); }
const galleta = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const sesion = /pf_session=([^;]+)/.exec(galleta);
if (!sesion) { console.log('login 200 pero sin pf_session'); console.log('EXIT=1'); process.exit(1); }
const pedir = (ruta) => fetch(BASE + ruta, { headers: { cookie: galleta } });

const version = await (await fetch(BASE + '/version')).json().catch(() => null);
console.log('TESTIGO · recorrido 920d en staging a 390×844 · version desplegada: ' + (version && version.version));

// Mes con mas gastos de los ultimos 12 (la lista real que se va a ver).
const hoy = new Date();
let mejor = { mes: null, items: [] };
for (let i = 0; i < 12; i++) {
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1));
  const mes = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
  const r = await pedir('/admin/expenses?month=' + mes);
  const items = (await r.json().catch(() => ({ items: [] }))).items || [];
  if (items.length > mejor.items.length) mejor = { mes, items };
}
const N = mejor.items.length;
const conFoto = mejor.items.filter((g) => g.tieneFoto).length;
console.log(`POBLACION · mes ${mejor.mes}: ${N} gastos (${conFoto} con foto, ${N - conFoto} sin ella), segun la API`);
if (N === 0) { console.log('🔴 NO SUPE MIRAR: staging no tiene ni un gasto en 12 meses'); console.log('EXIT=2'); process.exit(2); }

const { browser, quien } = await abrirNavegador(puppeteer);
console.log('navegador: ' + quien);
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.setCookie({ name: 'pf_session', value: sesion[1], domain: new URL(BASE).hostname, path: '/', httpOnly: true, secure: true });

const peticiones = [];
const errores = [];
page.on('request', (r) => peticiones.push({ metodo: r.method(), url: r.url() }));
page.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
page.on('console', (c) => { if (c.type() === 'error') errores.push('console.error: ' + c.text()); });

const foto = async (nombre, opciones = {}) => { await espera(500); await page.screenshot({ path: path.join(SALIDA, nombre), ...opciones }); };
const texto = (sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null);

await page.goto(BASE + '/dashboard/#expenses', { waitUntil: 'networkidle2', timeout: 45000 });
await page.waitForSelector('#exp-list', { timeout: 20000 });
// Elegir el mes con datos (si no es el de hoy).
const opcionMes = await page.evaluate((mes) => { const o = [...document.querySelectorAll('#exp-filter-month option')].find((x) => x.value === mes); return o ? o.value : null; }, mejor.mes);
if (opcionMes) await page.select('#exp-filter-month', opcionMes);
await page.waitForFunction('document.querySelectorAll("#exp-list .gasto-fila").length > 0', { timeout: 20000 }).catch(() => {});
await espera(600);

console.log('\nA. La lista con datos reales (390 px)');
const nFilas = await page.$$eval('#exp-list .gasto-fila', (f) => f.length);
ok(nFilas === N, `la lista pinta ${nFilas} filas y la API dice ${N}`);
const scrollX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok(scrollX <= 0, `sin scroll lateral (scrollWidth − innerWidth = ${scrollX})`);
const pildoras = await page.$$eval('#exp-list .gasto-foto', (p) => p.map((x) => x.textContent.trim()));
const guardadas = pildoras.filter((t) => t === 'Foto guardada').length;
const sin = pildoras.filter((t) => t === 'Sin foto').length;
ok(guardadas === conFoto && sin === N - conFoto, `píldoras: ${guardadas} «Foto guardada» (API ${conFoto}) y ${sin} «Sin foto» (API ${N - conFoto})`);
const imgs = await page.$$eval('#exp-list img', (i) => i.length);
ok(imgs === 0, `0 <img> en la lista (hay ${imgs})`);
const descargasFoto = peticiones.filter((p) => /\/admin\/expenses\/\d+\/foto/.test(p.url)).length;
ok(descargasFoto === 0, `0 descargas de /foto al cargar la lista (hubo ${descargasFoto})`);
// La cabecera es `.gastos-mes` con el recuento en un <span> hijo (`.gastos-mes-n`): se lee el contenedor, no una hoja.
const cabecera = await page.$eval('.gastos-mes', (c) => c.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);
// `textContent` no lleva el espacio antes del «·» (lo pone el hueco entre los dos <span>, no un carácter): «…de 2026· 4 gastos».
ok(cabecera && /^\S+ de 20\d\d\s*· \d+ gastos?/.test(cabecera) && new RegExp('· ' + N + ' gastos?').test(cabecera), `cabecera del mes: «${cabecera}»`);
const chips = await page.$$eval('.gastos-chip', (c) => c.map((x) => x.textContent.trim().replace(/\s+/g, ' ') + '|' + x.getAttribute('aria-pressed')));
ok(chips.length === 2 && chips[0].startsWith('Todos') && chips[0].includes(String(N)) && chips[0].endsWith('|true') && chips[1].startsWith('Sin foto') && chips[1].includes(String(N - conFoto)) && chips[1].endsWith('|false'),
  `chips: ${chips.join(' · ')}`);
const barraInicio = await page.$eval('#exp-new-btn', (b) => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b.closest('.gastos-barra') || b); return { pos: cs.position, arriba: Math.round(r.top), abajo: Math.round(r.bottom), alto: Math.round(r.height), h: window.innerHeight }; });
ok(barraInicio.pos === 'fixed' && barraInicio.abajo > barraInicio.h - 120 && barraInicio.abajo <= barraInicio.h, `«Nuevo gasto» fijo abajo: position ${barraInicio.pos}, borde inferior ${barraInicio.abajo} de ${barraInicio.h}, alto del botón ${barraInicio.alto}`);
ok(barraInicio.alto >= 44, `«Nuevo gasto» alcanzable con el pulgar: alto ${barraInicio.alto} px (≥ 44)`);
// ¿Que recibe el dedo? En cinco puntos a lo ancho del boton (a media altura), lo que hay ENCIMA tiene que ser el boton (o algo
// suyo). Un elemento fijo de otro (el «?» de ayuda, `#tut-help-btn`, z 350) que lo tape es un rojo con su nombre.
const tapado = await page.$eval('#exp-new-btn', (b) => {
  const r = b.getBoundingClientRect();
  const y = Math.round(r.top + r.height / 2);
  return [0.06, 0.25, 0.5, 0.75, 0.94].map((f) => {
    const x = Math.round(r.left + r.width * f);
    const e = document.elementFromPoint(x, y);
    return { x, y, propio: !!e && (e === b || b.contains(e)), quien: e ? (e.id ? '#' + e.id : e.tagName.toLowerCase()) : null };
  });
});
const ajenos = tapado.filter((t) => !t.propio);
ok(ajenos.length === 0, `el dedo llega al botón «Nuevo gasto» en sus 5 puntos${ajenos.length ? ' — TAPADO en ' + ajenos.map((t) => `x=${t.x} por ${t.quien}`).join(', ') : ''}`);
await foto('390-1-lista.png');
await foto('390-2-lista-entera.png', { fullPage: true });
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await espera(400);
const barraFinal = await page.$eval('#exp-new-btn', (b) => Math.round(b.getBoundingClientRect().bottom));
ok(barraFinal === barraInicio.abajo, `la barra sigue en su sitio tras recorrer la lista (borde inferior ${barraInicio.abajo} → ${barraFinal})`);
const ultimaFila = await page.$$eval('#exp-list .gasto-fila', (f) => Math.round(f[f.length - 1].getBoundingClientRect().bottom));
const arribaBarra = await page.$eval('#exp-new-btn', (b) => Math.round((b.closest('.gastos-barra') || b).getBoundingClientRect().top));
ok(ultimaFila <= arribaBarra, `la barra no tapa la última fila (fila acaba en ${ultimaFila}, barra empieza en ${arribaBarra})`);
await foto('390-3-final-de-la-lista.png');
await page.evaluate(() => window.scrollTo(0, 0));

console.log('\nB. Chip «Sin foto»');
await page.click('.gastos-chip[data-foto="sinfoto"]');
await espera(500);
const filasSinFoto = await page.$$eval('#exp-list .gasto-fila', (f) => f.length);
const pulsado = await page.$eval('.gastos-chip[data-foto="sinfoto"]', (c) => c.getAttribute('aria-pressed'));
ok(filasSinFoto === N - conFoto, `pulsar «Sin foto · ${N - conFoto}» deja ${filasSinFoto} filas (esperadas ${N - conFoto}); aria-pressed=${pulsado}`);
const soloSinFoto = await page.$$eval('#exp-list .gasto-foto', (p) => p.every((x) => x.textContent.trim() === 'Sin foto'));
ok(soloSinFoto, 'todas las filas que quedan dicen «Sin foto»');
const cabeceraFiltro = await page.evaluate(() => document.querySelector('#view-container').textContent);
ok(/Es la suma de lo que estás viendo, no la del mes\./.test(cabeceraFiltro), 'con el chip puesto la cabecera lleva la suma con su aviso «Es la suma de lo que estás viendo, no la del mes.»');
await foto('390-4-chip-sin-foto.png');
await page.click('.gastos-chip[data-foto="todos"]');
await espera(500);
ok((await page.$$eval('#exp-list .gasto-fila', (f) => f.length)) === N, 'pulsar «Todos» devuelve las ' + N + ' filas');

console.log('\nC. Filtro por trabajo');
const opcionesTrabajo = await page.$$eval('#exp-filter-job option', (o) => o.map((x) => x.value + '=' + x.textContent.trim()));
ok(opcionesTrabajo[0] === '=Todos los trabajos' && opcionesTrabajo.some((t) => t.endsWith('=Sin trabajo')), `el filtro ofrece: ${opcionesTrabajo.join(' | ')}`);
const conTrabajo = mejor.items.filter((g) => g.job).length;
const sinTrabajo = N - conTrabajo;
const valorSinTrabajo = await page.$eval('#exp-filter-job', (s) => { const o = [...s.options].find((x) => x.textContent.trim() === 'Sin trabajo'); return o ? o.value : null; });
if (valorSinTrabajo !== null) {
  await page.select('#exp-filter-job', valorSinTrabajo);
  await espera(500);
  const n = await page.$$eval('#exp-list .gasto-fila', (f) => f.length);
  ok(n === sinTrabajo, `«Sin trabajo» deja ${n} filas (la API dice ${sinTrabajo} sin trabajo)`);
  await foto('390-5-filtro-sin-trabajo.png');
}
const valorUnTrabajo = await page.$eval('#exp-filter-job', (s) => { const o = [...s.options].find((x) => x.value && x.textContent.trim() !== 'Sin trabajo'); return o ? { v: o.value, t: o.textContent.trim() } : null; });
if (valorUnTrabajo) {
  await page.select('#exp-filter-job', valorUnTrabajo.v);
  await espera(500);
  const n = await page.$$eval('#exp-list .gasto-fila', (f) => f.length);
  const esperadas = mejor.items.filter((g) => g.job && String(g.job.id) === valorUnTrabajo.v).length;
  ok(n === esperadas, `el trabajo «${valorUnTrabajo.t}» deja ${n} filas (la API dice ${esperadas})`);
  await foto('390-6-filtro-un-trabajo.png');
} else console.log('   (declarado) ningún gasto de este mes tiene trabajo: no hay un trabajo concreto que elegir');
// Un vacio de filtros, si la combinacion existe: un trabajo + «Sin foto» sin gastos.
await page.select('#exp-filter-job', '');
await espera(300);

console.log('\nD. «Nuevo gasto» abre el alta (y se cierra sin guardar)');
await page.click('#exp-new-btn');
await espera(700);
const modal = await page.evaluate(() => { const c = document.querySelector('#exp-concept'); if (!c) return null; const r = c.getBoundingClientRect(); return { visible: r.width > 0 && r.height > 0 }; });
ok(modal && modal.visible, 'el alta se abre con el campo de concepto a la vista');
await foto('390-7-nuevo-gasto-modal.png');
await page.keyboard.press('Escape');
await espera(400);
if (await page.$('#exp-concept')) {
  const cerrado = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(Cancelar|Cerrar|×|✕)$/.test(x.textContent.trim())); if (b) { b.click(); return true; } return false; });
  await espera(400);
  console.log('   (Escape no lo cerró; pulsado Cancelar/Cerrar: ' + cerrado + ')');
}
ok(!(await page.$('#exp-concept')) || (await page.$eval('#exp-concept', (c) => c.getBoundingClientRect().width === 0)), 'el alta se cerró sin guardar nada');

console.log('\nE. Solo lectura y errores');
// Al arrancar, el dashboard manda SOLO `POST /admin/entorno` (app.js `enviarEntornoDeLaApp`, SCRUM-360): telemetria
// del "ultimo entorno visto" de la PROPIA sesion (AuthSession.instaladaPwa), sin datos de negocio; abrir el
// dashboard es imposible sin ella. Es la unica excepcion admitida y se cuenta; cualquier otra escritura es un rojo.
const noGet = peticiones.filter((p) => p.metodo !== 'GET' && new URL(p.url).hostname === new URL(BASE).hostname);
const entorno = noGet.filter((p) => p.metodo === 'POST' && new URL(p.url).pathname === '/admin/entorno');
const otras = noGet.filter((p) => !entorno.includes(p));
console.log(`   (declarado) ${entorno.length} × POST /admin/entorno: lo manda la propia app al cargar, marca el entorno de la sesion de QA`);
ok(otras.length === 0, `todas las demas peticiones a staging fueron GET (escrituras que no son /admin/entorno: ${otras.length}${otras.length ? ' → ' + otras.map((p) => p.metodo + ' ' + p.url).join(', ') : ''})`);
ok(errores.length === 0, `0 errores de consola/página (hubo ${errores.length}${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''})`);
const fotosPedidasAlFinal = peticiones.filter((p) => /\/admin\/expenses\/\d+\/foto/.test(p.url)).length;
ok(fotosPedidasAlFinal === 0, `0 descargas de /foto en todo el recorrido (hubo ${fotosPedidasAlFinal})`);

await browser.close();
const malas = filas.filter((f) => !f.cond).length;
console.log(`\n${filas.length - malas} ✅ · ${malas} 🔴 · población: ${N} gastos de ${mejor.mes} en staging, 390×844, ${peticiones.length} peticiones`);
console.log('capturas en ' + path.relative(process.cwd(), SALIDA) + ': ' + fs.readdirSync(SALIDA).join(', '));
console.log('EXIT=' + (malas ? 1 : 0));
process.exit(malas ? 1 : 0);
