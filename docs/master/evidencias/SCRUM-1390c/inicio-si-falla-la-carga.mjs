// SCRUM-1390c · ¿Qué pinta el bloque de actividad de Inicio si su carga FALLA?
//
// La pregunta es de SCRUM-1390 c.17963: «no tienes presupuestos» y «no he podido cargarlos»
// significan lo contrario; ¿comparten salida? Se MIDE en un navegador, no leyendo el `catch`.
//
// MÉTODO: el banco de `scripts/guard-marcadores-en-pantalla.mjs` (SCRUM-722): el `index.html` REAL
// del panel, con sus scripts DERIVADOS de él y en su orden, en Edge sin cabeza (puppeteer-core del
// árbol). `fetch` doblado DENTRO de la página: la petición de las métricas contesta lo que dice cada
// ESCENARIO; el resto, vacío. Se llama a `renderHomeView` con el rol puesto y se LEE el texto del
// bloque `[data-home-block="activity"]` ya pintado. Ninguna red, ningún servidor, ninguna base.
//
// POBLACIÓN: 2 roles × ESCENARIOS.length escenarios (declarados abajo). Una celda que no pinta el
// bloque es CIEGA, no un resultado.
//
// CONTROLES (el positivo se SIEMBRA, no se toma del árbol): el escenario `con-datos` lleva un cliente
// inventado, «CLIENTE-SEMBRADO-1390C», que TIENE que salir en el bloque; y `vacio` TIENE que dar un
// texto distinto de `con-datos`. Si el lector no ve el sembrado, sale CIEGO (2).
// `--lector-roto` NO es medición: lee un bloque que no existe, para ver al instrumento decir CIEGO.
//
// Uso: node inicio-si-falla-la-carga.mjs <raíz del árbol>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(process.argv[2] || '.');
const ciego = (m) => { console.log('CIEGO: ' + m); console.log('EXIT=2'); process.exit(2); };
const LECTOR_ROTO = process.argv.includes('--lector-roto');
// `--panel=<dir>`: una COPIA del panel fuera del árbol (para la mutación del registro). Sin ella, el del árbol.
const argPanel = process.argv.find((a) => a.startsWith('--panel='));
const PANEL = argPanel ? path.resolve(argPanel.slice(8)) : path.join(raiz, 'public', 'dashboard');
const req = createRequire(path.join(raiz, 'package.json'));
let puppeteer;
try { puppeteer = req('puppeteer-core'); } catch { ciego('no encuentro puppeteer-core desde ' + raiz); }
const { rutaDelNavegador, argsDeAislamiento } = await import(pathToFileURL(path.join(raiz, 'scripts', '_navegador.mjs')).href);

