// SCRUM-1060 · CLIENTES · Medir cuanto pesa la foto de un Trabajo antes de enseñarla en el
// historial del cliente.
//
// Uso: node docs/master/evidencias/SCRUM-1060/medir-peso-y-carga.mjs
//
// Dos partes, la primera de SOLO LECTURA, la segunda con UNA escritura (crear + medir + borrar,
// mismo patron que SCRUM-947b):
//
//   A) PESO REAL DE 20 FOTOS DE MOVIL TIPICAS. `fotoParaGuardar` (expensesView.js) es codigo de
//      CLIENTE puro (canvas, sin red): se llama TAL CUAL como lo sirve staging (window.fotoParaGuardar,
//      funcion top-level sin IIFE), sobre 20 imagenes sinteticas que varian resolucion (12/8/16 MP,
//      apaisada y vertical — las de un movil real) y densidad de detalle (una pared lisa comprime
//      mucho; un ticket con letra menuda, poco). NINGUN dato se escribe en el servidor para esto.
//
//   B) TIEMPO DE CARGA BAJO RED 4G SIMULADA. Staging no tiene NINGUNA foto de tamaño real
//      (confirmado por `docs/master/evidencias/scrum920/sonda-peso-fotos-staging.mjs`: 3 fixtures
//      de 0,1 KiB). Se crea 1 gasto con la foto MEDIANA de la parte A por el modal real, se mide
//      `GET /admin/expenses/:id/foto` con `Network.emulateNetworkConditions` (el mismo perfil «4G
//      regular» de `scripts/guard-primera-pantalla.mjs`: 9 Mbps bajada, 4 subida, 170 ms), y se
//      BORRA. Un solo gasto de prueba, igual que SCRUM-947b.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';

const BASE = 'https://yaqu-staging-production.up.railway.app';
if (!/yaqu-staging/.test(BASE)) { console.error('no es staging: no se mide'); process.exit(2); }
const SECRETO = 'D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt';
const m = fs.readFileSync(SECRETO, 'utf8').match(/^E2E_TEST_LOGIN_SECRET=(.+)$/m);
if (!m) { console.error('no encuentro la clave de login en el fichero de secretos'); process.exit(2); }

const SALIDA = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'informe.json');

