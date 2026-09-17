// docs/master/evidencias/SCRUM-307/sin-red/_conductor.mjs — el banco «sin cobertura» de la Sesión 0 (17-sep-2026)
//
// Mide el panel de STAGING a 390 px con la red CORTADA DE VERDAD. Lo usan control-red.mjs, preparar.mjs y
// recorrido-sin-red.mjs. No corre en `npm test` ni en CI: necesita navegador, la sesión QA de staging y
// escribe datos de prueba.
//
// ═══ 🔴 POR QUÉ NO VALE EL INTERRUPTOR DE «SIN RED» DEL NAVEGADOR ═══════════════════════════════════════
// Medido el 17-sep-2026: con `ctx.setOffline(true)` de Playwright (el mismo corte que el de DevTools),
// las peticiones que pasan por el SERVICE WORKER siguieron llegando al servidor: se CREÓ un albarán de
// verdad (`201 POST /admin/jobs/3106/albaranes (SW)`) con la red «cortada». Emular el corte en la
// página no corta al service worker, que es justo quien sirve el panel. Es el aviso H7 de SCRUM-307.
//
// Por eso aquí TODO el tráfico del navegador —página y service worker— sale por un proxy local.
// `red.cortar()` destruye los túneles vivos, rechaza los nuevos y además pone la página en modo sin
// conexión (para que `navigator.onLine` sea `false`, como en un sótano). `red.devolver()` lo deshace.
// `control-red.mjs` comprueba que el corte corta ANTES de creerse ninguna medición.
//
// ═══ Otras dos trampas medidas ese mismo día ════════════════════════════════════════════════════════════
// · Un perfil de navegador guardado dentro del scratchpad de Claude tenía la Cache API rota
//   («UnknownError: Unexpected internal error»): el service worker parecía no instalarse. Aquí el
//   perfil es temporal y lo crea el propio navegador.
// · Un trazo con el ratón NO activa el pad de firma en emulación móvil: `trazoTactil` lo dibuja con
//   PointerEvent de tipo táctil, que es lo que produce un dedo.
//
// Secreto: `E2E_TEST_LOGIN_SECRET` se lee del ENTORNO y nunca se imprime (regla 9).
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../../scripts/_navegador.mjs';

export const BASE = process.env.STAGING_URL || 'https://yaqu-staging-production.up.railway.app';
if (!/staging/.test(new URL(BASE).hostname)) {
  console.error(`NO: ${new URL(BASE).hostname} no es staging. Este banco escribe datos de prueba.`);
  process.exit(2);
}
export const QA_EMAIL = process.env.E2E_QA_EMAIL || 'qa@staging.yaqu';
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
export const CARPETA_CAPTURAS = path.join(os.tmpdir(), 'yaqu-sin-red');

/** Arranca proxy y navegador. Devuelve { nav, page, red, eventos, captura, cerrar }. */
export async function arrancar() {
  let conectado = true;
  let rechazados = 0;
  const tuneles = new Set();
  const proxy = http.createServer((req, res) => { rechazados += conectado ? 0 : 1; res.writeHead(conectado ? 501 : 502); res.end(); });
  proxy.on('connect', (req, cliente, cabeza) => {
    if (!conectado) { rechazados++; cliente.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); return; }
    const [host, puerto] = req.url.split(':');
    const destino = net.connect(Number(puerto) || 443, host, () => {
      cliente.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (cabeza && cabeza.length) destino.write(cabeza);
      destino.pipe(cliente);
      cliente.pipe(destino);
    });
    const par = { cliente, destino };
    tuneles.add(par);
    const cerrarPar = () => { tuneles.delete(par); cliente.destroy(); destino.destroy(); };
    for (const s of [cliente, destino]) { s.on('error', cerrarPar); s.on('close', cerrarPar); }
  });
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));

  const nav = await lanzarNavegador(puppeteer, {
    headless: true,
    args: [`--proxy-server=http://127.0.0.1:${proxy.address().port}`, '--proxy-bypass-list=<-loopback>'],
  });
  if (!nav) { proxy.close(); console.error('NO SUPE MIRAR: el navegador no arrancó.'); process.exit(3); }
  const page = (await nav.pages())[0] || (await nav.newPage());
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

  const eventos = [];
  const corto = (u) => '/' + u.split('/').slice(3).join('/').replace(/[A-Za-z0-9]{24,}/g, '<tok>').slice(0, 80);
  page.on('requestfailed', (r) => eventos.push(`FALLA ${r.method()} ${corto(r.url())} ${r.failure()?.errorText || ''}`));
  page.on('response', (r) => {
    if (r.request().method() !== 'GET' || r.status() >= 400) {
      eventos.push(`${r.status()} ${r.request().method()} ${corto(r.url())}${r.fromServiceWorker() ? ' (SW)' : ''}`);
    }
  });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));

  const red = {
    async cortar() {
      conectado = false;
      for (const t of [...tuneles]) { t.cliente.destroy(); t.destino.destroy(); }
      tuneles.clear();
      await page.setOfflineMode(true);
    },
    async devolver() { conectado = true; await page.setOfflineMode(false); },
    rechazados: () => rechazados,
  };
  fs.mkdirSync(CARPETA_CAPTURAS, { recursive: true });
  const captura = (nombre) => page.screenshot({ path: path.join(CARPETA_CAPTURAS, nombre + '.png') }).catch(() => {});
  const volcar = (titulo) => { if (eventos.length) console.log(`   eventos ${titulo}:\n     ` + eventos.splice(0).join('\n     ')); };
  const cerrar = async () => { await nav.close().catch(() => {}); proxy.close(); };
  return { nav, page, red, volcar, captura, cerrar };
}

