// Banco SCRUM-1698 · sirve la vista y el CSS REALES y fotografía el parte FIRMADO a 390.
// /antes/* = copia de origin/main (en ./antes), /despues/* = el árbol. Sin red: sólo 127.0.0.1.
// Uso: node capturar.mjs <raiz-del-arbol> <carpeta-de-salida>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [, , ARBOL, OUT] = process.argv;
const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const PUBLIC = path.join(ARBOL, 'public');
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LOCALAPPDATA + '/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const EXE = process.env.LOCALAPPDATA + '/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe';

const PARTE = {
  id: 5, jobId: 77, numero: 'PT-2026-005', clienteNombre: 'Cliente de prueba',
  fecha: '2026-11-10T08:00:00.000Z', obra: 'Calle Mayor 14', referencia: '', entrada: null, salida: '', 
  desplazamientos: null, kilometros: 0, tecnicos: ['Operario QA'], tipo: 'reparacion_asistencia',
  lineas: [
    { id: 'l1', bloque: 'mano_obra', unds: 2.5, descripcion: 'Cambio de latiguillos' },
    { id: 'l2', bloque: 'materiales', unds: 2, descripcion: 'Latiguillo 40 cm' },
  ],
  notas: '', estado: 'firmado', firmoElCliente: true, firmoElTecnico: true,
  firmadoPorNombre: 'Cliente de prueba', firmadoTecnicoNombre: 'Operario QA',
  puedeEditarContenido: { ok: false, motivo: 'firmado' }, puedeEditarPrecios: { ok: true, motivo: null },
};

const pagina = (lado) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/fonts/inter.css"><link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/dashboard/css/styles.css"></head>
<body style="background:var(--bg);margin:0"><main style="padding:16px"><div class="card" id="c"></div></main>
<script src="/${lado}/dashboard/js/parteDetailView.js"></script>
<script>window.__ok = renderParte(document.getElementById('c'), ${JSON.stringify(PARTE)});</script></body></html>`;

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const m = u.pathname.match(/^\/banco\/(antes|despues)$/);
  if (m) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(pagina(m[1])); }
  let f;
  if (u.pathname.startsWith('/antes/')) f = path.join(AQUI, u.pathname);
  else if (u.pathname.startsWith('/despues/')) f = path.join(PUBLIC, u.pathname.slice('/despues'.length));
  else f = path.join(PUBLIC, u.pathname);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': (TIPOS[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(d);
  });
});

await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + srv.address().port;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, headless: true });
try {
  for (const lado of ['antes', 'despues']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(base + '/banco/' + lado);
    const ok = await p.evaluate(() => window.__ok);
    if (ok !== true) throw new Error('🔴 SUELO: la vista no pintó en ' + lado);
    // Orden de lo pintado, medido en el DOM (no leído del código).
    const orden = await p.evaluate(() => {
      const marcas = [['cabecera', 'header'], ['datos', '[data-parte-datos-del-parte]'], ['horas', '.parte-horas'],
        ['mano_obra', '[data-parte-bloque="mano_obra"]'], ['materiales', '[data-parte-bloque="materiales"]'],
        ['firmas', '[data-parte-firmas]'], ['volver', '[data-parte-salida]']];
      return marcas.map(([k, s]) => { const e = document.querySelector(s); return [k, e ? Math.round(e.getBoundingClientRect().top) : null]; })
        .sort((a, b) => a[1] - b[1]).map(([k, y]) => k + '@' + y).join(' → ');
    });
    console.log(lado + ': ' + orden);
    await p.screenshot({ path: path.join(OUT, lado + '-firmado-390.png'), fullPage: true });
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.close();
}
