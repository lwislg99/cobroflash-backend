// scripts/guard-ficha-de-factura.mjs — SCRUM-1787g · LA FICHA DE FACTURA, MIRADA EN NAVEGADOR.
//
// Uso:  npm run guard:ficha-de-factura
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
// La ficha nueva de factura (`public/dashboard/js/invoiceDetailView.js`, SCRUM-1787b y 1787e) no la
// abría NINGÚN guard de navegador (lo midió jv-j1ha en SCRUM-1787 c.22316; el recuento y su fecha
// están allí). Lo único que la había mirado en navegador eran sus capturas. Esto monta el
// PANEL REAL (index.html con todos sus scripts), sirve una factura de EJEMPLO por `/admin/invoices/1`
// y lee lo pintado:
//
//   · a 390 px: la página NO tiene scroll horizontal, y la primera línea de «Conceptos» enseña sus
//     CINCO datos (concepto, cantidad, precio, IVA y total) dentro de la ventana y sin que ningún
//     contenedor con scroll propio los esconda — el defecto que arregló 1787e (2 de 5 a la vista y
//     197 px tras el scroll de la tabla);
//   · en los TRES estados (pendiente, cobrada, anulada) y a los dos anchos se ve la línea de
//     progreso (`.j1-prog`), con todos sus pasos;
//   · en escritorio (1280 px) se ve el bloque «Siguiente paso» (`.detail-next`). Su rótulo NO se
//     copia aquí: se lee del propio `invoiceDetailView.js` en cada pasada; si no se puede leer, el
//     guard sale CIEGO en vez de comparar con una copia vieja.
//
// Los datos son de EJEMPLO (ninguna base): `/admin/*` lo contesta este banco, y el service worker
// del panel va desactivado (`setBypassServiceWorker`), como pidió el encargo (`serviceWorkers:'block'`
// en Playwright): uno registrado de otra pasada serviría un panel viejo desde su caché.
//
// ── CONTROL POSITIVO SEMBRADO (no prestado del árbol) ────────────────────────────────────────
// Antes de dar ningún veredicto, en la página de 390 px y sobre la ficha ya pintada, se SIEMBRAN los
// tres defectos que este guard promete cazar —un elemento de 2000 px, la tabla metida en una caja
// de 150 px con scroll propio y la línea de progreso escondida— y cada detector TIENE que verlos. Si
// alguno no los ve, el guard sale con 2 (NO SUPE MEDIR): un detector ciego da el mismo verde que
// una ficha perfecta. La siembra va DESPUÉS de medir y en una página que se cierra: no contamina
// ninguna medida.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────────
// Necesita navegador, como el resto de `guard:*` (misma decisión que guard:contraste). Entra por
// `guards:visuales` (SCRUM-522), que lo corre en CI en su job propio, y está declarado en
// `tests/_guards-de-navegador-declarados.mjs`. La red que SÍ corre siempre sobre el mecanismo de la
// tabla en móvil es `tests/scrum1787e-conceptos-en-movil.test.mjs`.
//
// Salidas: 0 de acuerdo, 1 hallazgo, 2 no supe medir (y 3/4 del navegador o del servidor).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { veredictoDe, recorrerCasos } from './_hallazgos-y-ciegos.mjs';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';
// SCRUM-1603/1755 · la letra de la casa: el veredicto mide cajas de texto (las celdas de la línea), y con la
// fuente de reserva de cada máquina mediría otra cosa. Las caras se sirven con su tipo y se esperan.
import { hojasDelPanel, TIPOS_DE_FUENTE, esperarFuentes, cegueraDeLaFuente, decirFuente } from './_hojas-del-panel.mjs';

export const SALIDA_HALLAZGO = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public', 'dashboard', 'js', 'invoiceDetailView.js');
let PUERTO = Number(process.env.FICHA_FACTURA_PUERTO || 0);

