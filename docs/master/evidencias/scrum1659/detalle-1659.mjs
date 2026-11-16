// SCRUM-1659 · dos medidas concretas en yaqu.app (sólo GET): pestañas de la lista a 390 y
// márgenes de la fila de acciones de la ficha #51. node detalle-1659.mjs
import { abrir } from 'file:///D:/MILLONARIO/cobroFlash/sondas-s2/comun.mjs';
for (const w of [390, 1280]) {
  let { browser, page } = await abrir({ viewport: { width: w, height: 844 } });
  await page.evaluate(() => window.renderAppView('albaranes'));
  await page.waitForSelector('#view-container tbody tr');
  console.log(w, 'TABS', JSON.stringify(await page.evaluate(() => {
    const t = document.querySelector('.data-card-tabs'); const cs = getComputedStyle(t); const card = t.closest('.data-card').getBoundingClientRect();
    return { scrollW: t.scrollWidth, clientW: t.clientWidth, overflowX: cs.overflowX, maskOuFade: cs.maskImage || cs.webkitMaskImage,
      tabs: [...t.querySelectorAll('.data-card-tab')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, x: Math.round(r.left), d: Math.round(r.right), h: Math.round(r.height), visible: r.right <= card.right }; }) };
  })));
  console.log(w, 'FILA', JSON.stringify(await page.evaluate(() => {
    const tr = document.querySelector('#view-container tbody tr'); const r = tr.getBoundingClientRect();
    const num = tr.querySelector('.alb-numero'); const cs = getComputedStyle(num);
    return { filaAlto: Math.round(r.height), numero: { fs: cs.fontSize, fw: cs.fontWeight, col: cs.color } };
  })));
  await browser.close();
  ({ browser, page } = await abrir({ viewport: { width: w, height: 844 } }));
  await page.evaluate(() => window.renderAppView('albaran-detail', { albaranId: 51 }));
  await page.waitForTimeout(2500);
  console.log(w, 'FICHA', JSON.stringify(await page.evaluate(() => {
    const card = document.querySelector('#view-container .detail-page, #view-container .data-card, #view-container > *');
    const c = card.getBoundingClientRect();
    const b = [...document.querySelectorAll('#view-container button')].filter((x) => x.offsetParent);
    const h2 = document.querySelector('#view-container h2').getBoundingClientRect();
    const est = [...document.querySelectorAll('#view-container *')].find((e) => e.children.length === 0 && e.textContent.trim() === 'BORRADOR' || e.textContent.trim() === 'Borrador');
    return { cardX: Math.round(c.left), tituloX: Math.round(h2.left), estadoX: est ? Math.round(est.getBoundingClientRect().left) : null,
      botones: b.map((x) => { const r = x.getBoundingClientRect(); const s = getComputedStyle(x); return { t: x.textContent.trim(), x: Math.round(r.left), h: Math.round(r.height), bg: s.backgroundColor, fs: s.fontSize, cls: x.className }; }),
      hayLineas: !!document.querySelector('#view-container table, #view-container .alb-lineas'), textoTotal: /242,36/.test(document.querySelector('#view-container').innerText) };
  })));
  await browser.close();
}
console.log('EXIT=0');
