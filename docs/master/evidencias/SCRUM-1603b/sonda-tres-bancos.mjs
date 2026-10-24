// Sólo lectura (SCRUM-1603b). ¿Con QUÉ FUENTE mide cada banco? La que el motor USÓ para los glifos
// (CDP `CSS.getPlatformFontsForNode`, como la sonda de J3 de SCRUM-1603), no la que pide el CSS.
// Uso: node sonda-tres-bancos.mjs <raiz>
//
// Casos:
//   A · `_banco-lista.mjs` de verdad (servirListas + abrirVista), Clientes            [POSITIVO: Inter]
//   B · el mismo, con `/fonts/inter.css` CORTADA en la red (B: aborto · B2: 404)     [NEGATIVO: no Inter,
//       y el banco lo CANTA en __errores — si calla, el banco mediría con la de reserva sin decirlo]
//   C · la cabecera que montan `guard-objetivo-tactil` y `censo-objetivo-tactil-panel`
//       (`enlacesDelPanel(PUBLIC)`), con un campo `.input`, y su espera (`esperarFuentes`) [POSITIVO]
//   D · la cabecera de ANTES de esta rama (tokens + styles a mano), mismo campo          [NEGATIVO]
// La sonda sale con 2 (CIEGO) si un positivo no pinta Inter o un negativo la pinta: entonces no discrimina.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(process.argv[2] || '.');
const PUBLIC = path.join(RAIZ, 'public');
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { servirListas, abrirNavegador, abrirVista } = await imp('scripts/_banco-lista.mjs');
const { enlacesDelPanel, esperarFuentes, cegueraDeLaFuente, decirFuente, TIPOS_DE_FUENTE } = await imp('scripts/_hojas-del-panel.mjs');

const DATOS = `(ruta) => {
  if (/\\/admin\\/merchant/.test(ruta)) return { id: 1, name: 'Fontanería Soler', country: 'ES', currency: 'EUR' };
  if (/\\/admin\\/customers/.test(ruta)) return [{ id: 1, name: 'Ana López', phone: '34000000001', email: 'ana@example.com' }];
  return [];
}`;

/** La fuente USADA en el primer elemento con texto de `selector`, por CDP. */
async function fuenteUsada(page, selector) {
  const marcado = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => /[a-záéíóúñ]{3}/i.test(e.textContent || ''));
    if (!el) return null;
    el.setAttribute('data-sonda1603', '1');
    return (el.textContent || '').trim().slice(0, 40);
  }, selector);
  if (!marcado) return { texto: null, usada: '(sin nodo con texto)' };
  const cdp = await page.createCDPSession();
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-sonda1603]' });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  await cdp.detach();
  return { texto: marcado, usada: fonts.map((f) => `${f.familyName}${f.isCustomFont ? ' (web)' : ''} ×${f.glyphCount}`).join(', ') || '(vacío)' };
}
const esInter = (u) => /\bInter \(web\)/.test(u);

const { browser } = await abrirNavegador(puppeteer);
console.log(`POBLACIÓN: 5 casos (2 positivos, 3 negativos) · navegador ${await browser.version()} · ${process.platform}`);
const r = {};