const MOVIL = { width: 390, height: 844, isMobile: true, hasTouch: true };
const ESCRITORIO = { width: 1280, height: 900 };

const ME = {
  id: 1, email: 'demo@yaqu.app', name: 'QA 1787g', plan: 'pro', role: 'admin',
  onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false,
};

/** Factura de EJEMPLO. Un concepto largo a propósito: es lo que empuja columnas fuera en móvil. */
function facturaDe(estado) {
  return {
    id: 1, number: 'F-2026-0001', type: 'F1', status: estado, currency: 'EUR',
    createdAt: '2026-11-20T10:00:00Z', paidAt: estado === 'paid' ? '2026-11-21T09:00:00Z' : null,
    total: 351.9, customer: { id: 1, name: 'Cliente de ejemplo' }, merchant: { id: 1, name: 'QA 1787g' },
    lines: [
      { concept: 'Sustitución de grifo monomando de cocina con latiguillos nuevos', qty: 2, price: 95.5, tax: 0.21 },
      { concept: 'Mano de obra', qty: 3, price: 30, tax: 0.21 },
    ],
    quotes: [], tags: [], asignados: [],
  };
}

const ESTADOS = ['pending', 'paid', 'annulled'];
const CASOS = [];
for (const estado of ESTADOS) for (const ancho of ['movil', 'escritorio']) CASOS.push({ estado, ancho });

let casoActual = CASOS[0];
/** Errores de página de las páginas del control positivo (no se juzgan: se dicen). */
const erroresEnControl = [];

function arrancarServidor() {
  const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/admin/me') return json(res, ME);
    if (u === '/admin/merchant') return json(res, { id: 1, name: 'QA 1787g', defaultCurrency: 'EUR' });
    if (u === '/admin/invoices/1') return json(res, facturaDe(casoActual.estado));
    if (u.startsWith('/admin/')) return json(res, { items: [], rows: [], data: [] });
    const f = path.join(RAIZ, 'public', u.replace(/^\//, ''));
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f);
      if (TIPOS_DE_FUENTE[ext]) { res.writeHead(200, { 'content-type': TIPOS_DE_FUENTE[ext] }); return res.end(fs.readFileSync(f)); }
      const tipo = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html';
      res.writeHead(200, { 'content-type': `${tipo}; charset=utf-8` });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); res.end('no');
  });
  return levantarServidor(srv, PUERTO).then((p) => { PUERTO = p; return srv; });
}

/** El rótulo de «Siguiente paso», leído de la vista (no copiado). `null` si no se puede leer. */
export function rotuloSiguientePaso(fuente) {
  const m = /class="detail-next-label">([^<]+)</.exec(fuente);
  return m ? m[1] : null;
}

// ── LO QUE CORRE DENTRO DE LA PÁGINA (en cadenas: censo de SCRUM-258) ────────────────────────

