// docs/master/evidencias/SCRUM-1790/aviso-pegado-al-borde.mjs — SCRUM-1790 · EL ROJO, FABRICADO.
//
// Uso:  node docs/master/evidencias/SCRUM-1790/aviso-pegado-al-borde.mjs [--capturas <carpeta>]
//
// ── POR QUÉ ERA INTERMITENTE (medido aquí el 23-nov-2026, no leído) ─────────────────────────
// `guard:falta-en-otra-pestana` (SCRUM-894) cazó a 390 px «el aviso queda fuera de la pantalla»
// en 1 de 2 pasadas, y 0 de 6 en otra máquina (SCRUM-1790 c.22374). La causa que proponía c.22374
// («si el campo ya se ve, el navegador no desplaza») NO es la que se mide: con el campo pegado al
// borde, el navegador lo CENTRA igual (scroll 0→244 en una ventana de 532, porque el panel lleva
// `scroll-padding-bottom: 80px`). Lo que hace el resultado depender del momento es
// `html { scroll-behavior: smooth }` (`public/dashboard/css/styles.css`): el desplazamiento hasta
// el campo inválido es ANIMADO, y el guard mide a los 400 ms. Si la animación sigue en vuelo, el
// aviso está todavía fuera de la ventana.
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
// El recorrido del guard (NIF vacío, pestaña Cobros, botón centrado y clic de verdad), y la
// posición del aviso y del campo en una LÍNEA DE TIEMPO tras el clic: al primer cuadro pintado y a
// los 100, 200, 400 y 1500 ms. Lo que ve el profesional en cuanto pulsa no puede depender de cuánto
// tarde una animación:
//   · 🔴 390 px → el aviso y el campo, DENTRO de la ventana en todas las muestras.
//   · CONTROL 1280 px → el mismo recorrido, igual que antes (aceptación 3 del ticket).
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Sin letra web, sin pestaña Empresa abierta o sin aviso no hay nada que medir: sale 2 (CIEGO),
// nunca 0. Salidas: 0 de acuerdo, 1 hallazgo, 2 ciego. El arnés (página, servidor, merchant) es
// copia del de `scripts/guard-falta-en-otra-pestana.mjs`, que no se toca (regla 41) y no exporta.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';
import { levantarServidor } from '../../../../scripts/_servidor.mjs';
import { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes } from '../../../../scripts/_hojas-del-panel.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const PUBLIC = path.join(RAIZ, 'public');
const iCap = process.argv.indexOf('--capturas');
const CAPTURAS = iCap > 0 ? process.argv[iCap + 1] : null;
const MUESTRAS_MS = [0, 100, 200, 400, 1500];

const JS = [
  '/dashboard/js/onboardingView.js',
  '/dashboard/js/prefijosPais.js',
  '/dashboard/js/settingsSubmenus.js',
  '/dashboard/js/puertaSerie.js',
  '/dashboard/js/settingsView.js',
];
const HOJAS = enlacesDelPanel(PUBLIC);
const MERCHANT = {
  id: 1, name: 'QA 1790', legalName: 'QA 1790 SL', taxId: 'B12345674', address: 'Calle Falsa 1',
  whatsappPhone: '34000000001', defaultCurrency: 'EUR', invoiceSeriesPrefix: 'F', country: 'ES',
  iban: null, bizumPhone: null, connectStatus: 'none',
};

function paginaHtml() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n' + HOJAS
    + '\n</head><body>\n<div id="vista" class="view-container"></div>\n<script>\n'
    + '  window.__merchant = ' + JSON.stringify(MERCHANT) + ';\n'
    + '  window.__guardados = [];\n'
    + '  window.getMerchantProfile = async () => window.__merchant;\n'
    + '  window.updateMerchantProfile = async (p) => { window.__guardados.push(p); return p; };\n'
    + '  window.apiRequest = async (ruta) => {\n'
    + '    if (ruta === "/admin/merchant") return window.__merchant;\n'
    + '    if (ruta === "/admin/connect/status") return { enabled: false };\n'
    + '    if (ruta === "/admin/referral") return { code: "X", redeemed: false };\n'
    + '    if (ruta === "/admin/metrics/whatsapp") return { rows: [] };\n'
    + '    return {};\n  };\n'
    + '  window.appLocale = "es"; window.appModoEmision = null;\n'
    + '  window.appPuertaSerieDisponible = false; window.appRetencionOpciones = null;\n'
    + '<\/script>\n' + JS.map((s) => '<script src="' + s + '"><\/script>').join('\n') + '\n</body></html>';
}

