// scripts/guard-caja-datos-del-cliente.mjs — SCRUM-589 (CONT-18) · LA CAJA DEL BLOQUE «DATOS DEL
// CLIENTE EN EL DOCUMENTO», MEDIDA EN NAVEGADOR, CON Y SIN LA ELECCIÓN DE NOMBRE.
//
// Uso:  npm run guard:caja-datos-del-cliente
//
// ── QUÉ MIDE Y POR QUÉ ───────────────────────────────────────────────────────────────────
// SCRUM-589 mete DOS opciones excluyentes («Razón social» / «Nombre comercial») debajo de un
// bloque que ya tenía cuatro casillas y una nota. El bloque estaba apretado y el texto lo firma
// el asesor, así que la caja se adapta al texto y no al revés. Esto comprueba que se adapta, a
// 929 y 390 px, en los DOS estados que el control tiene: con ☑Nombre (radios activos) y con
// ☐Nombre (radios deshabilitados, que NO se esconden).
//
// ── 🔴 LOS TEXTOS SE DERIVAN DEL FICHERO REAL ────────────────────────────────────────────
// El DOM se reproduce —el bloque se construye dentro de `renderQuotesView`, que necesita medio
// dashboard y varias llamadas de red para existir— pero LOS TEXTOS NO SE COPIAN: se extraen de
// `public/dashboard/js/quotesView.js` en cada pasada. Es lo que importa, porque la caja la
// decide el texto: si mañana alguien alarga un rótulo, esto lo mide sin que nadie lo actualice.
// Si la extracción falla, el guard NO mide: dice que no supo mirar (misma decisión que el resto
// de los guards de caja de la casa).
//
// ── 🔴 SE MIDE CON TEXTO DENTRO ──────────────────────────────────────────────────────────
// Una caja vacía computa 0 px y ese cero se lee como «no cabe nada», que es lo contrario.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────
// La suite no arranca navegador (misma decisión que `guard:contraste`, `guard:caja-avisos`,
// `guard:caja-semaforo` y `guard:caja-documento-suelto`). La red que SÍ corre siempre es
// `tests/scrum589-nombre-por-documento.test.mjs`, que vigila el MECANISMO.
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
const VISTA = path.join(PUBLIC, 'dashboard/js/quotesView.js');

const ANCHOS = [929, 390];
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];
const TIPOS = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html' };

function noSupeMirar(porque) {
  console.error('\n🔴 NO SUPE MIRAR — no se da ningún número.');
  console.error('   ' + porque);
  process.exit(2);
}

