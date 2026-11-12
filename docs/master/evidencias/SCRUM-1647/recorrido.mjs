// SCRUM-1647e · Recorrido en NAVEGADOR REAL de las tres páginas de pago con la CSP de SCRUM-1637 APLICADA.
//
// Uso (desde la raíz del árbol, con `dist/` de la rama compilado):
//   node docs/master/evidencias/SCRUM-1647/recorrido.mjs <distDeMain> <distDeLaRama> <dirSalida>
//
// Tres servidores (`servidor-csp.cjs`, prisma doblado, datos fabricados, sin red ni base):
//   A · main SIN política      → cómo se comporta y se ve HOY (la captura «antes»)
//   B · main CON política      → CONTROL: con los manejadores en línea, la política TIENE que bloquear
//   C · rama CON política      → lo que hay que medir (la captura «después»)
// Y en cada servidor, `/__sembrado`: control positivo fabricado (script en línea + onerror).
//
// Qué mide en cada página: informes CSP (evento `securitypolicyviolation`, por directiva efectiva, y
// líneas de consola que nombran la política), qué hay en el portapapeles REAL tras pulsar cada botón
// «copiar» (con un centinela escrito antes, para que «no copió» no se lea como «copió»), el rótulo del
// botón tras pulsarlo, y si el logo roto (404) queda oculto. Navegador: el de los guards de la casa
// (`scripts/_navegador.mjs`).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { lanzarNavegador, resolverNavegador } from '../../../../scripts/_navegador.mjs';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const puppeteer = require_('puppeteer-core');

const [distMain, distRama, salida] = process.argv.slice(2);
if (!distMain || !distRama || !salida) { console.error('uso: recorrido.mjs <distMain> <distRama> <dirSalida>'); process.exit(2); }
fs.mkdirSync(path.join(salida, 'capturas'), { recursive: true });

const SERVIDOR = path.join(import.meta.dirname, 'servidor-csp.cjs');
const ESCENARIOS = [
  { id: 'A-main-sin', dist: distMain, modo: 'sin', puerto: 47161 },
  { id: 'B-main-aplicada', dist: distMain, modo: 'aplicada', puerto: 47162 },
  { id: 'C-rama-aplicada', dist: distRama, modo: 'aplicada', puerto: 47163 },
  // D separa las dos causas posibles de una diferencia visual entre A y C: el cambio de código de la
  // rama (A↔D) y lo que bloquea la política (D↔C).
  { id: 'D-rama-sin', dist: distRama, modo: 'sin', puerto: 47164 },
];
const PAGINAS = [
  { id: 'transferencia', ruta: '/pay/bank/tok1647e', logo: false },
  { id: 'bizum', ruta: '/pay/bizum/tok1647e', logo: true },
  { id: 'factura', ruta: '/pay/invoice/tok1647e', logo: true },
];
const ANCHOS = [390, 1280];
const CENTINELA = 'CENTINELA-1647e';

// Entorno del hijo: sin ninguna clave de base (prisma va doblado; esto es una segunda red).
function entornoHijo() {
  const e = { ...process.env, DISABLE_CRONS: 'true', NODE_ENV: 'test' };
  for (const k of Object.keys(e)) if (/^DATABASE_URL/.test(k) || k === 'NODE_TEST_CONTEXT' || k === 'NODE_OPTIONS') delete e[k];
  for (const k of ['DATABASE_URL', 'DATABASE_URL_STAGING', 'DATABASE_URL_DEV', 'DATABASE_URL_TESTS']) e[k] = '';
  // El `dist/` de main se compila fuera del árbol (en un temporal sin `node_modules`): sus `require`
  // resuelven contra las dependencias de ESTE árbol.
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

const VIGIA = () => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__csp.push({ directiva: e.effectiveDirective, bloqueado: e.blockedURI, linea: e.lineNumber });
  });
};

async function abrir(nav, origen, ruta, ancho) {
  const ctx = await nav.createBrowserContext();
  await ctx.overridePermissions(origen, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  const p = await ctx.newPage();
  const consola = [];
  p.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) consola.push(m.text().slice(0, 200)); });
  await p.evaluateOnNewDocument(VIGIA);
  await p.setViewport({ width: ancho, height: 900, deviceScaleFactor: 1 });
  const r = await p.goto(origen + ruta, { waitUntil: 'networkidle0' });
  return { ctx, p, consola, status: r.status(), cabeceras: r.headers() };
}

