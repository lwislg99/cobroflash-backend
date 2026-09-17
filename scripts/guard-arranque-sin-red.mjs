// scripts/guard-arranque-sin-red.mjs — SCRUM-918 · RECARGAR SIN RED NO PUEDE DEJAR LA APP MUERTA.
//
// Uso:  npm run guard:arranque-sin-red
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
// Medido por la Sesión 0 en staging (17-sep-2026, `2be8fe16`, corte real con proxy) y repetido por la
// Sesión 2: sin red, RECARGAR la app acaba en la pantalla de error de Chrome («No se puede acceder…
// /login.html»). `app.js` mandaba a /login.html ante CUALQUIER fallo de GET /admin/me, también «sin
// red», y /login.html no está en el service worker. Con eso, un albarán ya descargado es inalcanzable.
//
// DECIDIDO (SCRUM-918): «sin red» NO es «sesión caducada». Sin red la app abre con lo que tiene en
// local y avisa. Solo una respuesta del servidor que no sea correcta manda al login.
//
// Se sirve el PANEL REAL con su service worker registrado de verdad (localhost es contexto seguro).
// ⚠️ EL CORTE ES REAL, también para el service worker: el servidor DESTRUYE cada conexión en cuanto
// llega. `setOffline` de Playwright/puppeteer no corta las peticiones del SW (medido por la S0: con la
// red «cortada» se creó un albarán de verdad), así que aquí no se usa.
//
//   · 🔴 A · con red arranca; se corta; se RECARGA → sigue en /dashboard/, con la app pintada y aviso;
//   · ✅ B · POSITIVO · con red y sesión caducada (401) → /login.html, como hoy;
//   · ⛔ C · NEGATIVO · un cliente que se veía con red NO aparece sin red: nada finge estar al día;
//   · D · sin la copia local de la sesión, sin red → aviso, sin redirigir y sin errores;
//   · E · vuelve la red (evento `online`) → el aviso se quita.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────────
// Necesita navegador, service worker y recarga. Entra por guards:visuales. La red que SÍ corre
// siempre es tests/scrum918-arranque-sin-red.test.mjs.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Si el SW no llega a controlar la página, si la app no arranca CON red, si el corte no corta (un
// `fetch` tiene que fallar) o si el centinela no se ve con red, sale con 2 (NO SUPE MEDIR).
// Salidas: 0 de acuerdo, 1 hallazgo, 2 ciego.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';

export const SALIDA_HALLAZGO = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let PUERTO = Number(process.env.SIN_RED_PUERTO || 0);
const CENTINELA = 'Cliente Centinela 918';

const estado = { cortado: false, me: 'ok' };
const ME = {
  id: 1, merchantId: 1, email: 'demo@yaqu.app', name: 'QA 918', merchantName: 'QA 918', plan: 'pro',
  userRole: 'admin', isOwner: true, onboardingCompleted: true, subscriptionStatus: 'active',
};

function arrancarServidor() {
  const json = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const srv = http.createServer((req, res) => {
    // EL CORTE: la conexión se destruye sin responder. Para el navegador —página y SW— es «sin red».
    if (estado.cortado) { req.socket.destroy(); return; }
    const u = req.url.split('?')[0];
    if (u === '/admin/me') return estado.me === '401' ? json(res, 401, { error: 'unauthorized' }) : json(res, 200, ME);
    if (u === '/admin/merchant') return json(res, 200, { id: 1, name: 'QA 918', defaultCurrency: 'EUR' });
    if (u === '/admin/customers') return json(res, 200, [{ id: 1, name: CENTINELA, phone: '34000000918' }]);
    if (u.startsWith('/admin/') || u.startsWith('/auth/')) return json(res, 200, { items: [], rows: [], data: [] });
    if (u === '/version') return json(res, 200, { version: 'guard-918' });
    const rel = u === '/dashboard/' ? 'dashboard/index.html' : u.replace(/^\//, '');
    const f = path.join(RAIZ, 'public', rel);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f);
      const tipo = { '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }[ext] || 'text/html';
      res.writeHead(200, { 'content-type': `${tipo}; charset=utf-8` });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); res.end('no');
  });
  return levantarServidor(srv, PUERTO).then((p) => { PUERTO = p; return srv; });
}

