// SCRUM-1371 · el GESTO en yaqu.app: «Enviar por WhatsApp» del presupuesto rápido, DOS clics con
// el envío fallando. Panel REAL de producción, cuenta QA.
// NO escribe en producción: toda petición que no es GET la contesta la sonda (control positivo del
// interceptor dentro de `abrir`: un POST de mentira tiene que salir cortado, o la sonda lanza).
//   node sonda-1371-reintentar.mjs                 → el panel que sirve producción hoy
//   node sonda-1371-reintentar.mjs viejo <ruta>    → CONTROL: el mismo panel con el `homeView.js`
//                                                    de antes de #2098 (`git show 34a3dc81~1:…`)
// Lo que NO es del gesto: los datos del modal se ponen en su estado (`qqState`), no tecleando.
import { abrir } from 'file:///D:/MILLONARIO/cobroFlash/sondas-s2/comun.mjs';

const VIEJO = process.argv[2] === 'viejo';
const FICHERO_VIEJO = process.argv[3];
if (VIEJO && !FICHERO_VIEJO) throw new Error('modo viejo: falta la ruta del homeView.js de antes');

let clientes = 0;
let presupuestos = 0;
let elEnvioSale = false; // qué contesta el envío en la escena en curso
const { browser, page, noGet, errores, build } = await abrir({
  servir: VIEJO ? { '/dashboard/js/homeView.js': FICHERO_VIEJO } : {},
  respuestas: (m, ruta, cuerpo) => {
    if (m !== 'POST') return null;
    if (ruta === '/admin/customers') { clientes += 1; return { status: 200, body: { id: 990000 + clientes, name: cuerpo?.name } }; }
    if (ruta === '/quote/create') { presupuestos += 1; return { status: 200, body: { id: 995000 + presupuestos, status: 'draft' } }; }
    if (/^\/admin\/quotes\/\d+\/send-whatsapp$/.test(ruta)) return elEnvioSale ? { status: 200, body: { ok: true, sent: true } } : { status: 500, body: { ok: false, error: 'server_error' } };
    return null;
  },
  viewport: { width: 390, height: 844 },
});

async function escena(nombre, preparar, { sale = false, nClics = 2, entreClics = null } = {}) {
  clientes = 0; presupuestos = 0; noGet.length = 0; elEnvioSale = sale;
  await page.evaluate(() => { if (document.getElementById('qq-send')) closeQuickQuote(); openQuickQuoteModal(); });
  const boton = page.locator('#qq-send');
  if (await boton.count() !== 1) return { escena: nombre, ciego: 'el modal no pintó su botón de enviar' };
  await page.evaluate(preparar);
  const clics = [];
  for (let i = 1; i <= nClics; i++) {
    if (i > 1 && entreClics) await page.evaluate(entreClics);
    await boton.scrollIntoViewIfNeeded();
    await boton.click();
    // El botón se apaga mientras envía: se espera a que vuelva a encenderse (el envío ya falló).
    await page.waitForFunction(() => { const b = document.getElementById('qq-send'); return !b || !b.disabled; }, null, { timeout: 15000 });
    await page.waitForTimeout(400);
    clics.push({ clic: i, modalSigueAbierto: await boton.count() === 1, botonEncendido: await boton.count() === 1 && !(await boton.isDisabled()) });
  }
  const de = (re) => noGet.filter((x) => x.metodo === 'POST' && re.test(x.ruta));
  return {
    escena: nombre,
    clics,
    altasDeCliente: de(/^\/admin\/customers$/).length,
    altasDePresupuesto: de(/^\/quote\/create$/).length,
    preciosPedidos: de(/^\/quote\/create$/).map((x) => x.cuerpo?.lines?.[0]?.price ?? null),
    enviosIntentados: de(/send-whatsapp$/).map((x) => x.ruta),
    noGet: noGet.map((x) => `${x.metodo} ${x.ruta} · ${x.hecho}`),
  };
}

const existente = await escena('cliente EXISTENTE', () => {
  qqState.customerName = 'Cliente de pruebas QA'; qqState.customerId = 83; qqState.customerPhone = '';
  qqState.products = [{ concept: 'Sonda 1371', qty: 1, price: 50 }];
});
const nuevo = await escena('cliente NUEVO', () => {
  qqState.customerName = 'Cliente nuevo de la sonda 1371'; qqState.customerId = null;
  const tel = document.getElementById('qq-customer-phone'); if (tel) tel.value = '34000000001'; else qqState.customerPhone = '34000000001';
  qqState.products = [{ concept: 'Sonda 1371', qty: 1, price: 50 }];
});

const LLENAR = () => {
  qqState.customerName = 'Cliente de pruebas QA'; qqState.customerId = 83; qqState.customerPhone = '34000000001';
  qqState.products = [{ concept: 'Sonda 1371', qty: 1, price: 50 }];
};
// Aceptación 3: entre los dos clics cambia el precio de la línea.
const otrasLineas = await escena('CONTROL: se cambian las líneas entre clics', LLENAR, { entreClics: () => { qqState.products = [{ concept: 'Sonda 1371', qty: 1, price: 80 }]; } });
// Aceptación 2, la ÚLTIMA: al salir bien el modal se cierra y la vista puede cambiar.
const todoBien = await escena('CONTROL: un clic con todo bien', LLENAR, { sale: true, nClics: 1 });

console.log(JSON.stringify({ modo: VIEJO ? 'VIEJO (control)' : 'HOY', build, existente, nuevo, otrasLineas, todoBien, erroresDePagina: errores }, null, 1));
await browser.close();
