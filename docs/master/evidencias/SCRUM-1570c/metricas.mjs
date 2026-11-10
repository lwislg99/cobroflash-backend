// SCRUM-1570c · de dónde salen los overrides de la reserva. Fuera de la tanda; se corre a mano:
//   node metricas.mjs <raizRepo> <carpeta DejaVu (DejaVuSans.ttf, DejaVuSans-Bold.ttf)> [ancho]
// MUESTRA: el texto que la landing PINTA, leído del DOM con Inter cargada (ancho 390 por defecto), nodo
// a nodo, con su font-weight y su text-transform aplicado, repartido en los tres tramos de grosor de las
// caras de reserva: 100-500, 600-700 y 800-900. (Primera versión: el texto del HTML en bruto, casi todo
// minúsculas; dejaba la DejaVu negrita estrecha en MAYÚSCULAS, y a 360 el «eyebrow» del hero cabía en
// una línea con la reserva y en dos con Inter: CLS 0,005 → 0,016. Medido en banco-a.txt de la 1ª pasada.)
// ANCHOS: los mide el navegador (canvas measureText) con cada fuente cargada por FontFace desde su
// fichero: Inter (public/fonts/inter-latin.woff2, variable, a SU grosor de cada nodo), Arial y Segoe UI
// (C:/Windows/Fonts; Liberation Sans y Arimo tienen las anchuras de Arial por diseño) y DejaVu Sans 2.37
// (regular para 100-500, negrita para el resto). fontkit 2.0.4 no instancia grosores de un woff2 variable.
// size-adjust = ancho Inter / ancho reserva, por tramo; ascent/descent/line-gap-override = hhea de Inter
// / upm / size-adjust (la fórmula de next/font y de capsize).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2]);
const DV = process.argv[3];
const ANCHO = Number(process.argv[4] || 390);
const req = createRequire(path.join(RAIZ, 'package.json'));
const fontkit = createRequire(path.join(RAIZ, '..', '..', '..', 'package.json'))('fontkit');
const puppeteer = req('puppeteer-core');
const { lanzarNavegador } = await import(pathToFileURL(path.join(RAIZ, 'scripts/_navegador.mjs')).href);

const FICH = {
  inter: path.join(RAIZ, 'public/fonts/inter-latin.woff2'),
  arial: 'C:/Windows/Fonts/arial.ttf', arialbd: 'C:/Windows/Fonts/arialbd.ttf',
  segoe: 'C:/Windows/Fonts/segoeui.ttf', segoebd: 'C:/Windows/Fonts/segoeuib.ttf',
  dv: path.join(DV, 'DejaVuSans.ttf'), dvbd: path.join(DV, 'DejaVuSans-Bold.ttf'),
};
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  const url = q.url.split('?')[0];
  if (url.startsWith('/__m/')) { const k = url.slice(5); if (!FICH[k]) { r.writeHead(404); r.end(); return; } r.writeHead(200); r.end(fs.readFileSync(FICH[k])); return; }
  if (url === '/public/founding-status') { r.writeHead(200, { 'content-type': 'application/json' }); r.end('{"price":9.9,"seatsTotal":20,"seatsLeft":18,"taken":2}'); return; }
  const f = path.join(RAIZ, 'public', url === '/' ? 'index.html' : url);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f));
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = 'http://127.0.0.1:' + srv.address().port;
const nav = await lanzarNavegador(puppeteer, {});
const p = await nav.newPage();
await p.setViewport({ width: ANCHO, height: 780 });
await p.goto(base + '/index.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
const M = await p.evaluate(async (base) => {
  // 1) La muestra: cada nodo de texto VISIBLE, con su grosor y su transformación.
  const segs = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.nodeName)) continue;
    let t = n.textContent.replace(/\s+/g, ' '); if (!t.trim()) continue;
    const r = document.createRange(); r.selectNodeContents(n); if (!r.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.textTransform === 'uppercase') t = t.toUpperCase(); else if (cs.textTransform === 'lowercase') t = t.toLowerCase();
    t = t.replace(/[^\u0020-\u024F\u2000-\u206F\u20AC]/g, ''); // fuera emojis y símbolos fuera del unicode-range de las caras
    if (t) segs.push({ t, w: Number(cs.fontWeight) });
  }
  // 2) Las fuentes, por fichero.
  const caras = [['M-Inter', 'inter', '100 900'], ['M-Arial', 'arial', '400'], ['M-Arial', 'arialbd', '700'],
    ['M-Segoe', 'segoe', '400'], ['M-Segoe', 'segoebd', '700'], ['M-DejaVu', 'dv', '400'], ['M-DejaVu', 'dvbd', '700']];
  for (const [fam, k, wt] of caras) { const f = new FontFace(fam, 'url(' + base + '/__m/' + k + ')', { weight: wt }); await f.load(); document.fonts.add(f); }
  const c = document.createElement('canvas').getContext('2d');
  const mide = (t, wt, fam) => { c.font = wt + ' 100px "' + fam + '"'; return c.measureText(t).width / 100; };
  const TRAMOS = { '100 500': [100, 500, 400], '600 700': [600, 700, 700], '800 900': [800, 900, 700] };
  const out = { segs: segs.length, tramos: {} };
  for (const [nombre, [lo, hi, wf]] of Object.entries(TRAMOS)) {
    const s = segs.filter((x) => x.w >= lo && x.w <= hi);
    const chars = s.reduce((a, x) => a + x.t.length, 0);
    const sum = (fam, fija) => s.reduce((a, x) => a + mide(x.t, fija || x.w, fam), 0);
    out.tramos[nombre] = { nodos: s.length, chars, inter: sum('M-Inter'), arial: sum('M-Arial', wf), segoe: sum('M-Segoe', wf), dejavu: sum('M-DejaVu', wf),
      mayus: s.reduce((a, x) => a + (x.t.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length, 0) };
  }
  // Control positivo: una familia que no existe mide igual que serif y distinto de Inter.
  const t0 = segs.map((x) => x.t).join(' ');
  out.nada = mide(t0, 400, 'M-NoExiste'); out.serif = mide(t0, 400, 'serif'); out.inter400 = mide(t0, 400, 'M-Inter');
  return out;
}, base);
await nav.close(); srv.close();