function resumenCsp(eventos, consola) {
  const porDirectiva = {};
  for (const e of eventos) porDirectiva[e.directiva] = (porDirectiva[e.directiva] || 0) + 1;
  const scriptSrc = eventos.filter((e) => /^script-src/.test(e.directiva)).length;
  return { eventos: eventos.length, scriptSrc, porDirectiva, lineasDeConsola: consola.length };
}

const informe = { navegador: resolverNavegador(), escenarios: {} };
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const hijos = [];
let nav;
try {
  for (const esc of ESCENARIOS) hijos.push(await arrancar(esc));
  nav = await lanzarNavegador(puppeteer, { headless: true });
  if (!nav) throw new Error('el navegador no arrancó');
  informe.version = await nav.version();

  for (const esc of ESCENARIOS) {
    const origen = `http://127.0.0.1:${esc.puerto}`;
    const res = { paginas: {} };

    // Control sembrado.
    {
      const { ctx, p, consola, cabeceras } = await abrir(nav, origen, '/__sembrado', 1280);
      await new Promise((r) => setTimeout(r, 300));
      const ev = await p.evaluate(() => window.__csp);
      const corrio = await p.evaluate(() => ({ script: window.__sembrado === 1, onerror: window.__sembrado2 === 1 }));
      res.sembrado = { politica: cabeceras['content-security-policy'] ? 'aplicada' : 'sin', corrio, ...resumenCsp(ev, consola) };
      await ctx.close();
    }

    for (const pag of PAGINAS) {
      const r = { capturas: {} };
      for (const ancho of ANCHOS) {
        const { ctx, p, consola, status, cabeceras } = await abrir(nav, origen, pag.ruta, ancho);
        r.status = status;
        r.politica = cabeceras['content-security-policy'] ? 'Content-Security-Policy'
          : cabeceras['content-security-policy-report-only'] ? 'Report-Only' : 'ninguna';
        const f = path.join(salida, 'capturas', `${esc.id}-${pag.id}-${ancho}.png`);
        await p.screenshot({ path: f, fullPage: true });
        r.capturas[ancho] = { fichero: path.basename(f), sha256: sha(f) };

        if (ancho === 1280) {
          if (pag.logo) {
            r.logo = await p.evaluate(() => {
              const i = document.querySelector('img.logo-img');
              return i ? { existe: true, cargo: i.complete && i.naturalWidth > 0, display: getComputedStyle(i).display } : { existe: false };
            });
          }
          // Cada botón «copiar»: centinela → clic de ratón real → leer el portapapeles real.
          const n = await p.$$eval('.copy-btn', (b) => b.length);
          r.copiar = [];
          await p.bringToFront();
          for (let k = 0; k < n; k++) {
            await p.evaluate((c) => navigator.clipboard.writeText(c), CENTINELA);
            const btns = await p.$$('.copy-btn');
            const rotulo = await btns[k].evaluate((b) => b.textContent.trim());
            await btns[k].click();
            await new Promise((x) => setTimeout(x, 400));
            const tras = await btns[k].evaluate((b) => ({ texto: b.textContent.trim(), copied: b.classList.contains('copied') }));
            const portapapeles = await p.evaluate(() => navigator.clipboard.readText());
            r.copiar.push({ boton: rotulo, portapapeles, copio: portapapeles !== CENTINELA, rotuloTras: tras.texto, claseCopied: tras.copied });
          }
          await new Promise((x) => setTimeout(x, 300));
          r.csp = resumenCsp(await p.evaluate(() => window.__csp), consola);
        }
        await ctx.close();
      }
      res.paginas[pag.id] = r;
    }
    informe.escenarios[esc.id] = res;
  }

  // Antes (A, main sin política) frente a después (C, rama con política): byte a byte.
  informe.comparacionVisual = [];
  const PARES = [['A-main-sin', 'C-rama-aplicada'], ['A-main-sin', 'D-rama-sin'], ['D-rama-sin', 'C-rama-aplicada'], ['B-main-aplicada', 'C-rama-aplicada']];
  for (const [x, y] of PARES) for (const pag of PAGINAS) for (const ancho of ANCHOS) {
    const a = informe.escenarios[x].paginas[pag.id].capturas[ancho];
    const c = informe.escenarios[y].paginas[pag.id].capturas[ancho];
    informe.comparacionVisual.push({ par: `${x} → ${y}`, pagina: pag.id, ancho, identicas: a.sha256 === c.sha256 });
  }
} finally {
  if (nav) await nav.close().catch(() => {});
  for (const h of hijos) h.kill();
}
fs.writeFileSync(path.join(salida, 'resultado.json'), JSON.stringify(informe, null, 2) + '\n');
console.log(JSON.stringify(informe, null, 2));