const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
const pag = await nav.newPage();
const informe = {};
let creadoId = null;
try {
  await pag.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await pag.goto(BASE + '/login.html', { waitUntil: 'load' });
  const login = await pag.evaluate(async (secreto) => {
    const r = await fetch('/auth/test-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qa@staging.yaqu', secret: secreto }) });
    return r.status;
  }, m[1].trim());
  informe.login = login;
  if (login !== 200) throw new Error('login de QA: ' + login);

  informe.version = await pag.evaluate(async () => (await (await fetch('/version')).json()).version);

  await pag.goto(BASE + '/dashboard/#expenses', { waitUntil: 'networkidle2' });
  await pag.waitForFunction(() => typeof window.fotoParaGuardar === 'function', { timeout: 10000 });

  // ── A · 20 FOTOS SINTETICAS DE MOVIL, POR fotoParaGuardar REAL ──────────────────────────────
  const RESOLUCIONES = [
    [4032, 3024], [3024, 4032], // 12 MP apaisada/vertical
    [3264, 2448], [2448, 3264], // 8 MP
    [4608, 3456], // 16 MP
  ];
  const DENSIDADES = [0.1, 0.3, 0.5, 0.8]; // fraccion de pixeles con ruido: pared lisa -> ticket detallado
  const muestras = [];
  for (let i = 0; i < 20; i++) {
    const [w, h] = RESOLUCIONES[i % RESOLUCIONES.length];
    const densidad = DENSIDADES[Math.floor(i / RESOLUCIONES.length) % DENSIDADES.length];
    const r = await pag.evaluate(async (w, h, densidad, i) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#d8cfc0'); g.addColorStop(1, '#8a7f70');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      let s = 11 + i * 97;
      const paso = 3;
      for (let yy = 0; yy < h; yy += paso) for (let xx = 0; xx < w; xx += paso) {
        s = (s * 1103515245 + 12345) >>> 0;
        if (((s >>> 20) & 0xff) / 255 > (1 - densidad)) {
          const v = (s >>> 24) - 128;
          x.fillStyle = `rgba(${v > 0 ? '255,255,255' : '0,0,0'},${(Math.abs(v) / 700).toFixed(3)})`;
          x.fillRect(xx, yy, paso, paso);
        }
      }
      x.fillStyle = '#222'; x.font = Math.round(w / 22) + 'px sans-serif';
      x.fillText('TICKET QA-1060-' + i + ' · ' + (12 + i) + ',00 EUR', w * 0.08, h * 0.5);
      const blobOriginal = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
      const file = new File([blobOriginal], 'IMG_' + i + '.jpg', { type: 'image/jpeg' });
      const t0 = performance.now();
      const dataUri = await window.fotoParaGuardar(file);
      const ms = performance.now() - t0;
      const bin = Math.round((dataUri.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
      const dims = await new Promise((ok) => { const im = new Image(); im.onload = () => ok([im.naturalWidth, im.naturalHeight]); im.onerror = () => ok(null); im.src = dataUri; });
      return { i, w, h, densidad, origenBytes: blobOriginal.size, guardadoDataUriBytes: dataUri.length, guardadoBinBytes: bin, guardadoPx: dims ? dims.join('×') : 'NO SE ABRE', msCliente: Math.round(ms) };
    }, w, h, densidad, i);
    muestras.push(r);
  }
  informe.muestras = muestras;
  const pesos = muestras.map((x) => x.guardadoBinBytes).sort((a, b) => a - b);
  const mib = (n) => +(n / 1048576).toFixed(3);
  informe.resumenPesoBin = {
    n: pesos.length,
    minMiB: mib(pesos[0]),
    medianaMiB: mib(pesos[Math.floor(pesos.length / 2)]),
    p90MiB: mib(pesos[Math.floor(pesos.length * 0.9)]),
    maxMiB: mib(pesos[pesos.length - 1]),
  };

  // ── B · 1 GASTO REAL, TIEMPO DE CARGA BAJO 4G SIMULADA ──────────────────────────────────────
  const mediana = muestras.slice().sort((a, b) => a.guardadoBinBytes - b.guardadoBinBytes)[Math.floor(muestras.length / 2)];
  const CONCEPTO = 'QA 1060 peso-y-carga ' + Date.now();
  await pag.click('#exp-new-btn');
  await pag.waitForSelector('#exp-receipt', { timeout: 10000 });
  await pag.evaluate(async (w, h, densidad, i) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#d8cfc0'); g.addColorStop(1, '#8a7f70');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    let s = 11 + i * 97; const paso = 3;
    for (let yy = 0; yy < h; yy += paso) for (let xx = 0; xx < w; xx += paso) {
      s = (s * 1103515245 + 12345) >>> 0;
      if (((s >>> 20) & 0xff) / 255 > (1 - densidad)) {
        const v = (s >>> 24) - 128;
        x.fillStyle = `rgba(${v > 0 ? '255,255,255' : '0,0,0'},${(Math.abs(v) / 700).toFixed(3)})`;
        x.fillRect(xx, yy, paso, paso);
      }
    }
    x.fillStyle = '#222'; x.font = Math.round(w / 22) + 'px sans-serif';
    x.fillText('TICKET QA-1060-' + i + ' · ' + (12 + i) + ',00 EUR', w * 0.08, h * 0.5);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
    const file = new File([blob], 'IMG_med.jpg', { type: 'image/jpeg' });
    const dt = new DataTransfer(); dt.items.add(file);
    document.getElementById('exp-receipt').files = dt.files;
  }, mediana.w, mediana.h, mediana.densidad, mediana.i);
  await pag.evaluate((concepto) => {
    document.getElementById('exp-concept').value = concepto;
    document.getElementById('exp-amount').value = '12';
  }, CONCEPTO);
  await pag.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), { timeout: 5000 }).catch(() => {});
  const boton = await pag.$('#exp-save');
  await boton.evaluate((b) => b.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await boton.click();
  const cerrado = await pag.waitForFunction(() => !document.getElementById('exp-modal'), { timeout: 60000 }).then(() => true, () => false);
  informe.modalCerrado = cerrado;
  if (!cerrado) throw new Error('el modal no se cerro: no se pudo crear el gasto de prueba');

  const g = await pag.evaluate(async (concepto) => {
    const r = await (await fetch('/admin/expenses')).json();
    const e = (r.items || []).find((x) => x.concept === concepto);
    return e ? { id: e.id } : null;
  }, CONCEPTO);
  if (!g) throw new Error('el gasto de prueba no esta en el servidor');
  creadoId = g.id;
  informe.gastoDePrueba = g.id;

  // Perfil «4G regular» — MISMO que scripts/guard-primera-pantalla.mjs: 9 Mbps bajada, 4 subida, 170 ms.
  const cdp = await pag.target().createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 170, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (4 * 1024 * 1024) / 8,
  });
  const cargas = [];
  for (let intento = 0; intento < 3; intento++) {
    const t0 = Date.now();
    const r = await pag.evaluate(async (id) => {
      const resp = await fetch('/admin/expenses/' + id + '/foto', { cache: 'no-store' });
      const buf = await resp.arrayBuffer();
      return { status: resp.status, bytes: buf.byteLength, tipo: resp.headers.get('content-type'), cache: resp.headers.get('cache-control') };
    }, creadoId);
    cargas.push({ intento, ms: Date.now() - t0, ...r });
  }
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  informe.cargaBajo4G = cargas;

  // Captura de la foto en el detalle del gasto, a 390 px, bajo la MISMA condicion de red — para el AC 3.
  await pag.reload({ waitUntil: 'networkidle2' });
  const fila = await pag.waitForFunction((concepto) => Array.from(document.querySelectorAll('tr, .data-card, [onclick]')).find((n) => n.textContent.includes(concepto) && n.getAttribute('onclick')), { timeout: 15000 }, CONCEPTO).catch(() => null);
  if (fila) {
    await fila.asElement().click();
    await pag.waitForSelector('#exp-receipt-section img', { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    const dirCap = path.dirname(SALIDA) + '/captura-390';
    fs.mkdirSync(dirCap, { recursive: true });
    await pag.screenshot({ path: dirCap + '/detalle-gasto-390.png' });
    informe.captura = 'captura-390/detalle-gasto-390.png';
  }
} catch (e) {
  informe.error = e.message;
} finally {
  if (creadoId != null) {
    informe.borrado = await pag.evaluate(async (id) => {
      const r = await fetch('/admin/expenses/' + id, { method: 'DELETE' });
      const lista = await (await fetch('/admin/expenses')).json();
      return { status: r.status, sigue: (lista.items || []).some((x) => x.id === id) };
    }, creadoId).catch((e) => ({ error: e.message }));
  }
  await nav.close();
}
fs.writeFileSync(SALIDA, JSON.stringify(informe, null, 2));
console.log(JSON.stringify(informe, null, 2));
const ok = !informe.error && informe.modalCerrado && informe.borrado && informe.borrado.status === 200 && informe.borrado.sigue === false;
console.log(ok ? '✔ medido: 20 muestras de peso + carga bajo 4G del gasto de prueba, BORRADO' : '🔴 algo no cuadra: mira el informe');
process.exit(ok ? 0 : 1);