const T = M.tramos;
const chars = Object.values(T).reduce((a, x) => a + x.chars, 0);
if (M.segs < 50 || chars < 2000) { console.error('CIEGO: muestra de ' + M.segs + ' nodos / ' + chars + ' caracteres'); process.exit(2); }
if (Math.abs(M.nada - M.serif) > 1e-6 || Math.abs(M.inter400 - M.nada) < 1) { console.error('CIEGO: Inter no se distingue de una familia inexistente ' + JSON.stringify([M.nada, M.serif, M.inter400])); process.exit(2); }
for (const [k, x] of Object.entries(T)) if (!x.chars || ![x.inter, x.arial, x.dejavu].every((v) => Number.isFinite(v) && v > 0)) { console.error('CIEGO: tramo ' + k + ' vacío o no finito'); process.exit(2); }

const inter = fontkit.openSync(FICH.inter);
const h = inter.hhea, upm = inter.unitsPerEm, os2 = inter['OS/2'];
console.log(`muestra: ${M.segs} nodos de texto visibles de public/index.html a ${ANCHO} px, ${chars} caracteres`);
console.log(`control: familia inexistente ${M.nada.toFixed(2)} = serif ${M.serif.toFixed(2)} ≠ Inter 400 ${M.inter400.toFixed(2)} (em sobre la muestra entera)`);
console.log(`Inter: upm ${upm} · hhea ${h.ascent}/${h.descent}/${h.lineGap} · typo ${os2.typoAscender}/${os2.typoDescender}/${os2.typoLineGap} · win ${os2.winAscent}/${os2.winDescent}`);
const pct = (x) => (x * 100).toFixed(2) + '%';
for (const [tramo, x] of Object.entries(T)) {
  console.log(`tramo ${tramo}: ${x.nodos} nodos, ${x.chars} caracteres (${x.mayus} mayúsculas)`);
  for (const k of ['arial', 'segoe', 'dejavu']) {
    const sa = x.inter / x[k];
    console.log(`   ${k.padEnd(7)} size-adjust ${pct(sa)} · ascent-override ${pct(h.ascent / upm / sa)} · descent-override ${pct(-h.descent / upm / sa)} · line-gap-override ${pct(h.lineGap / upm / sa)}`);
  }
}
