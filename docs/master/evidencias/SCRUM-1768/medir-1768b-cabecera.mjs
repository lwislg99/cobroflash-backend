// SCRUM-1768b · ¿la cabecera y la tira se colocan como dice el diseño? Mide CAJAS (no lee PNG).
//   LOCAL_DIR=<worktree> node medir-1768b-cabecera.mjs   (JOBS=77,76 ANCHOS=390,1280,1920)
// Por ficha y ancho: caja del título, del dinero y de las acciones (x, y, ancho, alto), filas de la tira de
// pestañas, alto mínimo de una pestaña y si el h3 apartado sigue en el árbol de accesibilidad (innerText).
import { abrir } from './comun.mjs';
import path from 'node:path';
const servir = {};
if (process.env.LOCAL_DIR) {
  servir['/dashboard/js/jobDetailView.js'] = path.join(process.env.LOCAL_DIR, 'public/dashboard/js/jobDetailView.js');
  servir['/dashboard/css/styles.css'] = path.join(process.env.LOCAL_DIR, 'public/dashboard/css/styles.css');
}
const ids = (process.env.JOBS || '77,76').split(',').map(Number);
for (const w of (process.env.ANCHOS || '390,1280,1920').split(',').map(Number)) {
  const { browser, page, errores } = await abrir({ servir, viewport: { width: w, height: 900 } });
  for (const id of ids) {
    await page.evaluate((i) => window.renderAppView('jobs-detail', { jobId: i }), id);
    await page.waitForSelector('.detail-head-acciones', { state: 'attached', timeout: 20000 });
    await page.waitForTimeout(1800);
    const m = await page.evaluate(() => {
      const caja = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
      const tabs = [...document.querySelectorAll('.detail-pestanas [role="tab"]')];
      const filas = new Set(tabs.map((b) => Math.round(b.getBoundingClientRect().y))).size;
      const panel = document.querySelector('[role="tabpanel"]:not([hidden])');
      const h3 = panel && panel.querySelector(':scope > .detail-section-title');
      return {
        izq: caja('.detail-head-izq'), dinero: caja('.detail-head-dinero'), acciones: caja('.detail-head-acciones'),
        tira: caja('.detail-pestanas'), filasTira: filas, altoMinTab: tabs.length ? Math.round(Math.min(...tabs.map((b) => b.getBoundingClientRect().height))) : null,
        h3Apartado: h3 ? { ancho: Math.round(h3.getBoundingClientRect().width), enInnerText: panel.innerText.includes(h3.textContent.trim()) } : null,
        lateral: caja('.detail-lateral'),
      };
    });
    console.log(JSON.stringify({ w, id, ...m }));
  }
  if (errores.length) console.log('errores', errores);
  await browser.close();
}
