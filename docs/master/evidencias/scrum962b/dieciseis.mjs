// Sólo lectura (SCRUM-962b, segunda tanda). Configuración VIVA (scripts/_banco-lista.mjs), pestaña a pestaña.
// Para cada control con área < 44 px: ¿su ETIQUETA asociada recibe el toque y lo activa? Se prueba con un
// CLIC DE RATÓN REAL en un punto de la etiqueta que NO es el control, y se mira si cambia el estado.
// Uso: node dieciseis.mjs <raiz> <salida.json>
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
  return [];
}`;
const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), [{ ruta: '/conf', fnVista: 'renderSettingsView', datos: DATOS, modoEmision: 'fiscal' }]);
const { browser } = await abrirNavegador(puppeteer);

// Marca cada corto con data-corto=N y devuelve su ficha + la de sus etiquetas.
const CENSAR = `(async (SEL) => {
  const cont = document.getElementById('view-container');
  const out = [];
  let n = 0;
  for (const el of cont.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    if (m.error || m.tocable >= 44) continue;
    const id = 'c' + (n++);
    el.dataset.corto = id;
    const panel = el.closest('.settings-panel');
    const etiquetas = [...(el.labels || [])].map((l, i) => {
      l.dataset.etiq = id + '-' + i;
      const lr = l.getBoundingClientRect();
      return { i, contiene: l.contains(el), alto: +lr.height.toFixed(1), ancho: +lr.width.toFixed(1), cursor: getComputedStyle(l).cursor };
    });
    const padre = el.parentElement;
    const cs = getComputedStyle(el);
    out.push({ id, tag: el.tagName.toLowerCase(), tipo: el.getAttribute('type') || '', cls: typeof el.className === 'string' ? el.className : '',
      texto: (el.textContent || el.value || el.id || '').replace(/\\s+/g, ' ').trim().slice(0, 50),
      panel: panel ? panel.dataset.submenu : '(fuera de paneles)', caja: +r.height.toFixed(1), ancho: +r.width.toFixed(1), tocable: m.tocable,
      display: cs.display, estiloEnLinea: el.getAttribute('style') || '', readonly: el.readOnly === true,
      padre: { tag: padre.tagName.toLowerCase(), cls: typeof padre.className === 'string' ? padre.className : '', texto: padre.textContent.replace(/\\s+/g, ' ').trim().length, propio: (el.textContent || '').trim().length },
      etiquetas });
  }
  return out;
})`;

const res = [];
for (const ancho of [390, 929]) {
  const { page } = await abrirVista(browser, puerto, '/conf', ancho, 4000);
  await page.evaluate(FUENTE_MEDIDOR);
  const pestanas = await page.evaluate(`[...document.querySelectorAll('.settings-nav [data-submenu]')].map((b) => b.dataset.submenu)`);
  const vistos = new Set();
  for (const p of pestanas) {
    await page.click(`.settings-nav [data-submenu="${p}"]`);
    await new Promise((ok) => setTimeout(ok, 150));
    await page.evaluate(`document.querySelectorAll('[data-corto], [data-etiq]').forEach((e) => { e.removeAttribute('data-corto'); e.removeAttribute('data-etiq'); })`);
    const cortos = await page.evaluate(`${CENSAR}(${JSON.stringify(AMPLIADO)})`);
    for (const c of cortos) {
      const clave = c.panel + '|' + c.tag + '|' + c.texto;
      if (c.panel === '(fuera de paneles)' && vistos.has(clave)) continue;
      vistos.add(clave);
      // Para cada etiqueta: área de toque de la ETIQUETA (árbitro del censo con selector 'label'), y CLIC REAL en
      // su punto más alejado del control que siga perteneciendo a la etiqueta. ¿Cambia el estado del control?
      for (const e of c.etiquetas) {
        e.tocable = (await page.evaluate(`window.__areaDeToque(document.querySelector('[data-etiq="${c.id}-${e.i}"]'), 'label', { scroll: true })`)).tocable ?? null;
        const punto = await page.evaluate(`(() => {
          const l = document.querySelector('[data-etiq="${c.id}-${e.i}"]'); const el = document.querySelector('[data-corto="${c.id}"]');
          l.scrollIntoView({ block: 'center' });
          const lr = l.getBoundingClientRect(), er = el.getBoundingClientRect();
          const cand = [];
          for (let y = lr.top + 1; y < lr.bottom - 1; y += 2) for (let x = lr.left + 1; x < lr.right - 1; x += 8) {
            const top = document.elementFromPoint(x, y);
            if (!top || top === el || el.contains(top)) continue;
            if (top.closest('label') !== l) continue;
            const d = Math.hypot(x - (er.left + er.width / 2), y - (er.top + er.height / 2));
            cand.push({ x, y, d, dy: Math.abs(y - (er.top + er.height / 2)) });
          }
          cand.sort((a, b) => b.dy - a.dy);
          return cand[0] || null;
        })()`);
        if (!punto) { e.clic = 'sin punto de la etiqueta fuera del control'; continue; }
        const antes = await page.evaluate(`(() => { const el = document.querySelector('[data-corto="${c.id}"]'); return el.type === 'checkbox' || el.type === 'radio' ? el.checked : document.activeElement === el; })()`);
        await page.mouse.click(punto.x, punto.y);
        await new Promise((ok) => setTimeout(ok, 50));
        const despues = await page.evaluate(`(() => { const el = document.querySelector('[data-corto="${c.id}"]'); return el.type === 'checkbox' || el.type === 'radio' ? el.checked : document.activeElement === el; })()`);
        e.clic = { punto: { dy: +punto.dy.toFixed(1) }, antes, despues, activa: antes !== despues || (despues === true && !['checkbox', 'radio'].includes(c.tipo)) };
        // Se deja como estaba (casillas): otro clic en el mismo punto.
        if (['checkbox', 'radio'].includes(c.tipo) && antes !== despues) await page.mouse.click(punto.x, punto.y);
      }
      res.push({ ...c, anchoEl: c.ancho, ancho, pestana: p });
    }
  }
  await page.close();
}
await browser.close();
srv.close();
fs.writeFileSync(process.argv[3], JSON.stringify(res, null, 1));
for (const r of res.filter((x) => x.ancho === 390)) {
  const et = r.etiquetas.map((e) => `etiqueta ${e.alto}/${e.tocable ?? '?'}px ${e.contiene ? 'envuelve' : 'for='} clic:${typeof e.clic === 'string' ? e.clic : (e.clic.activa ? 'ACTIVA' : 'no activa')}`).join(' · ') || 'sin etiqueta';
  console.log(`${r.panel} | ${r.tag}${r.tipo ? '[' + r.tipo + ']' : ''} | ${r.texto} | cls=${r.cls} | toque ${r.tocable} | ${r.display} | padre ${r.padre.tag}.${r.padre.cls} (${r.padre.propio}/${r.padre.texto} car) | ${et}${r.readonly ? ' | READONLY' : ''}${r.estiloEnLinea ? ' | style=' + r.estiloEnLinea.slice(0, 60) : ''}`);
}
console.log('cortos @390:', res.filter((x) => x.ancho === 390).length, '· @929:', res.filter((x) => x.ancho === 929).length);
