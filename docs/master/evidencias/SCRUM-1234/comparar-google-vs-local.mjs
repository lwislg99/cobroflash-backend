// Compara píxel a píxel la misma página con Inter servida por Google y servida desde /fonts/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/package.json');
const puppeteer = require('puppeteer-core');

const PUB = path.resolve('public');
const GOOGLE = '<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>';
const LOCAL = '<link rel="stylesheet" href="/fonts/inter.css"/>';
const cuerpo = `<body style="font-family:Inter,sans-serif;margin:16px;width:360px;color:#111">
${[300, 400, 500, 600, 650, 700, 800, 900].map((w) => `<p style="font-weight:${w};font-size:17px;margin:4px 0">${w} · Presupuesto nº P260001 — 1.234,56 € · Añadir línea · ÁÉÍÓÚ ñÑ ¿? ¡! Ç ü «» 0123456789 Δ Ж ệ</p>`).join('\n')}
<p style="font-size:13px;font-style:italic">Cursiva sintética 13px · firma del cliente</p>
<h1 style="font-weight:800;font-size:32px">Cobrar el resto</h1></body>`;
const pagina = (cabeza) => `<!doctype html><html><head><meta charset="utf-8">${cabeza}</head>${cuerpo}</html>`;

const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/g.html') { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(pagina(GOOGLE)); }
  if (u === '/l.html') { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(pagina(LOCAL)); }
  const f = path.join(PUB, u);
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', f.endsWith('.css') ? 'text/css' : 'font/woff2');
  fs.createReadStream(f).pipe(res);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}`;
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const fotos = {};
const peticionesGoogle = { g: 0, l: 0 };
for (const k of ['g', 'l']) {
  const p = await nav.newPage(); await p.setViewport({ width: 390, height: 700, deviceScaleFactor: 2 });
  p.on('request', (r) => { if (/fonts\.(googleapis|gstatic)/.test(r.url())) peticionesGoogle[k] += 1; });
  await p.goto(`${base}/${k}.html`, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  const cargadas = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').length);
  fotos[k] = await p.screenshot({ fullPage: true });
  fs.writeFileSync(path.join(process.argv[2], `fuente-${k}.png`), fotos[k]);
  console.log(k, 'caras cargadas:', cargadas);
  await p.close();
}
await nav.close(); srv.close();
console.log('peticiones a Google:', JSON.stringify(peticionesGoogle));
console.log('bytes PNG g/l:', fotos.g.length, fotos.l.length, 'IDÉNTICAS:', Buffer.compare(fotos.g, fotos.l) === 0);
