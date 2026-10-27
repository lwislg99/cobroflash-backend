// SCRUM-1227 · el GESTO: pulsar «Guardar cambios» en Configuración, en yaqu.app, con la cuenta QA.
// NO escribe en producción: el PUT lo contesta la sonda (control positivo del interceptor en `abrir`).
// El perfil QA tiene vacíos los cuatro obligatorios (fixture de SCRUM-1367), así que la sonda se los
// pone SÓLO EN EL NAVEGADOR, parcheando la respuesta del GET. Lo demás es lo que sirve producción.
//   node sonda-1227-guardar.mjs            → lo que hay hoy
//   node sonda-1227-guardar.mjs viejo      → CONTROL: el GET sin las dos claves (el servidor de antes de #1894)
import { abrir } from 'file:///D:/MILLONARIO/cobroFlash/sondas-s2/comun.mjs';

const VIEJO = process.argv[2] === 'viejo';
const PREFS_SEMBRADAS = { bloquesQa1227: ['uno', 'dos'], showTechPhotoToClient: false };
const { browser, page, noGet, errores, build } = await abrir({
  respuestas: (m, ruta) => (m === 'PUT' && ruta === '/admin/merchant' ? { status: 200, body: { ok: true } } : null),
  viewport: { width: 390, height: 844 },
});
let servidos = 0;
let recibidas = null;
await page.route((u) => new URL(u).pathname === '/admin/merchant', async (route) => {
  if (route.request().method() !== 'GET') return route.fallback();
  const resp = await route.fetch();
  const j = await resp.json();
  const m = j.merchant ?? j;
  recibidas = JSON.parse(JSON.stringify(m.clausulasPresupuesto ?? null));
  Object.assign(m, { legalName: 'QA SONDA 1227 SL', taxId: 'B00000000', address: 'Calle Inventada 0', whatsappPhone: '+34600000000' });
  m.homePrefs = PREFS_SEMBRADAS;
  if (VIEJO) { delete m.clausulasPresupuesto; delete m.homePrefs; }
  servidos += 1;
  return route.fulfill({ response: resp, json: j });
});
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => renderAppView('settings'));
await page.waitForTimeout(2500);
const filasEnPantalla = await page.evaluate(() => document.querySelectorAll('#clausulas-lista [data-clausula-fila]').length);
const boton = page.locator('button[type="submit"]', { hasText: 'Guardar cambios' });
const nBotones = await boton.count();
noGet.length = 0;
if (nBotones === 1) { await boton.scrollIntoViewIfNeeded(); await boton.click(); await page.waitForTimeout(2500); }
const put = noGet.find((x) => x.metodo === 'PUT' && x.ruta === '/admin/merchant');
const invalidos = await page.evaluate(() => Array.from(document.querySelectorAll('form')).flatMap((f) => Array.from(f.elements)).filter((el) => el.willValidate && !el.validity.valid).map((el) => el.name || el.id || el.tagName));
console.log(JSON.stringify({
  modo: VIEJO ? 'VIEJO (control)' : 'HOY',
  build,
  getParcheados: servidos,
  clausulasQueMandaElServidor: recibidas,
  filasDeClausulaEnPantalla: filasEnPantalla,
  botonesGuardar: nBotones,
  camposInvalidos: invalidos,
  salioPUT: Boolean(put),
  queSeHizoConEl: put?.hecho ?? null,
  putClausulas: put?.cuerpo?.clausulasPresupuesto ?? '(sin PUT)',
  putHomePrefs: put?.cuerpo?.homePrefs ?? '(sin PUT)',
  otrasNoGet: noGet.filter((x) => x !== put).map((x) => `${x.metodo} ${x.ruta} · ${x.hecho}`),
  erroresDePagina: errores,
}, null, 1));
await browser.close();
