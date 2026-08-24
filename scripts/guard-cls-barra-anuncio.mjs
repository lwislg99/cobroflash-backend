// scripts/guard-cls-barra-anuncio.mjs — SCRUM-544 · el salto de la primera pantalla, medido.
//
//   node scripts/guard-cls-barra-anuncio.mjs
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ MIDE Y POR QUÉ
//
// La barra de anuncio nace `hidden` y se despliega cuando responde `/public/founding-status`.
// Al desplegarse EMPUJA la página entera hacia abajo: el visitante ya está leyendo, y en móvil
// con el pulgar en camino a un botón, ese salto es un toque en el sitio equivocado.
//
// Medido en SCRUM-331 (F4): **CLS 0,382 a 360 px** y 0,108 a 390, contra un límite de 0,1. El A/B
// aisló la causa: con la fuente rota —la barra no llega a aparecer— el CLS caía a 0,001.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS TRES CASOS, Y NINGUNO SOBRA
//
//   · `vendidas` (taken>0) → la barra aparece CON la escasez («quedan N plazas»).
//   · `cero`     (taken=0) → la barra aparece SIN la escasez. Es el caso de HOY, y el que un
//                            arreglo a ojo se salta: la barra mide MENOS y una altura fija
//                            calculada con el otro caso deja hueco en blanco.
//   · `roto`     (500)     → la barra NO aparece nunca. Reservarle hueco aquí sería un vacío
//                            permanente en la parte más cara de la página.
//
// Si el arreglo solo funciona cuando el fetch responde, no es un arreglo: es suerte.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO
//
// Si no consigue LEER el CLS —sin observador, sin entradas, `undefined`— sale por «NO SUPE
// MIRAR» con código 2. Un 0 de un medidor roto se lee exactamente igual que una página perfecta,
// y aquí esa confusión es la que deja el salto en producción.
//
// Levanta su propio servidor con el `http` de Node: sin dependencias nuevas (regla 36).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const puppeteer = createRequire(path.join(RAIZ, 'package.json'))('puppeteer-core');
import { rutaDelNavegador } from './_navegador.mjs';
// SCRUM-522 · la ruta ya no se escribe aqui. Era una ruta de WINDOWS por defecto, identica en
// los nueve guards, y por eso ninguno podia correr en el runner de CI —Ubuntu— donde de verdad
// hacen falta. `rutaDelNavegador` busca en los sitios conocidos y, si no hay ninguno, PARA
// declarandose ciega en vez de devolver una ruta plausible. `EDGE_PATH` sigue mandando.
const EDGE = rutaDelNavegador();

export const ANCHOS = [360, 390];
export const LIMITE_CLS = 0.1;
export const CASOS = {
  vendidas: { taken: 2, seatsLeft: 18 },
  cero: { taken: 0, seatsLeft: 20 },
  roto: null,
};

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function servir(caso) {
  const srv = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/public/founding-status') {
      const c = CASOS[caso];
      if (!c) { res.writeHead(500); res.end('boom'); return; }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ price: 9.9, seatsTotal: 20, seatsLeft: c.seatsLeft, taken: c.taken }));
      return;
    }
    const rel = url === '/' ? '/index.html' : url;
    const f = path.join(RAIZ, 'public', rel);
    if (!f.startsWith(path.join(RAIZ, 'public')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); res.end('no'); return;
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ srv, puerto: srv.address().port })));
}