// ── LOS TEXTOS, EXTRAÍDOS DEL FICHERO REAL ───────────────────────────────────────────────
const fuente = fs.readFileSync(VISTA, 'utf8');
const casillas = [...fuente.matchAll(/\{\s*key:\s*"(\w+)",\s*label:\s*"([^"]+)"\s*\}/g)].map((m) => m[2]);
const radios = [...fuente.matchAll(/\{\s*valor:\s*"(\w+)",\s*label:\s*"([^"]+)"\s*\}/g)].map((m) => m[2]);
const nota = (fuente.match(/dfNote\.textContent\s*=\s*"([^"]+)"/) || [])[1];

if (casillas.length < 4) noSupeMirar(`sólo encuentro ${casillas.length} rótulos de casilla en quotesView.js (esperaba al menos los 4 de docFields).`);
if (radios.length !== 2) noSupeMirar(`encuentro ${radios.length} rótulos de radio y el control de SCRUM-589 tiene DOS. Si el control ha cambiado de forma, este guard no sabe medirlo.`);
if (!nota) noSupeMirar('no encuentro el texto de la nota (`dfNote.textContent`).');
// Las 4 de docFields son las últimas del fichero que casan con la forma {key,label}; las de
// pay-methods usan la misma forma, así que se filtran por nombre conocido del bloque.
const DOC = ['Nombre', 'Teléfono', 'NIF', 'Email'].filter((t) => casillas.includes(t));
if (DOC.length !== 4) noSupeMirar(`de las cuatro casillas de «Datos del cliente» sólo veo ${DOC.length}: ${JSON.stringify(DOC)}.`);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function pagina(estado) {
  const marcada = estado === 'con-nombre' ? ' checked' : '';
  const deshab = estado === 'con-nombre' ? '' : ' disabled';
  const opacidad = estado === 'con-nombre' ? '' : 'opacity:0.5;';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${CSS.map((c) => `<link rel="stylesheet" href="${c}">`).join('\n')}
</head><body>
<div class="layout">
  <aside class="sidebar"><div class="sidebar-logo"><div class="sidebar-logo-text">YaQu</div></div></aside>
  <main class="main"><div class="view-container"><div class="quotes-layout">
    <div class="card quotes-left-card"><div class="quote-block">
      <h3 class="quote-block-title">4. Envío</h3>
      <div class="field" id="bloque">
        <label class="pay-methods-title">Datos del cliente en el documento</label>
        <div class="pay-methods-row" id="fila">
          ${DOC.map((t, i) => `<label><input type="checkbox"${i === 0 ? marcada : ' checked'}/> ${esc(t)}</label>`).join('')}
        </div>
        <div class="inline-options" id="eleccion" style="margin-top:6px;${opacidad}">
          ${radios.map((t, i) => `<label class="radio-label"><input type="radio" name="n"${i === 0 ? ' checked' : ''}${deshab}/> ${esc(t)}</label>`).join('')}
        </div>
        <p class="pay-methods-note" id="nota">${esc(nota)}</p>
      </div>
    </div></div>
    <div class="card quotes-right-card"></div>
  </div></div></main>
</div>
<!-- CONTROL NEGATIVO del detector de desborde: una caja que NO puede crecer con un texto que no cabe. -->
<div id="control-desborde" style="width:60px;white-space:nowrap;overflow:hidden">${esc(nota)}</div>
</body></html>`;
}

const servidos = new Set();
const srv = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const m = url.match(/^\/__datos-(con-nombre|sin-nombre)\.html$/);
  if (m) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(pagina(m[1])); }
  const dest = path.join(PUBLIC, url.replace(/^\/+/, ''));
  if (!dest.startsWith(PUBLIC) || !fs.existsSync(dest)) { res.writeHead(404); return res.end(); }
  servidos.add(url);
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(dest)] || 'application/octet-stream' });
  res.end(fs.readFileSync(dest));
});

const puerto = await levantarServidor(srv, 0, '127.0.0.1');
const base = `http://127.0.0.1:${puerto}`;
const nav = await lanzarNavegador(puppeteer, {});
const hallazgos = [];

console.log('textos DERIVADOS de quotesView.js:');
console.log(`   casillas : ${JSON.stringify(DOC)}`);
console.log(`   elección : ${JSON.stringify(radios)}`);
console.log(`   nota     : ${nota.length} caracteres`);

try {
  const page = await nav.newPage();
  for (const estado of ['con-nombre', 'sin-nombre']) {
    for (const ancho of ANCHOS) {
      await page.setViewport({ width: ancho, height: 1000 });
      await page.goto(`${base}/__datos-${estado}.html`, { waitUntil: 'networkidle0' });
      const m = await page.evaluate(() => {
        const caja = (id) => {
          const n = document.getElementById(id);
          if (!n) return null;
          const r = n.getBoundingClientRect();
          const cs = getComputedStyle(n);
          const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
          return {
            alto: r.height, ancho: r.width,
            lineas: r.height > 0 ? Math.max(1, Math.round(r.height / lh)) : 0,
            desborda: n.scrollWidth > n.clientWidth + 1,
            fuera: r.right > window.innerWidth + 1,
          };
        };
        const fila = document.getElementById('fila');
        const ys = new Set(Array.from(fila.querySelectorAll('label')).map((l) => Math.round(l.getBoundingClientRect().top)));
        const card = document.querySelector('.quotes-left-card');
        const radios = Array.from(document.querySelectorAll('#eleccion input'));
        return {
          paddingCard: parseFloat(getComputedStyle(card).paddingLeft),
          anchoSidebar: parseFloat(getComputedStyle(document.querySelector('.sidebar')).width),
          filasVisuales: ys.size,
          radiosVisibles: document.getElementById('eleccion').getBoundingClientRect().height > 0,
          radiosDeshabilitados: radios.length > 0 && radios.every((r) => r.disabled),
          bloque: caja('bloque'), fila: caja('fila'), eleccion: caja('eleccion'), nota: caja('nota'),
          control: caja('control-desborde'),
        };
      });

      if (!servidos.has('/dashboard/css/styles.css')) noSupeMirar('el CSS del dashboard no se sirvió.');
      if (m.anchoSidebar <= 0) noSupeMirar('el sidebar computa 0 px: el CSS no se aplicó como en el producto.');
      if (m.paddingCard !== 20) noSupeMirar(`la card computa ${m.paddingCard}px de padding y el CSS pide 20: no es la caja del producto.`);
      if (!m.control || !m.control.desborda) noSupeMirar('el CONTROL NEGATIVO no salió desbordado: el detector de desborde no distingue, así que «todo cabe» significaría «no supe mirar».');
      for (const [q, c] of [['bloque', m.bloque], ['fila', m.fila], ['elección', m.eleccion], ['nota', m.nota]]) {
        if (!c) noSupeMirar(`no encuentro el nodo de «${q}».`);
        if (c.alto <= 0) noSupeMirar(`la caja de «${q}» mide 0: se está midiendo vacía.`);
      }

      // 🔴 CON ☐Nombre LOS RADIOS SE DESHABILITAN, NO SE ESCONDEN. Si desaparecieran, la fila
      // entera saltaría al marcar una casilla y el profesional no sabría que la opción existe.
      if (!m.radiosVisibles) noSupeMirar('la elección de nombre ha desaparecido del layout: tiene que deshabilitarse, no esconderse.');
      if (estado === 'sin-nombre' && !m.radiosDeshabilitados) {
        hallazgos.push('con ☐Nombre los radios siguen ACTIVOS (deberían estar deshabilitados)');
      }

      console.log(`\n── ${estado.toUpperCase()} · ${ancho} px ──`);
      console.log(`   bloque   ${m.bloque.alto.toFixed(1)} px · fila ${m.fila.alto.toFixed(1)} px (${m.filasVisuales} línea/s) · elección ${m.eleccion.alto.toFixed(1)} px · nota ${m.nota.alto.toFixed(1)} px (${m.nota.lineas} línea/s)`);
      console.log(`   radios: ${m.radiosVisibles ? 'en el layout' : 'AUSENTES'} · ${m.radiosDeshabilitados ? 'deshabilitados' : 'activos'}`);
      const mal = [m.bloque, m.fila, m.eleccion, m.nota].some((c) => c.desborda || c.fuera);
      if (mal) hallazgos.push(`${estado} @${ancho}px: algo desborda o se sale del viewport`);
      console.log(`   → ${mal ? '🔴 no cabe' : 'cabe ✅'}`);
    }
  }
} finally { await nav.close(); srv.close(); }

console.log('\n════ VEREDICTO ════');
if (hallazgos.length) {
  console.error(`🔴 ${hallazgos.length} hallazgo(s):`);
  for (const h of hallazgos) console.error('   ' + h);
  console.error('\n   El texto está FIRMADO: la caja se adapta al texto, nunca al revés.');
  process.exit(1);
}
console.log('   El bloque cabe en los dos estados y en los dos anchos, y la elección nunca');
console.log('   desaparece del layout. (Envolver no es hallazgo; desbordar o salirse, sí.)');
