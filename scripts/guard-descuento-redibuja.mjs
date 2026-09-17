// scripts/guard-descuento-redibuja.mjs — SCRUM-888 (punto 2) · TECLEAR UN DESCUENTO REDIBUJA.
//
// Uso:  npm run guard:descuento-redibuja
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
// En el editor de presupuestos, el total grande y la vista previa del documento tienen que decir
// lo mismo después de teclear un descuento. Medido en staging el 17-sep-2026 (`4b88ab67`) a 390 y
// 1280 px, con una línea de 8 × 24,95 € al 21 %:
//   · dto de línea 15 % tecleado → total 241,52 € y vista previa 241,52 €: NINGUNO se mueve,
//     porque el campo del dto no tenía escuchador;
//   · descuento global 25 € → total 175,04 € y vista previa 241,52 €, también tras 6,5 s y un Tab,
//     porque el global solo recalculaba los totales.
//
// Se monta el PANEL DE VERDAD (`public/dashboard/index.html` con todos sus scripts), se abre
// «Nuevo presupuesto» y se teclea como un profesional. Solo `/admin/*` es de la prueba.
//   · 🔴 dto de línea 15 % → el total cambia y la vista previa dice lo mismo;
//   · 🔴 descuento global 25 € → el total cambia y la vista previa dice lo mismo (175,04 €);
//   · POSITIVO: sin descuentos, total y vista previa 241,52 €, como hoy;
//   · y el borrador se guarda también al tocar cada descuento (espía de `localStorage.setItem`).
// Lo que NO juzga: las FILAS de la vista previa (su total por línea no aplica el dto; va en otro PR).
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────────
// Necesita el editor entero pintado y teclado de verdad; el banco de Node repinta el total con
// `innerHTML` acumulando nodos (SCRUM-897) y mediría otra cosa. Entra por guards:visuales. La red que
// SÍ corre siempre es tests/scrum888b-descuento-redibuja.test.mjs.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Si el editor no se pinta, no encuentra un campo o no consigue teclear, sale con 2 (NO SUPE
// MEDIR). Salidas: 0 de acuerdo, 1 hallazgo, 2 ciego.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';

export const SALIDA_HALLAZGO = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANCHOS = [390, 1280];
let PUERTO = Number(process.env.DESCUENTO_PUERTO || 0);

const ME = {
  id: 1, email: 'demo@yaqu.app', name: 'QA 888', plan: 'pro', role: 'admin',
  onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false,
};
const MERCHANT = { id: 1, name: 'QA 888', defaultCurrency: 'EUR', country: 'ES', iban: 'ES9121000418450200051332' };

