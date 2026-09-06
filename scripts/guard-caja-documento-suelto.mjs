// scripts/guard-caja-documento-suelto.mjs — SCRUM-776 · LA CAJA DE LOS RÓTULOS DEL DOCUMENTO
// SUELTO, MEDIDA EN NAVEGADOR, EN LOS DOS MODOS.
//
// Uso:  npm run guard:caja-documento-suelto
//
// ── QUÉ MIDE Y POR QUÉ ───────────────────────────────────────────────────────────────────
// SCRUM-776 hace que siete rótulos sigan al modo de emisión: en modo justificante dicen
// «justificante» y en modo factura siguen diciendo «factura». Los del modo justificante son MÁS
// LARGOS —«Justificantes» contra «Facturas», «Nº justificante» contra «Nº factura», y la frase de
// error crece nueve caracteres—, así que el texto está firmado y LA CAJA SE ADAPTA AL TEXTO.
// Esto comprueba que se adapta de verdad, en los dos modos y en los dos anchos.
//
// ── 🔴 SE MIDE CON TEXTO DENTRO ──────────────────────────────────────────────────────────
// Una caja vacía computa 0 px y ese cero se lee como «no cabe nada», que es lo contrario. Aquí
// cada nodo se mide con su texto puesto, y se exige que el texto esté en el DOM antes de creerse
// ninguna cifra. Misma lección que `guard:caja-semaforo` (SCRUM-648), de donde sale este patrón.
//
// ── 🔴 EL MODAL ES EL DE VERDAD, NO UNA COPIA ────────────────────────────────────────────
// Se carga `nuevaFacturaModal.js` y `modalHeader.js` del árbol y se llama a
// `openNuevaFacturaModal` — el mismo código que corre en producción. Medir una reproducción del
// modal mediría mi reproducción, que es justo el error que este ticket viene a quitar (dos sitios
// diciendo lo mismo). El shell (`.layout`/`.sidebar`/`.main`) sí se reproduce, como en
// `guard-caja-semaforo`: es donde vive la caja, y el CSS que lo maqueta es el del árbol.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────
// La suite no arranca navegador (misma decisión que `guard:contraste`, `guard:caja-avisos` y
// `guard:caja-semaforo`). La red que SÍ corre siempre es
// `tests/scrum776-una-sola-voz.test.mjs`, que vigila el MECANISMO: que los siete deriven de una
// sola fuente y que no vuelva a haber rótulos a pelo en el flujo.
//
// ── SUELOS ───────────────────────────────────────────────────────────────────────────────
// No basta con ser un navegador: antes de dar un número se comprueba que el CSS del árbol se
// sirvió y SE APLICÓ (el sidebar computa su ancho), que el modal se abrió, y que el texto medido
// es el que digo. Si algo falla, esto NO da número: dice que no supo mirar y sale con 2.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const PUBLIC = path.join(RAIZ, 'public');

/** Los anchos de la casa. 929 = portátil con sidebar · 390 = iPhone estándar. */
const ANCHOS = [929, 390];
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];
const TIPOS = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html' };

/** Los dos modos que el profesional puede tener HOY. `no` no abre el modal, así que no se mide. */
const MODOS = ['justificante', 'factura'];

/**
 * La página de medida. Trae el shell donde vive la caja y CARGA LOS FICHEROS DEL ÁRBOL.
 *
 * `apiRequest` y `showToast` se sustituyen por dobles: el primero porque aquí no hay servidor de
 * la app —y lo que se mide es la CAJA, no la red— y el segundo para poder leer el aviso sin
 * depender de su animación. Los dobles son de la PRUEBA; los rótulos salen del fichero real.
 */
function paginaDeMedida(modo) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${CSS.map((c) => `<link rel="stylesheet" href="${c}">`).join('\n')}
</head><body>
<div class="layout">
  <aside class="sidebar"><div class="sidebar-logo"><div class="sidebar-logo-text">YaQu</div></div></aside>
  <main class="main">
    <div class="view-container">
      <div class="view-header"><h1 class="view-title" id="titulo-pagina"></h1></div>
      <!-- 🔴 CONTROL NEGATIVO DEL DETECTOR DE DESBORDE. Una caja que NO puede crecer (ancho fijo
           + nowrap) con un texto que no cabe. Si el detector no lo caza, «todo cabe» significa
           «no supe mirar», y este guard lo dice en vez de dar verde. Lección de SCRUM-648: el
           caso tiene que poder salir rojo de verdad, no parecerlo. -->
      <div id="control-desborde" style="width:80px;white-space:nowrap;overflow:hidden">No hemos podido emitir el justificante. Inténtalo otra vez.</div>
      <div class="data-card">
        <div class="table-wrap"><table class="data-table"><thead><tr>
          <th style="width:36px" class="col-hide-mobile"><input type="checkbox"/></th>
          <th id="col-numero"></th><th>Cliente</th>
          <th style="text-align:right">Total</th><th>Estado</th>
          <th class="col-hide-mobile">Fecha</th>
        </tr></thead><tbody><tr><td></td><td id="celda-numero"></td><td>Construcciones Ejemplo S.L.</td><td style="text-align:right">1.234,56 €</td><td><span class="status-pill">PENDIENTE</span></td><td>06/09/2026</td></tr></tbody></table></div>
      </div>
    </div>
  </main>
