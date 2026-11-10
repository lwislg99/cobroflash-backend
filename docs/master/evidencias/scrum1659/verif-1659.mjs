// SCRUM-1659 · antes/después de la lista de albaranes en yaqu.app (cuenta QA, sólo GET).
// «después» = la página de producción con albaranesView.js y styles.css servidos desde el árbol.
//   node verif-1659.mjs <arbol> <carpeta-capturas>
import { abrir } from 'file:///D:/MILLONARIO/cobroFlash/sondas-s2/comun.mjs';
import path from 'node:path';
const [ARBOL, OUT] = process.argv.slice(2);
const SERVIR = {
  '/dashboard/js/albaranesView.js': path.join(ARBOL, 'public/dashboard/js/albaranesView.js'),
  '/dashboard/css/styles.css': path.join(ARBOL, 'public/dashboard/css/styles.css'),
};
let filas = 0;
for (const modo of ['antes', 'despues']) {
  for (const w of [390, 1280]) {
    const { browser, page, noGet, errores, build } = await abrir({ viewport: { width: w, height: 844 }, servir: modo === 'despues' ? SERVIR : {} });
    // Testigo de ejecución (A21): el fichero servido ES el del árbol, o «después» no mide nada.
    const testigo = await page.evaluate(async () => (await (await fetch('/dashboard/js/albaranesView.js')).text()).includes('alb-lista'));
    if ((modo === 'despues') !== testigo) throw new Error(`TESTIGO: modo ${modo} y el fichero servido ${testigo ? 'SÍ' : 'NO'} lleva el arreglo`);
    await page.evaluate(() => window.renderAppView('albaranes'));
    await page.waitForSelector('#view-container tbody tr');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const t = document.querySelector('.data-card-tabs'); const card = t.closest('.data-card').getBoundingClientRect();
      const ult = [...t.querySelectorAll('.data-card-tab')].pop();
      const antesDeDesplazar = ult.getBoundingClientRect().right;
      t.scrollLeft = t.scrollWidth; // lo que hace un dedo que arrastra la fila hasta el final
      const r = ult.getBoundingClientRect();
      const alto = (s) => Math.round(document.querySelector(s).getBoundingClientRect().height * 10) / 10;
      return {
        overflowX: getComputedStyle(t).overflowX, scrollW: t.scrollWidth, clientW: t.clientWidth,
        ultima: ult.firstChild.textContent, ultimaDerAntes: Math.round(antesDeDesplazar), ultimaDerTrasDesplazar: Math.round(r.right),
        tarjetaDer: Math.round(card.right), ultimaAlcanzable: r.right <= card.right + 0.5 && r.left >= card.left - 0.5,
        altosPestanas: [...t.querySelectorAll('.data-card-tab')].map((b) => Math.round(b.getBoundingClientRect().height)),
        buscador: alto('#view-container .data-card-toolbar input'), filtro: alto('#view-container .data-card-toolbar select'),
        estilosEnLinea: [...document.querySelectorAll('#view-container [style]')].map((e) => e.tagName + ':' + e.getAttribute('style')),
        desbordaPagina: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    // y el toque: pulsar la última pestaña filtra (estado DESPUÉS de pulsar, A6)
    await page.evaluate(() => { const t = document.querySelector('.data-card-tabs'); t.scrollLeft = 0; });
    await page.locator('.data-card-tab').last().click({ force: modo === 'antes' });
    const tras = await page.evaluate(() => ({ activa: document.querySelector('.data-card-tab.active').firstChild.textContent, filas: document.querySelectorAll('#view-container tbody tr').length,
      pills: [...document.querySelectorAll('#view-container tbody .status-pill')].map((p) => p.textContent) }));
    await page.evaluate(() => { const t = document.querySelector('.data-card-tabs'); t.scrollLeft = t.scrollWidth; });
    await page.screenshot({ path: path.join(OUT, `lista-${modo}-${w}.png`), fullPage: false });
    console.log(modo, w, 'build', build, JSON.stringify(m), 'TRAS PULSAR', JSON.stringify(tras), 'noGet', noGet.length, 'err', errores.length);
    filas++;
    await browser.close();
  }
}
console.log('POBLACION filas=' + filas); console.log('EXIT=0');
