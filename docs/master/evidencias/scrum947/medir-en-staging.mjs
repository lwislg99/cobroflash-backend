// docs/master/evidencias/scrum947/medir-en-staging.mjs — SCRUM-947 · LA MEDICIÓN QUE CIERRA.
//
// Uso (desde la raíz de un worktree al día, con el despliegue ya en staging):
//   node docs/master/evidencias/scrum947/medir-en-staging.mjs
//
// En STAGING, con el merchant QA y el panel desplegado de verdad: crea UN gasto con una foto de
// 3–5 MB por el modal (clic real en «Añadir gasto»), comprueba el ESTADO —el gasto existe, su foto
// llegó reducida y se abre, y al reabrirlo desde la lista la foto SE VE— y lo BORRA. Imprime el id.
// Permiso del orquestador por el canal (18-sep-2026): crear 1 gasto, comprobarlo y borrarlo.
//
// 🔒 El secreto de login se lee EN TIEMPO DE EJECUCIÓN de un fichero fuera del repo y no se imprime
// (regla 9). Aborta si la base no es staging: producción no se toca.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';

const BASE = 'https://yaqu-staging-production.up.railway.app';
if (!/yaqu-staging/.test(BASE)) { console.error('no es staging: no se mide'); process.exit(2); }
const SECRETO = 'D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt';
const m = fs.readFileSync(SECRETO, 'utf8').match(/^E2E_TEST_LOGIN_SECRET=(.+)$/m);
if (!m) { console.error('no encuentro la clave de login en el fichero de secretos'); process.exit(2); }
const CONCEPTO = `QA 947 foto ${Date.now()}`;
const LADO_MAXIMO = 2000;

const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
const pag = await nav.newPage();
const informe = { concepto: CONCEPTO };
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
  informe.despliegueTieneElArreglo = await pag.evaluate(async () => (await (await fetch('/dashboard/js/expensesView.js', { cache: 'no-store' })).text()).includes('fotoParaGuardar'));
  if (!informe.despliegueTieneElArreglo) throw new Error('staging aún no sirve el arreglo');

  await pag.goto(BASE + '/dashboard/#expenses', { waitUntil: 'networkidle2' });
  await pag.waitForSelector('#exp-new-btn', { timeout: 15000 });
  await pag.click('#exp-new-btn');
  await pag.waitForSelector('#exp-receipt', { timeout: 10000 });

  const foto = await pag.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 4000; c.height = 3000;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 4000, 3000); g.addColorStop(0, '#d8cfc0'); g.addColorStop(1, '#8a7f70');
    x.fillStyle = g; x.fillRect(0, 0, 4000, 3000);
    let s = 11;
    for (let yy = 0; yy < 3000; yy += 3) for (let xx = 0; xx < 4000; xx += 3) {
      s = (s * 1103515245 + 12345) >>> 0; const v = (s >>> 24) - 128;
      x.fillStyle = `rgba(${v > 0 ? '255,255,255' : '0,0,0'},${(Math.abs(v) / 900).toFixed(3)})`; x.fillRect(xx, yy, 3, 3);
    }
    x.fillStyle = '#222'; x.font = '200px sans-serif'; x.fillText('TICKET 947 · 42,00 EUR', 400, 1500);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
    const file = new File([blob], 'IMG_0947.jpg', { type: 'image/jpeg' });
    const dt = new DataTransfer(); dt.items.add(file);
    document.getElementById('exp-receipt').files = dt.files;
    return file.size;
  });
  informe.fotoMiB = +(foto / 1048576).toFixed(2);
  if (foto < 3e6 || foto > 5.2e6) throw new Error('la foto no pesa 3–5 MB: ' + informe.fotoMiB);

  await pag.evaluate((concepto) => {
    document.getElementById('exp-concept').value = concepto;
    document.getElementById('exp-amount').value = '42';
  }, CONCEPTO);
  await pag.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), { timeout: 5000 }).catch(() => {});
  const boton = await pag.$('#exp-save');
  await boton.evaluate((b) => b.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await boton.click();
  const cerrado = await pag.waitForFunction(() => !document.getElementById('exp-modal'), { timeout: 60000 }).then(() => true, () => false);
  informe.modalCerrado = cerrado;
  if (!cerrado) informe.avisoEnPantalla = await pag.evaluate(() => document.getElementById('exp-error')?.textContent || null);

  // ESTADO en el servidor: el gasto existe y su foto llegó reducida.
  const g = await pag.evaluate(async (concepto) => {
    const r = await (await fetch('/admin/expenses')).json();
    const e = (r.items || []).find((x) => x.concept === concepto);
    return e ? { id: e.id, receipt: e.receiptData || '' } : null;
  }, CONCEPTO);
  if (!g) throw new Error('el gasto NO está en el servidor');
  creadoId = g.id;
  informe.id = g.id;
  informe.guardadoMiB = +(g.receipt.length / 1048576).toFixed(2);
  informe.guardadoEsJpeg = g.receipt.startsWith('data:image/jpeg;base64,');
  const d = await pag.evaluate((uri) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = () => ok(null); i.src = uri; }), g.receipt);
  informe.guardadoPx = d ? d.join('×') : 'NO SE ABRE';

  // ESTADO en pantalla: recargar, abrir el gasto desde la LISTA, y la foto se ve.
  await pag.goto(BASE + '/dashboard/#expenses', { waitUntil: 'networkidle2' });
  await pag.reload({ waitUntil: 'networkidle2' });
  const fila = await pag.waitForFunction((concepto) => Array.from(document.querySelectorAll('tr, .data-card, [onclick]')).find((n) => n.textContent.includes(concepto) && n.getAttribute('onclick')), { timeout: 15000 }, CONCEPTO).catch(() => null);
  if (!fila) informe.seVeAlReabrir = 'no encontré la fila en la lista';
  else {
    await fila.asElement().click();
    await pag.waitForSelector('#exp-receipt-section img', { timeout: 10000 }).catch(() => {});
    informe.seVeAlReabrir = await pag.evaluate(() => new Promise((ok) => {
      const img = document.querySelector('#exp-receipt-section img');
      if (!img) return ok('sin <img>');
      const fin = () => ok({ naturalWidth: img.naturalWidth, alto: Math.round(img.getBoundingClientRect().height), visible: img.checkVisibility() });
      if (img.complete) fin(); else { img.onload = fin; img.onerror = fin; }
    }));
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
const ok = !informe.error && informe.modalCerrado && informe.guardadoEsJpeg && informe.guardadoPx !== 'NO SE ABRE'
  && Math.max(...String(informe.guardadoPx).split('×').map(Number)) <= LADO_MAXIMO
  && informe.seVeAlReabrir && informe.seVeAlReabrir.naturalWidth > 0 && informe.seVeAlReabrir.visible
  && informe.borrado && informe.borrado.status === 200 && informe.borrado.sigue === false;
console.log(JSON.stringify(informe, null, 2));
console.log(ok ? '✔ la foto de 3–5 MB se GUARDA en staging, se VE al reabrir, y el gasto de prueba está BORRADO' : '🔴 algo no cuadra: mira el informe');
process.exit(ok ? 0 : 1);