// ── LO QUE CORRE DENTRO DE LA PÁGINA (en cadenas: censo de SCRUM-258) ────────────────────────
const LEER = new Function(`
  var aviso = document.getElementById('sin-cobertura-banner');
  return {
    ruta: location.pathname,
    appPintada: !!document.getElementById('btn-logout'),
    aviso: aviso ? aviso.textContent.replace(/\\s+/g, ' ').trim() : null,
    controla: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    texto: (document.body ? document.body.innerText : '').slice(0, 4000)
  };
`);
const CONTROL_DEL_CORTE = new Function(`
  return fetch('/version', { cache: 'no-store' }).then(function (r) { return 'HTTP ' + r.status; }, function () { return 'FALLA'; });
`);
const IR_A_CLIENTES = new Function(`
  var b = document.querySelector('.nav-item[data-view="customers"]');
  if (!b) return false;
  b.click();
  return true;
`);
const OLVIDAR_COPIA = new Function(`
  var n = 0;
  for (var i = localStorage.length - 1; i >= 0; i--) {
    var k = localStorage.key(i);
    if (k && k.indexOf('yaqu_sesion_sin_cobertura') === 0) { localStorage.removeItem(k); n++; }
  }
  return n;
`);
const VUELVE_LA_RED = new Function(`window.dispatchEvent(new Event('online')); return true;`);

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const esErrorDeChrome = (url) => /^chrome-error:/.test(url);

/** Abre el panel CON red hasta que el SW controla la página y la app arranca. */
async function abrirConRed(pag, base) {
  await pag.goto(`${base}/dashboard/`, { waitUntil: 'networkidle0' });
  for (let i = 0; i < 6; i++) {
    const r = await pag.evaluate(LEER);
    if (r.controla && r.appPintada) return r;
    await pag.reload({ waitUntil: 'networkidle0' });
    await espera(800);
  }
  return pag.evaluate(LEER);
}

async function recargarSinRed(pag) {
  estado.cortado = true;
  await pag.reload({ waitUntil: 'load', timeout: 15000 }).catch(() => {});
  await espera(2500);
  const url = pag.url();
  if (esErrorDeChrome(url)) return { url, errorDeChrome: true };
  return { url, errorDeChrome: false, ...(await pag.evaluate(LEER)) };
}

const hallazgos = [];
const ciegos = [];
const filas = [];

