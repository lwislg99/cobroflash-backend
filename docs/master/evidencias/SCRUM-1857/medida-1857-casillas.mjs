// SCRUM-1857 ① · la casilla del precio por unidad de «Partes por valorar» (`INPUT.po-col-precio`): caja y
// ÁREA DE TOQUE, ANTES y DESPUÉS, a 390, 929 y 1280, sobre https://yaqu.app con la cuenta +qa.
// Uso: node medida-1857-casillas.mjs <raizDelWorktree> <dirSalida>
// ANTES = lo desplegado. DESPUÉS = `styles.css` del ÁRBOL LOCAL servido por interceptación. Se abren los
// partes REALES por valorar de la cuenta +qa (sólo GET); no se teclea nada, y toda escritura (no-GET) se
// intercepta y NO llega a prod. El toque se mide como el árbitro de `guard:objetivo-tactil`: qué elemento
// recibe el punto (`elementFromPoint`), barriendo la vertical y la horizontal que pasan por el centro.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [raiz, salida] = process.argv.slice(2).map((p) => path.resolve(p));
const requiere = createRequire(path.join('D:/MILLONARIO/cobroFlash/cobroflash-backend', 'node_modules/'));
const puppeteer = requiere('puppeteer-core');
const { abrirNavegador } = await import(pathToFileURL(path.join(raiz, 'scripts/_banco-lista.mjs')).href);

const BASE = 'https://yaqu.app';
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim();
const [cNombre, ...cResto] = cookie.split('=');
fs.mkdirSync(salida, { recursive: true });
const LOCALES = { '/dashboard/css/styles.css': ['public/dashboard/css/styles.css', 'text/css'] };
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

const informe = [];
const { browser } = await abrirNavegador(puppeteer);
try {
  for (const lado of ['antes', 'despues']) {
    for (const [ancho, alto] of [[390, 844], [929, 900], [1280, 900]]) {
      const page = await browser.newPage();
      await page.setViewport({ width: ancho, height: alto });
      await page.setCookie({ name: cNombre, value: cResto.join('='), domain: 'yaqu.app', path: '/', secure: true, httpOnly: true });
      await page.setBypassServiceWorker(true);
      await page.setRequestInterception(true);
      const escrituras = [];
      const servidosLocales = new Set();
      page.on('request', (req) => {
        const u = new URL(req.url());
        if (u.origin === BASE && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) {
          escrituras.push(`${req.method()} ${u.pathname}`);
          return req.respond({ status: 200, contentType: 'application/json', body: '{}' });
        }
        const local = lado === 'despues' && u.origin === BASE && LOCALES[u.pathname];
        if (local) {
          servidosLocales.add(u.pathname);
          return req.respond({ status: 200, contentType: local[1], body: fs.readFileSync(path.join(raiz, local[0])) });
        }
        return req.continue();
      });
      const errores = [];
      page.on('pageerror', (e) => errores.push(String(e.message || e)));
      await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.evaluate(() => window.renderAppView('partes-oficina'));
      await page.waitForSelector('#po-lista > button.customers-card', { timeout: 30000 });
      await page.evaluate(() => document.querySelector('#po-lista > button.customers-card').click());
      await page.waitForSelector('#po-detalle input.po-col-precio', { timeout: 30000 });
      await espera(600);
      const medida = await page.evaluate(() => {
        const casillas = [...document.querySelectorAll('#po-detalle input.po-col-precio')];
        const primera = casillas[0];
        primera.scrollIntoView({ block: 'center' });
        // Cada una se trae a la vista ANTES de medirla: elementFromPoint no ve fuera de la ventana, y la
        // primera vuelta de esta sonda dio «toque 0» a las casillas de más abajo por eso.
        return casillas.slice(0, 3).map((c) => {
          c.scrollIntoView({ block: 'center', behavior: 'instant' });
          const q = c.getBoundingClientRect();
          const cx = q.left + q.width / 2;
          const cy = q.top + q.height / 2;
          const recibe = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === c || c.contains(e)); };
          let alto = 0;
          for (let y = Math.floor(q.top) - 30; y <= Math.ceil(q.bottom) + 30; y++) if (recibe(cx, y)) alto++;
          let anchoToque = 0;
          for (let x = Math.floor(q.left) - 30; x <= Math.ceil(q.right) + 30; x++) if (recibe(x, cy)) anchoToque++;
          return { caja: [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)], toque: [anchoToque, alto], disabled: c.disabled };
        });
      });
      const otros = await page.evaluate(() => {
        // Control: lo que NO se toca. El `input` global (el buscador de arriba) y «Guardar precios».
        const b = [...document.querySelectorAll('#po-detalle button')].find((x) => x.textContent.trim() === 'Guardar precios');
        const q = b ? b.getBoundingClientRect() : null;
        return {
          guardarPrecios: q ? [Math.round(q.width), Math.round(q.height)] : null,
          desbordaPagina: document.documentElement.scrollWidth > window.innerWidth,
          casillas: document.querySelectorAll('#po-detalle input.po-col-precio').length,
        };
      });
      // El repo es PÚBLICO: antes de fotografiar se tapan el cliente y la obra de los partes reales de la
      // cuenta +qa (la lista y la cabecera del detalle). No cambia ninguna medida: ya están tomadas.
      await page.evaluate(() => {
        document.querySelectorAll('#po-lista > button.customers-card > span:first-child > span:last-child').forEach((n) => { n.textContent = 'Cliente (oculto en la captura)'; });
        const sub = document.querySelector('#po-detalle .customers-card > div:first-child > div:first-child > div:last-child');
        if (sub) sub.textContent = 'Cliente · obra (ocultos en la captura)';
      });
      await espera(300);
      await page.screenshot({ path: path.join(salida, `medida-1857-${lado}-${ancho}.png`) });
      informe.push({ lado, ancho, servidosLocales: [...servidosLocales], escrituras, errores, medida, ...otros });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(informe, null, 1));
