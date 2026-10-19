// Ficha del albarán #46 (cuenta QA) en yaqu.app: geometría a varios anchos. SÓLO GET (lo demás se
// aborta y se cuenta), serviceWorkers:'block'. Saca: ancho de la página y del contenedor, cada bloque
// de la ficha (caja, hijos, cuánto ocupa su contenido) y el rail (columnas, filas, huecos).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright-core');
const OUT = process.argv[2];
const ID = process.argv[3] || '46';
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim().replace(/^pf_session=/, '').split(';')[0];
const ANCHOS = [[1280, 800, false], [1440, 900, false], [1920, 1080, false], [390, 844, true]];
const FICHERO = process.env.FICHERO ? fs.readFileSync(process.env.FICHERO, 'utf8') : null;
const SUFIJO = process.env.FICHERO ? '-despues' : '';

function medir() {
  const r = (e) => { const q = e.getBoundingClientRect(); return { x: Math.round(q.x), y: Math.round(q.y + scrollY), w: Math.round(q.width), h: Math.round(q.height) }; };
  const nom = (e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  // Ancho que ocupa de verdad el contenido de un bloque: la unión de los rectángulos de su texto.
  const anchoTexto = (e) => {
    const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let min = Infinity, max = -Infinity;
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.textContent.trim()) continue; const g = document.createRange(); g.selectNodeContents(n); for (const q of g.getClientRects()) { if (q.width) { min = Math.min(min, q.left); max = Math.max(max, q.right); } } }
    return isFinite(min) ? Math.round(max - min) : 0;
  };
  const pagina = document.querySelector('.detail-page') || document.querySelector('.view-container');
  const vc = document.querySelector('.view-container');
  const out = { vw: innerWidth, docH: document.scrollingElement.scrollHeight, pagina: pagina ? { el: nom(pagina), ...r(pagina) } : null, vc: vc ? { el: nom(vc), ...r(vc), padding: getComputedStyle(vc).padding, maxWidth: getComputedStyle(vc).maxWidth } : null, bloques: [] };
  if (pagina) for (const b of pagina.children) {
    const cs = getComputedStyle(b);
    out.bloques.push({ el: nom(b), ...r(b), display: cs.display, gridCols: cs.gridTemplateColumns, flexDir: cs.flexDirection, maxWidth: cs.maxWidth, hijos: b.children.length, anchoTexto: anchoTexto(b), texto: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140) });
  }
  // El rail: cada fila con su rótulo y su valor.
  const rail = [...document.querySelectorAll('[class*="rail"]')].find((e) => e.querySelector('.detail-total-label'));
  if (rail) {
    const cs = getComputedStyle(rail);
    out.rail = { el: nom(rail), ...r(rail), display: cs.display, gridCols: cs.gridTemplateColumns, gap: cs.gap, filas: [...rail.children].map((f) => ({ ...r(f), texto: (f.innerText || '').replace(/\s+/g, ' · ').trim().slice(0, 80), anchoTexto: anchoTexto(f) })) };
  }
  return out;
}

const browser = await chromium.launch();
try {
  for (const [w, h, movil] of ANCHOS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: movil ? 2 : 1, isMobile: movil, hasTouch: movil, serviceWorkers: 'block' });
    await ctx.addCookies([{ name: 'pf_session', value: cookie, domain: 'yaqu.app', path: '/', secure: true, httpOnly: true }]);
    const page = await ctx.newPage();
    const cuenta = { gets: 0, abortadas: [] };
    // FICHERO=<ruta>: el GET de albaranDetailView.js se contesta con ese fichero (la rama sin mergear),
    // para medir el «después» en producción con los datos de producción. Todo lo demás, de yaqu.app.
    await page.route('**/*', (route) => { const q = route.request(); if (FICHERO && q.method() === 'GET' && new URL(q.url()).pathname.endsWith('/js/albaranDetailView.js')) { cuenta.sustituido = (cuenta.sustituido || 0) + 1; return route.fulfill({ status: 200, contentType: 'application/javascript', body: FICHERO }); } if (q.method() === 'GET') { cuenta.gets++; return route.continue(); } cuenta.abortadas.push(`${q.method()} ${new URL(q.url()).pathname}`); return route.abort(); });
    try {
      await page.goto(`https://yaqu.app/dashboard/#albaran-detail/${ID}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const m = await page.evaluate(medir);
      await page.screenshot({ path: `${OUT}/albaran-${ID}-${w}${SUFIJO}.png`, fullPage: true });
      console.log(JSON.stringify({ ancho: w, ...m, ...cuenta }));
    } catch (e) { console.log(JSON.stringify({ ancho: w, CIEGO: String(e.message).slice(0, 300) })); }
    await ctx.close();
  }
} finally { await browser.close(); }
