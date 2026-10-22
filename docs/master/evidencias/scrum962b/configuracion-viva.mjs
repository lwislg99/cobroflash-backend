// Segundo instrumento (sólo lectura): Configuración VIVA, con los scripts del índice cargados por
// scripts/_banco-lista.mjs, pulsando cada pestaña con un clic real (pintarNav del producto).
// Uso: node configuracion-viva.mjs <raiz> <salida.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(process.argv[2]);
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { servirListas, abrirNavegador, abrirVista } = await imp('scripts/_banco-lista.mjs');
const { FUENTE_MEDIDOR, INTERACTIVOS } = await imp('scripts/_medidor-de-toque.mjs');
const AMPLIADO = INTERACTIVOS + ', select, textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]), [role="tab"], [role="switch"], [role="radio"], [role="menuitem"]';

const DATOS = `(ruta) => {
  if (/\\/admin\\/merchant$/.test(ruta)) return { id: 1, name: 'Fontanería Soler', country: 'ES', currency: 'EUR', slug: 'fontaneria-soler', publicProfileEnabled: true, profileZones: ['Valencia'], slugChangedAt: null };
  if (/\\/admin\\/team/.test(ruta)) return [];
  return [];
}`;
const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), [{ ruta: '/conf', fnVista: 'renderSettingsView', datos: DATOS, modoEmision: 'fiscal' }]);
const { browser } = await abrirNavegador(puppeteer);

const MEDIR = `(async (SEL, CENSO) => {
  const out = [];
  let sinPintar = 0;
  const rot = (el) => {
    let t = (el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || (el.tagName === 'SELECT' ? '' : el.textContent) || '';
    t = t.replace(/\\s+/g, ' ').trim();
    if (!t) { let p = el.previousElementSibling; while (p && !/^(LABEL|SPAN|P|DIV|STRONG)$/.test(p.tagName)) p = p.previousElementSibling; if (p) t = p.textContent.replace(/\\s+/g, ' ').trim(); }
    if (!t && el.parentElement) { const l = el.parentElement.querySelector('label'); if (l) t = l.textContent.replace(/\\s+/g, ' ').trim(); }
    return (t || el.id || el.name || '(sin rótulo)').slice(0, 48);
  };
  const cont = document.getElementById('view-container');
  for (const el of cont.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) { sinPintar++; continue; }
    const panel = el.closest('.settings-panel');
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    out.push({ tipo: el.tagName.toLowerCase() + (el.tagName === 'INPUT' ? '[' + (el.getAttribute('type') || 'text') + ']' : '') + (el.getAttribute('role') ? '[role=' + el.getAttribute('role') + ']' : ''),
      rotulo: rot(el), cls: typeof el.className === 'string' ? el.className : '', panel: panel ? panel.dataset.submenu : '(fuera de paneles)',
      caja: +r.height.toFixed(1), tocable: m.tocable ?? null, error: m.error || null, enSelectorDelCenso: el.matches(CENSO), cssH: getComputedStyle(el).height });
  }
  return { out, sinPintar, errores: window.__errores.slice() };
})`;

const res = [];
for (const ancho of [390, 929]) {
  const { page, errores } = await abrirVista(browser, puerto, '/conf', ancho);
  const pestanas = await page.evaluate(`[...document.querySelectorAll('.settings-nav [data-submenu]')].map((b) => b.dataset.submenu)`);
  // estado de montaje
  const r0 = await page.evaluate(`${FUENTE_MEDIDOR};${MEDIR}(${JSON.stringify(AMPLIADO)}, ${JSON.stringify(INTERACTIVOS)})`);
  res.push({ ancho, pestana: null, errores, ...r0 });
  for (const p of pestanas) {
    await page.click(`.settings-nav [data-submenu="${p}"]`);
    await new Promise((ok) => setTimeout(ok, 150));
    const r = await page.evaluate(`${FUENTE_MEDIDOR};${MEDIR}(${JSON.stringify(AMPLIADO)}, ${JSON.stringify(INTERACTIVOS)})`);
    res.push({ ancho, pestana: p, ...r });
  }
  await page.close();
}
await browser.close();
srv.close();
fs.writeFileSync(process.argv[3], JSON.stringify(res, null, 1));
for (const r of res) console.log(r.ancho, r.pestana ?? '(montaje)', 'medidos', r.out.length, 'sinPintar', r.sinPintar, r.errores && r.errores.length ? 'ERRORES ' + JSON.stringify(r.errores).slice(0, 200) : '');