</div>
<script>window.appDocumentoSuelto = ${JSON.stringify(modo)};</script>
<script src="/dashboard/js/rotulosDelDocumento.js"></script>
<script src="/dashboard/js/modalHeader.js"></script>
<script>
  // Dobles DE LA PRUEBA (no del producto): aquí no hay backend y no se mide la red.
  window.__toast = null;
  function showToast(t) { window.__toast = t; }
  async function apiRequest() { return { clientes: [] }; }
</script>
<script src="/dashboard/js/nuevaFacturaModal.js"></script>
<script>
  // El título y la columna se pintan con la MISMA fuente que la vista: si el fichero de rótulos
  // no existe todavía (antes del arreglo), se cae al texto de hoy y el guard lo DICE.
  var R = window.rotulosDelDocumento || null;
  document.getElementById('titulo-pagina').textContent = R ? R.tituloListado() : 'Facturas';
  document.getElementById('col-numero').textContent = R ? R.columnaNumero() : 'Nº factura';
  document.getElementById('celda-numero').textContent = '2026-FG-001';
  window.__hayFuenteUnica = !!R;
  openNuevaFacturaModal(function () {});
</script>
</body></html>`;
}

function servidor() {
  const servidos = new Map();
  const s = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    const m = url.match(/^\/__caja-(justificante|factura)\.html$/);
    if (m) {
      const cuerpo = paginaDeMedida(m[1]);
      servidos.set(url, cuerpo.length);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(cuerpo);
    }
    const dest = path.join(PUBLIC, url.replace(/^\/+/, ''));
    if (!dest.startsWith(PUBLIC) || !fs.existsSync(dest)) { res.writeHead(404); return res.end(); }
    const cuerpo = fs.readFileSync(dest);
    servidos.set(url, cuerpo.length);
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(dest)] || 'application/octet-stream' });
    return res.end(cuerpo);
  });
  return { s, servidos };
}

function noSupeMirar(porque) {
  console.error('\n🔴 NO SUPE MIRAR — no se da ningún número.');
  console.error('   ' + porque);
  process.exit(2);
}

const { s, servidos } = servidor();
const puerto = await levantarServidor(s, 0, '127.0.0.1');
const base = `http://127.0.0.1:${puerto}`;
const navegador = await lanzarNavegador(puppeteer, {});
const hallazgos = [];
let fuenteUnica = null;

