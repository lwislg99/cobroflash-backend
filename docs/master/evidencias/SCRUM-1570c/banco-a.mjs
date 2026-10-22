// SCRUM-1570c · banco de la opción (a): reserva con las medidas de Inter + V1. Fuera de la tanda:
//   node banco-a.mjs <raizRepo> <html base> <carpeta DejaVu> [anchos] [repeticiones]
// Sirve public/ del árbol, con index.html sustituido por <html base> («antes») o el del árbol
// («después»). Mide como scripts/guard-cls-barra-anuncio.mjs (Edge, 4G emulada, mismo observador,
// mismos casos de /public/founding-status) y además el alto del subtítulo del hero, que es lo que
// se re-maqueta (SCRUM-1570 c.20169). Reservas:
//   · sistema → la página tal cual (en Windows: antes Segoe UI vía system-ui; después la cara
//               'YaQu Reserva Arial' por local('Arial')).
//   · arial   → antes: --font "Inter","Arial" (emula Arial/Liberation); después: tal cual.
//   · dejavu  → DejaVu registrada con FontFace (sin red). Antes, como familia suelta tras Inter; después, con
//               los descriptores de las caras 'YaQu Reserva DejaVu' COPIADOS del index.html servido, y
//               sin la cara Arial en la pila (Ubuntu sin fonts-liberation).
// Controles: fuente 'rota' (woff2 → 404) tiene que dar CLS ~0; cada fila dice qué familia pintó el
// subtítulo (CIEGO si la inyección no llegó o si la reserva esperada no está cargada).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [RAIZ, BASE, DV] = [path.resolve(process.argv[2]), process.argv[3], process.argv[4]];
const ANCHOS = (process.argv[5] || '360,390').split(',').map(Number);
const REP = Number(process.argv[6] || 2);
const puppeteer = createRequire(path.join(RAIZ, 'package.json'))('puppeteer-core');
const { lanzarNavegador } = await import(pathToFileURL(path.join(RAIZ, 'scripts/_navegador.mjs')).href);
const CASOS = { vendidas: { taken: 2, seatsLeft: 18 }, cero: { taken: 0, seatsLeft: 20 }, roto: null };
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const HTML = { antes: fs.readFileSync(BASE, 'utf8'), despues: fs.readFileSync(path.join(RAIZ, 'public/index.html'), 'utf8') };
const b64 = (n) => fs.readFileSync(path.join(DV, n)).toString('base64');
// DejaVu NO va por la red ni en el HTML: un data: URI de 1,9 MB bajo 4G retrasa el primer pintado hasta
// después de Inter y da CLS 0 (medido en la primera pasada de este banco). Se registra con FontFace desde
// un ArrayBuffer en evaluateOnNewDocument, que es lo más parecido a una fuente instalada.
const DV64 = { r: b64('DejaVuSans.ttf'), b: b64('DejaVuSans-Bold.ttf') };
const MARCA = '<meta name="sonda-1570c">';
const ESPERA = '<link rel="stylesheet" href="/__sonda/espera.css"/>'; // igual en todas: retiene el primer pintado 700 ms como en g-espera.txt

function inyeccion(version, reserva) {
  if (reserva === 'sistema') return { html: MARCA + ESPERA, caras: [] };
  if (reserva === 'arial') return { html: MARCA + (version === 'antes' ? '<style>:root{--font:"Inter","Arial"}</style>' : '') + ESPERA, caras: [] };
  if (version === 'antes') return { html: MARCA + '<style>:root{--font:"Inter","SondaDV"}</style>' + ESPERA,
    caras: [{ fam: 'SondaDV', f: 'r', d: { weight: '100 500' } }, { fam: 'SondaDV', f: 'b', d: { weight: '600 900' } }] };
  // Después: las tres caras 'YaQu Reserva DejaVu' del index.html servido, con SUS descriptores, bajo el
  // nombre SondaDV (las de local() no resuelven en esta máquina), y la pila del index.html sin la cara Arial.
  const reglas = HTML.despues.match(/@font-face\{font-family:'YaQu Reserva DejaVu';[^}]*\}/g) || [];
  if (reglas.length !== 3) throw new Error('CIEGO: esperaba 3 caras YaQu Reserva DejaVu en index.html, hay ' + reglas.length);
  const desc = (r, k) => (r.match(new RegExp(k + ':([^;}]*)')) || [])[1];
  const caras = reglas.map((r) => ({ fam: 'SondaDV', f: /font-weight:100 500/.test(r) ? 'r' : 'b',
    d: { weight: desc(r, 'font-weight'), sizeAdjust: desc(r, 'size-adjust'), ascentOverride: desc(r, 'ascent-override'),
      descentOverride: desc(r, 'descent-override'), lineGapOverride: desc(r, 'line-gap-override'), unicodeRange: desc(r, 'unicode-range') } }));
  const pila = HTML.despues.match(/--font:([^;]*);/)[1].replace(/'YaQu Reserva Arial',/, '').replace(/'YaQu Reserva DejaVu'/, '"SondaDV"');
  return { html: MARCA + '<style>:root{--font:' + pila + '}</style>' + ESPERA, caras, desc: caras.map((c) => JSON.stringify(c.d)).join(' ') };
}

