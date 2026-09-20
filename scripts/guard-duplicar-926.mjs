// scripts/guard-duplicar-926.mjs — SCRUM-926 · DUPLICAR NO PUEDE PERDER LO QUE COBRA.
//
//   npm run guard:duplicar-conserva
//
// Duplicar un presupuesto abre el editor con una COPIA. Lo que no viaje en esa copia, el
// profesional lo vuelve a teclear — o, peor, no se da cuenta y manda el presupuesto **a más
// precio del que habia pactado**, que es justo el descuento global (D6 de SCRUM-883).
//
// Monta el panel REAL contra un servidor falso, pulsa «Duplicar» DE VERDAD y lee el editor que
// sale. Cada campo lleva su propio caso y **su propio control positivo**, porque un campo vacío
// y un lector que no sabe mirar ese campo se leen exactamente igual:
//
//   G · descuento global  · rojo: 25 € puesto, el editor abre sin él y con el campo cerrado.
//       POSITIVO G: se abre el campo a mano y se teclea 25 → el lector lo ve. Si esto falla, el
//       vacío del caso G no dice nada del editor: dice que este guard no sabe leer ese campo.
//   P · condiciones de pago · rojo: FIFTY_FIFTY puesto, el editor abre en otra cosa.
//       POSITIVO P: se pone FIFTY_FIFTY a mano en el desplegable → el lector lo ve.
//
// ⚠️ EL VALOR DEL CASO P NO ES CASUAL. El editor nace en `FULL_UPFRONT` (quotesView.js), así que
// un caso escrito con FULL_UPFRONT saldría VERDE sin que nadie restaure nada — verde por
// coincidencia, que es el defecto que esta casa ya se comió una vez. Se usa FIFTY_FIFTY, que no
// es el valor de nacimiento.
//
// Lo que este guard NO mide, medido antes de decirlo (no es pereza, es que no existe dónde):
//   · `tiers` — la plantilla lo lleva, pero `quotesView.js` no nombra `tiers` NI UNA VEZ: el
//     editor no tiene tramos, así que no hay campo que restaurar. Restaurarlo es otro ticket.
//   · `currency` — la plantilla lo lleva, pero el editor no tiene selector: siempre usa
//     `currentMerchant.defaultCurrency || 'EUR'`. No se pierde nada que se pueda recuperar aquí.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GLOBAL = 25;
const PAGO = 'FIFTY_FIFTY';
const NACIMIENTO = 'FULL_UPFRONT'; // lo que el editor pone solo: el caso NO puede usar esto

const ME = { id: 1, email: 'demo@yaqu.app', name: 'QA 926', plan: 'pro', role: 'admin', onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false };
const LINEAS = [
  { concept: 'Pieza QA 926', qty: 2, price: 50, tax: 0.21 },
  { concept: 'Mano de obra QA 926', qty: 3, price: 30, tax: 0.21 },
];

let caso = null;
const quote = () => ({
  id: 1, number: 1, status: 'draft', currency: 'EUR', createdAt: '2026-09-18T10:00:00Z',
  total: 100, lines: LINEAS,
  discountGlobalAmount: caso.global,
  paymentTerms: caso.pago,
  customer: { id: 1, name: 'Cliente QA' }, merchant: { id: 1, name: 'QA 926' },
  invoices: [], decision: {}, tiers: null, billingPlan: null, asignados: [], tags: [],
});

