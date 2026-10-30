// SCRUM-962g · el «Menú» (`.topbar-hamburger`) de la barra superior de yaqu.app a 390: ÁREA de toque
// (árbitro elementFromPoint, pasos de 0,5) y captura de la barra. Va por `banco-prod.mjs` (sólo GET).
// CONTROL: un botón de 12 px inyectado tiene que salir corto, o la medida no vale.
// Uso: [SERVIR_CSS=<styles.css>] node menu-962g.mjs <raiz> <captura.png>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const RAIZ = path.resolve(process.argv[2]);
const CAPTURA = process.argv[3];
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { servirListas, abrirNavegador, abrirVista } = await import('./banco-prod.mjs');
const { puerto } = await servirListas(null, [{ ruta: '/m', fnVista: 'renderQuotesView', datos: '(ruta) => []' }]);
const { browser } = await abrirNavegador(puppeteer);
try {
  const { page } = await abrirVista(browser, puerto, '/m', 390, 844);
  const r = await page.evaluate(() => {
    const area = (el) => {
      const b = el.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const suyo = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)); };
      if (!suyo(cx, cy)) return { error: 'el centro no es suyo' };
      const hasta = (dx, dy) => { let d = 0; while (d < 80 && suyo(cx + dx * (d + 0.5), cy + dy * (d + 0.5))) d += 0.5; return d; };
      return { caja: `${b.width}×${b.height}`, ancho: hasta(-1, 0) + hasta(1, 0), alto: hasta(0, -1) + hasta(0, 1) };
    };
    const ctl = document.createElement('button'); ctl.style.cssText = 'position:fixed;left:200px;top:400px;width:12px;height:12px;padding:0;border:0;min-height:0'; document.body.appendChild(ctl);
    const c = area(ctl); ctl.remove();
    window.scrollTo(0, 0);
    return { menu: area(document.querySelector('.topbar-hamburger')), control: c.alto < 44 ? `verde (${c.alto})` : 'NO CAZA' };
  });
  if (CAPTURA) fs.writeFileSync(CAPTURA, await page.screenshot({ clip: { x: 0, y: 0, width: 390, height: 70 } }));
  console.log(JSON.stringify(r));
  if (r.control.startsWith('NO')) process.exitCode = 2;
} finally { await browser.close(); }