let PUERTO = 0;
function arrancarServidor() {
  const srv = http.createServer((req, res) => {
    const ruta = req.url.split('?')[0];
    if (ruta === '/__aviso-1790.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(paginaHtml());
    }
    try {
      const cuerpo = fs.readFileSync(path.join(PUBLIC, ruta.replace(/^\//, '')));
      const letra = TIPOS_DE_FUENTE[path.extname(ruta)];
      const tipo = letra || (ruta.endsWith('.css') ? 'text/css' : ruta.endsWith('.js') ? 'text/javascript' : 'text/plain') + '; charset=utf-8';
      res.writeHead(200, { 'content-type': tipo });
      res.end(cuerpo);
    } catch { res.writeHead(404); res.end(''); }
  });
  return levantarServidor(srv, 0).then((p) => { PUERTO = p; return srv; });
}

// Pinta la pantalla, espera los datos, vacía el NIF y deja abierta la pestaña Cobros.
const PREPARAR = new Function(`
  renderSettingsView(document.getElementById('vista'));
  return new Promise(function (ok) {
    var t0 = Date.now();
    (function esperar() {
      var n = document.querySelector('input[name="name"]');
      if (n && n.value === 'QA 1790') return ok(seguir());
      if (Date.now() - t0 > 5000) return ok('los datos del merchant no llegaron a pintarse');
      setTimeout(esperar, 50);
    })();
  });
  function seguir() {
    var nif = document.querySelector('form [name="taxId"]');
    var tab = document.querySelector('.settings-nav button[data-submenu="cobro"]');
    if (!nif || !tab) return 'falta el campo NIF o la pestaña Cobros';
    nif.value = '';
    tab.click();
    return null;
  }
`);

// Muestrea tras el clic: la primera, al primer cuadro pintado; las demás, a sus milisegundos.
const MUESTREAR = new Function('ms', `
  function leer(t) {
    var a = document.querySelector('[data-aviso-falta]');
    var c = document.querySelector('form [name="taxId"]');
    var ra = a && a.getBoundingClientRect(), rc = c.getBoundingClientRect();
    return { t: t, scroll: Math.round(window.scrollY),
      aviso: ra ? [Math.round(ra.top), Math.round(ra.bottom)] : null,
      campo: [Math.round(rc.top), Math.round(rc.bottom)] };
  }
  // Arranca con el clic: este oyente se añade DESPUÉS del de la pantalla, así que corre tras él.
  return new Promise(function (ok) {
    var t0, fuera = [];
    document.querySelector('form button[type="submit"]').addEventListener('click', function () {
    t0 = performance.now();
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      fuera.push(leer(0));
      ms.slice(1).forEach(function (m) {
        setTimeout(function () { fuera.push(leer(m)); if (fuera.length === ms.length) ok(fuera); }, Math.max(0, m - (performance.now() - t0)));
      });
    }); });
    }, { once: true });
  });
`);

const ESTADO = new Function(`
  var activa = Array.from(document.querySelectorAll('.settings-panel'))
    .filter(function (p) { return p.style.display !== 'none'; }).map(function (p) { return p.dataset.submenu; });
  return { alto: window.innerHeight, activa: activa,
    foco: document.activeElement && document.activeElement.name,
    texto: (document.querySelector('[data-aviso-falta]') || {}).textContent || null };
`);

const hallazgos = [];
const ciegos = [];
const filas = [];
const srv = await arrancarServidor();
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const caso of [
    { id: '390px · 🔴 NIF vacío, Guardar desde Cobros', ancho: 390 },
    { id: '1280px · control: mismo recorrido en escritorio', ancho: 1280 },
  ]) {
    const pag = await navegador.newPage();
    try {
      await pag.setViewport(caso.ancho < 800
        ? { width: caso.ancho, height: 844, isMobile: true, hasTouch: true }
        : { width: caso.ancho, height: 800 });
      await pag.goto(`http://127.0.0.1:${PUERTO}/__aviso-1790.html`, { waitUntil: 'load' });
      const fuente = await esperarFuentes(pag);
      if (!(fuente.cargadas > 0)) { ciegos.push(`${caso.id} → sin letra web cargada`); continue; }
      const prep = await pag.evaluate(PREPARAR);
      if (prep) { ciegos.push(`${caso.id} → ${prep}`); continue; }
      // El recorrido del guard, tal cual: botón centrado (sin animación) y clic de verdad.
      const boton = await pag.$('form button[type="submit"]');
      await boton.evaluate((b) => b.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const muestreo = pag.evaluate(MUESTREAR, MUESTRAS_MS);
      await boton.click();
      // Lo que ve el profesional nada más pulsar (la del final se hace abajo, tras la última muestra).
      if (CAPTURAS) {
        fs.mkdirSync(CAPTURAS, { recursive: true });
        await pag.screenshot({ path: path.join(CAPTURAS, `scrum1790-${caso.ancho}-al-pulsar.png`) });
      }
      const linea = await muestreo;
      const e = await pag.evaluate(ESTADO);
      if (CAPTURAS) {
        fs.mkdirSync(CAPTURAS, { recursive: true });
        await pag.screenshot({ path: path.join(CAPTURAS, `scrum1790-${caso.ancho}.png`) });
      }
      if (e.activa.length !== 1 || e.activa[0] !== 'empresa') { ciegos.push(`${caso.id} → no abrió Empresa: ${JSON.stringify(e.activa)}`); continue; }
      if (!e.texto || linea.some((m) => !m.aviso)) { ciegos.push(`${caso.id} → no salió aviso en todas las muestras: no hay nada que medir`); continue; }
      const mal = [];
      for (const m of linea) {
        if (m.aviso[0] < 0 || m.aviso[1] > e.alto) mal.push(`a los ${m.t} ms el aviso queda fuera de la pantalla (${m.aviso[0]}–${m.aviso[1]} de ${e.alto}, scroll ${m.scroll})`);
        if (m.campo[0] < 0 || m.campo[1] > e.alto) mal.push(`a los ${m.t} ms el campo queda fuera de la pantalla (${m.campo[0]}–${m.campo[1]} de ${e.alto})`);
      }
      if (e.foco !== 'taxId') mal.push(`foco en ${e.foco}, se esperaba taxId`);
      filas.push({ id: caso.id, ok: !mal.length, linea, alto: e.alto });
      if (mal.length) hallazgos.push({ id: caso.id, mal });
    } finally {
      await pag.close();
    }
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log('\n  SCRUM-1790 · EL AVISO DEL NIF EN CUANTO SE PULSA, NO CUANDO ACABE UNA ANIMACIÓN');
for (const f of filas) {
  console.log(`  ${f.ok ? '✔' : '🔴'} ${f.id} · ventana ${f.alto}`);
  for (const m of f.linea) console.log(`       ${String(m.t).padStart(4)} ms · scroll ${m.scroll} · aviso ${m.aviso[0]}–${m.aviso[1]} · campo ${m.campo[0]}–${m.campo[1]}`);
}
for (const c of ciegos) console.error('  🔴 NO SUPE MEDIR · ' + c);
for (const h of hallazgos) console.error(`  🔴 ${h.id}\n     · ${h.mal.join('\n     · ')}`);
const total = 2;
console.log(`  población: ${total} casos × ${MUESTRAS_MS.length} muestras · medidos ${filas.length} · hallazgos ${hallazgos.length} · ciegos ${ciegos.length}`);
if (hallazgos.length) process.exit(1);
if (ciegos.length || filas.length !== total) process.exit(2);
console.log('  ✔ de acuerdo');