const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
const srv = http.createServer((rq, res) => {
  const u = rq.url.split('?')[0];
  if (u === '/admin/me') return json(res, ME);
  if (u === '/admin/merchant') return json(res, { id: 1, name: 'QA 926', defaultCurrency: 'EUR' });
  if (u === '/admin/quotes/1') return json(res, quote());
  if (u.startsWith('/admin/')) return json(res, { items: [], rows: [], data: [] });
  const f = path.join(RAIZ, 'public', u.replace(/^\//, ''));
  if (fs.existsSync(f) && fs.statSync(f).isFile()) {
    const ext = path.extname(f);
    res.writeHead(200, { 'content-type': (ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html') + '; charset=utf-8' });
    return res.end(fs.readFileSync(f));
  }
  res.writeHead(404); res.end('no');
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const PUERTO = srv.address().port;

// Se lee por IDENTIDAD, no por posición: el desplegable de cobro es el que TIENE la opción
// FIFTY_FIFTY, no «el tercer select de la pantalla» (referenciar por posición caduca).
const LEER = new Function(`
  var inp = document.querySelector('.quote-dto-global__campo input');
  var campo = document.querySelector('.quote-dto-global__campo');
  var btn = null;
  Array.prototype.forEach.call(document.querySelectorAll('button'), function (b) {
    if (/Añadir descuento/.test(b.textContent)) btn = b;
  });
  var pago = null;
  Array.prototype.forEach.call(document.querySelectorAll('select'), function (s) {
    if (s.querySelector('option[value="FIFTY_FIFTY"]')) pago = s;
  });
  var valores = Array.prototype.map.call(document.querySelectorAll('input, textarea'), function (x) { return x.value; });
  return {
    lineasCargadas: valores.filter(function (v) { return /QA 926/.test(v); }).length,
    hayCampoGlobal: !!inp,
    global: inp ? inp.value : null,
    campoGlobalAbierto: campo ? !campo.hidden : null,
    botonAnadirVisible: btn ? !btn.hidden : null,
    hayDesplegableDePago: !!pago,
    pago: pago ? pago.value : null
  };
`);

// 🔴 TODO lo que corre DENTRO del navegador va en `new Function`, nunca en una flecha suelta.
// No es manía: el censo de SCRUM-258 cuenta identificadores sin declarar, y un `document`
// lexical en un script de Node es indistinguible —para el censo y para quien lea— de un
// `ReferenceError` esperando a que alguien ejecute ese camino.
const BUSCAR_DUPLICAR = new Function(
  'return Array.from(document.querySelectorAll("button")).find(function (b) { return /Duplicar/.test(b.textContent); });',
);
const EDITOR_YA_TIENE_LINEAS = new Function(
  'return Array.from(document.querySelectorAll("input, textarea")).some(function (x) { return /QA 926/.test(x.value); });',
);

// Los dos controles positivos, también en `new Function` y por el mismo motivo.
const ABRIR_Y_ESCRIBIR_GLOBAL = new Function('v', `
  var btn = null;
  Array.prototype.forEach.call(document.querySelectorAll('button'), function (b) {
    if (/Añadir descuento/.test(b.textContent)) btn = b;
  });
  if (btn) btn.click();
  var inp = document.querySelector('.quote-dto-global__campo input');
  if (!inp) return { leido: null, nota: 'no hay campo que abrir' };
  inp.value = String(v);
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  var campo = document.querySelector('.quote-dto-global__campo');
  return { leido: inp.value, abierto: campo ? !campo.hidden : null };
`);
const PONER_COBRO_A_MANO = new Function('v', `
  var sel = null;
  Array.prototype.forEach.call(document.querySelectorAll('select'), function (s) {
    if (s.querySelector('option[value="FIFTY_FIFTY"]')) sel = s;
  });
  if (!sel) return { leido: null, nota: 'no hay desplegable de cobro' };
  sel.value = v;
  return { leido: sel.value };
`);

const abrirEditorDuplicando = async (nav, c) => {
  caso = c;
  const pag = await nav.newPage();
  const errores = [];
  pag.on('pageerror', (e) => errores.push(String(e.message || e)));
  await pag.setViewport({ width: 1280, height: 900 });
  await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#quotes-detail/1`, { waitUntil: 'networkidle0' });
  const btn = await pag.waitForFunction(BUSCAR_DUPLICAR, { timeout: 15000 }).catch(() => null);
  if (!btn) { await pag.close(); return { ciego: 'no encuentro el boton «Duplicar»', errores }; }
  await btn.asElement().click();
  const listo = await pag.waitForFunction(EDITOR_YA_TIENE_LINEAS, { timeout: 15000 }).then(() => true, () => false);
  await new Promise((r) => setTimeout(r, 400));
  return { pag, listo, errores };
};

const informe = { casos: {}, controles: {} };
const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
try {
  // ── G · el descuento global ───────────────────────────────────────────────────────────────
  {
    const { pag, listo, errores, ciego } = await abrirEditorDuplicando(nav, { global: GLOBAL, pago: null });
    if (ciego) informe.casos.G = { ciego, errores };
    else {
      informe.casos.G = { editorConLineas: listo, ...await pag.evaluate(LEER), errores };
      // CONTROL POSITIVO G, en la MISMA pantalla: se abre el campo a mano y se teclea.
      informe.controles.G = await pag.evaluate(ABRIR_Y_ESCRIBIR_GLOBAL, GLOBAL);
      await pag.close();
    }
  }
  // ── P · las condiciones de pago ───────────────────────────────────────────────────────────
  {
    const { pag, listo, errores, ciego } = await abrirEditorDuplicando(nav, { global: null, pago: PAGO });
    if (ciego) informe.casos.P = { ciego, errores };
    else {
      informe.casos.P = { editorConLineas: listo, ...await pag.evaluate(LEER), errores };
      // CONTROL POSITIVO P: se pone a mano el valor y se vuelve a leer con el MISMO lector.
      informe.controles.P = await pag.evaluate(PONER_COBRO_A_MANO, PAGO);
      await pag.close();
    }
  }
} finally {
  await nav.close();
  srv.close();
}

const G = informe.casos.G || {};
const P = informe.casos.P || {};
const casillas = {
  'SUELO · el editor abre con las 2 lineas del presupuesto duplicado (G)': G.lineasCargadas === 2,
  'SUELO · y tambien en el caso de cobro (P)': P.lineasCargadas === 2,
  'CONTROL POSITIVO G · este guard SABE leer el campo del descuento global':
    informe.controles.G?.leido === String(GLOBAL) && informe.controles.G?.abierto === true,
  'CONTROL POSITIVO P · este guard SABE leer el desplegable de cobro':
    informe.controles.P?.leido === PAGO,
  'CONTROL DEL CASO P · FIFTY_FIFTY no es el valor de nacimiento del editor': PAGO !== NACIMIENTO,
  [`G · duplicar CONSERVA el descuento global de ${GLOBAL} €`]: G.global === String(GLOBAL),
  'G · y deja su campo ABIERTO, no un importe detras de un boton': G.campoGlobalAbierto === true && G.botonAnadirVisible === false,
  [`P · duplicar CONSERVA las condiciones de pago (${PAGO})`]: P.pago === PAGO,
  'sin errores de pagina en ninguno de los dos casos': (G.errores || []).length === 0 && (P.errores || []).length === 0,
};

console.log(JSON.stringify(informe, null, 2));
console.log('\n── SCRUM-926 · duplicar conserva lo que cobra ──');
for (const [k, v] of Object.entries(casillas)) console.log((v ? '✔ ' : '🔴 ') + k);
console.log('\nNO SE MIDE AQUI (medido, no supuesto): `tiers` (quotesView.js no nombra tiers ni una vez: no hay editor de tramos)');
console.log('                                        `currency` (el editor no tiene selector: usa la del merchant)');
const verdes = Object.values(casillas).filter(Boolean).length;
const total = Object.keys(casillas).length;
console.log(`\nPOBLACION casillas=${total} verdes=${verdes} fallos=${total - verdes}`);
console.log('EXIT=' + (verdes === total ? 0 : 1));
process.exit(verdes === total ? 0 : 1);