const srv = await arrancarServidor();
const base = `http://localhost:${PUERTO}`;
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });

  // ── A + C + E · recargar sin red, lo que se ve y lo que vuelve ─────────────────────────────
  {
    estado.cortado = false; estado.me = 'ok';
    const ctx = await navegador.createBrowserContext();
    const pag = await ctx.newPage();
    const errores = [];
    pag.on('pageerror', (e) => errores.push(String(e.message || e)));
    await pag.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    try {
      const conRed = await abrirConRed(pag, base);
      if (!conRed.controla) { ciegos.push('A · el service worker no llegó a controlar la página: sin él no hay recarga sin red que medir'); }
      else if (!conRed.appPintada) { ciegos.push('A · con red la app no arrancó'); }
      else {
        await pag.evaluate(IR_A_CLIENTES);
        await espera(1200);
        const clientesConRed = await pag.evaluate(LEER);
        if (clientesConRed.texto.indexOf(CENTINELA) === -1) { ciegos.push('C · con red no se ve el cliente centinela: el negativo no mediría nada'); }
        else {
          const sinRed = await recargarSinRed(pag);
          const control = sinRed.errorDeChrome ? 'FALLA' : await pag.evaluate(CONTROL_DEL_CORTE);
          if (control !== 'FALLA') { ciegos.push(`A · el corte no corta: /version responde ${control}`); }
          else {
            filas.push({ caso: 'A · recargar sin red', r: sinRed });
            const mal = [];
            if (sinRed.errorDeChrome) mal.push(`la recarga acaba en la pantalla de error de Chrome (${sinRed.url})`);
            else {
              if (sinRed.ruta !== '/dashboard/') mal.push(`la app se va a ${sinRed.ruta}`);
              if (!sinRed.appPintada) mal.push('la app no arranca: no hay navegación');
              if (!sinRed.aviso) mal.push('no hay aviso de que no hay cobertura');
            }
            if (mal.length) hallazgos.push({ caso: 'A · 🔴 recargar sin red', mal });
            else {
              // C · el negativo, con la app ya arrancada sin red.
              await pag.evaluate(IR_A_CLIENTES);
              await espera(1500);
              const clientesSinRed = await pag.evaluate(LEER);
              filas.push({ caso: 'C · clientes sin red', r: clientesSinRed });
              if (clientesSinRed.texto.indexOf(CENTINELA) !== -1) {
                hallazgos.push({ caso: 'C · ⛔ nada finge estar al día', mal: [`sin red se enseña «${CENTINELA}», que vino del servidor con red`] });
              }
              // E · vuelve la red.
              estado.cortado = false;
              await pag.evaluate(VUELVE_LA_RED);
              await espera(2000);
              const vuelta = await pag.evaluate(LEER);
              filas.push({ caso: 'E · vuelve la red', r: vuelta });
              if (vuelta.aviso) hallazgos.push({ caso: 'E · vuelve la red', mal: ['con la red de vuelta el aviso sigue diciendo que no hay cobertura'] });
            }
            if (errores.length) hallazgos.push({ caso: 'A · errores de página', mal: errores });
          }
        }
      }
    } finally {
      estado.cortado = false;
      await ctx.close();
    }
  }

  // ── D · sin copia local de la sesión ───────────────────────────────────────────────────────
  {
    estado.cortado = false; estado.me = 'ok';
    const ctx = await navegador.createBrowserContext();
    const pag = await ctx.newPage();
    const errores = [];
    pag.on('pageerror', (e) => errores.push(String(e.message || e)));
    await pag.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    try {
      const conRed = await abrirConRed(pag, base);
      if (!conRed.controla || !conRed.appPintada) { ciegos.push('D · con red no llegó a arrancar con el SW controlando'); }
      else {
        await pag.evaluate(OLVIDAR_COPIA);
        const sinRed = await recargarSinRed(pag);
        filas.push({ caso: 'D · sin copia local, sin red', r: sinRed });
        const mal = [];
        if (sinRed.errorDeChrome) mal.push(`la recarga acaba en la pantalla de error de Chrome (${sinRed.url})`);
        else {
          if (sinRed.ruta !== '/dashboard/') mal.push(`la app se va a ${sinRed.ruta}`);
          if (!sinRed.aviso) mal.push('no hay aviso de que no hay cobertura');
        }
        if (errores.length) mal.push(`errores de página: ${errores.join(' | ')}`);
        if (mal.length) hallazgos.push({ caso: 'D · sin copia local', mal });
      }
    } finally {
      estado.cortado = false;
      await ctx.close();
    }
  }

  // ── B · POSITIVO · sesión caducada con red → login ────────────────────────────────────────
  {
    estado.cortado = false; estado.me = '401';
    const ctx = await navegador.createBrowserContext();
    const pag = await ctx.newPage();
    try {
      await pag.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await pag.goto(`${base}/dashboard/`, { waitUntil: 'networkidle0' }).catch(() => {});
      await espera(1500);
      // La ruta, sin `new URL` (censo SCRUM-195): se quita el origen y la consulta del texto.
      const ruta = pag.url().replace(/^[a-z-]+:\/\/[^/]*/i, '').split(/[?#]/)[0];
      filas.push({ caso: 'B · 401 con red', r: { ruta } });
      if (ruta !== '/login.html') hallazgos.push({ caso: 'B · ✅ 401 con red', mal: [`con la sesión caducada no va al login: está en ${ruta}`] });
    } finally {
      estado.me = 'ok';
      await ctx.close();
    }
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log('');
console.log('  SCRUM-918 · RECARGAR SIN RED (panel real, service worker real, corte real, 390 px)');
console.log('  ' + '─'.repeat(100));
for (const f of filas) {
  const r = f.r;
  console.log(`  ${f.caso.padEnd(30)} ${r.errorDeChrome ? 'ERROR DE CHROME ' + r.url : `ruta:${r.ruta}  app:${r.appPintada ?? '-'}  aviso:${r.aviso ? '«' + r.aviso + '»' : 'no'}`}`);
}
console.log('  ' + '─'.repeat(100));

if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MEDIR — esto NO es «arranca sin red»:\n');
  for (const c of ciegos) console.error('     · ' + c);
  process.exit(SALIDA_NO_SUPE_MEDIR);
}
if (hallazgos.length) {
  console.error(`\n  🔴 ${hallazgos.length} HALLAZGO(S):\n`);
  for (const h of hallazgos) {
    console.error(`     [${h.caso}]`);
    for (const m of h.mal) console.error('       · ' + m);
  }
  console.error('\n  Si el móvil recarga en un sótano, el técnico no puede abrir ni el albarán que ya tenía descargado.');
  process.exit(SALIDA_HALLAZGO);
}
console.log('\n  ✔ sin red la app arranca y avisa, no enseña nada como si estuviera al día, y un 401 sigue yendo al login.\n');
