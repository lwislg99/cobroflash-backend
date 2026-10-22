// SCRUM-962d · los 5 modales VIVOS del editor de presupuestos (scripts/_banco-lista.mjs), abiertos con clics
// reales: alto de la cabecera, caja visible y ÁREA EFECTIVA (ancho×alto, árbitro elementFromPoint) del «?» y
// del «×». Mismo `__area` que cabecera-banco.mjs. Sólo lee el árbol.
// Uso: node cabecera-viva.mjs <raiz> <salida.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const RAIZ = path.resolve(process.argv[2]);
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { servirListas, abrirNavegador, abrirVista } = await imp('scripts/_banco-lista.mjs');
const DATOS = `(ruta) => {
  if (/\\/admin\\/merchant$/.test(ruta)) return { id: 1, name: 'Fontanería Soler', country: 'ES', currency: 'EUR' };
  if (/\\/admin\\/customers/.test(ruta)) return [{ id: 1, name: 'Ana López', phone: '34000000001' }];
  if (/\\/admin\\/templates/.test(ruta)) return [1, 2, 3, 4, 5].map((i) => ({ id: i, name: 'Plantilla ' + i, currency: 'EUR', lines: [{ concept: 'Revisión', quantity: 1, unitPrice: 60 }] }));
  return [];
}`;
const AREA = `window.__area = (el) => {
  const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const suyo = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && t.closest('button') === el; };
  if (!suyo(cx, cy)) return { error: 'el centro no es suyo' };
  const hasta = (dx, dy) => { let d = 0; while (d < 80 && suyo(cx + dx * (d + 0.5), cy + dy * (d + 0.5))) d += 0.5; return d; };
  return { alto: +(hasta(0, -1) + hasta(0, 1)).toFixed(1), ancho: +(hasta(-1, 0) + hasta(1, 0)).toFixed(1) };
};
window.__cabecera = () => {
  const hs = [...document.querySelectorAll('.modal-header')].filter((h) => h.getBoundingClientRect().height);
  const h = hs[hs.length - 1]; if (!h) return null;
  const ay = h.querySelector('.modal-ayuda'), ce = h.querySelector('.modal-close');
  const c = (e) => e ? +e.getBoundingClientRect().height.toFixed(1) + '/' + +e.getBoundingClientRect().width.toFixed(1) : null;
  return { titulo: h.querySelector('.modal-title').textContent.trim(), alto: +h.getBoundingClientRect().height.toFixed(1),
    ayuda: c(ay), cerrar: c(ce), areaAyuda: ay ? window.__area(ay) : null, areaCerrar: ce ? window.__area(ce) : null };
};`;
const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), [{ ruta: '/ed', fnVista: 'renderQuotesView', datos: DATOS }]);
const { browser } = await abrirNavegador(puppeteer);
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const quieto = (p) => p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), { timeout: 3000 }).catch(() => {});
const res = [];
try {
  for (const ancho of [390, 929]) {
    const { page } = await abrirVista(browser, puerto, '/ed', ancho, 2000);
    await page.evaluate(AREA);
    const pulsar = async (filtro, sinDesplazar) => {
      const h = await page.evaluateHandle(`[...document.querySelectorAll('button')].find((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && !e.disabled && (${filtro})(e); }) || null`);
      const el = h.asElement(); if (!el) return false;
      // El menú «⋯» de escritorio se CIERRA al desplazar (api.js, onScroll): a su ítem no se le hace scroll.
      if (!sinDesplazar) await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      const b = await el.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await espera(200); await quieto(page); return true;
    };
    const medir = async (nombre, abrir) => {
      const ok = await abrir();
      const c = ok ? await page.evaluate('window.__cabecera()') : null;
      res.push({ ancho, modal: nombre, abierto: ok && !!c, ...(c || {}) });
      await page.keyboard.press('Escape'); await espera(200);
      const sigue = await page.evaluate(`[...document.querySelectorAll('.modal-overlay')].some((o) => o.getBoundingClientRect().height)`);
      if (sigue) await pulsar(`(e) => e.classList.contains('modal-close') && e.closest('.modal-overlay')`);
      await quieto(page);
    };
    await medir('alta de cliente', () => pulsar(`(e) => e.textContent.trim() === '+ Nuevo cliente'`));
    await medir('Ver documento', () => pulsar(`(e) => e.textContent.trim() === 'Ver documento'`));
    await pulsar(`(e) => e.textContent.trim().startsWith('Ana López')`);
    await pulsar(`(e) => e.textContent.trim() === 'Continuar' && e.closest('.is-abierto')`);
    const conc = await page.$('.quote-line input[type=text]'); await conc.click(); await conc.type('Cambio de grifo'); await espera(150);
    await medir('ajustes de la línea', async () => (await pulsar(`(e) => e.textContent.trim() === '⋯' && e.closest('.quote-line')`)) && pulsar(`(e) => e.textContent.trim().startsWith('Ajustes (IVA')`, true));
    await medir('plantillas', () => pulsar(`(e) => e.textContent.trim().startsWith('📋')`));
    await medir('Sugerir con IA', () => pulsar(`(e) => e.textContent.trim().startsWith('✨ Sugerir con IA')`));
    await page.close();
  }
} finally { await browser.close(); srv.close(); }
fs.writeFileSync(process.argv[3], JSON.stringify(res, null, 1));
for (const r of res) console.log(`@${r.ancho} ${r.modal.padEnd(20)} ${r.abierto ? `cabecera ${r.alto} · «?» caja ${r.ayuda} área ${r.areaAyuda ? r.areaAyuda.ancho + '×' + r.areaAyuda.alto : '—'} · «×» caja ${r.cerrar} área ${r.areaCerrar ? r.areaCerrar.ancho + '×' + r.areaCerrar.alto : '—'}` : '✖ NO SE ABRIÓ'}`);
