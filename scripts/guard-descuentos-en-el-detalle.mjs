// scripts/guard-descuentos-en-el-detalle.mjs — SCRUM-888 (punto 1, front) · EL DETALLE CUADRA.
//
// Uso:  npm run guard:descuentos-en-el-detalle
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
// El detalle de un presupuesto (`quotesDetailView.js`) pintaba cada línea, la base y el IVA con
// su propia cuenta (`base = qty × price`), sin el dto de la línea ni el descuento global, debajo de
// un total —el guardado— que SÍ los lleva. Medido en SCRUM-883 (C3): base e IVA sumaban más que el
// total. Se monta el PANEL REAL, se sirve un presupuesto por `/admin/quotes/1` y se lee lo pintado:
//
//   · POSITIVO · sin descuentos → líneas, base e IVA IDÉNTICOS a la cuenta de hoy (el céntimo que
//     separa esa cuenta de la del editor es el punto 4 de SCRUM-888 y no se toca aquí);
//   · 🔴 con dto de línea → cada línea con su dto, y base + IVA cuadran con el total;
//   · 🔴 con dto y descuento global, CON `discountGlobalAmount` en la respuesta → cuadra;
//   · DECLARADO · con descuento global SIN el campo (lo que devuelve hoy el servidor, medido en
//     staging `e437a51f`) → se aplica lo que se sabe (el dto) y el global sigue sin restarse, como
//     hoy. Deducirlo restando del total sería una segunda cuenta; el campo lo pone la Sesión 1.
//
// Las cifras esperadas salen de `quoteDescuentos.js`, la MISMA cuenta que usa el editor.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────────
// Pinta con el panel real en navegador; el banco de Node parte el `innerHTML` de la tabla en plano
// y repinta acumulando (SCRUM-897). Entra por guards:visuales. La red que SÍ corre siempre es
// tests/scrum888c-descuentos-en-lineas.test.mjs.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Si la ficha no se pinta o no encuentra las filas o los totales, sale con 2 (NO SUPE MEDIR).
// Salidas: 0 de acuerdo, 1 hallazgo, 2 ciego.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';

export const SALIDA_HALLAZGO = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const quoteDescuentos = createRequire(import.meta.url)('../public/dashboard/js/quoteDescuentos.js');
let PUERTO = Number(process.env.DETALLE_PUERTO || 0);

const ME = {
  id: 1, email: 'demo@yaqu.app', name: 'QA 888', plan: 'pro', role: 'admin',
  onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false,
};

const SIN_DTO = [
  { concept: 'Pieza QA 888', qty: 8, price: 24.95, tax: 0.21 },
  { concept: 'Mano de obra', qty: 11, price: 19.99, tax: 0.10 },
  { concept: 'Desplazamiento', qty: 1, price: 120, tax: 0.21 },
];
const CON_DTO = [
  { concept: 'Pieza QA 888', qty: 8, price: 24.95, tax: 0.21, dto: 15 },
  { concept: 'Mano de obra', qty: 11, price: 19.99, tax: 0.10, dto: 10 },
  { concept: 'Desplazamiento', qty: 1, price: 120, tax: 0.21 },
];
const totalGuardado = (lineas, global) => quoteDescuentos.totalesConDescuento(lineas, global).totalCents / 100;

const CASOS = [
  { id: 'positivo · sin descuentos', lineas: SIN_DTO, global: null, conCampo: true, espera: 'hoy' },
  { id: 'rojo · dto de línea', lineas: CON_DTO, global: null, conCampo: true, espera: 'cuadra' },
  { id: 'rojo · dto y global 25 € CON el campo', lineas: CON_DTO, global: 25, conCampo: true, espera: 'cuadra' },
  { id: 'declarado · dto y global 25 € SIN el campo', lineas: CON_DTO, global: 25, conCampo: false, espera: 'sin-global' },
];

let casoActual = CASOS[0];

function quoteDe(caso) {
  const q = {
    id: 1, number: 1, status: 'draft', currency: 'EUR', createdAt: '2026-09-17T10:00:00Z',
    total: totalGuardado(caso.lineas, caso.global), lines: caso.lineas,
    customer: { id: 1, name: 'Cliente QA' }, merchant: { id: 1, name: 'QA 888' },
    invoices: [], decision: {}, tiers: null, billingPlan: null, asignados: [], tags: [],
  };
  if (caso.conCampo) q.discountGlobalAmount = caso.global;
  return q;
}

function arrancarServidor() {
  const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/admin/me') return json(res, ME);
    if (u === '/admin/merchant') return json(res, { id: 1, name: 'QA 888', defaultCurrency: 'EUR' });
    if (u === '/admin/quotes/1') return json(res, quoteDe(casoActual));
    if (u.startsWith('/admin/')) return json(res, { items: [], rows: [], data: [] });
    // El panel se sirve en SU ruta: `index.html` pide sus scripts con rutas relativas a /dashboard/.
    const f = path.join(RAIZ, 'public', u.replace(/^\//, ''));
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f);
      const tipo = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html';
      res.writeHead(200, { 'content-type': `${tipo}; charset=utf-8` });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); res.end('no');
  });
  return levantarServidor(srv, PUERTO).then((p) => { PUERTO = p; return srv; });
}

// ── LO QUE CORRE DENTRO DE LA PÁGINA (en cadenas: censo de SCRUM-258) ────────────────────────