function arrancarServidor() {
  const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/admin/me') return json(res, ME);
    if (u === '/admin/merchant') return json(res, MERCHANT);
    if (u === '/admin/customers') return json(res, []);
    if (u.startsWith('/admin/')) return json(res, { items: [], rows: [], data: [] });
    // El panel se sirve en SU ruta: `index.html` pide sus scripts con rutas relativas a /dashboard/.
    const rel = u.replace(/^\//, '');
    const f = path.join(RAIZ, 'public', rel);
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

const ESPIA_BORRADOR = `
  window.__borradores = 0;
  var original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (String(k).indexOf('pf_quote_draft_') === 0) window.__borradores++;
    return original.apply(this, arguments);
  };
`;

const LEER = new Function(`
  var t = function (s) { var e = document.querySelector(s); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; };
  return {
    kpi: t('.quote-total-kpi__cifra'),
    previa: t('.quote-preview .preview-total-row-main strong'),
    filaPrevia: t('.quote-preview .preview-lines-table tr:last-child td:last-child'),
    borradores: window.__borradores
  };
`);

const ABRIR_HOJA = new Function(`
  var b = document.querySelector('.quote-line .quote-line__ajustes');
  if (!b) return false;
  b.click();
  return true;
`);
const CERRAR_HOJA = new Function(`
  var b = document.querySelector('.quote-ajustes-modal .modal-footer .btn-primary');
  if (!b) return false;
  b.click();
  return true;
`);
const ABRIR_GLOBAL = new Function(`
  var b = document.querySelector('.quote-dto-global button');
  if (!b) return false;
  b.click();
  return true;
`);

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Teclea en el campo como un usuario: enfoca, borra y escribe carácter a carácter. */
async function teclear(pag, selector, texto) {
  const el = await pag.$(selector);
  if (!el) return false;
  await el.evaluate((e) => { e.scrollIntoView({ block: 'center', behavior: 'instant' }); e.focus(); });
  await el.evaluate((e) => { e.value = ''; });
  await pag.keyboard.type(texto);
  return true;
}

const hallazgos = [];
const ciegos = [];
const filas = [];

const srv = await arrancarServidor();
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const ancho of ANCHOS) {
    const pag = await navegador.newPage();
    const errores = [];
    pag.on('pageerror', (e) => errores.push(String(e.message || e)));
    try {
      await pag.setViewport({ width: ancho, height: 900, isMobile: ancho < 800, hasTouch: ancho < 800 });
      await pag.evaluateOnNewDocument(ESPIA_BORRADOR);
      await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#quotes-new`, { waitUntil: 'networkidle0' });
      const pintado = await pag.waitForSelector('.quote-line .quote-line__price input', { timeout: 10000 }).then(() => true, () => false);
      if (!pintado) { ciegos.push(`${ancho}px → el editor no se pintó (errores: ${errores.join(' | ') || 'ninguno'})`); continue; }
      await espera(500);

      const paso = async (nombre) => { await espera(900); const r = await pag.evaluate(LEER); filas.push({ ancho, nombre, ...r }); return r; };

      if (!await teclear(pag, '.quote-line .quote-line__concept input', 'Pieza QA 888')
        || !await teclear(pag, '.quote-line .quote-line__qty input', '8')
        || !await teclear(pag, '.quote-line .quote-line__price input', '24.95')) {
        ciegos.push(`${ancho}px → no encontré concepto, cantidad o precio de la primera línea`); continue;
      }
      const base = await paso('sin descuentos');
      if (!base.kpi || !base.previa) { ciegos.push(`${ancho}px → no leo el total grande o el de la vista previa`); continue; }
      if (base.kpi === '0,00 €') { ciegos.push(`${ancho}px → lo tecleado no llegó al total (sigue en 0,00 €)`); continue; }

      if (!await pag.evaluate(ABRIR_HOJA)) { ciegos.push(`${ancho}px → no hay botón de ajustes de la línea`); continue; }
      const hoja = await pag.waitForSelector('.quote-ajustes-modal .quote-line__dto input', { timeout: 5000 }).then(() => true, () => false);
      if (!hoja) { ciegos.push(`${ancho}px → la hoja de ajustes no trae el campo «Dto. %»`); continue; }
      const antesDto = base.borradores;
      await teclear(pag, '.quote-ajustes-modal .quote-line__dto input', '15');
      const conDto = await paso('dto de línea 15 %');
      await pag.evaluate(CERRAR_HOJA);

      if (!await pag.evaluate(ABRIR_GLOBAL)) { ciegos.push(`${ancho}px → no hay botón «+ Añadir descuento»`); continue; }
      const antesGlobal = conDto.borradores;
      if (!await teclear(pag, '.quote-dto-global__campo input', '25')) { ciegos.push(`${ancho}px → no hay campo de descuento global`); continue; }
      const conGlobal = await paso('descuento global 25 €');

      const mal = [];
      if (base.kpi !== '241,52 €' || base.previa !== '241,52 €') mal.push(`POSITIVO: sin descuentos se esperaba 241,52 € en los dos; total ${base.kpi}, vista previa ${base.previa}`);
      if (conDto.kpi === base.kpi) mal.push(`dto de línea 15 %: el total no se mueve (${conDto.kpi})`);
      if (conDto.previa !== conDto.kpi) mal.push(`dto de línea 15 %: total ${conDto.kpi} y vista previa ${conDto.previa}`);
      if (conDto.borradores <= antesDto) mal.push('dto de línea 15 %: el borrador no se guarda');
      if (conGlobal.kpi !== '175,04 €') mal.push(`descuento global 25 €: total ${conGlobal.kpi}, se esperaba 175,04 € (medido en staging)`);
      if (conGlobal.previa !== conGlobal.kpi) mal.push(`descuento global 25 €: total ${conGlobal.kpi} y vista previa ${conGlobal.previa}`);
      if (conGlobal.borradores <= antesGlobal) mal.push('descuento global 25 €: el borrador no se guarda');
      if (errores.length) mal.push(`errores de página: ${errores.join(' | ')}`);
      if (mal.length) hallazgos.push({ ancho, mal });
    } finally {
      await pag.close();
    }
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log('');
console.log('  SCRUM-888 · TECLEAR UN DESCUENTO REDIBUJA EL TOTAL Y LA VISTA PREVIA (panel real)');
console.log('  ' + '─'.repeat(100));
for (const f of filas) {
  console.log(`  ${f.ancho}px · ${f.nombre.padEnd(24)} total:${f.kpi}  vista previa:${f.previa}  borradores:${f.borradores}  (fila de la vista previa, no se juzga: ${f.filaPrevia})`);
}
console.log('  ' + '─'.repeat(100));

if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MEDIR — esto NO es «redibuja bien»:\n');
  for (const c of ciegos) console.error('     · ' + c);
  process.exit(SALIDA_NO_SUPE_MEDIR);
}
if (hallazgos.length) {
  console.error(`\n  🔴 EN ${hallazgos.length} DE ${ANCHOS.length} ANCHOS LA PANTALLA NO DICE LO QUE SE HA TECLEADO:\n`);
  for (const h of hallazgos) {
    console.error(`     [${h.ancho}px]`);
    for (const m of h.mal) console.error('       · ' + m);
  }
  console.error('\n  El profesional ve un total y una vista previa distintos del documento que firma el cliente.');
  process.exit(SALIDA_HALLAZGO);
}
console.log(`\n  ✔ a ${ANCHOS.join(' y ')} px: cada descuento tecleado mueve el total, la vista previa dice lo mismo y el borrador se guarda.\n`);
