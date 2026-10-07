/* SCRUM-1437 · el alta de cliente de YaQu VISTA EN PANTALLA (yaqu.app, cuenta de QA), SOLO LECTURA.
   Corta toda peticion que no sea GET/HEAD y lo comprueba ANTES de pulsar nada (control positivo).
   NO pulsa «Guardar». La cookie se lee de su fichero y no se imprime.
   Uso: node alta-cliente-en-pantalla.mjs <carpeta de salida> <ancho> <alto> */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [salida, anchoArg, altoArg] = process.argv.slice(2);
const ancho = Number(anchoArg), alto = Number(altoArg);
if (!salida || !ancho || !alto) { console.error('uso: <carpeta> <ancho> <alto>'); process.exit(3); }
const PW = 'C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const NAVEGADORES = 'C:/Users/Admin/AppData/Local/ms-playwright';
const RUTA_SESION = 'C:/Users/Admin/.yaqu-qa-sesion.txt';
const BASE = 'https://yaqu.app';
const TEXTO = 'PRUEBA S0 SCRUM-1437 recuento de pasos';
const VETADOS = /^(guardar|guardar cambios|enviar|salir|eliminar|borrar|cerrar sesi[oó]n)/i;

const ciego = (m) => { console.error('CIEGO: ' + m); process.exit(2); };
if (!fs.existsSync(RUTA_SESION)) ciego('no hay sesion guardada');
const m = fs.readFileSync(RUTA_SESION, 'utf8').match(/pf_session=([^;,\s]+)/);
if (!m) ciego('el fichero de sesion no lleva pf_session');
const exe = fs.readdirSync(NAVEGADORES).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
  .map((d) => fs.readdirSync(path.join(NAVEGADORES, d)).map((s) => path.join(NAVEGADORES, d, s, 'chrome.exe')).find((p) => fs.existsSync(p)))
  .find(Boolean);
if (!exe) ciego('no encuentro chrome.exe en ' + NAVEGADORES);