function servir(version, reserva, caso, fuente) {
  const iny = inyeccion(version, reserva);
  const html = HTML[version].replace('</head>', iny.html + '</head>');
  const srv = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/public/founding-status') {
      const c = CASOS[caso];
      if (!c) { res.writeHead(500); res.end('boom'); return; }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ price: 9.9, seatsTotal: 20, seatsLeft: c.seatsLeft, taken: c.taken })); return;
    }
    if (url === '/__sonda/espera.css') { setTimeout(() => { res.writeHead(200, { 'content-type': 'text/css' }); res.end(''); }, 700); return; }
    if (url === '/' || url === '/index.html') { res.writeHead(200, { 'content-type': TIPOS['.html'] }); res.end(html); return; }
    const f = path.join(RAIZ, 'public', url);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
    if (f.endsWith('.woff2') && fuente === 'rota') { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ srv, puerto: srv.address().port, caras: iny.caras, desc: iny.desc })));
}

async function medir(nav, puerto, ancho, caras) {
  const p = await nav.newPage();
  await p.setViewport({ width: ancho, height: 780, deviceScaleFactor: 2 });
  const cdp = await p.target().createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 170, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (4 * 1024 * 1024) / 8 });
  if (caras.length) await p.evaluateOnNewDocument((caras, DV64) => {
    const buf = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0)).buffer;
    const bufs = { r: buf(DV64.r), b: buf(DV64.b) };
    for (const c of caras) { const f = new FontFace(c.fam, bufs[c.f], Object.fromEntries(Object.entries(c.d).filter(([, v]) => v))); document.fonts.add(f); }
  }, caras, DV64);
  await p.evaluateOnNewDocument(() => {
    window.__cls = 0; window.__obs = 0; window.__s = [];
    new PerformanceObserver((l) => { window.__obs++; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { window.__obs++; for (const e of l.getEntries()) if (!e.hadRecentInput) {
      window.__cls += e.value;
      window.__s.push(Math.round(e.value * 1000) / 1000 + '@' + Math.round(e.startTime) + ' ' + e.sources.map((s) => (s.node ? s.node.nodeName + (s.node.className && typeof s.node.className === 'string' ? '.' + s.node.className.split(' ')[0] : '') : '?') + ' ' + Math.round(s.previousRect.y) + '→' + Math.round(s.currentRect.y)).join(' | '));
    } }).observe({ type: 'layout-shift', buffered: true });
    // Alto del subtítulo en el PRIMER pintado (con la reserva), para compararlo con el final.
    requestAnimationFrame(function mira() { const s = document.querySelector('.hero .sub'); if (s && s.getBoundingClientRect().height) window.__sub0 = Math.round(s.getBoundingClientRect().height); else requestAnimationFrame(mira); });
  });
  await p.goto('http://127.0.0.1:' + puerto + '/index.html', { waitUntil: 'networkidle2' });
  await p.evaluate(() => new Promise((ok) => setTimeout(ok, 1200)));
  const r = await p.evaluate(() => {
    const fam = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''));
    return { cls: Math.round(window.__cls * 1000) / 1000, obs: window.__obs, s: window.__s, sub0: window.__sub0,
      sub: Math.round(document.querySelector('.hero .sub').getBoundingClientRect().height),
      marca: !!document.querySelector('meta[name="sonda-1570c"]'), cargadas: [...new Set(fam)].sort().join(',') };
  });
  await p.close();
  return r;
}

const nav = await lanzarNavegador(puppeteer, {});
console.log('SCRUM-1570c · banco (a) · Edge de Windows, 4G emulada · ' + REP + ' repeticiones por fila · anchos ' + ANCHOS.join(','));
console.log('reserva  versión  fuente  caso      ancho · CLS (cada repetición) · sub primer pintado→final · familias cargadas · saltos de la 1ª');
let ciegos = 0;
for (const reserva of ['sistema', 'arial', 'dejavu']) for (const version of ['antes', 'despues']) for (const fuente of ['ok', 'rota']) for (const caso of Object.keys(CASOS)) {
  if (fuente === 'rota' && caso !== 'vendidas') continue; // el control basta con un caso
  const { srv, puerto, caras, desc } = await servir(version, reserva, caso, fuente);
  if (desc && caso === 'vendidas' && fuente === 'ok') console.log('        descriptores SondaDV: ' + desc);
  for (const ancho of ANCHOS) {
    const rs = [];
    for (let i = 0; i < REP; i++) rs.push(await medir(nav, puerto, ancho, caras));
    const r0 = rs[0];
    let nota = '';
    if (rs.some((r) => !r.marca || !r.obs)) { nota = ' ⚠ CIEGO: sin inyección o sin observador'; ciegos++; }
    const esperada = reserva === 'dejavu' ? 'SondaDV' : (version === 'despues' ? 'YaQu Reserva Arial' : null);
    if (esperada && !rs.every((r) => r.cargadas.split(',').includes(esperada))) { nota += ' ⚠ CIEGO: la reserva ' + esperada + ' no está cargada'; ciegos++; }
    console.log(reserva.padEnd(8) + ' ' + version.padEnd(8) + ' ' + fuente.padEnd(6) + ' ' + caso.padEnd(9) + String(ancho).padStart(5)
      + ' · CLS ' + rs.map((r) => r.cls).join(' / ') + ' · sub ' + r0.sub0 + '→' + r0.sub + ' · ' + r0.cargadas + nota);
    for (const s of r0.s) console.log('        ' + s);
  }
  srv.close();
}
await nav.close();
console.log(ciegos ? 'CIEGO en ' + ciegos + ' filas' : 'todas las filas con inyección, observador y la reserva esperada cargada');
process.exit(ciegos ? 2 : 0);