/** Inicia la sesión QA de staging con el login de test. El secreto viene del entorno. */
export async function entrar(page) {
  const secreto = process.env.E2E_TEST_LOGIN_SECRET;
  if (!secreto) { console.error('NO SUPE MIRAR: falta E2E_TEST_LOGIN_SECRET en el entorno.'); process.exit(2); }
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const estado = await page.evaluate(async (email, secret) => {
    const r = await fetch('/auth/test-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, secret }) });
    return r.status;
  }, QA_EMAIL, secreto);
  if (estado !== 200) { console.error(`NO SUPE MIRAR: test-login respondió ${estado}.`); process.exit(2); }
}

/** Abre el panel y espera a que el service worker controle la página y termine la precarga. */
export async function calentar(page) {
  await page.goto(BASE + '/dashboard/', { waitUntil: 'load' });
  for (let i = 0; i < 20; i++) {
    const listo = await page.evaluate(() => !!navigator.serviceWorker.controller && window.precargaUltimoResultado !== undefined);
    if (listo) break;
    if (i === 6) await page.reload({ waitUntil: 'load' });
    await dormir(1500);
  }
  return page.evaluate(() => ({ sw: !!navigator.serviceWorker.controller, precarga: window.precargaUltimoResultado }));
}

/** ¿El corte corta? Una petición directa y una que pasa por el service worker tienen que FALLAR. */
export async function sondaDeRed(page) {
  return page.evaluate(async () => {
    const probar = async (u) => { try { return (await fetch(u, { cache: 'no-store', credentials: 'include' })).status; } catch (e) { return 'ERROR'; } };
    return { directa: await probar('/version'), porElSW: await probar('/admin/jobs') };
  });
}
export const cortada = (s) => s.directa === 'ERROR' && s.porElSW === 'ERROR';

export const trazoTactil = (page) => page.$$eval('canvas', (lienzos) => {
  const cv = lienzos.filter((c) => c.offsetParent).pop();
  if (!cv) return false;
  const r = cv.getBoundingClientRect();
  const ev = (tipo, x, y) => cv.dispatchEvent(new PointerEvent(tipo, { bubbles: true, pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: r.left + x, clientY: r.top + y, pressure: 0.5 }));
  ev('pointerdown', 20, 40);
  for (let i = 1; i < 15; i++) ev('pointermove', 20 + i * 12, 40 + (i % 2 ? -15 : 15));
  ev('pointerup', 200, 40);
  return true;
});

/** Cuántas firmas hay en la cola del móvil (IndexedDB `yaqu` · `firmasPendientes`). */
export const colaDeFirmas = (page) => page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('yaqu');
  r.onerror = () => res('no abre');
  r.onsuccess = () => {
    try {
      const q = r.result.transaction('firmasPendientes').objectStore('firmasPendientes').count();
      q.onsuccess = () => res(q.result);
      q.onerror = () => res('error');
    } catch (e) { res('exc ' + e.message); }
  };
}));

export const textoDePagina = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
export const textoNuevo = (antes, ahora) => ahora.split(/(?<=[.!?])\s+/).filter((f) => !antes.includes(f)).join(' | ').slice(0, 400);

export async function pulsar(page, selectorOTexto) {
  const hecho = await page.evaluate((s) => {
    const porSelector = s.startsWith('[') ? document.querySelector(s) : null;
    const porTexto = !porSelector && [...document.querySelectorAll('button, a')].find((b) => b.offsetParent && b.innerText.trim() === s);
    const el = porSelector || porTexto;
    if (!el) return false;
    el.click();
    return true;
  }, selectorOTexto);
  return hecho;
}

export const argumento = (nombre) => {
  const i = process.argv.indexOf('--' + nombre);
  return i === -1 ? undefined : process.argv[i + 1];
};
