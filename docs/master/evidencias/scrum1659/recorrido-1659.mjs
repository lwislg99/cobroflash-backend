// SCRUM-1659 · recorrido AB6 de las tres pantallas de albaranes en yaqu.app (cuenta QA).
// SÓLO LEE: toda petición que no es GET se corta (control positivo en comun.mjs antes de medir).
//   node recorrido-1659.mjs <carpeta-capturas> <albaranId> [tokenPublico] [servir:ruta=fichero,...]
import { abrir, BASE } from 'file:///D:/MILLONARIO/cobroFlash/sondas-s2/comun.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [OUT, ALB, TOKEN, SERVIR] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const servir = {};
for (const par of (SERVIR || '').split(',').filter(Boolean)) { const [k, v] = par.split('='); servir[k] = v; }

const MEDIR = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const txt = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const root = document.querySelector('#view-container') || document.body;
  const ctrls = [...root.querySelectorAll('a,button,input,select,textarea,[role=button]')].filter(vis);
  const cortos = ctrls.map((el) => { const r = el.getBoundingClientRect(); return { el: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : ''), t: txt(el), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; })
    .filter((c) => c.h < 44 || c.w < 44);
  const conStyle = [...root.querySelectorAll('[style]')].filter((e) => !/^\s*$/.test(e.getAttribute('style'))).map((e) => e.tagName.toLowerCase() + ':' + e.getAttribute('style').slice(0, 60));
  const pills = [...root.querySelectorAll('.status-pill,.badge')].filter(vis).map((e) => { const cs = getComputedStyle(e); return { t: e.innerText.trim(), tt: cs.textTransform, fs: cs.fontSize, fw: cs.fontWeight, col: cs.color, bg: cs.backgroundColor }; });
  const dinero = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode; if (/\d[\d.,]*\s?€/.test(n.nodeValue)) { const e = n.parentElement; if (!vis(e)) continue; const cs = getComputedStyle(e); dinero.push({ t: n.nodeValue.trim().slice(0, 30), col: cs.color, fw: cs.fontWeight, fvn: cs.fontVariantNumeric }); } }
  const titulos = [...root.querySelectorAll('h1,h2,h3')].filter(vis).map((e) => { const cs = getComputedStyle(e); return { tag: e.tagName, t: e.innerText.trim().slice(0, 40), fs: cs.fontSize, fw: cs.fontWeight, ls: cs.letterSpacing }; });
  const verdes = [...root.querySelectorAll('button,a,.btn')].filter(vis).filter((e) => { const bg = getComputedStyle(e).backgroundColor; return /rgb\(22, 163, 74\)/.test(bg); }).map(txt);
  const de = document.documentElement;
  return {
    ancho: innerWidth, scrollW: de.scrollWidth, desbordaX: de.scrollWidth > innerWidth + 1,
    altoDoc: de.scrollHeight, fuente: getComputedStyle(document.body).fontFamily.slice(0, 40),
    nControles: ctrls.length, cortos, conStyle, pills, dinero: dinero.slice(0, 30), titulos, verdesPrimarios: verdes,
    vacio: !!root.querySelector('.empty-state:not([style*="none"])'),
  };
};

const informe = {};
async function pantalla(nombre, viewport, ir) {
  const { browser, page, noGet, errores, build } = await abrir({ viewport, servir });
  await ir(page);
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(MEDIR);
  const f = path.join(OUT, `${nombre}-${viewport.width}.png`);
  await page.screenshot({ path: f, fullPage: true });
  informe[`${nombre}-${viewport.width}`] = { build, ...m, noGet, errores };
  await browser.close();
}

for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  await pantalla('lista', vp, async (p) => { await p.evaluate(() => window.renderAppView('albaranes')); await p.waitForSelector('#view-container tbody tr', { timeout: 15000 }); });
  await pantalla('ficha', vp, async (p) => { await p.evaluate((id) => window.renderAppView('albaran-detail', { albaranId: Number(id) }), ALB); await p.waitForTimeout(2500); });
  if (TOKEN) {
    // La pública NO es del panel: se abre la URL tal cual; abrir() ya montó el corte de no-GET.
    await pantalla('publica', vp, async (p) => { await p.goto(`${BASE}/albaran/${TOKEN}`, { waitUntil: 'networkidle' }); });
  }
}
writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify(informe, null, 1));
console.log('POBLACION pantallas=' + Object.keys(informe).length);
for (const [k, v] of Object.entries(informe)) console.log(k, 'build', v.build, 'ctrl', v.nControles, 'cortos', v.cortos.length, 'style', v.conStyle.length, 'desbordaX', v.desbordaX, 'noGet', v.noGet.length, 'err', v.errores.length);
console.log('EXIT=0');
