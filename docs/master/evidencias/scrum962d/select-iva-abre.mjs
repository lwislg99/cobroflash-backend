// Sólo lectura (SCRUM-962c, el DUDOSO). ¿Un toque en la ETIQUETA del <select> «IVA %» de los ajustes de línea
// ABRE el desplegable? Móvil emulado (390, touch). Árbitro: `select.matches(':open')`, con CONTROL POSITIVO: un
// toque directo en el <select> TIENE que dar :open. Si no, el árbitro no ve la apertura y la respuesta no vale.
// Uso: node select-iva-abre.mjs <raiz>
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
const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), [{ ruta: '/ed', fnVista: 'renderQuotesView', datos: DATOS }]);
const { browser } = await abrirNavegador(puppeteer);
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const out = {};
try {
  const page = await browser.newPage();
  await page.emulate({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
  await page.goto(`http://127.0.0.1:${puerto}/ed`, { waitUntil: 'load' });
  await page.waitForFunction('window.__listo === true', { timeout: 20000 });
  out.soportaOpen = await page.evaluate(`CSS.supports('selector(:open)')`);
  const tocar = async (sel, filtro) => {
    const h = await page.evaluateHandle(`[...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && (${filtro})(e); }) || null`);
    const el = h.asElement(); if (!el) return false;
    await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    const b = await el.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await espera(250); return true;
  };
  await tocar('button', `(e) => e.textContent.trim().startsWith('Ana López')`);
  await tocar('button', `(e) => e.textContent.trim() === 'Continuar' && e.closest('.is-abierto')`);
  const conc = await page.$('.quote-line input[type=text]'); await conc.tap(); await conc.type('Cambio de grifo');
  await tocar('button', `(e) => e.textContent.trim() === '⋯' && e.closest('.quote-line')`);
  await tocar('button', `(e) => e.textContent.trim().startsWith('Ajustes (IVA')`);
  const sel = await page.evaluateHandle(`[...document.querySelectorAll('.quote-ajustes-modal select')].find((s) => s.getBoundingClientRect().height) || null`);
  const el = sel.asElement();
  if (!el) { out.error = 'no encuentro el select de IVA en el modal de ajustes'; }
  else {
    const abierto = () => el.evaluate((s) => { try { return s.matches(':open'); } catch (e) { return 'sin :open'; } });
    out.antes = await abierto();
    // ① CONTROL POSITIVO: toque directo en el select.
    const b = await el.boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await espera(300);
    out.toqueDirecto = await abierto();
    await page.keyboard.press('Escape'); await espera(250);
    out.trasEscape = await abierto();
    // ② La etiqueta: el punto de la etiqueta más alejado del select que siga siendo de la etiqueta.
    const p = await el.evaluate((s) => {
      const l = s.labels && s.labels[0]; if (!l) return null;
      const lr = l.getBoundingClientRect(), sr = s.getBoundingClientRect(); let mejor = null;
      for (let y = lr.top + 1; y < lr.bottom - 1; y += 2) for (let x = lr.left + 1; x < lr.right - 1; x += 6) {
        const t = document.elementFromPoint(x, y);
        if (!t || t === s || s.contains(t) || t.closest('label') !== l) continue;
        const d = Math.abs(y - (sr.top + sr.height / 2)) + Math.abs(x - (sr.left + sr.width / 2)) / 4;
        if (!mejor || d > mejor.d) mejor = { x, y, d, etiqueta: l.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) };
      }
      return mejor;
    });
    out.puntoEtiqueta = p;
    if (p) {
      await page.touchscreen.tap(p.x, p.y); await espera(300);
      out.toqueEtiqueta = await abierto();
      out.focoTrasEtiqueta = await el.evaluate((s) => document.activeElement === s);
    }
    out.alto = await el.evaluate((s) => +s.getBoundingClientRect().height.toFixed(1));
  }
  await page.close();
} finally { await browser.close(); srv.close(); }
console.log(JSON.stringify(out, null, 1));
