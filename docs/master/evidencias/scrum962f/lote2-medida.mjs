// SCRUM-962f · los 4 de quotesView.js, ANTES y DESPUÉS, en el editor VIVO (scripts/_banco-lista.mjs), recorrido con
// clics reales hasta cada uno: los dos radios «Razón social / Nombre comercial» y la casilla «Incluir descripción en
// el PDF» (Condiciones › Ajustes del documento) y el <select> «IVA %» (⋯ de la línea › Ajustes). Para cada uno:
//   · su caja y su ÁREA EFECTIVA (ancho×alto, árbitro elementFromPoint, el mismo de 962d);
//   · la de su ETIQUETA, y si un TOQUE en el punto de la etiqueta más alejado lo ACTIVA (marca / abre);
//   · que el toque en la etiqueta VECINA no lo active a él (los dos radios van pegados);
//   · el alto del bloque que lo contiene (¿cuánto crece la pantalla?).
// Móvil emulado (390, táctil) y escritorio (929, ratón). CONTROL POSITIVO del árbitro de apertura: tocar el
// <select> directamente TIENE que abrirlo (`:open`).
// Uso: node lote2-medida.mjs <raiz> <salida.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const RAIZ = path.resolve(process.argv[2]);
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { servirListas, abrirNavegador } = await imp('scripts/_banco-lista.mjs');
const DATOS = `(ruta) => {
  if (/\\/admin\\/merchant$/.test(ruta)) return { id: 1, name: 'Fontanería Soler', country: 'ES', currency: 'EUR' };
  if (/\\/admin\\/customers/.test(ruta)) return [{ id: 1, name: 'Ana López', phone: '34000000001' }];
  return [];
}`;
const FUENTE = `
window.__area = (el) => {
  const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const suyo = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === el || t.closest('input, select, button') === el); };
  if (!suyo(cx, cy)) return { error: 'el centro no es suyo' };
  const hasta = (dx, dy) => { let d = 0; while (d < 80 && suyo(cx + dx * (d + 0.5), cy + dy * (d + 0.5))) d += 0.5; return d; };
  return { alto: +(hasta(0, -1) + hasta(0, 1)).toFixed(1), ancho: +(hasta(-1, 0) + hasta(1, 0)).toFixed(1) };
};
window.__caja = (e) => { const r = e.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
// El punto de la etiqueta más alejado del control que SIGUE siendo de la etiqueta (y no del control).
window.__puntoLejano = (el) => {
  const l = el.labels && el.labels[0]; if (!l) return null;
  const lr = l.getBoundingClientRect(), er = el.getBoundingClientRect(); let mejor = null;
  for (let y = lr.top + 1; y < lr.bottom - 1; y += 1) for (let x = lr.left + 1; x < lr.right - 1; x += 4) {
    const t = document.elementFromPoint(x, y);
    if (!t || t === el || t.closest('label') !== l) continue;
    const d = Math.abs(y - (er.top + er.height / 2)) * 3 + Math.abs(x - (er.left + er.width / 2));
    if (!mejor || d > mejor.d) mejor = { x, y, d };
  }
  return mejor;
};`;
const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), [{ ruta: '/ed', fnVista: 'renderQuotesView', datos: DATOS }]);
const { browser } = await abrirNavegador(puppeteer);
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const res = [];
try {
  for (const [ancho, movil] of [[390, true], [929, false]]) {
    const page = await browser.newPage();
    await page.emulate({ viewport: { width: ancho, height: 2000, isMobile: movil, hasTouch: movil, deviceScaleFactor: 1 }, userAgent: movil ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' : (await browser.userAgent()) });
    await page.goto(`http://127.0.0.1:${puerto}/ed`, { waitUntil: 'load' });
    await page.waitForFunction('window.__listo === true', { timeout: 20000 });
    await page.evaluate(FUENTE);
    const tocarXY = async (x, y) => { if (movil) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await espera(250); };
    const tocarEl = async (el) => { const b = await el.boundingBox(); await tocarXY(b.x + b.width / 2, b.y + b.height / 2); };
    const boton = async (filtro, sinDesplazar) => {
      const h = await page.evaluateHandle(`[...document.querySelectorAll('button')].find((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && !e.disabled && (${filtro})(e); }) || null`);
      const el = h.asElement(); if (!el) return false;
      if (!sinDesplazar) await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await tocarEl(el); return true;
    };
    const estado = (el) => el.evaluate((e) => e.tagName === 'SELECT' ? (e.matches(':open') ? 'abierto' : 'cerrado') : (e.checked ? 'marcado' : 'sin marcar'));
    // Mide un control: caja, área, etiqueta, toque en la etiqueta (y deshace), alto del bloque.
    const medir = async (nombre, el, bloqueSel) => {
      await el.evaluate((e) => e.scrollIntoView({ block: 'center' })); await espera(100);
      const f = await el.evaluate((e, bs) => ({ caja: window.__caja(e), area: window.__area(e), etiqueta: e.labels && e.labels[0] ? { caja: window.__caja(e.labels[0]) } : null,
        bloque: e.closest(bs) ? +e.closest(bs).getBoundingClientRect().height.toFixed(1) : null }), bloqueSel);
      const p = await el.evaluate((e) => window.__puntoLejano(e));
      if (p) {
        const antes = await estado(el);
        await tocarXY(p.x, p.y);
        f.toqueEtiqueta = { antes, despues: await estado(el) };
        if (f.toqueEtiqueta.despues === 'abierto') { await page.keyboard.press('Escape'); await espera(200); }
      }
      const fila = { ancho, control: nombre, ...f };
      res.push(fila);
      return fila;   // la MISMA fila que va a la salida: lo que se le añada después, sale
    };
    // ── Condiciones › Ajustes del documento
    await boton(`(e) => e.textContent.trim().startsWith('Ana López')`);
    await boton(`(e) => e.textContent.trim() === 'Continuar' && e.closest('.is-abierto')`);
    const conc = await page.$('.quote-line input[type=text]'); await tocarEl(conc); await conc.type('Cambio de grifo'); await espera(150);
    await boton(`(e) => e.textContent.trim() === 'Continuar' && e.closest('.is-abierto')`);
    await boton(`(e) => e.textContent.trim() === 'Cambiar' && e.closest('.quote-ajustes')`);
    const r1 = (await page.evaluateHandle(`document.querySelector('input[name="df-nombre"][value="legal"]')`)).asElement();
    const r2 = (await page.evaluateHandle(`document.querySelector('input[name="df-nombre"][value="comercial"]')`)).asElement();
    const pdf = (await page.evaluateHandle(`document.querySelector('input[name="include_description"]')`)).asElement();
    // El radio se prueba desde el estado en que el toque SÍ cambia algo: «Nombre comercial» sin marcar.
    await medir('radio «Nombre comercial»', r2, '.quote-ajustes');
    // Tras el toque en la etiqueta de «Nombre comercial», «Razón social» ya está SIN marcar: se mide desde ahí.
    await medir('radio «Razón social»', r1, '.quote-ajustes');
    // ¿la etiqueta de «Razón social» (su punto más a la DERECHA) roba a «Nombre comercial»? Y al revés.
    const vecinos = await page.evaluate(() => {
      const [a, b] = ['legal', 'comercial'].map((v) => document.querySelector(`input[name="df-nombre"][value="${v}"]`));
      const la = a.labels[0].getBoundingClientRect(), lb = b.labels[0].getBoundingClientRect();
      const y = (la.top + la.bottom) / 2;
      const t1 = document.elementFromPoint(la.right - 2, y), t2 = document.elementFromPoint(lb.left + 2, y);
      return { finDeRazon: t1 && t1.closest('label') === a.labels[0] ? 'de «Razón social»' : '🔴 de otro', inicioDeComercial: t2 && t2.closest('label') === b.labels[0] ? 'de «Nombre comercial»' : '🔴 de otro' };
    });
    res.push({ ancho, control: 'frontera entre los dos radios', ...vecinos });
    await medir('casilla «Incluir descripción en el PDF»', pdf, '.quote-ajustes');
    // ── ⋯ de la línea › Ajustes › IVA %
    await boton(`(e) => e.textContent.trim() === 'Atrás' && e.closest('.is-abierto')`);
    await boton(`(e) => e.textContent.trim() === '⋯' && e.closest('.quote-line')`);
    await boton(`(e) => e.textContent.trim().startsWith('Ajustes (IVA')`, true);
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), { timeout: 3000 }).catch(() => {});
    const sel = (await page.evaluateHandle(`[...document.querySelectorAll('.quote-ajustes-modal select')].find((s) => s.getBoundingClientRect().height) || null`)).asElement();
    if (!sel) res.push({ ancho, control: 'select «IVA %»', error: 'no se abrió el modal de ajustes' });
    else {
      // CONTROL POSITIVO del árbitro: tocar el select directamente lo abre.
      await tocarEl(sel); const directo = await estado(sel); await page.keyboard.press('Escape'); await espera(200);
      const f = await medir('select «IVA %»', sel, '.quote-ajustes-campos');
      f.controlPositivoToqueDirecto = directo;
      // y sus vecinos en el modal, para ver que no se descoloca nada
      f.modal = await page.evaluate(() => { const m = document.querySelector('.quote-ajustes-modal'); return m ? +m.getBoundingClientRect().height.toFixed(1) : null; });
      // El IVA BLOQUEADO (suplido): con la casilla de suplido marcada el select se deshabilita; ¿se ve gris?
      const suplido = (await page.evaluateHandle(`document.querySelector('.quote-ajustes-modal .quote-line__suplido input[type=checkbox]')`)).asElement();
      if (suplido) {
        const b = await suplido.boundingBox(); await tocarXY(b.x + b.width / 2, b.y + b.height / 2);
        f.bloqueado = await sel.evaluate((s) => ({ disabled: s.disabled, fondo: getComputedStyle(s).backgroundColor, cursor: getComputedStyle(s).cursor, alto: +s.getBoundingClientRect().height.toFixed(1) }));
        await tocarXY(b.x + b.width / 2, b.y + b.height / 2);
      }
      f.camposHermanos = await page.evaluate(() => [...document.querySelectorAll('.quote-ajustes-campos input:not([type=checkbox])')].filter((i) => i.getBoundingClientRect().height).map((i) => +i.getBoundingClientRect().height.toFixed(1)));
    }
    await page.close();
  }
} finally { await browser.close(); srv.close(); }
fs.writeFileSync(process.argv[3], JSON.stringify(res, null, 1));
for (const r of res) {
  if (r.control.startsWith('frontera')) { console.log(`@${r.ancho} frontera: fin de «Razón social» es ${r.finDeRazon} · inicio de «Nombre comercial» es ${r.inicioDeComercial}`); continue; }
  if (r.error) { console.log(`@${r.ancho} ${r.control}: 🔴 ${r.error}`); continue; }
  console.log(`@${r.ancho} ${r.control.padEnd(40)} caja ${r.caja.w}×${r.caja.h} · área ${r.area.error || r.area.ancho + '×' + r.area.alto} · etiqueta ${r.etiqueta ? r.etiqueta.caja.w + '×' + r.etiqueta.caja.h : '—'} · toque en la etiqueta: ${r.toqueEtiqueta ? r.toqueEtiqueta.antes + ' → ' + r.toqueEtiqueta.despues : '—'} · bloque ${r.bloque}` +
    (r.controlPositivoToqueDirecto ? ` · CONTROL toque directo: ${r.controlPositivoToqueDirecto} · modal ${r.modal} · hermanos ${JSON.stringify(r.camposHermanos)} · bloqueado ${JSON.stringify(r.bloqueado)}` : ''));
}