const { chromium } = createRequire(import.meta.url)(PW);
fs.mkdirSync(salida, { recursive: true });
const tag = `${ancho}x${alto}`;
const informe = { ventana: tag, cortadas: [], gets: 0, pasos: [], clics: 0, campos: 0, pantallas: 0 };
const navegador = await chromium.launch({ executablePath: exe, headless: true });
let codigo = 0;
try {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, serviceWorkers: 'block', locale: 'es-ES' });
  await ctx.addCookies([{ name: 'pf_session', value: m[1], domain: 'yaqu.app', path: '/', secure: true, httpOnly: true }]);
  await ctx.route('**/*', (ruta) => {
    const r = ruta.request();
    if (r.method() === 'GET' || r.method() === 'HEAD') { informe.gets++; return ruta.continue(); }
    informe.cortadas.push(`${r.method()} ${new URL(r.url()).pathname}`);
    return ruta.abort();
  });
  const page = await ctx.newPage();
  const foto = (n) => page.screenshot({ path: path.join(salida, `alta-${tag}-${n}.png`) });
  const pulsar = async (loc, nombre) => {
    const n = await loc.count();
    if (n !== 1) throw new Error(`«${nombre}»: ${n} coincidencias, se esperaba 1`);
    const txt = ((await loc.innerText()) || '').trim().split('\n')[0];
    if (VETADOS.test(txt)) throw new Error(`«${txt}» esta vetado: no se pulsa`);
    await loc.click();
    informe.clics++;
    informe.pasos.push(`clic ${informe.clics}: ${nombre} [${txt}]`);
  };

  await page.goto(BASE + '/dashboard/', { waitUntil: 'domcontentloaded' });
  await page.locator('#btn-add-customer').waitFor({ state: 'visible', timeout: 30000 });
  informe.build = await page.evaluate(() => fetch('/version').then((r) => r.json()).then((j) => j.version).catch(() => 'no-leido'));

  /* CONTROL POSITIVO del interceptor, antes de tocar nada: un POST a una ruta que no existe. */
  const control = await page.evaluate(() => fetch('/__control-s0-no-existe', { method: 'POST', body: '{}' }).then((r) => 'PASO ' + r.status).catch(() => 'cortada'));
  informe.control = control;
  if (control !== 'cortada' || !informe.cortadas.includes('POST /__control-s0-no-existe')) throw new Error('el interceptor NO corta: ' + control);
  informe.cortadasAntesDePulsar = informe.cortadas.length;
  await foto('0-inicio');

  await pulsar(page.locator('#btn-add-customer'), 'accion rapida del inicio');
  const nuevo = page.locator('button.btn-primary', { hasText: 'Nuevo cliente' });
  await nuevo.first().waitFor({ state: 'visible', timeout: 30000 });
  informe.pantallas++;
  informe.pasos.push('pantalla 1: lista de clientes');
  await page.waitForTimeout(1500);
  await foto('1-lista');

  const visibles = () => page.evaluate(() => [...document.querySelectorAll('input, select, textarea')]
    .filter((e) => e.offsetParent !== null && e.type !== 'hidden')
    .map((e) => e.name || e.id || e.placeholder || e.type));
  const antes = new Set(await visibles());
  await pulsar(nuevo.filter({ visible: true }), 'boton de la lista');
  await page.getByRole('button', { name: 'Guardar', exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
  informe.pantallas++;
  informe.pasos.push('pantalla 2: formulario de cliente nuevo');
  await page.waitForTimeout(800);
  await foto('2-formulario-vacio');

  const campos = () => page.evaluate(() => [...document.querySelectorAll('input, select, textarea')]
    .filter((e) => e.offsetParent !== null && e.type !== 'hidden')
    .map((e) => {
      const lab = e.closest('label') || (e.id && document.querySelector(`label[for="${e.id}"]`)) || e.parentElement?.querySelector('label');
      return { nombre: e.name || e.id || '', tipo: e.tagName === 'INPUT' ? e.type : e.tagName.toLowerCase(), obligatorio: !!e.required,
        rotulo: ((lab && lab.innerText) || e.getAttribute('aria-label') || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 60), valor: (e.value || '').slice(0, 40) };
    }));
  const delFormulario = (await campos()).filter((c) => !antes.has(c.nombre || c.tipo));
  informe.camposDelFormulario = delFormulario.length;
  informe.obligatorios = delFormulario.filter((c) => c.obligatorio).map((c) => c.rotulo || c.nombre);
  informe.conValorDeEntrada = delFormulario.filter((c) => c.valor && c.tipo !== 'checkbox' && c.tipo !== 'radio').map((c) => `${c.rotulo || c.nombre}=${c.valor}`);
  informe.listaDeCampos = delFormulario.map((c) => `${c.obligatorio ? '*' : ' '} ${c.rotulo || c.nombre} (${c.tipo})`);

  const guardar = page.getByRole('button', { name: 'Guardar', exact: true }).filter({ visible: true });
  if ((await guardar.count()) !== 1) throw new Error('«Guardar»: no hay exactamente uno visible');
  informe.guardarEnVacio = (await guardar.isDisabled()) ? 'deshabilitado' : 'activo';

  const nombre = page.locator('input[name="name"]').filter({ visible: true });
  if ((await nombre.count()) !== 1) throw new Error('campo del nombre: no hay exactamente uno visible');
  await nombre.fill(TEXTO);
  informe.campos++;
  informe.pasos.push('campo 1: nombre');
  await page.waitForTimeout(1200);
  informe.guardarConNombre = (await guardar.isDisabled()) ? 'deshabilitado' : 'activo';
  await foto('3-con-nombre');
  informe.pasos.push('«Guardar»: a la vista, NO PULSADO (seria el clic ' + (informe.clics + 1) + ')');
  informe.clicsHastaElBoton = informe.clics;
  informe.clicsConGuardar = informe.clics + 1;
  informe.cortadasDespuesDelControl = informe.cortadas.slice(informe.cortadasAntesDePulsar);
} catch (e) {
  informe.error = String(e && e.message || e);
  try {
    const p = navegador.contexts()[0].pages()[0];
    await p.screenshot({ path: path.join(salida, `alta-${tag}-error.png`) });
    informe.botonesVisibles = await p.evaluate(() => [...document.querySelectorAll('button, a.btn, [role=button]')].filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean).slice(0, 60));
    informe.hash = await p.evaluate(() => location.hash);
  } catch { /* sin foto */ }
  codigo = 1;
} finally {
  await navegador.close();
}
fs.writeFileSync(path.join(salida, `alta-${tag}.json`), JSON.stringify(informe, null, 2));
console.log(JSON.stringify(informe, null, 2));
process.exit(codigo);