/** Mide la ficha pintada. Devuelve datos crudos; el juicio se hace fuera. */
const MEDIR = new Function(`
  var vw = document.documentElement.clientWidth;
  var vis = function (el) {
    if (!el) return { ok: false, por: 'no existe' };
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return { ok: false, por: 'mide 0 (' + Math.round(r.width) + '×' + Math.round(r.height) + ')' };
    if (r.left < -1 || r.right > vw + 1) return { ok: false, por: 'fuera de la ventana (' + Math.round(r.left) + '…' + Math.round(r.right) + ' de ' + vw + ')' };
    for (var a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      var cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible') {
        var ra = a.getBoundingClientRect();
        if (r.left < ra.left - 1 || r.right > ra.right + 1) {
          return { ok: false, por: 'escondido por el scroll de ' + a.tagName.toLowerCase() + (a.className ? '.' + String(a.className).split(' ').join('.') : '') + ' (' + Math.round(r.right - ra.right) + ' px fuera)' };
        }
      }
    }
    return { ok: true };
  };
  // 🔴 \`html, body { overflow-x: clip }\` (styles.css): la página NUNCA hace scroll horizontal, y lo
  // que se sale se CORTA sin barra. Leer scrollWidth con el clip puesto da 0 siempre (lo cazó el
  // control positivo «ancho» en la primera pasada). Se quita el clip solo para medir y se repone.
  var he = document.documentElement, bo = document.body;
  var antes = [he.style.overflowX, bo.style.overflowX];
  he.style.overflowX = 'visible'; bo.style.overflowX = 'visible';
  var scroll = Math.max(he.scrollWidth, bo.scrollWidth) - he.clientWidth;
  he.style.overflowX = antes[0]; bo.style.overflowX = antes[1];
  var tabla = document.querySelector('.detail-section table.j1-fac-conceptos');
  var fila = tabla ? tabla.querySelector('tbody tr:not(.quote-apartado)') : null;
  var celdas = fila ? Array.from(fila.children).map(function (td, i) {
    var v = vis(td);
    return { i: i, texto: td.textContent.trim(), ok: v.ok && td.textContent.trim() !== '', por: v.ok ? (td.textContent.trim() ? '' : 'vacía') : v.por };
  }) : null;
  var prog = document.querySelector('.j1-prog');
  var pasos = prog ? Array.from(prog.querySelectorAll('.j1-prog-paso')).map(function (li) {
    var v = vis(li); return { texto: li.textContent.trim(), ok: v.ok, por: v.por || '' };
  }) : null;
  var sig = document.querySelector('.detail-next');
  var sigRot = sig ? sig.querySelector('.detail-next-label') : null;
  return {
    vw: vw, scroll: scroll,
    celdas: celdas, prog: prog ? vis(prog) : { ok: false, por: 'no existe' }, pasos: pasos,
    siguiente: vis(sig), siguienteRotulo: sigRot ? sigRot.textContent.trim() : null
  };
`);

/** Siembra un defecto en la página ya medida. Solo para el control positivo. */
const SEMBRAR = new Function('cual', `
  if (cual === 'ancho') {
    var d = document.createElement('div'); d.setAttribute('data-siembra-1787g', '');
    d.style.width = '2000px'; d.style.height = '4px'; document.body.appendChild(d);
  } else if (cual === 'tabla') {
    var t = document.querySelector('.detail-section table.j1-fac-conceptos');
    var caja = document.createElement('div'); caja.style.width = '150px'; caja.style.overflowX = 'auto';
    t.parentNode.insertBefore(caja, t); caja.appendChild(t);
    t.style.display = 'table'; t.style.width = '600px';
    var tb = t.querySelector('tbody'); if (tb) tb.style.display = 'table-row-group';
    t.querySelectorAll('tbody tr').forEach(function (tr) { tr.style.display = 'table-row'; });
    t.querySelectorAll('tbody td').forEach(function (td) { td.style.display = 'table-cell'; });
  } else if (cual === 'progreso') {
    var p = document.querySelector('.j1-prog'); if (p) p.style.display = 'none';
  }
`);

// ── EL JUICIO ────────────────────────────────────────────────────────────────────────────────

