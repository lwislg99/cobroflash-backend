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
import { veredictoDe, recorrerCasos } from './_hallazgos-y-ciegos.mjs';

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

const abrirEditorDuplicando = async (nav, c, errores) => {
  caso = c;
  const pag = await nav.newPage();
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
/** Lo que devuelve cada caso a `recorrerCasos`: aquí se LEE; se juzga después, con el informe entero. */
const SOLO_LEIDO = Object.freeze({ hallazgos: Object.freeze([]), ciegos: Object.freeze([]) });
const CASOS = [
  // G · el descuento global. CONTROL POSITIVO, en la MISMA pantalla: se abre el campo a mano y se teclea.
  { clave: 'G', plantilla: { global: GLOBAL, pago: null }, control: (pag) => pag.evaluate(ABRIR_Y_ESCRIBIR_GLOBAL, GLOBAL) },
  // P · las condiciones de pago. CONTROL POSITIVO: se pone a mano el valor y se vuelve a leer con el MISMO lector.
  { clave: 'P', plantilla: { global: null, pago: PAGO }, control: (pag) => pag.evaluate(PONER_COBRO_A_MANO, PAGO) },
];
// SCRUM-1392 · los errores de página de cada caso se apuntan en una lista del MÓDULO, no en una que
// nace dentro del caso: un error VISTO tiene que contar aunque el caso lance después (una lectura
// que revienta, la página que se destruye). Con la lista dentro, ese caso salía sólo como ciego y
// el error visto no llegaba a ninguna casilla (visto correr: docs/master/SCRUM-1392.md).
const erroresDePagina = Object.fromEntries(CASOS.map((c) => [c.clave, []]));
let recorrido;
try {
  // `recorrerCasos`: un caso que LANZA (el navegador se cae, la página se destruye) es un ciego de
  // ESE caso y el otro se lee igual. Antes subía sin capturar y el proceso salía con 1.
  recorrido = await recorrerCasos(CASOS, async (c) => {
    const { pag, listo, errores, ciego } = await abrirEditorDuplicando(nav, c.plantilla, erroresDePagina[c.clave]);
    if (ciego) { informe.casos[c.clave] = { ciego, errores }; return SOLO_LEIDO; }
    informe.casos[c.clave] = { editorConLineas: listo, ...await pag.evaluate(LEER), errores };
    informe.controles[c.clave] = await c.control(pag);
    await pag.close();
    return SOLO_LEIDO;
  }, (c) => 'caso ' + c.clave);
} finally {
  await nav.close();
  srv.close();
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1336 · UNA CASILLA EN ROJO NO DICE POR QUÉ ESTÁ EN ROJO, Y HAY DOS PORQUÉS.
//
// Aquí había nueve casillas y una sola cuenta: «verdes de total». Las de SUELO y de CONTROL dicen
// si el guard SUPO MIRAR; las de G y P dicen si duplicar CONSERVA. Con el botón «Duplicar» fuera de
// la pantalla salían siete en rojo y el proceso con 1 —«duplicar no conserva»—, cuando no se había
// duplicado nada (visto correr: docs/master/evidencias/scrum1336/).
//
// Ahora cada caso se pregunta primero si se pudo LEER. Si no, es un ciego y sus casillas de producto
// quedan SIN JUZGAR: ni verdes ni rojas. El código lo da `veredictoDe` con las dos cuentas.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const hallazgos = [];
const ciegos = [];
const filas = [];
const apuntar = (estado, texto) => {
  filas.push({ estado, texto });
  if (estado === 'hallazgo') hallazgos.push(texto);
  if (estado === 'ciego') ciegos.push(texto);
};
const suelo = (ok, texto) => { apuntar(ok ? 'ok' : 'ciego', texto); return ok; };
const producto = (leido, ok, texto) => apuntar(!leido ? 'sin juzgar' : (ok ? 'ok' : 'hallazgo'), texto);

for (const c of recorrido.ciegos) apuntar('ciego', c);
const G = informe.casos.G || {};
const P = informe.casos.P || {};

// ── G ──
let leidoG = suelo(!G.ciego && !!informe.casos.G, 'SUELO · el caso G se pudo abrir' + (G.ciego ? ' — ' + G.ciego : ''));
leidoG = leidoG && suelo(G.lineasCargadas === 2, 'SUELO · el editor abre con las 2 lineas del presupuesto duplicado (G)');
leidoG = leidoG && suelo(informe.controles.G?.leido === String(GLOBAL) && informe.controles.G?.abierto === true,
  'CONTROL POSITIVO G · este guard SABE leer el campo del descuento global');
producto(leidoG, G.global === String(GLOBAL), `G · duplicar CONSERVA el descuento global de ${GLOBAL} €`);
producto(leidoG, G.campoGlobalAbierto === true && G.botonAnadirVisible === false, 'G · y deja su campo ABIERTO, no un importe detras de un boton');

// ── P ──
let leidoP = suelo(!P.ciego && !!informe.casos.P, 'SUELO · el caso P se pudo abrir' + (P.ciego ? ' — ' + P.ciego : ''));
leidoP = leidoP && suelo(P.lineasCargadas === 2, 'SUELO · y tambien en el caso de cobro (P)');
leidoP = leidoP && suelo(informe.controles.P?.leido === PAGO, 'CONTROL POSITIVO P · este guard SABE leer el desplegable de cobro');
leidoP = suelo(PAGO !== NACIMIENTO, 'CONTROL DEL CASO P · FIFTY_FIFTY no es el valor de nacimiento del editor') && leidoP;
producto(leidoP, P.pago === PAGO, `P · duplicar CONSERVA las condiciones de pago (${PAGO})`);

// Un error de página es algo que SE HA VISTO, haya ciego o no: se cuenta siempre.
// Que NO haya ninguno es un juicio por AUSENCIA: sólo vale si los dos casos se leyeron. Con uno sin
// leer la lista sale vacía igual, y la casilla queda SIN JUZGAR en vez de verde (c.17970; lo cazó
// el censo de `tests/scrum622`, que no deja que un «no lo sé» acabe en 'ok').
const errores = [...erroresDePagina.G.map((e) => 'G: ' + e), ...erroresDePagina.P.map((e) => 'P: ' + e)];
apuntar(errores.length ? 'hallazgo' : (leidoG && leidoP ? 'ok' : 'sin juzgar'), 'sin errores de pagina en ninguno de los dos casos' + (errores.length ? ' — ' + errores.join(' · ') : ''));

const MARCAS = { ok: '✔ ', hallazgo: '🔴 ', ciego: '⬜ NO SUPE MIRAR · ', 'sin juzgar': '·  SIN JUZGAR (su caso no se pudo leer) · ' };
console.log(JSON.stringify(informe, null, 2));
console.log('\n── SCRUM-926 · duplicar conserva lo que cobra ──');
for (const f of filas) console.log(MARCAS[f.estado] + f.texto);
console.log('\nNO SE MIDE AQUI (medido, no supuesto): `tiers` (quotesView.js no nombra tiers ni una vez: no hay editor de tramos)');
console.log('                                        `currency` (el editor no tiene selector: usa la del merchant)');
const cuantas = (estado) => filas.filter((f) => f.estado === estado).length;
const veredictoFinal = veredictoDe({ hallazgos, ciegos });
console.log(`\nPOBLACION casillas=${filas.length} verdes=${cuantas('ok')} hallazgos=${cuantas('hallazgo')} ciegos=${cuantas('ciego')} sin-juzgar=${cuantas('sin juzgar')}`);
console.log('EXIT=' + veredictoFinal.codigo);
if (veredictoFinal.codigo !== 0) console.error(veredictoFinal.linea);
// La línea de las dos cuentas sale SIEMPRE, también en verde: si sólo saliera con algo que contar,
// que no esté no distinguiría «0 hallazgos · 0 ciegos» de «nadie llegó a contar».
else console.log(veredictoFinal.linea);
// Se sale SIEMPRE con el código del veredicto, también el 0: el servidor del banco puede dejar el
// proceso abierto, y un `process.exit(0)` escrito a mano sería otra forma de decidir al lado.
process.exit(veredictoFinal.codigo);
