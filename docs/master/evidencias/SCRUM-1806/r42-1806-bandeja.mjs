// SCRUM-1806 · r42 EN VIVO: el rótulo firmado en el aviso de la bandeja «Pendientes de facturar».
// Uso: node r42-1806-bandeja.mjs <raizDelWorktree> <dirSalida>
// yaqu.app sirve TODO (nada local: se mide lo desplegado). La bandeja de la cuenta +qa está vacía
// (GET real → `{"clientes":[]}`), así que la respuesta de ESE GET se sustituye por dos clientes de
// EJEMPLO: uno sin tipo declarado (debe preguntar) y otro con él (control: NO debe preguntar).
// Toda escritura (no-GET) se intercepta y NO llega a prod; el informe las lista.
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
const LITERAL = '¿Factura como empresa o autónomo (IVA)?';

const grupo = (mes, sem) => ({
  mesLabel: mes, semaforo: sem, fechaLimite: '2026-12-15', avisar: false,
  importePotencial: { total: 242 }, albaranes: [{ id: 990001 }], jobId: 990001,
});
const INYECTADO = {
  clientes: [
    { customerId: 990001, customerName: 'Cliente de EJEMPLO sin tipo', tipoDestinatario: 'PARTICULAR', tipoDestinatarioDeclarado: null, grupos: [grupo('Noviembre 2026', 'ambar')] },
    { customerId: 990002, customerName: 'Cliente de EJEMPLO con tipo', tipoDestinatario: 'EMPRESARIO', tipoDestinatarioDeclarado: 'EMPRESARIO', grupos: [grupo('Noviembre 2026', 'verde')] },
  ],
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
    const escrituras = [];
    let inyectado = 0;
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.origin === BASE && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) {
        escrituras.push(`${req.method()} ${u.pathname}`);
        return req.respond({ status: 200, contentType: 'application/json', body: '{}' });
      }
      if (u.origin === BASE && req.method() === 'GET' && u.pathname === '/admin/albaranes/pendientes-facturar') {
        inyectado++;
        return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(INYECTADO) });
      }
      return req.continue();
    });
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e.message || e)));
    await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle2', timeout: 60000 });
    // Lo DESPLEGADO: el fichero que sirve yaqu.app lleva el literal (recibo de que #3317 está en prod).
    const desplegado = await page.evaluate(async () => {
      const r = await fetch('/dashboard/js/tipoDestinatarioPendiente.js', { cache: 'no-store' });
      return r.ok ? await r.text() : '';
    });
    await page.evaluate(() => window.renderAppView('invoices'));
    await espera(1200);
    const pestana = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#view-container button, #view-container [role="tab"]')]
        .find((x) => /pendientes/i.test(x.textContent));
      if (b) b.click();
      return b ? b.textContent.trim() : null;
    });
    await page.waitForSelector('.tipo-destinatario-campo', { timeout: 20000 }).catch(() => {});
    await espera(500);
    const medida = await page.evaluate(() => {
      const caja = (n) => { if (!n) return null; const q = n.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)]; };
      const etiquetas = [...document.querySelectorAll('.tipo-destinatario-campo label')];
      return {
        rotulos: etiquetas.map((e) => e.textContent),
        caja: caja(etiquetas[0]),
        enPantalla: etiquetas[0] ? (() => { const q = etiquetas[0].getBoundingClientRect(); return q.width > 0 && q.height > 0; })() : false,
        tarjetas: [...document.querySelectorAll('.tipo-destinatario-pendiente')].length,
        opciones: etiquetas[0] ? [...etiquetas[0].parentElement.querySelectorAll('option')].map((o) => o.textContent) : [],
        desborda: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    const et = await page.$('.tipo-destinatario-campo');
    if (et) await et.evaluate((n) => n.scrollIntoView({ block: 'center' }));
    await espera(300);
    await page.screenshot({ path: path.join(salida, `r42-1806-bandeja-${ancho}.png`) });
    informe.push({ ancho, desplegadoLlevaElLiteral: desplegado.includes(LITERAL), pestana, inyectado, escrituras, errores, ...medida });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(informe, null, 1));
