// SCRUM-1570c · ¿cambia el aspecto con Inter CARGADA? A mano:
//   node cajas.mjs <raizRepo> <html base> [anchos]
// Sirve public/ con index.html = <html base> («antes») o el del árbol («después»), espera a Inter y
// compara la caja (x, y, ancho, alto) de CADA elemento del <body>, emparejados por su posición en el
// árbol del DOM, más la familia que pintó cada nodo de texto (document.fonts cargadas). Dice cuántos
// elementos comparó y cuántos difieren en más de 0,5 px, con los primeros.
// Control positivo: una tercera versión, «sembrada», que es la de después con el subtítulo del hero
// a 17px; si el comparador no la ve distinta, sale CIEGO.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2]);
const ANCHOS = (process.argv[4] || '360,390,768,1280').split(',').map(Number);
const puppeteer = createRequire(path.join(RAIZ, 'package.json'))('puppeteer-core');
const { lanzarNavegador } = await import(pathToFileURL(path.join(RAIZ, 'scripts/_navegador.mjs')).href);
const despues = fs.readFileSync(path.join(RAIZ, 'public/index.html'), 'utf8');
const HTML = { antes: fs.readFileSync(process.argv[3], 'utf8'), despues, sembrada: despues.replace('</head>', '<style>.hero .sub{font-size:17px!important}</style></head>') };

const srv = http.createServer((q, r) => {
  const url = q.url.split('?')[0];
  if (url === '/public/founding-status') { r.writeHead(200, { 'content-type': 'application/json' }); r.end('{"price":9.9,"seatsTotal":20,"seatsLeft":18,"taken":2}'); return; }
  const v = url.match(/^\/(antes|despues|sembrada)\.html$/);
  if (v) { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(HTML[v[1]]); return; }
  const f = path.join(RAIZ, 'public', url);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' }); r.end(fs.readFileSync(f));
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const nav = await lanzarNavegador(puppeteer, {});
async function cajas(v, ancho) {
  const p = await nav.newPage();
  await p.setViewport({ width: ancho, height: 900 });
  await p.goto('http://127.0.0.1:' + srv.address().port + '/' + v + '.html', { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise((ok) => setTimeout(ok, 1500)); // la barra de anuncio y las animaciones de entrada
  const r = await p.evaluate(() => {
    document.getAnimations().forEach((a) => a.cancel()); // las infinitas (pulso del botón) mueven las cajas
    const out = [];
    const walk = (el, ruta) => {
      const b = el.getBoundingClientRect();
      out.push({ ruta, x: b.x, y: b.y + scrollY, w: b.width, h: b.height });
      [...el.children].forEach((c, i) => walk(c, ruta + '>' + c.nodeName.toLowerCase() + (c.id ? '#' + c.id : c.classList[0] ? '.' + c.classList[0] : '') + ':' + i));
    };
    walk(document.body, 'body');
    return { cajas: out, familias: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')))].sort().join(','), alto: document.documentElement.scrollHeight };
  });
  await p.close();
  return r;
}
let ciego = false;
console.log('SCRUM-1570c · cajas con Inter cargada · antes = origin/main, después = este árbol');
for (const ancho of ANCHOS) {
  const A = await cajas('antes', ancho), D = await cajas('despues', ancho), S = await cajas('sembrada', ancho);
  const compara = (X, Y) => {
    const m = new Map(Y.cajas.map((c) => [c.ruta, c]));
    const dif = [];
    let comunes = 0;
    for (const c of X.cajas) { const d = m.get(c.ruta); if (!d) { dif.push(c.ruta + ' (sólo en uno)'); continue; } comunes++;
      const delta = Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y), Math.abs(c.w - d.w), Math.abs(c.h - d.h));
      if (delta > 0.5) dif.push(c.ruta.split('>').slice(-2).join('>') + ' Δ' + delta.toFixed(1) + ' (' + [c.y, c.h].map(Math.round) + '→' + [d.y, d.h].map(Math.round) + ')'); }
    return { comunes, total: X.cajas.length + '/' + Y.cajas.length, dif };
  };
  const ad = compara(A, D), as = compara(D, S);
  if (!as.dif.length) ciego = true;
  console.log(`${ancho}px · antes↔después: ${ad.comunes} cajas comparadas (${ad.total}), ${ad.dif.length} difieren · alto de página ${A.alto}→${D.alto} · familias cargadas antes [${A.familias}] después [${D.familias}]`);
  for (const d of ad.dif.slice(0, 8)) console.log('    ' + d);
  console.log(`        control sembrado (subtítulo a 17px): ${as.dif.length} difieren${as.dif.length ? '' : '  ⚠ CIEGO'}`);
}
await nav.close(); srv.close();
process.exit(ciego ? 2 : 0);