async function medir(nav, puerto, ancho) {
  const p = await nav.newPage();
  await p.setViewport({ width: ancho, height: 780, deviceScaleFactor: 2 });
  const cdp = await p.target().createCDPSession();
  await cdp.send('Network.enable');
  // 4G «regular»: 9 Mbps de bajada, 4 de subida, 170 ms de ida y vuelta.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 170, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (4 * 1024 * 1024) / 8,
  });
  await p.evaluateOnNewDocument(() => {
    window.__cls = 0; window.__lcp = 0; window.__obs = 0; window.__shifts = [];
    try {
      new PerformanceObserver((l) => {
        window.__obs++;
        for (const e of l.getEntries()) if (!e.hadRecentInput) {
          window.__cls += e.value;
          window.__shifts.push({ v: Math.round(e.value * 1000) / 1000, t: Math.round(e.startTime) });
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => { window.__obs++; for (const e of l.getEntries()) window.__lcp = Math.round(e.startTime); })
        .observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) { window.__obsError = String(e && e.message); }
  });
  await p.goto('http://127.0.0.1:' + puerto + '/index.html', { waitUntil: 'networkidle2' });
  // El salto llega DESPUÉS del fetch; se deja respirar para no medir antes de que ocurra.
  await p.evaluate(() => new Promise((ok) => setTimeout(ok, 1200)));
  const r = await p.evaluate(() => {
    const vis = (id) => { const e = document.getElementById(id); if (!e) return null; return !(e.hidden || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden'); };
    const alto = (id) => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().height) : null; };
    const txt = (id) => { const e = document.getElementById(id); return e ? e.textContent.replace(/[ \t\n\r]+/g, ' ').trim().slice(0, 90) : null; };
    return {
      cls: window.__cls, lcp: window.__lcp, obs: window.__obs, obsError: window.__obsError || null,
      shifts: window.__shifts,
      fcp: Math.round((performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0),
      anuncioVisible: vis('announce'), plazasVisible: vis('ann-plazas'),
      altoAnuncio: alto('announce'), textoAnuncio: txt('announce'),
      scrollHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  await p.close();
  return r;
}

let nav;
try {
  nav = await puppeteer.launch({ executablePath: EDGE, args: ['--no-sandbox'] });
} catch (e) {
  console.error('🔴 NO SUPE MIRAR: no se pudo abrir Edge (' + (e && e.message ? e.message.slice(0, 90) : '?') + ').');
  console.error('   Esto NO es «no hay salto»: es que no se ha medido. Apunta EDGE_PATH a un Edge.');
  process.exit(2);
}

console.log('salto de la primera pantalla (CLS) — SCRUM-544 · Edge, 4G emulada, límite ' + LIMITE_CLS + '\n');
let fallos = 0;
let ciego = false;
const tabla = [];

for (const caso of Object.keys(CASOS)) {
  const { srv, puerto } = await servir(caso);
  for (const ancho of ANCHOS) {
    const r = await medir(nav, puerto, ancho);

    // SUELO: sin observador o sin lectura, no se afirma nada.
    if (typeof r.cls !== 'number' || Number.isNaN(r.cls) || r.obs === 0) {
      console.error('🔴 NO SUPE MIRAR el CLS en ' + caso + '/' + ancho + 'px'
        + (r.obsError ? ' (' + r.obsError + ')' : ' — el observador no entregó ni una entrada'));
      ciego = true; continue;
    }

    const cls = Math.round(r.cls * 1000) / 1000;
    const mal = cls > LIMITE_CLS;
    if (mal) fallos++;
    if (r.scrollHorizontal) { console.log('   🔴 scroll horizontal en ' + caso + '/' + ancho); fallos++; }
    tabla.push({ caso, ancho, cls, lcp: r.lcp, fcp: r.fcp, anuncio: r.anuncioVisible, plazas: r.plazasVisible, altoAnuncio: r.altoAnuncio });

    console.log((mal ? '🔴 ' : '   ') + caso.padEnd(9) + ' ' + String(ancho).padStart(3) + ' px · CLS '
      + String(cls).padEnd(6) + ' · FCP ' + String(r.fcp).padStart(4) + ' · LCP ' + String(r.lcp).padStart(4)
      + ' · barra ' + (r.anuncioVisible ? 'VISIBLE(' + r.altoAnuncio + 'px)' : 'oculta')
      + ' · escasez ' + (r.plazasVisible === null ? '—' : r.plazasVisible ? 'VISIBLE' : 'oculta'));
    if (r.shifts.length) console.log('             saltos: ' + r.shifts.map((s) => s.v + '@' + s.t + 'ms').join(' · '));
    if (r.anuncioVisible) console.log('             barra: «' + r.textoAnuncio + '»');
  }
  srv.close();
}

await nav.close();
console.log('');
if (ciego) { console.error('🔴 medición CIEGA: no se afirma nada sobre el salto.'); process.exit(2); }
console.log(fallos === 0
  ? '✓ ningún caso pasa de ' + LIMITE_CLS + ' de CLS'
  : '🔴 ' + fallos + ' medición(es) por encima del límite');
process.exit(fallos === 0 ? 0 : 1);
