// SCRUM-1805 ① · capturas del editor EN MODO FACTURA (paso «Condiciones» abierto y cerrado), a 390 y
// 1280, sobre https://yaqu.app con la cuenta QA.
// Uso: node captura-1805-editor-factura.mjs <raizDelWorktree> <dirSalida>
// yaqu.app sirve la página; quotesView.js y cuerpoDelDocumentoSuelto.js se sirven desde el ÁRBOL LOCAL
// por interceptación (la rama aún no está en main). Toda escritura (no-GET) se intercepta y NO llega a
// prod. El modo factura se pide en la página (`appDocumentoSuelto = 'factura'`) y se monta por la
// puerta de la ruta (`renderDocumentoSueltoView`): nada se emite. Datos de EJEMPLO.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [raiz, salida] = process.argv.slice(2).map((p) => path.resolve(p));
const RAIZ_REPO = 'D:/MILLONARIO/cobroFlash/cobroflash-backend';
const requiere = createRequire(path.join(RAIZ_REPO, 'node_modules/'));
const puppeteer = requiere('puppeteer-core');
const { abrirNavegador } = await import(pathToFileURL(path.join(raiz, 'scripts/_banco-lista.mjs')).href);

const BASE = 'https://yaqu.app';
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim();
const [cNombre, ...cResto] = cookie.split('=');
fs.mkdirSync(salida, { recursive: true });

const LOCALES = {
  '/dashboard/js/quotesView.js': ['public/dashboard/js/quotesView.js', 'application/javascript'],
  '/dashboard/js/cuerpoDelDocumentoSuelto.js': ['public/dashboard/js/cuerpoDelDocumentoSuelto.js', 'application/javascript'],
};
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

