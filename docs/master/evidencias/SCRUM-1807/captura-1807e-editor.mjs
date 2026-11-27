// SCRUM-1807e · capturas del editor con apartados, a 390 y 1280, sobre https://yaqu.app con la cuenta QA.
// Uso: node captura-1807e-editor.mjs <raizDelWorktree> <dirSalida>
// yaqu.app sirve la página; quotesView.js, quoteApartados.js y styles.css se sirven desde el ÁRBOL LOCAL
// por interceptación (la rama aún no está en main). Toda escritura (no-GET) se intercepta y NO llega a prod.
// Datos de EJEMPLO: la plantilla de «Duplicar» del test `scrum1807e`.
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
  '/dashboard/js/quoteApartados.js': ['public/dashboard/js/quoteApartados.js', 'application/javascript'],
  '/dashboard/css/styles.css': ['public/dashboard/css/styles.css', 'text/css'],
};
const PLANTILLA = {
  name: 'Copia de #18', currency: 'EUR', paymentTerms: 'FULL_UPFRONT',
  lines: [
    { concept: 'Baño', apartado: true, agrupado: true, description: 'Reforma completa del baño' },
    { concept: 'Plato de ducha', qty: 1, price: 100, tax: 0.21 },
    { concept: 'Mano de obra', qty: 2, price: 50, tax: 0.10 },
    { concept: 'Cocina', apartado: true },
    { concept: 'Grifo monomando', qty: 1, price: 9999.99, tax: 0.21 },
  ],
};

const informe = [];
const { browser } = await abrirNavegador(puppeteer);
try {
  // 1920: la columna del editor pasa de 640 px y la rejilla deja de plegarse (cuatro números en fila).
  for (const [ancho, alto] of [[390, 844], [1280, 900], [1920, 1080]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: ancho, height: alto });
    await page.setCookie({ name: cNombre, value: cResto.join('='), domain: 'yaqu.app', path: '/', secure: true, httpOnly: true });
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    const servidosLocales = new Set();
    const escrituras = [];
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.origin === BASE && req.method() !== 'GET' && req.method() !== 'HEAD' && req.method() !== 'OPTIONS') {
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
    await page.evaluate((tpl) => window.renderAppView('quotes-new', { template: tpl }), PLANTILLA);
    await page.waitForSelector('.quote-line--apartado', { timeout: 30000 });
    await new Promise((ok) => setTimeout(ok, 800));
    // Paso cerrado: el botón NO debe verse (lo midió esta captura la primera vez: asomaba en «2 Conceptos»).
    const botonConPasoCerrado = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '+ Añadir apartado');
      const q = b && b.getBoundingClientRect();
      return !!(q && q.width > 0 && q.height > 0);
    });
    // Se abre «Conceptos» como lo abre la persona: elige el cliente de pruebas y pulsa «Continuar».
    await page.evaluate(() => {
      const s = document.querySelector('#view-container select[name="customer_id"]');
      const o = s && [...s.options].find((x) => x.textContent.trim().startsWith('Cliente de pruebas QA'));
      if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await new Promise((ok) => setTimeout(ok, 400));
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#view-container button')].find((x) => x.textContent.trim() === 'Continuar');
      if (b) b.click();
    });
    await new Promise((ok) => setTimeout(ok, 600));
    const medida = await page.evaluate(() => {
      const caja = (n) => { if (!n) return null; const q = n.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)]; };
      const cab = [...document.querySelectorAll('.quote-line--apartado')].map((f) => ({
        concepto: f.querySelector('input').value,
        modo: f.querySelector('select').value,
        iva: f.querySelector('.quote-apartado__iva').textContent,
        ivaCaja: caja(f.querySelector('.quote-apartado__iva')),
        total: f.querySelector('.quote-line__total').textContent,
        selectorCaja: caja(f.querySelector('select')),
        fila: caja(f),
      }));
      // La columna del chip de IVA de la PRIMERA línea que cobra, para ver si el de la cabecera cae en ella.
      // Con un IVA distinto del de siempre (el 10 % de «Mano de obra»), el chip se pinta.
      const linea = [...document.querySelectorAll('.quote-line:not(.quote-line--apartado)')][1];
      const boton = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '+ Añadir apartado');
      return { cab, chipIvaDeLinea: caja(linea && linea.querySelector('.quote-line__ajustes')), boton: caja(boton),
        desborda: document.documentElement.scrollWidth > window.innerWidth };
    });
    const primera = await page.$('.quote-line--apartado');
    await primera.evaluate((n) => n.scrollIntoView({ block: 'start' }));
    await new Promise((ok) => setTimeout(ok, 300));
    await page.screenshot({ path: path.join(salida, `captura-1807e-editor-${ancho}.png`) });
    informe.push({ ancho, botonConPasoCerrado, servidosLocales: [...servidosLocales], escrituras, errores, ...medida });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(informe, null, 1));