/** Lee filas y totales de la ficha y formatea las cifras esperadas con el formateador de la ficha. */
const LEER = new Function('esperadas', `
  var titulo = null;
  var secciones = document.querySelectorAll('.detail-section');
  var conc = null;
  for (var i = 0; i < secciones.length; i++) {
    var h = secciones[i].querySelector('.detail-section-title');
    if (h && h.textContent.trim() === 'Conceptos') { conc = secciones[i]; break; }
  }
  if (!conc) return { ciego: 'no hay sección «Conceptos»' };
  var filas = Array.from(conc.querySelectorAll('tbody tr:not(.quote-apartado) td.amount')).map(function (td) { return td.textContent.trim(); });
  var texto = function (rotulo) {
    var d = Array.from(conc.querySelectorAll('div')).find(function (x) { return x.children.length === 1 && x.textContent.trim().indexOf(rotulo) === 0; });
    return d ? d.querySelector('span').textContent.trim() : null;
  };
  var f = function (n) { return fmtQuoteMoney(n, 'EUR'); };
  return {
    filas: filas, base: texto('Base imponible:'), iva: texto('IVA:'), total: texto('Total:'),
    esperado: {
      filas: esperadas.filas.map(f), base: f(esperadas.base), iva: f(esperadas.iva), total: f(esperadas.total)
    }
  };
`);

/** La cuenta de HOY del detalle, para el positivo: base = qty × price, IVA = base × tax, a pelo. */
function cuentaDeHoy(lineas, total) {
  let base = 0; let iva = 0;
  const filas = lineas.map((l) => { const b = l.qty * l.price; const i = b * l.tax; base += b; iva += i; return b + i; });
  return { filas, base, iva, total };
}

/** La cuenta compartida: `quoteDescuentos`, la misma del editor. */
function cuentaCompartida(lineas, global, total) {
  const T = quoteDescuentos.totalesConDescuento(lineas, global);
  const filas = lineas.map((l) => { const b = l.qty * quoteDescuentos.precioEfectivo(l.price, l.dto); return b + b * l.tax; });
  return { filas, base: T.baseImponibleCents / 100, iva: T.cuotaCents / 100, total };
}

const hallazgos = [];
const ciegos = [];
const filas = [];

const srv = await arrancarServidor();
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const caso of CASOS) {
    casoActual = caso;
    const total = totalGuardado(caso.lineas, caso.global);
    const esperadas = caso.espera === 'hoy' ? cuentaDeHoy(caso.lineas, total)
      : caso.espera === 'cuadra' ? cuentaCompartida(caso.lineas, caso.global, total)
        : cuentaCompartida(caso.lineas, null, total);
    const pag = await navegador.newPage();
    const errores = [];
    pag.on('pageerror', (e) => errores.push(String(e.message || e)));
    try {
      await pag.setViewport({ width: 390, height: 900, isMobile: true, hasTouch: true });
      await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#quotes-detail/1`, { waitUntil: 'networkidle0' });
      const pintada = await pag.waitForSelector('.detail-section td.amount', { timeout: 10000 }).then(() => true, () => false);
      if (!pintada) { ciegos.push(`${caso.id} → la ficha no pintó filas (errores: ${errores.join(' | ') || 'ninguno'})`); continue; }
      const r = await pag.evaluate(LEER, esperadas);
      if (r.ciego) { ciegos.push(`${caso.id} → ${r.ciego}`); continue; }
      if (r.filas.length !== caso.lineas.length || !r.base || !r.iva || !r.total) {
        ciegos.push(`${caso.id} → leo ${r.filas.length} filas, base ${r.base}, IVA ${r.iva}, total ${r.total}`); continue;
      }
      filas.push({ caso, r });
      const mal = [];
      r.filas.forEach((v, i) => { if (v !== r.esperado.filas[i]) mal.push(`línea ${i + 1}: pinta ${v}, se esperaba ${r.esperado.filas[i]}`); });
      if (r.base !== r.esperado.base) mal.push(`base: pinta ${r.base}, se esperaba ${r.esperado.base}`);
      if (r.iva !== r.esperado.iva) mal.push(`IVA: pinta ${r.iva}, se esperaba ${r.esperado.iva}`);
      if (r.total !== r.esperado.total) mal.push(`total: pinta ${r.total}, se esperaba ${r.esperado.total}`);
      if (caso.espera === 'cuadra' && Math.round((esperadas.base + esperadas.iva) * 100) !== Math.round(total * 100)) {
        mal.push(`CONTROL: la cuenta esperada no cuadra (${esperadas.base} + ${esperadas.iva} ≠ ${total}); el caso está mal montado`);
      }
      if (errores.length) mal.push(`errores de página: ${errores.join(' | ')}`);
      if (mal.length) hallazgos.push({ caso, mal });
    } finally {
      await pag.close();
    }
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log('');
console.log('  SCRUM-888 · EL DETALLE DEL PRESUPUESTO PINTA LÍNEAS, BASE E IVA CON LOS DESCUENTOS (panel real, 390 px)');
console.log('  ' + '─'.repeat(100));
for (const f of filas) {
  console.log(`  ${f.caso.id.padEnd(44)} filas:${f.r.filas.join(' · ')}  base:${f.r.base}  IVA:${f.r.iva}  total:${f.r.total}`);
}
console.log('  ' + '─'.repeat(100));

if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MEDIR — esto NO es «el detalle cuadra»:\n');
  for (const c of ciegos) console.error('     · ' + c);
  process.exit(SALIDA_NO_SUPE_MEDIR);
}
if (hallazgos.length) {
  console.error(`\n  🔴 ${hallazgos.length} DE ${CASOS.length} CASOS NO PINTAN LO ESPERADO:\n`);
  for (const h of hallazgos) {
    console.error(`     [${h.caso.id}]`);
    for (const m of h.mal) console.error('       · ' + m);
  }
  console.error('\n  El profesional lee una base y un IVA que no suman el total que firma el cliente.');
  process.exit(SALIDA_HALLAZGO);
}
console.log(`\n  ✔ los ${CASOS.length} casos: sin descuentos igual que hoy; con descuentos, la misma cuenta que el editor.\n`);