const informe = [];
const { browser } = await abrirNavegador(puppeteer);
try {
  for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: ancho, height: alto });
    await page.setCookie({ name: cNombre, value: cResto.join('='), domain: 'yaqu.app', path: '/', secure: true, httpOnly: true });
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    const servidosLocales = new Set();
    const escrituras = [];
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.origin === BASE && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) {
        escrituras.push(`${req.method()} ${u.pathname}`);
        return req.respond({ status: 200, contentType: 'application/json', body: '{}' });
      }
      const local = u.origin === BASE && LOCALES[u.pathname];
      if (local) {
        servidosLocales.add(u.pathname);
        return req.respond({ status: 200, contentType: local[1], body: fs.readFileSync(path.join(raiz, local[0])) });
      }
      return req.continue();
    });
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e.message || e)));
    await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => {
      window.appDocumentoSuelto = 'factura';
      window.renderDocumentoSueltoView(document.querySelector('#view-container'));
    });
    await page.waitForSelector('#invoice-due-date', { timeout: 30000 });
    await espera(800);
    // Cliente de pruebas, una línea de ejemplo, y «Continuar» dos veces: queda abierto «3 Condiciones».
    await page.evaluate(() => {
      const s = document.querySelector('#view-container select[name="customer_id"]');
      const o = s && [...s.options].find((x) => x.textContent.trim().startsWith('Cliente de pruebas QA'));
      if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await espera(400);
    await page.evaluate(() => {
      const pon = (n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); };
      const c = document.querySelector('#view-container input[placeholder="Concepto / servicio"]');
      const nums = [...document.querySelectorAll('#view-container .quote-line input[type="number"]')];
      pon(c, 'Cambio de grifo'); pon(nums[0], '1'); pon(nums[1], '120');
    });
    // Teclear el concepto abre el autocompletado del catálogo («Sin resultados»), y su búsqueda
    // responde TARDE: un blur antes de la respuesta lo cierra y la respuesta lo reabre. Se espera a
    // que conteste y se sale del campo, como lo haría la persona. (La primera vuelta lo dejó flotando.)
    await espera(1500);
    await page.evaluate(() => {
      const c = document.querySelector('#view-container input[placeholder="Concepto / servicio"]');
      c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      c.blur();
    });
    await espera(400);
    const autocompletadoAbierto = await page.evaluate(() => [...document.querySelectorAll('.pf-autocomplete')]
      .some((n) => { const q = n.getBoundingClientRect(); return q.width > 0 && q.height > 0 && getComputedStyle(n).display !== 'none'; }));
    const continuar = () => page.evaluate(() => {
      const b = [...document.querySelectorAll('#view-container button')]
        .find((x) => x.textContent.trim() === 'Continuar' && x.offsetParent !== null && !x.disabled);
      if (b) b.click();
      return !!b;
    });
    await continuar(); await espera(400);
    await continuar(); await espera(600);
    // Se abre la fila de formas de pago y se desmarca Transferencia, como lo haría la persona.
    const medidaAbierto = await page.evaluate(() => {
      const caja = (n) => { if (!n) return null; const q = n.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)]; };
      const cond = [...document.querySelectorAll('#view-container .quote-block-title')].find((t) => t.textContent.trim() === 'Condiciones');
      const bloque = cond && cond.closest('.quote-block');
      const filas = bloque ? [...bloque.querySelectorAll('.quote-fila__titulo')].map((t) => t.textContent.trim()) : [];
      return {
        pasoAbierto: !!(bloque && bloque.classList.contains('is-abierto')),
        filas,
        venceEl: document.querySelector('#invoice-due-date').value,
        bloque: caja(bloque),
        desborda: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    const cond = await page.evaluateHandle(() => [...document.querySelectorAll('#view-container .quote-block-title')]
      .find((t) => t.textContent.trim() === 'Condiciones'));
    await cond.evaluate((n) => n.scrollIntoView({ block: 'start' }));
    await espera(300);
    await page.screenshot({ path: path.join(salida, `captura-1805-condiciones-abierto-${ancho}.png`) });

    // AB6 · la fila «Vence el» ABIERTA: el campo de fecha, medido (toque ≥ 44 px, dentro del ancho).
    const venceAbierto = await page.evaluate(() => {
      const fila = [...document.querySelectorAll('#view-container .quote-fila')]
        .find((f) => f.querySelector('.quote-fila__titulo') && f.querySelector('.quote-fila__titulo').textContent.trim() === 'Vence el');
      const b = fila && [...fila.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Cambiar');
      if (b) b.click();
      const i = document.querySelector('#invoice-due-date');
      const q = i.getBoundingClientRect();
      const qb = b ? b.getBoundingClientRect() : null;
      return {
        campo: [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)],
        boton: qb ? [Math.round(qb.left), Math.round(qb.top), Math.round(qb.width), Math.round(qb.height)] : null,
        cabe: q.right <= window.innerWidth,
      };
    });
    await espera(300);
    const filaVence = await page.$('#invoice-due-date');
    await filaVence.evaluate((n) => n.scrollIntoView({ block: 'center' }));
    await espera(300);
    await page.screenshot({ path: path.join(salida, `captura-1805-vence-abierto-${ancho}.png`) });
    // Se vuelve a plegar con su «Listo».
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#view-container .quote-fila button')].find((x) => x.textContent.trim() === 'Listo');
      if (b) b.click();
    });
    await espera(200);

    await page.evaluate(() => {
      const chk = [...document.querySelectorAll('#view-container input[type="checkbox"]')]
        .find((x) => (x.parentElement && x.parentElement.textContent.includes('Transferencia')));
      if (chk && chk.checked) chk.click();
    });
    await espera(200);
    await continuar(); await espera(600);
    const medidaCerrado = await page.evaluate(() => {
      const cond = [...document.querySelectorAll('#view-container .quote-block-title')].find((t) => t.textContent.trim() === 'Condiciones');
      const bloque = cond && cond.closest('.quote-block');
      const r = bloque && bloque.querySelector('.quote-paso__resumen');
      const rev = [...document.querySelectorAll('#view-container .quote-block-title')].find((t) => t.textContent.trim() === 'Revisar y emitir');
      return {
        resumen: r ? r.textContent : null,
        numeroCondiciones: cond && cond.dataset.numero,
        numeroRevisar: rev && rev.dataset.numero,
        desborda: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    await cond.evaluate((n) => n.scrollIntoView({ block: 'start' }));
    await espera(300);
    await page.screenshot({ path: path.join(salida, `captura-1805-condiciones-cerrado-${ancho}.png`) });
    informe.push({ ancho, servidosLocales: [...servidosLocales], escrituras, errores, autocompletadoAbierto, abierto: medidaAbierto, venceAbierto, cerrado: medidaCerrado });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(informe, null, 1));