try {
  const page = await navegador.newPage();
  for (const modo of MODOS) {
    for (const ancho of ANCHOS) {
      await page.setViewport({ width: ancho, height: 900 });
      await page.goto(`${base}/__caja-${modo}.html`, { waitUntil: 'networkidle0' });

      const m = await page.evaluate(() => {
        const caja = (nodo, etiqueta) => {
          if (!nodo) return { etiqueta, ausente: true };
          const r = nodo.getBoundingClientRect();
          const cs = getComputedStyle(nodo);
          const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
          const texto = (nodo.textContent || '').trim();
          return {
            etiqueta, texto, chars: texto.length,
            width: r.width, height: r.height,
            fontSize: parseFloat(cs.fontSize), lineHeight: lh,
            lineas: r.height > 0 ? Math.max(1, Math.round(r.height / lh)) : 0,
            // DESBORDE: el contenido no cabe en su caja (se corta o se sale).
            desborda: nodo.scrollWidth > nodo.clientWidth + 1,
            scrollWidth: nodo.scrollWidth, clientWidth: nodo.clientWidth,
            recortado: cs.textOverflow === 'ellipsis' && nodo.scrollWidth > nodo.clientWidth + 1,
            // ¿Se sale del viewport por la derecha? Eso es romper la página, no envolver.
            fueraDelViewport: r.right > window.innerWidth + 1,
          };
        };
        const overlay = document.querySelector('.modal-overlay');
        const modal = overlay && overlay.querySelector('.modal');
        const botones = modal ? Array.from(modal.querySelectorAll('button')) : [];
        const primario = botones.find((b) => b.className.indexOf('btn-primary') >= 0);
        const errNodo = modal ? modal.querySelector('.alert.error') : null;
        // El error se mide CON SU TEXTO: es el rótulo más largo de los siete.
        if (errNodo) {
          errNodo.textContent = window.rotulosDelDocumento
            ? window.rotulosDelDocumento.errorAlEmitir()
            : 'No hemos podido emitir la factura. Inténtalo otra vez.';
          errNodo.style.display = 'block';
        }
        return {
          viewport: window.innerWidth,
          anchoSidebar: getComputedStyle(document.querySelector('.sidebar')).width,
          mainMarginLeft: parseFloat(getComputedStyle(document.querySelector('.main')).marginLeft),
          hayFuenteUnica: window.__hayFuenteUnica === true,
          modalAbierto: !!modal,
          controlDesborde: caja(document.getElementById('control-desborde'), 'control negativo'),
          ariaDialogo: overlay ? overlay.getAttribute('aria-label') : null,
          ariaSelector: modal && modal.querySelector('select') ? modal.querySelector('select').getAttribute('aria-label') : null,
          cajas: [
            caja(document.getElementById('titulo-pagina'), 'título de listado'),
            caja(document.getElementById('col-numero'), 'columna Nº'),
            caja(modal ? modal.querySelector('.modal-title, .modal-header h2, .modal-header h3') : null, 'título del modal'),
            caja(primario, 'botón primario'),
            caja(errNodo, 'error al emitir'),
          ],
        };
      });

      // ── SUELOS ────────────────────────────────────────────────────────────────────────
      if (!servidos.has('/dashboard/css/styles.css')) noSupeMirar('el CSS del dashboard no llegó a servirse.');
      if (parseFloat(m.anchoSidebar) <= 0) noSupeMirar('el sidebar computa 0 px: el CSS no se aplicó como en el producto.');
      if (!m.modalAbierto) noSupeMirar('el modal no se abrió, así que no hay rótulos que medir.');
      // 🔴 EL DETECTOR TIENE QUE SABER DECIR QUE NO. Si el control negativo —una caja de 80 px
      // con una frase de 59 caracteres y — no sale como desbordada, entonces el «todo
      // cabe» de abajo no vale nada: sería el mismo verde que daría un detector apagado.
      if (!m.controlDesborde || !m.controlDesborde.desborda) {
        noSupeMirar('el CONTROL NEGATIVO no salió desbordado. El detector de desborde no distingue, '
          + 'así que «todos caben» significaría «no supe mirar».');
      }
      fuenteUnica = m.hayFuenteUnica;

      console.log(`\n── MODO ${modo.toUpperCase()} · VIEWPORT ${ancho} px ──`);
      console.log(`   sidebar ${m.anchoSidebar} · .main margin-left ${m.mainMarginLeft} px · fuente única: ${m.hayFuenteUnica ? 'SÍ' : 'NO (rótulos a pelo)'}`);
      console.log(`   aria diálogo : ${JSON.stringify(m.ariaDialogo)}`);
      console.log(`   aria selector: ${JSON.stringify(m.ariaSelector)}`);
      for (const c of m.cajas) {
        if (c.ausente) { noSupeMirar(`no se encontró el nodo de «${c.etiqueta}».`); }
        if (c.width <= 0 || c.height <= 0) {
          noSupeMirar(`la caja de «${c.etiqueta}» mide 0. Se está midiendo vacía, y ese cero se `
            + 'leería como «no cabe» cuando lo que pasa es que no hay texto.');
        }
        const mal = c.desborda || c.fueraDelViewport;
        console.log(`   ${mal ? '🔴' : '  '} ${c.etiqueta.padEnd(18)} ${JSON.stringify(c.texto).padEnd(58)} `
          + `${String(c.chars).padStart(3)} car · ${c.width.toFixed(1)}×${c.height.toFixed(1)} px · ${c.lineas} línea(s)`
          + `${c.desborda ? ` · DESBORDA (scroll ${c.scrollWidth} > client ${c.clientWidth})` : ''}`
          + `${c.fueraDelViewport ? ' · SE SALE DEL VIEWPORT' : ''}`);
        if (mal) hallazgos.push(`${modo} @${ancho}px · ${c.etiqueta}: ${JSON.stringify(c.texto)}`);
      }
    }
  }
} finally {
  await navegador.close();
  s.close();
}

console.log('\n════ VEREDICTO ════');
if (fuenteUnica === false) {
  console.log('   ⚠️  `rotulosDelDocumento` NO existe todavía: los rótulos medidos son los de hoy.');
}
if (hallazgos.length) {
  console.error(`\n🔴 ${hallazgos.length} rótulo(s) NO CABEN en su caja:`);
  for (const h of hallazgos) console.error('   ' + h);
  console.error('\n   El texto está FIRMADO: la caja se adapta al texto, nunca al revés. PARA y dilo.');
  process.exit(1);
}
console.log('   Todos los rótulos caben en su caja, en los dos modos y en los dos anchos.');
console.log('   (Envolver en varias líneas NO es un hallazgo; desbordar o salirse del viewport, sí.)');
