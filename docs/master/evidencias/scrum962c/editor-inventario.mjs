// Sólo lectura (SCRUM-962c). Editor de presupuestos VIVO (scripts/_banco-lista.mjs): inventario de los controles
// (selector ampliado) y, para cada uno NO pintado, qué ancestro lo oculta y cómo. Apunta qué rutas pide la vista.
// Uso: node editor-inventario.mjs <raiz> <ancho>
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const RAIZ = path.resolve(process.argv[2]);
const ANCHO = Number(process.argv[3] || 390);
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { servirListas, abrirNavegador, abrirVista } = await imp('scripts/_banco-lista.mjs');
const { INTERACTIVOS } = await imp('scripts/_medidor-de-toque.mjs');
const AMPLIADO = INTERACTIVOS + ', select, textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]), [role="tab"], [role="switch"], [role="radio"], [role="menuitem"]';
export const DATOS = `(ruta) => {
  if (/\\/admin\\/merchant$/.test(ruta)) return { id: 1, name: 'Fontanería Soler', country: 'ES', currency: 'EUR', slug: 'fontaneria-soler' };
  if (/\\/admin\\/customers/.test(ruta)) return [{ id: 1, name: 'Ana López', phone: '34000000001', email: 'ana@example.com' }, { id: 2, name: 'Fincas Soler SL', phone: '34000000002' }];
  if (/\\/admin\\/products/.test(ruta)) return [{ id: 1, name: 'Mano de obra', price: 35, unit: 'h', active: true, kind: 'service' }];
  return [];
}`;
const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), [{ ruta: '/ed', fnVista: 'renderQuotesView', datos: DATOS, modoEmision: 'fiscal' }]);
const { browser } = await abrirNavegador(puppeteer);
const { page, errores } = await abrirVista(browser, puerto, '/ed', ANCHO, 4000);
const r = await page.evaluate(`(() => {
  const S = ${JSON.stringify(AMPLIADO)};
  const cont = document.getElementById('view-container');
  const nombre = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).join('.') : '');
  const out = { pintados: 0, ocultos: [], peticiones: window.__peticiones.map((p) => p.metodo + ' ' + p.ruta) };
  for (const el of cont.querySelectorAll(S)) {
    const rc = el.getBoundingClientRect();
    if (rc.width && rc.height) { out.pintados++; continue; }
    // El ancestro más ALTO que no se pinta: ése es el estado que habría que abrir.
    let oculto = null, a = el;
    while (a && a !== cont) { const cs = getComputedStyle(a); if (a.hidden || cs.display === 'none' || cs.visibility === 'hidden') oculto = a; a = a.parentElement; }
    const cs = oculto ? getComputedStyle(oculto) : null;
    out.ocultos.push({ control: nombre(el) + (el.getAttribute('type') ? '[' + el.getAttribute('type') + ']' : ''), texto: (el.textContent || el.placeholder || '').replace(/\\s+/g, ' ').trim().slice(0, 30),
      por: oculto ? nombre(oculto) + (oculto.hidden ? ' [hidden]' : '') + (cs.display === 'none' ? ' {display:none}' : '') : '(¿?)' });
  }
  return out;
})()`);
console.log('ancho', ANCHO, '· errores', JSON.stringify(errores), '· pintados', r.pintados, '· ocultos', r.ocultos.length);
console.log('peticiones:', [...new Set(r.peticiones)].join(' | '));
const grupos = new Map();
for (const o of r.ocultos) { if (!grupos.has(o.por)) grupos.set(o.por, []); grupos.get(o.por).push(o.control + ' «' + o.texto + '»'); }
for (const [por, cs] of [...grupos].sort((a, b) => b[1].length - a[1].length)) console.log(`\n${String(cs.length).padStart(3)} ← ${por}\n      ${cs.slice(0, 8).join('\n      ')}${cs.length > 8 ? '\n      …' : ''}`);
await page.close(); await browser.close(); srv.close();