/** Juzga una medida. Pura: devuelve las dos listas. Exportada para el test del mecanismo. */
export function juzgar(caso, m, rotuloEsperado, suyas) {
  // Apunta en las listas que entrega `recorrerCasos` (SCRUM-1392): si el caso lanza después, no se pierden.
  const { hallazgos, ciegos } = suyas;
  const id = `${caso.estado} · ${caso.ancho}`;
  if (!m.pasos || m.pasos.length < 3) ciegos.push(`${id} → la línea de progreso tiene ${m.pasos ? m.pasos.length : 0} pasos; esperaba 3 (Emitida, Enviada y el final)`);
  else {
    if (!m.prog.ok) hallazgos.push(`${id} → la línea de progreso no se ve: ${m.prog.por}`);
    m.pasos.forEach((p) => { if (!p.ok) hallazgos.push(`${id} → el paso «${p.texto}» no se ve: ${p.por}`); });
  }
  if (caso.ancho === 'movil') {
    if (m.scroll > 0) hallazgos.push(`${id} → la PÁGINA tiene scroll horizontal: ${m.scroll} px de más a ${m.vw} px`);
    if (!m.celdas) ciegos.push(`${id} → no encuentro la primera línea de «Conceptos»`);
    else if (m.celdas.length !== 5) ciegos.push(`${id} → la primera línea de «Conceptos» tiene ${m.celdas.length} celdas; esperaba 5`);
    else m.celdas.forEach((c) => { if (!c.ok) hallazgos.push(`${id} → el dato ${c.i + 1} de 5 de la línea («${c.texto}») no se ve: ${c.por}`); });
  } else {
    if (rotuloEsperado == null) ciegos.push(`${id} → no pude leer el rótulo de «Siguiente paso» en invoiceDetailView.js`);
    else if (!m.siguiente.ok) hallazgos.push(`${id} → el bloque «${rotuloEsperado}» no se ve: ${m.siguiente.por}`);
    else if (m.siguienteRotulo !== rotuloEsperado) hallazgos.push(`${id} → el bloque de acciones dice «${m.siguienteRotulo}», no «${rotuloEsperado}»`);
  }
  return suyas;
}

/** Control positivo: cada detector tiene que ver su defecto sembrado. Devuelve ciegos. */
export function juzgarSiembra(cual, m) {
  if (cual === 'ancho' && !(m.scroll > 0)) return [`CONTROL «ancho»: sembré un elemento de 2000 px y el detector de scroll dice ${m.scroll} px`];
  if (cual === 'tabla' && !(m.celdas && m.celdas.some((c) => !c.ok))) return ['CONTROL «tabla»: metí la tabla en una caja de 150 px con scroll y el detector ve las 5 columnas'];
  if (cual === 'progreso' && m.prog.ok) return ['CONTROL «progreso»: escondí la línea de progreso y el detector la ve'];
  return [];
}

