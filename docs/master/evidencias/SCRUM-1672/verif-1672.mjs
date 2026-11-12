// SCRUM-1672 · antes/después de la cabecera de la ficha del trabajo en yaqu.app (cuenta QA, sólo GET).
// «antes» = producción tal cual · «después» = producción con jobDetailView.js servido desde el árbol.
//   node verif-1672.mjs <arbol> <carpeta-capturas> [jobId=79]
import { abrir } from 'file:///D:/MILLONARIO/cobroFlash/sondas-s2/comun.mjs';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
const [ARBOL, OUT, JOB = '79'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const FICH = '/dashboard/js/jobDetailView.js';
let filas = 0;
for (const modo of ['antes', 'despues']) {
  for (const w of [390, 1280]) {
    const servir = modo === 'despues' ? { [FICH]: path.join(ARBOL, 'public' + FICH) } : {};
    const { browser, page, noGet, errores, build } = await abrir({ viewport: { width: w, height: 844 }, servir });
    // Testigo (A21): el fichero servido ES el del árbol en «después», y el de prod en «antes».
    const testigo = await page.evaluate(async (f) => (await (await fetch(f)).text()).includes('detail-cita'), FICH);
    if ((modo === 'despues') !== testigo) throw new Error(`TESTIGO: modo ${modo} y el fichero servido ${testigo ? 'SÍ' : 'NO'} lleva el arreglo`);
    const dato = await page.evaluate(async (id) => { const r = await fetch('/admin/jobs/' + id, { credentials: 'include' }); const j = await r.json(); return { status: j.status, scheduledAt: j.scheduledAt, createdAt: j.createdAt }; }, JOB);
    await page.evaluate((id) => window.renderAppView('jobs-detail', { jobId: Number(id) }), JOB);
    await page.waitForSelector('#view-container .detail-sub');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const vis = (e) => e && getComputedStyle(e).display !== 'none';
      const lineas = [...document.querySelectorAll('#view-container .detail-sub')].filter(vis).map((e) => {
        const r = e.getBoundingClientRect(); return { texto: e.textContent, top: Math.round(r.top), alto: Math.round(r.height), der: Math.round(r.right) };
      });
      const texto = document.querySelector('#view-container').innerText;
      return { titulo: document.querySelector('#view-container h2')?.textContent, lineas, apariciones12nov: (texto.match(/12 nov/g) || []).length, desbordaPagina: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    await page.screenshot({ path: path.join(OUT, `${modo}-${w}.png`), fullPage: false });
    console.log(modo, w, 'build', build, 'dato', JSON.stringify(dato), JSON.stringify(m), 'noGet', noGet.length, 'err', errores.length, errores.slice(0, 2).join(' | '));
    filas++;
    await browser.close();
  }
}
console.log('POBLACION filas=' + filas); console.log('EXIT=0');