// ── El banco (el de SCRUM-722, con un `fetch` por escenario)
const indice = fs.readFileSync(path.join(PANEL, 'index.html'), 'utf8');
const scripts = [...new Set([...indice.matchAll(/js\/([A-Za-z0-9]+\.js)/g)].map((m) => m[1]))].filter((f) => f !== 'onboardingView.js');
if (scripts.length < 40 || !scripts.includes('homeView.js') || !scripts.includes('api.js')) ciego('sólo ' + scripts.length + ' scripts derivados de index.html: el banco no es el panel');
const url = (p) => pathToFileURL(path.join(PANEL, p)).href;
const SEMBRADO = 'CLIENTE-SEMBRADO-1390C';
// PLAZO_RED_MS: api.js lo lee de window al cargar (10 s por defecto). Se baja a 1,5 s para que el
// escenario «se-cuelga» venza dentro de la medición. Declarado: es la única cosa del panel que cambia.
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(path.join(raiz, 'public', 'tokens.css')).href}">
<link rel="stylesheet" href="${url('css/styles.css')}"></head><body><div id="v"></div>
<script>
window.PLAZO_RED_MS = 1500;
localStorage.setItem('token','banco-1390c');
window.__escenario = 'arranque';
window.__pedidas = [];
const json = (x, s) => Promise.resolve(new Response(JSON.stringify(x), { status: s || 200, headers: { 'content-type': 'application/json' } }));
window.fetch = function (u, op) {
  const ruta = String(u && u.url ? u.url : u);
  window.__pedidas.push(ruta.replace(/^.*?\\/admin/, '/admin'));
  if (/\\/admin\\/metrics\\/(inicio|home)(\\?|$)/.test(ruta)) {
    const e = window.__escenario;
    if (e === 'vacio') return json({ recentActivity: [] });
    if (e === 'con-datos') return json({ recentActivity: [{ id: 9, quoteNumber: 9, customer: '${SEMBRADO}', total: 100, currency: 'EUR', status: 'sent', updatedAt: '2026-10-20T10:00:00Z' }] });
    if (e === 'sin-la-clave') return json({});
    if (e === 'http-500') return json({ error: 'internal_error' }, 500);
    if (e === 'http-502-sin-json') return Promise.resolve(new Response('<html>Bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }));
    if (e === 'http-401') return json({ error: 'unauthorized' }, 401);
    if (e === 'http-403') return json({ error: 'forbidden' }, 403);
    if (e === 'sin-red') return Promise.reject(new TypeError('Failed to fetch'));
    // Como el fetch del navegador: no contesta nunca, PERO rechaza si api.js aborta por su plazo.
    // (La primera versión ignoraba la señal y medía un fetch que no existe: ver el registro.)
    if (e === 'se-cuelga') return new Promise((_, mal) => {
      const s = op && op.signal; window.__conSenal = !!s;
      if (s) s.addEventListener('abort', () => mal(new DOMException('The operation was aborted.', 'AbortError')));
    });
    if (e === '200-no-json') return Promise.resolve(new Response('no es json', { status: 200, headers: { 'content-type': 'text/plain' } }));
    return json({ recentActivity: [] });
  }
  if (/\\/admin\\/(me|merchant)(\\?|$)/.test(ruta)) return json({ ok: true, id: 7, name: 'Negocio', role: 'admin', plan: 'pro', merchantId: 7 });
  return json([]);
};
</script>
${scripts.map((s) => `<script src="${url('js/' + s)}"></script>`).join('\n')}
</body></html>`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1390c-'));
const fichero = path.join(dir, 'banco.html');
fs.writeFileSync(fichero, html, 'utf8');

const ESCENARIOS = ['vacio', 'con-datos', 'sin-la-clave', 'http-500', 'http-502-sin-json', 'http-401', 'http-403', 'sin-red', 'se-cuelga', '200-no-json'];
const ROLES = ['tecnico', 'admin'];

const navegador = await puppeteer.launch({ executablePath: rutaDelNavegador(), headless: 'new', args: argsDeAislamiento() });
const filas = [];
try {
  const page = await navegador.newPage();
  page.setDefaultTimeout(20000);
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(pathToFileURL(fichero).href, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1500));
  const publicada = await page.evaluate(() => typeof window.renderHomeView === 'function');
  if (!publicada) ciego('el panel no publica renderHomeView');
  for (const rol of ROLES) {
    for (const esc of ESCENARIOS) {
      const r = await page.evaluate(async (rol, esc, roto) => {
        window.appUserRole = rol; window.__escenario = esc; window.__pedidas = [];
        const v = document.getElementById('v'); v.innerHTML = '';
        // No se espera a ciegas: si renderHomeView no vuelve, eso es un DATO de la celda, no un cuelgue
        // del banco (la primera corrida se colgó así; ver el registro).
        const t0 = Date.now();
        const vuelve = await Promise.race([
          Promise.resolve(window.renderHomeView(v)).then(() => 'volvió', (e) => 'lanzó: ' + String(e && e.message || e)),
          new Promise((ok) => setTimeout(() => ok('NO volvió en 6 s'), 6000)),
        ]);
        window.__vuelve = vuelve + ' (' + (Date.now() - t0) + ' ms)';
        await new Promise((ok) => setTimeout(ok, esc === 'se-cuelga' ? 2500 : 400));
        const bloque = v.querySelector(roto ? '[data-home-block="no-existe"]' : '[data-home-block="activity"]');
        const kpis = v.querySelector('#kpi-grid');
        return {
          vuelve: window.__vuelve + (esc === 'se-cuelga' ? ' · la petición llevaba señal de aborto: ' + window.__conSenal : ''),
          pedidas: window.__pedidas.filter((p) => /metrics/.test(p)),
          hay: !!bloque,
          texto: bloque ? bloque.innerText.replace(/\s+/g, ' ').trim() : null,
          error: bloque ? !!bloque.querySelector('.state-error') : null,
          reintentar: bloque ? !!bloque.querySelector('.state-error-retry') : null,
          esqueleto: bloque ? bloque.querySelectorAll('.skeleton').length : null,
          kpis: kpis ? kpis.innerText.replace(/\s+/g, ' ').trim().slice(0, 120) : '(no hay #kpi-grid)',
        };
      }, rol, esc, LECTOR_ROTO);
      filas.push({ rol, esc, ...r });
      console.error('celda ' + rol + '/' + esc + ' · ' + r.vuelve);
    }
  }
} finally {
  await navegador.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('SCRUM-1390c · el bloque de actividad de Inicio, pintado en ' + rutaDelNavegador() + ' · ' + scripts.length + ' scripts de index.html' + (argPanel ? ' · ⚠️ PANEL COPIADO: ' + PANEL + ' (no es una medición del árbol)' : ''));
console.log('POBLACION: ' + ROLES.length + ' roles × ' + ESCENARIOS.length + ' escenarios = ' + filas.length + ' celdas');
for (const f of filas) {
  console.log(`${f.rol.padEnd(8)} ${f.esc.padEnd(18)} pide ${f.pedidas.join(',') || '—'} · renderHomeView ${f.vuelve}`);
  console.log(`         bloque: ${f.hay ? '«' + f.texto + '»' : 'NO PINTADO'} · error ${f.error} · reintentar ${f.reintentar} · esqueletos ${f.esqueleto}`);
  if (f.rol === 'admin') console.log(`         #kpi-grid: «${f.kpis}»`);
}

// ── Controles
const celda = (rol, esc) => filas.find((f) => f.rol === rol && f.esc === esc);
let ok = true; const ciegas = filas.filter((f) => !f.hay);
for (const rol of ROLES) {
  const d = celda(rol, 'con-datos'); const v = celda(rol, 'vacio');
  const ve = !!(d && d.texto && d.texto.includes(SEMBRADO));
  const separa = !!(d && v && d.texto && v.texto && d.texto !== v.texto);
  console.log(`CONTROL ${rol}: el sembrado sale en con-datos ${ve} · vacío y con-datos dan textos distintos ${separa}`);
  if (!ve || !separa) ok = false;
}
if (ciegas.length) ciego(ciegas.length + ' de ' + filas.length + ' celdas sin bloque pintado (' + ciegas.map((f) => f.rol + '/' + f.esc).join(', ') + ')');
if (!ok) ciego('el lector no ve el sembrado o no separa vacío de con-datos');

console.log('\n── ¿El fallo cae en el MISMO sitio que el vacío?');
for (const rol of ROLES) {
  const v = celda(rol, 'vacio').texto;
  for (const esc of ESCENARIOS.filter((e) => e !== 'vacio' && e !== 'con-datos')) {
    const f = celda(rol, esc);
    console.log(`  ${rol.padEnd(8)} ${esc.padEnd(18)} ${f.texto === v ? '🔴 IGUAL QUE EL VACÍO' : 'distinto del vacío'}${f.error ? ' (estado de error)' : ''}`);
  }
}
console.log('EXIT=0');
