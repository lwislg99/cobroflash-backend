// SCRUM-1647d · El ALTA (`/register.html`) en navegador real, con la política de SCRUM-1637 APLICADA.
// Método de SCRUM-1647e (J2, `recorrido.mjs`): cuatro escenarios sobre la `app` real de dos `dist/`.
//   A = main sin política · B = main con política (CONTROL: tiene que romperse) ·
//   C = rama con política (lo que se pide) · D = rama sin política.
// Aspecto: A↔D (el cambio de código, sin política) tiene que ser idéntico byte a byte. A↔C se mide y se
// dice, pero NO decide: `style-src` está fuera de este ticket (SCRUM-1647 c.21665 → SCRUM-1723).
// Comportamiento: con la política, el alta con invitación (`?ref=`) se completa con 0 informes `script-src`.
//
// Uso:  node recorrido-alta.mjs <distMain> <distRama> <dirSalida>
// Salida: 0 = C cumple y los controles responden · 1 = C no cumple · 2 = CIEGO (un control no responde).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { lanzarNavegador, resolverNavegador } from '../../../../../scripts/_navegador.mjs';

const RAIZ = path.resolve(import.meta.dirname, '../../../../..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const puppeteer = require_('puppeteer-core');

const [distMain, distRama, salida] = process.argv.slice(2);
if (!distMain || !distRama || !salida) { console.error('uso: recorrido-alta.mjs <distMain> <distRama> <dirSalida>'); process.exit(2); }
fs.mkdirSync(path.join(salida, 'capturas'), { recursive: true });

const SERVIDOR = path.join(import.meta.dirname, 'servidor-alta.cjs');
// Puertos libres que da el sistema (con diez sesiones a la vez, uno fijo ya estaba cogido: EADDRINUSE).
const puertoLibre = () => new Promise((ok, mal) => {
  const s = net.createServer().once('error', mal).listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
});
const ESCENARIOS = [
  { id: 'A-main-sin', dist: distMain, modo: 'sin' },
  { id: 'B-main-aplicada', dist: distMain, modo: 'aplicada' },
  { id: 'C-rama-aplicada', dist: distRama, modo: 'aplicada' },
  { id: 'D-rama-sin', dist: distRama, modo: 'sin' },
];
for (const esc of ESCENARIOS) esc.puerto = await puertoLibre();
const VISTAS = [
  { id: 'con-invitacion', ruta: '/register.html?ref=AMIGO1647D' },
  { id: 'sin-invitacion', ruta: '/register.html' },
];
const ANCHOS = [390, 1280];

function entornoHijo() {
  const e = { ...process.env, DISABLE_CRONS: 'true', NODE_ENV: 'test' };
  for (const k of Object.keys(e)) if (/^DATABASE_URL/.test(k) || k === 'NODE_TEST_CONTEXT' || k === 'NODE_OPTIONS') delete e[k];
  for (const k of ['DATABASE_URL', 'DATABASE_URL_STAGING', 'DATABASE_URL_DEV', 'DATABASE_URL_TESTS']) e[k] = '';
  e.NODE_PATH = path.join(RAIZ, 'node_modules');
  return e;
}
function arrancar(esc) {
  return new Promise((ok, mal) => {
    const h = spawn(process.execPath, [SERVIDOR, esc.dist, String(esc.puerto), esc.modo],
      { cwd: path.dirname(path.resolve(esc.dist)), env: entornoHijo(), stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    const t = setTimeout(() => mal(new Error(`${esc.id}: el servidor no dijo LISTO en 60 s\n${log}`)), 60_000);
    h.stdout.on('data', (d) => { log += d; if (log.includes('LISTO')) { clearTimeout(t); ok(h); } });
    h.stderr.on('data', (d) => { log += d; });
    h.on('exit', (c) => { clearTimeout(t); mal(new Error(`${esc.id}: el servidor salió con ${c}\n${log}`)); });
  });
}

const recursosQueFaltan = [];
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function abrir(nav, origen, ruta, ancho, { interceptar = false } = {}) {
  const ctx = await nav.createBrowserContext();
  const p = await ctx.newPage();
  const altas = [];
  const navegaciones = [];
  const csp = [];
  // Recurso propio que falta = hoja de estilo, fuente, guion o imagen con 4xx/5xx (lo que cambiaría el
  // aspecto). Fuera: el 404 SEMBRADO a propósito (`/no-existe/`), el `favicon.ico` que pide el navegador
  // por su cuenta y las llamadas `fetch` (el `401 /admin/me` del login al llegar sin sesión es lo esperado).
  p.on('response', (r) => {
    const tipo = r.request().resourceType();
    if (r.status() >= 400 && ['stylesheet', 'font', 'script', 'image'].includes(tipo)
      && !r.url().includes('/no-existe/') && !r.url().endsWith('/favicon.ico')) recursosQueFaltan.push(`${r.status()} ${tipo} ${r.url()}`);
  });
  // Los informes se cuentan en el lado de Node (cada documento nuevo pierde su `window.__csp`):
  // la vigía los deja en la consola con una marca, y también se cuentan las líneas de consola de CSP.
  p.on('console', (m) => {
    const t = m.text();
    if (t.startsWith('⟦csp⟧')) csp.push(JSON.parse(t.slice(5)));
  });
  await p.evaluateOnNewDocument(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.log('⟦csp⟧' + JSON.stringify({ directiva: e.effectiveDirective, bloqueado: e.blockedURI, linea: e.lineNumber }));
    });
  });
  if (interceptar) {
    await p.setRequestInterception(true);
    p.on('request', (q) => {
      if (q.isNavigationRequest() && q.frame() === p.mainFrame()) navegaciones.push(`${q.method()} ${q.url().replace(origen, '')}`);
      if (q.method() === 'POST' && new URL(q.url()).pathname === '/auth/register') {
        altas.push(JSON.parse(q.postData() || '{}'));
        q.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      q.continue();
    });
  }
  await p.setViewport({ width: ancho, height: 900, deviceScaleFactor: 1 });
  const r = await p.goto(origen + ruta, { waitUntil: 'networkidle0' });
  return { ctx, p, altas, navegaciones, csp, status: r.status(), cabeceras: r.headers() };
}
const resumen = (ev) => {
  const porDirectiva = {};
  for (const e of ev) porDirectiva[e.directiva] = (porDirectiva[e.directiva] || 0) + 1;
  return { eventos: ev.length, scriptSrc: ev.filter((e) => /^script-src/.test(e.directiva)).length, porDirectiva };
};
const visible = (sel) => (d) => { const el = d.querySelector(sel); return el ? getComputedStyle(el).display !== 'none' : null; };

const informe = { navegador: resolverNavegador(), escenarios: {} };
const hijos = [];
let nav;
try {
  for (const esc of ESCENARIOS) hijos.push(await arrancar(esc));
  nav = await lanzarNavegador(puppeteer, { headless: true });
  if (!nav) throw new Error('el navegador no arrancó');
  informe.version = await nav.version();

  for (const esc of ESCENARIOS) {
    const origen = `http://127.0.0.1:${esc.puerto}`;
    const res = { vistas: {} };

    { // control sembrado
      const { ctx, p, csp, cabeceras } = await abrir(nav, origen, '/__sembrado', 1280);
      await espera(300);
      const corrio = await p.evaluate(() => ({ script: window.__sembrado === 1, onerror: window.__sembrado2 === 1 }));
      res.sembrado = { politica: cabeceras['content-security-policy'] ? 'aplicada' : 'sin', corrio, ...resumen(csp) };
      await ctx.close();
    }

    for (const v of VISTAS) {
      const r = { capturas: {} };
      for (const ancho of ANCHOS) {
        const { ctx, p, status, cabeceras } = await abrir(nav, origen, v.ruta, ancho);
        r.status = status;
        r.politica = cabeceras['content-security-policy'] ? 'Content-Security-Policy'
          : cabeceras['content-security-policy-report-only'] ? 'Report-Only' : 'ninguna';
        const f = path.join(salida, 'capturas', `${esc.id}-${v.id}-${ancho}.png`);
        await p.screenshot({ path: f, fullPage: true });
        r.capturas[ancho] = { fichero: path.basename(f), sha256: sha(f) };
        if (ancho === 1280) {
          r.insigniaVisible = await p.evaluate(`(${visible.toString()})('#ref-badge')(document)`);
          r.avisoVisible = await p.evaluate(`(${visible.toString()})('#alert')(document)`);
        }
        await ctx.close();
      }
      res.vistas[v.id] = r;
    }

    { // EL ALTA CON INVITACIÓN, de punta a punta
      const { ctx, p, altas, navegaciones, csp } = await abrir(nav, origen, VISTAS[0].ruta, 1280, { interceptar: true });
      const a = {};
      a.insigniaVisible = await p.evaluate(`(${visible.toString()})('#ref-badge')(document)`);
      // otro país oculta los campos de España (guion), y España los vuelve a enseñar
      await p.select('#country', 'PT');
      a.camposEsOcultosConPT = await p.evaluate(() => document.getElementById('campos-es').hidden);
      await p.select('#country', 'ES');
      a.camposEsVisiblesConES = await p.evaluate(() => !document.getElementById('campos-es').hidden);
      await p.type('#name', 'Fontanería Banco 1647d');
      await p.type('#email', 'banco1647d@ejemplo.test');
      await p.select('#provincia', 'Albacete');
      await p.select('#domicilio-foral', 'no');
      await p.select('#domicilio-canarias', 'no');
      await p.click('#btn');
      await espera(800);
      let tras = null;
      try {
        tras = await p.evaluate(() => ({
          url: location.pathname + location.search,
          aviso: (document.getElementById('alert') || {}).textContent || '',
          avisoVisible: document.getElementById('alert') ? getComputedStyle(document.getElementById('alert')).display !== 'none' : null,
          boton: (document.getElementById('btn') || {}).textContent || '',
        }));
      } catch (e) { tras = { error: String(e.message || e).slice(0, 120) }; }
      a.trasEnviar = tras;
      await espera(4600); // el guion redirige a /login.html a los 4 s
      a.urlFinal = await p.evaluate(() => location.pathname + location.search).catch(() => '¿?');
      a.altas = altas;
      a.navegaciones = navegaciones;
      a.csp = resumen(csp);
      a.completa = altas.length === 1 && altas[0].ref === 'AMIGO1647D' && altas[0].source === 'ref:AMIGO1647D'
        && altas[0].provincia === 'Albacete' && a.urlFinal === '/login.html'
        && /Cuenta creada/.test(tras?.aviso || '');
      res.alta = a;
      await ctx.close();
    }
    res.lecturasDelDoble = Number(await (await fetch(`${origen}/__lecturas`)).text());
    informe.escenarios[esc.id] = res;
  }

  informe.comparacionVisual = [];
  const PARES = [['A-main-sin', 'D-rama-sin'], ['A-main-sin', 'C-rama-aplicada'], ['D-rama-sin', 'C-rama-aplicada'], ['A-main-sin', 'B-main-aplicada']];
  for (const [x, y] of PARES) for (const v of VISTAS) for (const ancho of ANCHOS) {
    informe.comparacionVisual.push({ par: `${x} → ${y}`, vista: v.id, ancho,
      identicas: informe.escenarios[x].vistas[v.id].capturas[ancho].sha256 === informe.escenarios[y].vistas[v.id].capturas[ancho].sha256 });
  }
  informe.recursosQueFaltan = [...new Set(recursosQueFaltan)];
} finally {
  if (nav) await nav.close().catch(() => {});
  for (const h of hijos) h.kill();
}

fs.writeFileSync(path.join(salida, 'resultado.json'), JSON.stringify(informe, null, 2) + '\n');
const E = informe.escenarios;
const ciegos = [];
if (!(E['B-main-aplicada'].sembrado.scriptSrc > 0 && E['C-rama-aplicada'].sembrado.scriptSrc > 0)) ciegos.push('el sembrado no da informes con la política aplicada');
if (E['A-main-sin'].sembrado.eventos !== 0) ciegos.push('el sembrado da informes SIN política');
if (E['B-main-aplicada'].alta.completa) ciegos.push('CONTROL: main con la política completa el alta (el banco no aplica la política)');
if (!E['A-main-sin'].alta.completa) ciegos.push('CONTROL: main sin política no completa el alta (el recorrido no sabe hacer el alta)');
if (informe.recursosQueFaltan.length) ciegos.push(`faltan recursos propios: ${informe.recursosQueFaltan.join(', ')}`);
for (const [id, e] of Object.entries(E)) if (e.lecturasDelDoble !== 0) ciegos.push(`${id}: la página leyó la base ${e.lecturasDelDoble} veces`);
const C = E['C-rama-aplicada'];
const cumple = C.alta.completa && C.alta.csp.scriptSrc === 0 && C.vistas['sin-invitacion'].insigniaVisible === false;
for (const [id, e] of Object.entries(E)) {
  console.log(`${id.padEnd(16)} sembrado script-src ${e.sembrado.scriptSrc} · alta completa ${e.alta.completa} · altas ${e.alta.altas.length} · `
    + `script-src en el alta ${e.alta.csp.scriptSrc} ${JSON.stringify(e.alta.csp.porDirectiva)} · insignia sin ref ${e.vistas['sin-invitacion'].insigniaVisible} · url final ${e.alta.urlFinal}`);
}
for (const c of informe.comparacionVisual) console.log(`visual ${c.par} ${c.vista} ${c.ancho}: ${c.identicas ? 'IDÉNTICAS' : 'distintas'}`);
console.log(`navegador: ${informe.version}`);
if (ciegos.length) { console.log('CIEGO:\n  ' + ciegos.join('\n  ')); process.exitCode = 2; }
else { console.log(cumple ? 'C CUMPLE' : 'C NO CUMPLE'); process.exitCode = cumple ? 0 : 1; }
