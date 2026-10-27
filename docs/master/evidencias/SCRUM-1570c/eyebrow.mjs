// SCRUM-1570c · por qué el «eyebrow» del hero cambia de líneas a 360 con la DejaVu ajustada. A mano:
//   node eyebrow.mjs <raizRepo> <carpeta DejaVu> [ancho]
// Sirve public/ del árbol; registra la DejaVu (sin red) con los descriptores de las caras
// 'YaQu Reserva DejaVu' del index.html y mide, con Inter y con la reserva, el ancho del texto del
// eyebrow, el hueco de su contenedor y sus líneas.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2]);
const DV = process.argv[3];
const ANCHO = Number(process.argv[4] || 360);
const puppeteer = createRequire(path.join(RAIZ, 'package.json'))('puppeteer-core');
const { lanzarNavegador } = await import(pathToFileURL(path.join(RAIZ, 'scripts/_navegador.mjs')).href);
const html = fs.readFileSync(path.join(RAIZ, 'public/index.html'), 'utf8');
const reglas = html.match(/@font-face\{font-family:'YaQu Reserva DejaVu';[^}]*\}/g) || [];
if (reglas.length !== 3) { console.error('CIEGO: ' + reglas.length + ' caras'); process.exit(2); }
const desc = (r, k) => (r.match(new RegExp(k + ':([^;}]*)')) || [])[1];
const caras = reglas.map((r) => ({ f: /font-weight:100 500/.test(r) ? 'r' : 'b', d: { weight: desc(r, 'font-weight'), sizeAdjust: desc(r, 'size-adjust'), ascentOverride: desc(r, 'ascent-override'), descentOverride: desc(r, 'descent-override'), lineGapOverride: desc(r, 'line-gap-override') } }));
const DV64 = { r: fs.readFileSync(path.join(DV, 'DejaVuSans.ttf')).toString('base64'), b: fs.readFileSync(path.join(DV, 'DejaVuSans-Bold.ttf')).toString('base64') };

const srv = http.createServer((q, r) => {
  const url = q.url.split('?')[0];
  if (url === '/public/founding-status') { r.writeHead(200, { 'content-type': 'application/json' }); r.end('{"price":9.9,"seatsTotal":20,"seatsLeft":18,"taken":2}'); return; }
  const f = path.join(RAIZ, 'public', url === '/' ? 'index.html' : url);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); r.end(fs.readFileSync(f));
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const nav = await lanzarNavegador(puppeteer, {});
const p = await nav.newPage();
await p.setViewport({ width: ANCHO, height: 780 });
await p.evaluateOnNewDocument((caras, DV64) => {
  const buf = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0)).buffer;
  for (const c of caras) document.fonts.add(new FontFace('SondaDV', buf(DV64[c.f]), c.d));
}, caras, DV64);
await p.goto('http://127.0.0.1:' + srv.address().port + '/index.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
const r = await p.evaluate(() => {
  const e = document.querySelector('.hero .eyebrow');
  const mide = (fam) => {
    e.style.setProperty('font-family', fam);
    const rg = document.createRange(); rg.selectNodeContents(e);
    const lineas = new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size;
    const out = { fam, alto: Math.round(e.getBoundingClientRect().height * 10) / 10, ancho: Math.round(e.getBoundingClientRect().width * 10) / 10, lineas };
    // ancho del texto en una sola línea
    const s = document.createElement('span'); s.textContent = e.textContent; s.style.cssText = 'position:absolute;white-space:nowrap;visibility:hidden'; e.appendChild(s);
    out.textoEnUnaLinea = Math.round(s.getBoundingClientRect().width * 10) / 10; s.remove();
    return out;
  };
  const padre = e.parentElement.getBoundingClientRect().width;
  const a = mide('Inter'), b = mide('SondaDV'); e.style.removeProperty('font-family');
  return { texto: e.textContent, padre: Math.round(padre * 10) / 10, inter: a, reserva: b };
});
await nav.close(); srv.close();
console.log(`ancho ${ANCHO} · «${r.texto}» · hueco del contenedor ${r.padre}px`);
for (const k of ['inter', 'reserva']) console.log(`  ${k.padEnd(8)} texto en una línea ${r[k].textoEnUnaLinea}px · caja ${r[k].ancho}×${r[k].alto} · líneas ${r[k].lineas}`);