const ejecutado = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (ejecutado) {
  const rotuloEsperado = rotuloSiguientePaso(fs.readFileSync(VISTA, 'utf8'));
  const filas = [];
  const controles = [];
  const letras = new Set();
  // Las hojas que declara el índice del panel tienen que estar en disco: si no, la ficha se pinta sin ellas.
  const hojasQueFaltan = hojasDelPanel(path.join(RAIZ, 'public')).filter((h) => !fs.existsSync(path.join(RAIZ, 'public', h)));
  const srv = await arrancarServidor();
  let navegador;
  let r;
  try {
    navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
    const abrir = async (caso, alError) => {
      casoActual = caso;
      const pag = await navegador.newPage();
      pag.on('pageerror', (e) => alError(String(e.message || e)));
      await pag.setBypassServiceWorker(true);
      await pag.setViewport(caso.ancho === 'movil' ? MOVIL : ESCRITORIO);
      await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#invoice-detail/1`, { waitUntil: 'networkidle0' });
      const pintada = await pag.waitForSelector('.j1-prog', { timeout: 10000 }).then(() => true, () => false);
      const fuente = await esperarFuentes(pag);
      letras.add(decirFuente(fuente));
      const sinLetra = cegueraDeLaFuente(fuente, 'la ficha de factura')
        || (fuente.cargadas > 0 ? null : `🔴 SIN LETRA WEB en la ficha de factura: ${fuente.declaradas} caras declaradas y 0 cargadas; mediría con la de reserva de esta máquina.`);
      return { pag, pintada, sinLetra };
    };
    r = await recorrerCasos(CASOS, async (caso, suyas) => {
      const id = `${caso.estado} · ${caso.ancho}`;
      const { pag, pintada, sinLetra } = await abrir(caso, (e) => suyas.hallazgos.push(`${id} → error de página: ${e}`));
      try {
        if (sinLetra) { suyas.ciegos.push(`${id} → ${sinLetra}`); return suyas; }
        if (!pintada) { suyas.ciegos.push(`${id} → la ficha no pintó (los errores de página, si los hubo, van como hallazgos)`); return suyas; }
        const m = await pag.evaluate(MEDIR);
        filas.push({ caso, m });
        return juzgar(caso, m, rotuloEsperado, suyas);
      } finally { await pag.close(); }
    }, (c) => `${c.estado} · ${c.ancho}`);
    // Control positivo, en páginas propias y después de medir.
    for (const cual of ['ancho', 'tabla', 'progreso']) {
      const { pag, pintada, sinLetra } = await abrir({ estado: 'pending', ancho: 'movil' }, (e) => erroresEnControl.push(`CONTROL «${cual}»: ${e}`));
      try {
        if (!pintada || sinLetra) { r.ciegos.push(`CONTROL «${cual}»: ${sinLetra || 'la ficha no pintó'}`); continue; }
        await pag.evaluate(SEMBRAR, cual);
        const m = await pag.evaluate(MEDIR);
        const c = juzgarSiembra(cual, m);
        controles.push(`${cual}: ${c.length ? 'NO LO VIO' : 'lo vio'}`);
        r.ciegos.push(...c);
      } finally { await pag.close(); }
    }
  } finally {
    if (navegador) await navegador.close();
    srv.close();
  }

  console.log('');
  console.log('  SCRUM-1787g · LA FICHA DE FACTURA EN NAVEGADOR (panel real, datos de ejemplo, 390 y 1280 px)');
  console.log('  ' + '─'.repeat(100));
  for (const f of filas) {
    const cel = f.m.celdas ? `${f.m.celdas.filter((c) => c.ok).length}/${f.m.celdas.length} datos a la vista` : 'sin tabla';
    const pas = f.m.pasos ? f.m.pasos.map((p) => p.texto + (p.ok ? '' : '✗')).join(' → ') : '—';
    console.log(`  ${(f.caso.estado + ' · ' + f.caso.ancho).padEnd(22)} scroll:${String(f.m.scroll).padStart(4)} px · ${cel.padEnd(20)} · progreso: ${pas}`
      + (f.caso.ancho === 'escritorio' ? ` · «${f.m.siguienteRotulo}»: ${f.m.siguiente.ok ? 'se ve' : f.m.siguiente.por}` : ''));
  }
  console.log(`  ${[...letras].join(' | ')}`);
  if (hojasQueFaltan.length) r.ciegos.push(`el índice del panel enlaza hojas que no están en disco: ${hojasQueFaltan.join(', ')}`);
  console.log(`  control positivo sembrado: ${controles.join(' · ') || 'NO CORRIÓ'}`);
  for (const e of erroresEnControl) console.log('  (error de página en el control, no juzgado) ' + e);
  console.log('  ' + '─'.repeat(100));
  if (controles.length !== 3) r.ciegos.push(`el control positivo corrió ${controles.length} de 3 siembras`);
  if (r.ciegos.length) {
    console.error('\n  🔴 NO SUPE MEDIR — esto NO es «la ficha está bien»:\n');
    for (const c of r.ciegos) console.error('     · ' + c);
  }
  if (r.hallazgos.length) {
    console.error(`\n  🔴 ${r.hallazgos.length} HALLAZGO(S) EN LA FICHA DE FACTURA:\n`);
    for (const h of r.hallazgos) console.error('     · ' + h);
  }
  const v = veredictoDe(r);
  if (v.codigo !== 0) {
    console.error('\n  ' + v.linea + '\n');
    process.exit(v.codigo);
  }
  console.log(`\n  ✔ los ${CASOS.length} casos (3 estados × 2 anchos) y las 3 siembras del control.\n`);
}
