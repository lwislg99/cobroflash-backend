// SCRUM-1651 en yaqu.app (cuenta QA): pulsar «Duplicar» en un presupuesto con 3 opciones y ver el editor.
// Uso: node duplicar-1651.mjs <arbol|-> <id> [<id control sin opciones>]
//   <arbol> sirve quotesView.js y quotesDetailView.js de ESA rama sobre prod; «-» = prod a pelo.
// «Duplicar» sólo hace GET y navega; el interceptor de comun.mjs corta cualquier no-GET (control positivo).
// CONTROL DEL INSTRUMENTO: si no encuentra el editor («Nuevo presupuesto») lo dice: CIEGO.
import { abrir } from './comun.mjs';
import { mkdirSync } from 'node:fs';
const [arbol, idTxt, idCtrl] = process.argv.slice(2);
mkdirSync('cap1651', { recursive: true });
const AVISO = 'Se duplica sólo la opción recomendada.';
const servir = arbol && arbol !== '-' ? {
  '/dashboard/js/quotesView.js': arbol + '/public/dashboard/js/quotesView.js',
  '/dashboard/js/quotesDetailView.js': arbol + '/public/dashboard/js/quotesDetailView.js',
} : {};
const etiqueta = arbol && arbol !== '-' ? 'rama' : 'prod';
for (const ancho of [1280, 390]) {
  for (const id of [idTxt, idCtrl].filter(Boolean).map(Number)) {
    const { browser, page, build, errores, noGet } = await abrir({ servir, viewport: { width: ancho, height: 900 } });
    await page.evaluate((i) => { location.hash = '#quotes-detail/' + i; }, id);
    const btn = page.locator('button', { hasText: 'Duplicar' }).first();
    await btn.waitFor({ state: 'visible', timeout: 20000 });
    await btn.click();
    const veoEditor = await page.waitForFunction(() => /Nuevo presupuesto/.test(document.body.innerText) && !!document.querySelector('.quote-line, .quote-lines, input'), null, { timeout: 20000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(1500);
    const r = await page.evaluate((txt) => {
      const nodos = [...document.querySelectorAll('.alert')].filter((e) => e.textContent.trim() === txt);
      const n = nodos[0];
      const rect = n && n.getBoundingClientRect();
      return {
        avisos: nodos.length,
        visible: !!(n && n.offsetParent && rect.height > 0),
        enPantallaSinDesplazar: !!(rect && rect.top >= 0 && rect.bottom <= innerHeight),
        caja: rect ? { top: Math.round(rect.top), alto: Math.round(rect.height), ancho: Math.round(rect.width) } : null,
        color: n ? getComputedStyle(n).color : null,
        fondo: n ? getComputedStyle(n).backgroundColor : null,
        alertaPlantilla: [...document.querySelectorAll('.alert')].map((e) => e.textContent.trim()).filter((t) => /Plantilla/.test(t)),
      };
    }, AVISO);
    await page.screenshot({ path: `cap1651/${etiqueta}-q${id}-${ancho}.png` });
    console.log(JSON.stringify({ build: build && build.slice(0, 9), servido: etiqueta, ancho, id, instrumento: veoEditor ? 've el editor' : 'CIEGO: no veo el editor', ...r }));
    if (noGet.length) console.log('NO-GET:', JSON.stringify(noGet));
    if (errores.length) console.log('ERRORES:', JSON.stringify(errores));
    await browser.close();
  }
}
