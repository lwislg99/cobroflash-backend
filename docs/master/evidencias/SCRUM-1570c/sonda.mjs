// Sonda SCRUM-1570c (fuera del árbol). Uso: node sonda.mjs <raizRepo> alturas|cls
// alturas: alto de #announce con la fuente de reserva (woff2 → 404) y con Inter, por ancho y caso.
// cls: CLS y fuentes de cada salto con las .woff2 retrasadas N ms.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2]);
const modo = process.argv[3] || 'alturas';
const puppeteer = createRequire(path.join(RAIZ, 'package.json'))('puppeteer-core');
const { lanzarNavegador } = await import(pathToFileURL(path.join(RAIZ, 'scripts/_navegador.mjs')).href);
const CASOS = { vendidas: { taken: 2, seatsLeft: 18 }, cero: { taken: 0, seatsLeft: 20 }, roto: null };
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };

// RESERVA=<carpeta con DejaVuSans.ttf y DejaVuSans-Bold.ttf>: la copia SERVIDA (no el árbol) pone
// DejaVu, en data: URI, detrás de Inter en --font, para emular la reserva del runner de Ubuntu.
let INYECCION = '';
// RESERVA_LOCAL=<familia instalada> (p. ej. Arial = métricas de Liberation Sans): sin data: URI.
if (process.env.RESERVA_LOCAL) INYECCION = '<style>:root{--font:"Inter","' + process.env.RESERVA_LOCAL + '"}</style>';
else if (process.env.RESERVA) {
  const b64 = (n) => fs.readFileSync(path.join(process.env.RESERVA, n)).toString('base64');
  INYECCION = '<style>@font-face{font-family:"SondaReserva";font-weight:100 500;font-display:block;src:url(data:font/ttf;base64,' + b64('DejaVuSans.ttf') + ') format("truetype")}'
    + '@font-face{font-family:"SondaReserva";font-weight:600 900;font-display:block;src:url(data:font/ttf;base64,' + b64('DejaVuSans-Bold.ttf') + ') format("truetype")}'
    + ':root{--font:"Inter","SondaReserva"}</style>'
    + '<script>document.fonts.load("400 16px SondaReserva");document.fonts.load("700 16px SondaReserva")</script>'
    + '<link rel="stylesheet" href="/__sonda/espera.css"/>';
}

function servir(caso, fuente) { // fuente: 'ok' | 'rota' | número de ms de retraso
  const srv = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/public/founding-status') {
      const c = CASOS[caso];
      if (!c) { res.writeHead(500); res.end('boom'); return; }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ price: 9.9, seatsTotal: 20, seatsLeft: c.seatsLeft, taken: c.taken })); return;
    }
    if (url === '/__sonda/espera.css') { setTimeout(() => { res.writeHead(200, { 'content-type': 'text/css' }); res.end('/* */'); }, 700); return; }
    const f = path.join(RAIZ, 'public', url === '/' ? '/index.html' : url);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
    const enviar = () => {
      res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
      if (INYECCION && f.endsWith('index.html')) res.end(fs.readFileSync(f, 'utf8').replace('</head>', INYECCION + '</head>'));
      else res.end(fs.readFileSync(f));
    };
    if (f.endsWith('.woff2')) {
      if (fuente === 'rota') { res.writeHead(404); res.end('no'); return; }
      if (typeof fuente === 'number') { setTimeout(enviar, fuente); return; }
    }
    enviar();
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ srv, puerto: srv.address().port })));
}

const nav = await lanzarNavegador(puppeteer, {});

