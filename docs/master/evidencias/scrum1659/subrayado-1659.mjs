// SCRUM-1659 · ¿se ve el subrayado de la pestaña activa con la fila desplazable? (sólo GET)
//   node subrayado-1659.mjs <arbol> <out> [sin-servir]
import { abrir } from 'file:///D:/MILLONARIO/cobroFlash/sondas-s2/comun.mjs';
import path from 'node:path';
const [ARBOL, OUT, SIN] = process.argv.slice(2);
const servir = SIN ? {} : {
  '/dashboard/js/albaranesView.js': path.join(ARBOL, 'public/dashboard/js/albaranesView.js'),
  '/dashboard/css/styles.css': path.join(ARBOL, 'public/dashboard/css/styles.css'),
};
const { browser, page } = await abrir({ viewport: { width: 390, height: 844 }, servir });
await page.evaluate(() => window.renderAppView('albaranes'));
await page.waitForSelector('#view-container tbody tr');
await page.waitForTimeout(300);
for (const cual of ['first', 'last']) {
  await page.locator('.data-card-tab')[cual]().click({ force: true });
  await page.waitForTimeout(250);
  const m = await page.evaluate(() => {
    const t = document.querySelector('.data-card-tabs'); const a = t.querySelector('.data-card-tab.active');
    const rt = t.getBoundingClientRect(); const ra = a.getBoundingClientRect();
    return { activa: a.firstChild.textContent, tabsScrollH: t.scrollHeight, tabsClientH: t.clientHeight, overflowY: getComputedStyle(t).overflowY,
      bordeInferiorActiva: Math.round(ra.bottom * 10) / 10, bordeInferiorFila: Math.round(rt.bottom * 10) / 10, subrayadoDentro: ra.bottom <= rt.bottom + 0.01,
      activaDentroX: ra.left >= rt.left - 0.5 && ra.right <= rt.right + 0.5, scrollLeft: t.scrollLeft };
  });
  const box = await page.locator('.data-card-tabs').boundingBox();
  await page.screenshot({ path: path.join(OUT, `pestanas-${SIN ? 'antes' : 'despues'}-${cual}.png`), clip: { x: 0, y: box.y - 4, width: 390, height: box.height + 8 } });
  console.log(cual, JSON.stringify(m));
}
await browser.close();
console.log('EXIT=0');