// ── A y B · `_banco-lista.mjs` de verdad ─────────────────────────────────────────────────────
const { srv, puerto } = await servirListas(PUBLIC, [{ ruta: '/__clientes', fnVista: 'renderCustomersView', datos: DATOS }]);
// B corta la petición (aborto) y B2 la contesta con 404: Chromium deja la hoja de forma distinta en
// cada caso (medido: abortada, leer sus reglas LANZA; con 404, tiene 0 reglas), y el banco tiene que cantar los dos.
for (const [id, cortar] of [['A', null], ['B', 'aborto'], ['B2', '404']]) {
  let page;
  if (cortar) {
    // Se corta ANTES de navegar: abrirVista no deja meter la intercepción en medio, así que se repite su paso.
    page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (q) => {
      if (!q.url().includes('/fonts/inter.css')) return q.continue();
      return cortar === 'aborto' ? q.abort() : q.respond({ status: 404, body: 'no' });
    });
    await page.setViewport({ width: 929, height: 900 });
    await page.goto(`http://127.0.0.1:${puerto}/__clientes`, { waitUntil: 'load' });
    await page.waitForFunction('window.__listo === true', { timeout: 20000 });
  } else {
    ({ page } = await abrirVista(browser, puerto, '/__clientes', 929));
  }
  const errores = await page.evaluate('window.__errores');
  const fuentes = await page.evaluate('window.__fuentes');
  const u = await fuenteUsada(page, 'button, h1, h2, td, label');
  r[id] = { ...u, fuentes, errores, canta: errores.some((e) => e.startsWith('fuente: ')) };
  console.log(`${id} · _banco-lista ${cortar ? `con /fonts/inter.css CORTADA (${cortar})` : 'tal cual'} · «${u.texto}»\n   USA: ${u.usada}\n   ${decirFuente(fuentes)} · hojas sin cargar: ${JSON.stringify(fuentes && fuentes.hojasSinCargar)}\n   el banco lo canta en __errores: ${r[id].canta}`);
  await page.close();
}
srv.close();

// ── C y D · la cabecera del guard y del censo, contra la de antes ───────────────────────────
const CAMPO = '<div class="view-container"><label>Buscar cliente <input class="input" id="__campo" value="Fontanería Soler"></label></div>';
const pagina = (cabeza) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${cabeza}</head><body>${CAMPO}</body></html>`;
const CABEZA_DE_ANTES = '<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css">';
const TIPOS = { '.css': 'text/css', ...TIPOS_DE_FUENTE };
const s2 = http.createServer((q, res) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/__C') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(pagina(enlacesDelPanel(PUBLIC))); }
  if (p === '/__D') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(pagina(CABEZA_DE_ANTES)); }
  const abs = path.join(PUBLIC, p);
  if (!abs.startsWith(PUBLIC) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(abs)] || 'application/octet-stream' });
  res.end(fs.readFileSync(abs));
});
await new Promise((ok) => s2.listen(0, '127.0.0.1', ok));
for (const id of ['C', 'D']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 929, height: 900 });
  await page.goto(`http://127.0.0.1:${s2.address().port}/__${id}`, { waitUntil: 'load' });
  const fuentes = await esperarFuentes(page);
  const alto = await page.evaluate(() => Math.round(document.getElementById('__campo').getBoundingClientRect().height * 100) / 100);
  const u = await fuenteUsada(page, 'label');
  r[id] = { ...u, fuentes, alto, ceguera: cegueraDeLaFuente(fuentes, id) };
  console.log(`${id} · cabecera ${id === 'C' ? 'de guard y censo (enlacesDelPanel)' : 'de ANTES (a mano, sin inter.css)'}\n   USA: ${u.usada}\n   ${decirFuente(fuentes)} · veredicto del banco: ${r[id].ceguera || 'mide con lo que declara'}\n   caja .input: ${alto} px`);
  await page.close();
}
s2.close();
await browser.close();

let codigo = 0;
const fallo = (m) => { console.log('\nCIEGO: ' + m); codigo = 2; };
if (!esInter(r.A.usada)) fallo('el positivo A no pinta Inter — la sonda no sabe verla');
if (!esInter(r.C.usada)) fallo('el positivo C no pinta Inter — la sonda no sabe verla');
for (const id of ['B', 'B2']) {
  if (esInter(r[id].usada)) fallo(`el negativo ${id} pinta Inter con la hoja cortada — la sonda no discrimina`);
  if (!r[id].canta) fallo(`con la hoja de la fuente cortada (${id}), el banco NO lo dice: mediría con la de reserva callado`);
}
if (esInter(r.D.usada)) fallo('el negativo D pinta Inter sin enlazarla — la sonda no discrimina');
if (r.A.canta) fallo('el banco canta un problema de fuente en el caso sano A');
if (!codigo) console.log('\ncontroles: A y C pintan Inter · B, B2 y D no · B y B2 los canta el banco → la sonda discrimina');
console.log(`EXIT=${codigo}`);
process.exit(codigo);