if (modo === 'alturas') {
  const anchos = (process.argv[4] || '320,340,360,375,390,412,430,480,540,600,601,700,768,900,1024,1200,1440').split(',').map(Number);
  const filas = [];
  for (const caso of Object.keys(CASOS)) for (const fuente of ['rota', 'ok']) {
    const { srv, puerto } = await servir(caso, fuente);
    const p = await nav.newPage();
    for (const ancho of anchos) {
      await p.setViewport({ width: ancho, height: 780 });
      await p.goto('http://127.0.0.1:' + puerto + '/index.html', { waitUntil: 'networkidle0' });
      await p.evaluate(() => document.fonts.ready);
      const r = await p.evaluate(() => {
        const a = document.getElementById('announce');
        const i = a.querySelector('.announce-in');
        const fam = document.fonts.check('13.5px Inter') ;
        const hh=(q)=>Math.round(document.querySelector(q).getBoundingClientRect().height); return { h1: hh('#reg-hero'), sub: hh('.hero .sub'), hero: hh('section.hero'), alto: Math.round(a.getBoundingClientRect().height * 100) / 100, contenido: Math.round(i.scrollHeight), oculto: a.hidden, inter: fam,
          fuentes: [...document.fonts].filter((f) => f.status === 'loaded').length };
      });
      filas.push({ caso, fuente, ancho, ...r });
    }
    await p.close(); srv.close();
  }
  console.log('caso      ancho  reserva  inter  (contenido reserva/inter) · fuentes cargadas reserva/inter');
  for (const caso of Object.keys(CASOS)) for (const ancho of anchos) {
    const a = filas.find((f) => f.caso === caso && f.ancho === ancho && f.fuente === 'rota');
    const b = filas.find((f) => f.caso === caso && f.ancho === ancho && f.fuente === 'ok');
    console.log(caso.padEnd(9) + String(ancho).padStart(5) + String(a.alto).padStart(9) + String(b.alto).padStart(7)
      + (a.alto !== b.alto ? '  ≠' : '   ') + '  (' + a.contenido + '/' + b.contenido + ') · ' + a.fuentes + '/' + b.fuentes + ' · h1 ' + a.h1 + '/' + b.h1 + ' · sub ' + a.sub + '/' + b.sub + ' · hero ' + a.hero + '/' + b.hero);
  }
} else {
  const anchos = (process.argv[4] || '360,390').split(',').map(Number);
  // -1 = Inter rota (404): el control de que la reserva no salta por sí sola.
  const retrasos = (process.argv[5] || '0,300,1000').split(',').map(Number).map((n) => (n < 0 ? 'rota' : n));
  for (const caso of Object.keys(CASOS)) for (const ms of retrasos) {
    const { srv, puerto } = await servir(caso, ms);
    for (const ancho of anchos) {
      const p = await nav.newPage();
      await p.setViewport({ width: ancho, height: 780, deviceScaleFactor: 2 });
      await p.evaluateOnNewDocument(() => {
        window.__cls = 0; window.__obs = 0; window.__s = [];
        new PerformanceObserver((l) => { window.__obs++; for (const e of l.getEntries()) if (!e.hadRecentInput) {
          window.__cls += e.value;
          window.__s.push({ v: Math.round(e.value * 1000) / 1000, t: Math.round(e.startTime),
            src: e.sources.map((s) => (s.node ? (s.node.nodeName + (s.node.id ? '#' + s.node.id : '') + (s.node.className && typeof s.node.className === 'string' ? '.' + s.node.className.split(' ')[0] : '')) : '?')
              + ' ' + Math.round(s.previousRect.y) + '→' + Math.round(s.currentRect.y) + ' h' + Math.round(s.previousRect.height) + '→' + Math.round(s.currentRect.height)) });
        } }).observe({ type: 'layout-shift', buffered: true });
      });
      await p.goto('http://127.0.0.1:' + puerto + '/index.html', { waitUntil: 'networkidle2' });
      await p.evaluate(() => new Promise((ok) => setTimeout(ok, 1200 + 0)));
      await p.evaluate(() => document.fonts.ready);
      await new Promise((ok) => setTimeout(ok, 300));
      const r = await p.evaluate(() => ({ cls: Math.round(window.__cls * 1000) / 1000, obs: window.__obs, s: window.__s,
        alto: Math.round(document.getElementById('announce').getBoundingClientRect().height), inter: document.fonts.check('13.5px Inter') }));
      console.log(caso.padEnd(9) + String(ancho).padStart(5) + ' retraso ' + String(ms).padStart(5) + ' · CLS ' + r.cls + ' · obs ' + r.obs + ' · barra ' + r.alto + ' · inter ' + r.inter);
      for (const s of r.s) console.log('      ' + s.v + '@' + s.t + ' ' + s.src.join(' | '));
      await p.close();
    }
    srv.close();
  }
}
await nav.close();
