/* SCRUM-1184b · la vista previa del numero de albaran VISTA EN PANTALLA (yaqu.app, cuenta de QA).
   SOLO LECTURA: corta toda peticion que no sea GET/HEAD y lo comprueba ANTES de pulsar nada.
   Abre la hoja «Nuevo albaran» de un Trabajo y NO pulsa nada dentro: la hoja abre, no crea.
   Dos pasadas sobre la misma pantalla:
     A · tal cual            -> la hoja dice «Siguiente numero: <lo que responde la ruta>.»
     B · con la ruta cortada -> la hoja NO dice nada (falla cerrado). Es el control: prueba que el
         texto sale de la ruta y que la sonda sabe ver «no pintado».
   La cookie se lee de su fichero y no se imprime.
   Uso: node vista-previa-en-pantalla.mjs
   Salida: un JSON por stdout con `poblacion` y, en la ultima linea, EXIT=<n>. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const PW = 'C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const NAVEGADORES = 'C:/Users/Admin/AppData/Local/ms-playwright';
const RUTA_SESION = 'C:/Users/Admin/.yaqu-qa-sesion.txt';
const BASE = 'https://yaqu.app';
const RUTA_SERIE = '/admin/albaranes/serie';

const salir = (codigo, obj) => { console.log(JSON.stringify(obj, null, 2)); console.log('EXIT=' + codigo); process.exit(codigo); };
const ciego = (m) => salir(2, { ciego: m });
if (!fs.existsSync(RUTA_SESION)) ciego('no hay sesion guardada');
const m = fs.readFileSync(RUTA_SESION, 'utf8').match(/pf_session=([^;,\s]+)/);
if (!m) ciego('el fichero de sesion no lleva pf_session');
if (!fs.existsSync(PW)) ciego('no encuentro playwright-core en ' + PW);
const exe = fs.readdirSync(NAVEGADORES).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
  .map((d) => fs.readdirSync(path.join(NAVEGADORES, d)).map((s) => path.join(NAVEGADORES, d, s, 'chrome.exe')).find((p) => fs.existsSync(p)))
  .find(Boolean);
if (!exe) ciego('no encuentro chrome.exe en ' + NAVEGADORES);

const { chromium } = createRequire(import.meta.url)(PW);
const navegador = await chromium.launch({ executablePath: exe, headless: true });

/** Una pasada: abre la ficha del Trabajo, pulsa «+ Nuevo albaran» y lee la linea de la vista previa. */
async function pasada(nombre, cortarSerie) {
  const inf = { pasada: nombre, cortadas: [], gets: 0, serieCortada: 0 };
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', locale: 'es-ES' });
  try {
    await ctx.addCookies([{ name: 'pf_session', value: m[1], domain: 'yaqu.app', path: '/', secure: true, httpOnly: true }]);
    await ctx.route('**/*', (ruta) => {
      const r = ruta.request();
      const camino = new URL(r.url()).pathname;
      if (r.method() !== 'GET' && r.method() !== 'HEAD') { inf.cortadas.push(`${r.method()} ${camino}`); return ruta.abort(); }
      if (cortarSerie && camino === RUTA_SERIE) { inf.serieCortada++; return ruta.abort(); }
      inf.gets++;
      return ruta.continue();
    });
    const page = await ctx.newPage();
    await page.goto(BASE + '/dashboard/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.appState === 'object' || document.querySelector('.sidebar, nav'), null, { timeout: 30000 });
    inf.build = await page.evaluate(() => fetch('/version').then((r) => r.json()).then((j) => j.version).catch(() => 'no-leido'));

    /* CONTROL POSITIVO del interceptor, antes de tocar nada: un POST a una ruta que no existe. */
    inf.control = await page.evaluate(() => fetch('/__control-s1-no-existe', { method: 'POST', body: '{}' }).then((r) => 'PASO ' + r.status).catch(() => 'cortada'));
    if (inf.control !== 'cortada' || !inf.cortadas.includes('POST /__control-s1-no-existe')) throw new Error('el interceptor NO corta: ' + inf.control);

    const trabajos = await page.evaluate(() => fetch('/admin/jobs', { credentials: 'include' }).then((r) => r.json()));
    if (!Array.isArray(trabajos) || trabajos.length === 0) throw new Error('la cuenta no tiene ningun Trabajo: no hay hoja que abrir');
    inf.trabajo = trabajos[0].id;
    inf.trabajosEnLaCuenta = trabajos.length;

    /* Lo que responde la ruta, leido por el mismo navegador (en la pasada B no se puede: va cortada). */
    inf.ruta = cortarSerie ? null
      : await page.evaluate((r) => fetch(r, { credentials: 'include' }).then(async (x) => ({ estado: x.status, cuerpo: await x.json() })), RUTA_SERIE);

    await page.goto(BASE + '/dashboard/#jobs-detail/' + inf.trabajo, { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const boton = page.locator('button', { hasText: '+ Nuevo albarán' });
    await boton.first().waitFor({ state: 'visible', timeout: 30000 });
    inf.botones = await boton.count();
    /* El recuento se toma AQUI, justo antes de pulsar: el panel manda un `POST /admin/entorno` en
       cada carga (medido en la primera pasada de esta sonda; el interceptor lo corta), y eso no es
       la hoja escribiendo. Lo que se compara es lo que pasa DESPUES de pulsar. */
    inf.cortadasAntesDePulsar = inf.cortadas.length;
    await boton.first().click();
    const hoja = page.locator('.modal-overlay[aria-label="Nuevo albarán"]');
    await hoja.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000); // la linea se rellena cuando contesta la ruta; la hoja no la espera
    const linea = hoja.locator('.alb-siguiente-numero');
    inf.lineas = await linea.count();
    inf.oculta = inf.lineas === 1 ? await linea.evaluate((e) => e.hidden) : null;
    inf.visible = inf.lineas === 1 ? await linea.isVisible() : null;
    inf.texto = inf.lineas === 1 ? await linea.evaluate((e) => e.textContent) : null;
    inf.cortadasAlAcabar = inf.cortadas.length;
    return inf;
  } catch (e) {
    inf.error = String(e && e.message ? e.message : e);
    return inf;
  } finally {
    await ctx.close();
  }
}

let codigo = 0;
const A = await pasada('A · tal cual', false);
const B = await pasada('B · ruta cortada (control)', true);
await navegador.close();

const fallos = [];
for (const p of [A, B]) {
  if (p.error) fallos.push(`${p.pasada}: ${p.error}`);
  if (p.lineas !== 1) fallos.push(`${p.pasada}: ${p.lineas} lineas .alb-siguiente-numero en la hoja, se esperaba 1`);
  /* `POST /admin/entorno` es del arranque del panel y puede llegar tarde, ya pulsado el boton: se
     nombra y se aparta. Cualquier OTRA escritura despues de pulsar es de la hoja, y falla. */
  p.escriturasDeLaHoja = (p.cortadas || []).slice(p.cortadasAntesDePulsar ?? 0).filter((c) => c !== 'POST /admin/entorno');
  if (p.escriturasDeLaHoja.length) fallos.push(`${p.pasada}: al abrir la hoja la pantalla intento escribir (${p.escriturasDeLaHoja.join(', ')})`);
}
const siguiente = A.ruta && A.ruta.cuerpo && typeof A.ruta.cuerpo.siguiente === 'string' ? A.ruta.cuerpo.siguiente : null;
if (!A.error) {
  if (!siguiente) fallos.push('A: la ruta no devolvio `siguiente` (estado ' + (A.ruta && A.ruta.estado) + ')');
  else if (A.texto !== `Siguiente número: ${siguiente}.`) fallos.push(`A: la hoja dice «${A.texto}» y la ruta «${siguiente}»`);
  if (A.visible !== true) fallos.push('A: la linea no se ve');
}
if (!B.error) {
  if (B.serieCortada < 1) fallos.push('B: el control no llego a cortar la ruta: no prueba nada');
  if (B.visible !== false || B.oculta !== true || B.texto) fallos.push(`B: con la ruta cortada la hoja pinta «${B.texto}» (visible=${B.visible})`);
}
if (fallos.length) codigo = 1;
salir(codigo, { poblacion: { pasadas: 2, hojasAbiertas: [A, B].filter((p) => p.lineas === 1).length }, veredicto: codigo === 0 ? 'VISTO' : 'FALLA', fallos, A, B });
