// Sonda: qué fuente PINTA de verdad Chromium en el campo `.input` del panel, según cómo se sirva la página.
// Uso: node sonda-fuente.mjs <raíz del árbol> [--prod]
// Lee el árbol; no escribe nada en él. Navegador por el módulo común de la casa (_navegador.mjs).
//
// La pregunta se contesta con CSS.getPlatformFontsForNode (CDP): la fuente que el motor USÓ para
// los glifos del nodo, no la que pide el CSS. Y con document.fonts: si la FontFace «Inter» llegó a
// cargarse.
//
// Controles:
//   · POSITIVO SEMBRADO: el caso «inter.css + woff2 servido como font/woff2» TIENE que pintar Inter.
//     Si no, la sonda no sabe ver Inter y todo lo demás es CIEGO.
//   · NEGATIVO: el caso «sin inter.css» NO puede pintar Inter.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2] || '.');
const PROD = process.argv.includes('--prod');
const PUBLIC = path.join(RAIZ, 'public');
const req = createRequire(path.join(RAIZ, 'scripts', 'x.mjs'));
const puppeteer = (await import(pathToFileURL(req.resolve('puppeteer-core')).href)).default;
const { lanzarNavegador } = await import(pathToFileURL(path.join(RAIZ, 'scripts', '_navegador.mjs')).href);

// Los tipos que usan los servidores de los guards (copiados de guard-objetivo-tactil.mjs:185): sin woff2.
const TIPOS_GUARD = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const TIPOS_BIEN = { ...TIPOS_GUARD, '.woff2': 'font/woff2' };

const CAMPO = '<div><input class="input" id="__campo" placeholder="Buscar cliente…" value="Fontanería Soler"><span id="__texto">Fontanería Soler 0123456789</span></div>';
const hoja = (conInter) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${conInter ? '<link rel="stylesheet" href="/fonts/inter.css">' : ''}<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css">
</head><body><div class="view-container">${CAMPO}</div></body></html>`;

let tipos = TIPOS_GUARD;
const pedidas = [];
const srv = http.createServer((rq, rs) => {
  let p = decodeURIComponent(rq.url.split('?')[0]);
  pedidas.push(p);
  if (p === '/__sin') { rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return rs.end(hoja(false)); }
  if (p === '/__con') { rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return rs.end(hoja(true)); }
  if (p === '/') p = '/index.html';
  const abs = path.join(PUBLIC, p);
  if (!abs.startsWith(PUBLIC) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { rs.writeHead(404); return rs.end('no'); }
  rs.writeHead(200, { 'Content-Type': tipos[path.extname(abs)] || 'application/octet-stream' });
  rs.end(fs.readFileSync(abs));
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${srv.address().port}`;

const nav = await lanzarNavegador(puppeteer, { headless: 'new' });
if (!nav) { console.log('CIEGO: el navegador no arrancó'); process.exit(3); }
console.log(`navegador: ${await nav.version()} · plataforma ${process.platform}`);

async function medir(etiqueta, url, { js = true, inyectar = false, ancho = 929 } = {}) {
  const page = await nav.newPage();
  await page.setViewport({ width: ancho, height: 900 });
  await page.setJavaScriptEnabled(js);
  pedidas.length = 0;
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  } catch (e) {
    console.log(`${etiqueta}: CIEGO (goto: ${e.message.split('\n')[0]})`);
    await page.close(); return null;
  }
  if (inyectar) {
    await page.evaluate((html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.prepend(d.firstElementChild); }, CAMPO);
  }
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 300));
  const info = await page.evaluate(() => {
    const el = document.getElementById('__campo');
    const caras = [...document.fonts].filter((f) => /inter/i.test(f.family));
    return {
      hayCampo: !!el,
      familiaPedida: el ? getComputedStyle(el).fontFamily : getComputedStyle(document.body).fontFamily,
      alto: el ? Math.round(el.getBoundingClientRect().height * 100) / 100 : null,
      carasInter: caras.length,
      carasCargadas: caras.filter((f) => f.status === 'loaded').length,
      carasError: caras.filter((f) => f.status === 'error').length,
      check: document.fonts.check('16px Inter'),
      fontsCss: [...document.styleSheets].some((s) => (s.href || '').includes('/fonts/inter.css')),
    };
  });
  // La fuente que el motor USÓ: CDP sobre el campo (o el body si no lo hay).
  const cdp = await page.createCDPSession();
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#__texto' });
  let usada = '(sin nodo)';
  if (nodeId) {
    // Primera versión: buscaba el texto interno del input con un SEGUNDO DOM.getDocument, que
    // invalida los nodeId del primero → «(vacío)» en los 8 casos; lo cazó el positivo sembrado.
    // Ahora se mide un <span> hermano del campo, que hereda la misma familia (font-family: inherit).
    try {
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      usada = fonts.map((f) => `${f.familyName}${f.isCustomFont ? ' (web)' : ''} ×${f.glyphCount}`).join(', ') || '(vacío)';
    } catch (e) { usada = `(error CDP: ${e.message})`; }
  }
  const woff = pedidas.filter((p) => p.endsWith('.woff2'));
  console.log(`${etiqueta}\n   pide: ${info.familiaPedida}\n   USA: ${usada}\n   inter.css enlazada: ${info.fontsCss} · caras Inter: ${info.carasInter} (cargadas ${info.carasCargadas}, error ${info.carasError}) · fonts.check: ${info.check}${woff.length ? ` · woff2 pedidos: ${woff.join(' ')}` : ''}${info.alto != null ? `\n   alto de la caja .input: ${info.alto} px` : ''}`);
  await page.close();
  return { usada, ...info };
}

const r = {};
tipos = TIPOS_GUARD;
r.sin = await medir('A · banco del guard táctil (sin inter.css, tipos del guard)', `${BASE}/__sin`);
r.conGuard = await medir('B · banco + inter.css, woff2 servido como octet-stream (tipos del guard)', `${BASE}/__con`);
tipos = TIPOS_BIEN;
r.conBien = await medir('C · banco + inter.css, woff2 como font/woff2  [POSITIVO SEMBRADO]', `${BASE}/__con`);
r.landing = await medir('D · landing real public/index.html (sin JS, campo inyectado)', `${BASE}/`, { js: false, inyectar: true });
r.login = await medir('E · login real public/login.html (sin JS, campo inyectado)', `${BASE}/login.html`, { js: false, inyectar: true });
r.panel = await medir('F · panel real public/dashboard/index.html (sin JS, campo inyectado)', `${BASE}/dashboard/index.html`, { js: false, inyectar: true });
if (PROD) {
  r.prodLanding = await medir('G · https://yaqu.app/ (producción, sin JS, campo inyectado)', 'https://yaqu.app/', { js: false, inyectar: true });
  r.prodLogin = await medir('H · https://yaqu.app/login.html (producción, sin JS, campo inyectado)', 'https://yaqu.app/login.html', { js: false, inyectar: true });
}
await nav.close(); srv.close();

const esInter = (x) => x && /\bInter\b/.test(x.usada);
let codigo = 0;
if (!esInter(r.conBien)) { console.log('\nCIEGO: el positivo sembrado (C) no pinta Inter — la sonda no sabe ver Inter'); codigo = 2; }
else if (esInter(r.sin)) { console.log('\nCIEGO: el negativo (A) pinta Inter sin enlazar la hoja — la sonda no discrimina'); codigo = 2; }
else console.log('\ncontroles: positivo C pinta Inter · negativo A no la pinta → la sonda discrimina');
process.exit(codigo);
