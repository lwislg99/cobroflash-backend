// SCRUM-1659 · la página pública de firma con las líneas REALES del AB260006, pintadas por
// `renderLineasAlbaran` de dist (el mismo código que usa la ruta) e insertadas en la página servida
// por yaqu.app del #46 (emitido, 0 líneas). Sólo GET; nada se pulsa. node publica-lineas-1659.mjs <out> <token> <lineas.html>
import { abrir, BASE } from 'file:///D:/MILLONARIO/cobroFlash/sondas-s2/comun.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const [OUT, TOKEN, LINEAS] = process.argv.slice(2);
const html = readFileSync(LINEAS, 'utf8');
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const { browser, page, noGet } = await abrir({ viewport: vp });
  await page.goto(`${BASE}/albaran/${TOKEN}`, { waitUntil: 'networkidle' });
  const r = await page.evaluate((h) => {
    const sin = [...document.querySelectorAll('.card *')].find((e) => e.children.length === 0 && /Sin líneas/.test(e.textContent));
    if (!sin) return { insertado: false };
    const caja = document.createElement('div'); caja.innerHTML = h; sin.replaceWith(caja);
    // El repo es PÚBLICO: el correo de la cuenta QA que pinta el aviso de privacidad se tapa en la captura.
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) tw.currentNode.nodeValue = tw.currentNode.nodeValue.replace(/[\w.+-]+@[\w.-]+/g, 'correo@ejemplo.es');
    const t = document.querySelector('.lines-table');
    const card = document.querySelector('.card');
    const ths = [...t.querySelectorAll('th')].map((e) => ({ t: e.textContent, tt: getComputedStyle(e).textTransform }));
    const total = document.querySelector('.totales .total'); const cs = getComputedStyle(total);
    const sel = document.getElementById('firmante-calidad');
    return {
      insertado: true, tablaW: Math.round(t.getBoundingClientRect().width), cardW: Math.round(card.getBoundingClientRect().width),
      tablaDesborda: t.getBoundingClientRect().right > card.getBoundingClientRect().right,
      scrollX: document.documentElement.scrollWidth > innerWidth + 1, ths,
      total: { t: total.textContent, col: cs.color, fw: cs.fontWeight, fs: cs.fontSize },
      selectOpciones: sel ? [...sel.options].map((o) => o.textContent) : null, selectValor: sel ? sel.value : null,
      borrar: (() => { const b = document.getElementById('sig-clear'); const q = b.getBoundingClientRect(); return { w: q.width, h: q.height }; })(),
      placeholder: (() => { const p = document.getElementById('sig-placeholder'); const s = getComputedStyle(p); return { col: s.color, bg: getComputedStyle(document.getElementById('sig-wrapper')).backgroundColor }; })(),
    };
  }, html);
  console.log(vp.width, JSON.stringify(r), 'noGet', noGet.length);
  await page.screenshot({ path: path.join(OUT, `publica-lineas-${vp.width}.png`), fullPage: true });
  await browser.close();
}
console.log('EXIT=0');
