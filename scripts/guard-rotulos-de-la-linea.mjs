// scripts/guard-rotulos-de-la-linea.mjs — SCRUM-909 · EL CONCEPTO NO PUEDE DESAPARECER.
//
// Uso:  npm run guard:rotulos-de-la-linea
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
// En el editor de presupuestos, la columna del CONCEPTO se quedaba sin ancho y su rótulo se salía
// de la caja, pintándose encima de la columna de al lado. Medido en el DOM RENDERIZADO el
// 17-sep-2026 sobre `963c2732`, con una línea escrita (Pieza QA 909 · 8 · 24,95 €):
//
//     ventana   columna CONCEPTO   rótulo «Concepto» (necesita 72 px)
//      1180 px        0,0 px        en una caja de 0    → se sale
//      1280 px        0,0 px        en una caja de 0    → se sale
//      1440 px        9,6 px        en una caja de 10   → se sale
//      1600 px      106,7 px        cabe
//      1920 px      301,0 px        cabe
//       390 px      298,0 px        cabe (una columna, el pliegue de móvil)
//
// O sea: la banda rota va de 768 px a ~1520 px, que es justo donde viven los portátiles de 1366 y
// 1440. El enunciado del ticket decía «a 1280 px» y se quedaba corto.
//
// 🔴 POR QUÉ ESTE GUARD NO COMPARA LOS RECTÁNGULOS DE LOS DOS RÓTULOS, que es lo primero que uno
// escribe cuando lee «los rótulos se pisan»:
//
//     UN GUARD POR INTERSECCIÓN DE CAJAS SALE **VERDE** CONTRA ESTA PANTALLA ROTA.
//
// Medido: a 1280 px las cajas de «Concepto» y «Cantidad» NO se cruzan — hay 12 px de hueco entre
// columnas—. Lo que se cruza es el TEXTO, que se desborda de una caja de 0 px porque un `<span>`
// no recorta. Un guard verde sobre la pantalla rota no es un guard flojo: es un guard que miente
// en la dirección peligrosa, porque da permiso para cerrar.
//
// Por eso lo que se mide es lo que de verdad está mal: EL ANCHO DE LA COLUMNA y si el RÓTULO CABE
// (`scrollWidth > clientWidth`).
//
// ── LO QUE EXIGE, en cada anchura ────────────────────────────────────────────────────────────
//   🔴 A · cada rótulo de la línea CABE en su caja (`scrollWidth <= clientWidth`).
//   🔴 B · el campo del CONCEPTO es el MÁS ANCHO de la línea. No es gusto: es el contrato que la
//          Parte AB3 le escribió a este componente — «concepto a ancho completo (protagonista)».
//   ⛔ C · NEGATIVO: la línea no desborda de lado en ninguna anchura (AB3: «un solo DOM, cero
//          scroll lateral en cualquier anchura»).
//   ✅ D · POSITIVO: a 390 px el concepto sigue ocupando la línea ENTERA, como hoy. El arreglo no
//          puede pagarse rompiendo el móvil, que es donde el pro trabaja.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Si el editor no se pinta, no encuentra los campos, o lo tecleado no llega al total, sale con 2
// (NO SUPE MEDIR), que NO es «está bien». Salidas: 0 de acuerdo, 1 hallazgo, 2 ciego.
//
// ⚠️ SE TECLEA ANTES DE MEDIR, y no es un adorno: con la línea VACÍA el editor la PLIEGA a
// propósito (`.quote-line--vacia:not(:focus-within)` esconde cantidad, precio y acciones). La
// primera versión de esta sonda midió sin teclear y a 390 px devolvió ceros en todo. Un cero no
// es «está limpio»: es «no he mirado».
//
// ── POR QUÉ FUERA DE `npm test`, Y POR QUÉ NO HAY RED DE NODO ────────────────────────────────
// Esto NO tiene un test de Node equivalente, y es deliberado. Lo único que un test sobre el fuente
// podría mirar es si la hoja de estilos dice tal o cual cosa — y eso es un PROXY del defecto, no el
// defecto: el defecto es un número que sólo existe cuando el navegador resuelve la rejilla. Es
// exactamente el caso que `docs/equipo/sesion-2.md` usa para defender que estos guards existan:
// el fuente se lee bien y la pantalla está rota.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';
import { abrirConceptos, CLIENTE_DE_PASO } from './_abrir-conceptos.mjs';

export const SALIDA_HALLAZGO = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// La POBLACIÓN. No son anchos bonitos: 1180/1280/1366/1440 son la banda medida como rota, 1600 y
// 1920 son el otro lado, 768 y 1024 el borde de abajo, y 390 el móvil que no se puede perder.
const ANCHOS = [390, 768, 1024, 1180, 1280, 1366, 1440, 1600, 1920, 2560];
const MOVIL = 390;
let PUERTO = Number(process.env.ROTULOS_PUERTO || 0);

const ME = {
  id: 1, email: 'demo@yaqu.app', name: 'QA 909', plan: 'pro', role: 'admin',
  onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false,
};
const MERCHANT = { id: 1, name: 'QA 909', defaultCurrency: 'EUR', country: 'ES', iban: 'ES9121000418450200051332' };

function arrancarServidor() {
  const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/admin/me') return json(res, ME);
    if (u === '/admin/merchant') return json(res, MERCHANT);
    // SCRUM-915d · un cliente que elegir: sin él no se sale del paso Cliente y no hay líneas que teclear.
    if (u === '/admin/customers') return json(res, [CLIENTE_DE_PASO]);
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
const MEDIR = new Function(`
  var linea = document.querySelector('.quote-line');
  var lista = document.querySelector('.quote-lines');
  if (!linea || !lista) return { error: 'no hay .quote-line o .quote-lines' };

  var caja = function (el) {
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: Math.round(r.x * 10) / 10, ancho: Math.round(r.width * 10) / 10 };
  };

  // TODOS los campos de la línea, no una lista escrita a mano: si mañana aparece un campo nuevo,
  // este guard lo mide solo. Una lista cableada sólo vigila lo que había el día que se escribió.
  var campos = [];
  var nodos = linea.querySelectorAll(':scope > .quote-line__field');
  for (var i = 0; i < nodos.length; i++) {
    var campo = nodos[i];
    var lab = campo.querySelector(':scope > .quote-line__label');
    var inp = campo.querySelector('input');
    campos.push({
      clase: campo.className,
      esConcepto: campo.classList.contains('quote-line__concept'),
      texto: lab ? lab.textContent.replace(/\\s+/g, ' ').trim() : null,
      campo: caja(campo),
      input: caja(inp),
      tieneRotulo: !!lab,
      // ¿el texto del rótulo CABE? Un span no recorta: si pide más de lo que hay, se pinta fuera.
      scrollWidth: lab ? lab.scrollWidth : 0,
      clientWidth: lab ? lab.clientWidth : 0,
      desbordado: lab ? lab.scrollWidth > lab.clientWidth + 1 : false
    });
  }

  return {
    campos: campos,
    // El total: si lo tecleado no llegó aquí, el editor no está vivo y nada de lo de arriba vale.
    total: (function () { var e = document.querySelector('.quote-total-kpi__cifra'); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; })(),
    lineaDesborda: linea.scrollWidth > linea.clientWidth + 1,
    listaDesborda: lista.scrollWidth > lista.clientWidth + 1,
    anchoLinea: Math.round(linea.clientWidth * 10) / 10,
    // EL ANCHO CONTRA EL QUE SE MIDE "ocupa la linea entera" ES EL DEL CONTENIDO, NO clientWidth:
    // este incluye el relleno de la tarjeta, asi que un concepto que SI ocupa toda la fila salia
    // 24 px corto y el POSITIVO se ponia rojo contra una pantalla sana. Lo cazo el propio guard en
    // su primera pasada, a 390 px: 298 px dentro de "una linea de 322".
    anchoContenido: (function () {
      var cs = getComputedStyle(linea);
      return Math.round((linea.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0)) * 10) / 10;
    })(),
    columnas: getComputedStyle(linea).gridTemplateColumns
  };
`);

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Teclea en el campo como un usuario: enfoca, borra y escribe carácter a carácter. */
async function teclear(pag, selector, texto) {
  const el = await pag.$(selector);
  if (!el) return false;
  await el.evaluate((e) => { e.scrollIntoView({ block: 'center', behavior: 'instant' }); e.focus(); e.value = ''; });
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
    // Un contexto POR ANCHO: el borrador vive en `localStorage` y el de un ancho se restauraría
    // al abrir el siguiente (medido en SCRUM-888).
    const contexto = await navegador.createBrowserContext();
    const pag = await contexto.newPage();
    const errores = [];
    pag.on('pageerror', (e) => errores.push(String(e.message || e)));
    try {
      await pag.setViewport({ width: ancho, height: 900, isMobile: ancho < 800, hasTouch: ancho < 800 });
      await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#quotes-new`, { waitUntil: 'networkidle0' });
      const pintado = await pag.waitForSelector('.quote-line .quote-line__price input', { timeout: 10000 }).then(() => true, () => false);
      if (!pintado) { ciegos.push(`${ancho}px → el editor no se pintó (errores: ${errores.join(' | ') || 'ninguno'})`); continue; }
      await espera(400);
      // SCRUM-915d · las líneas viven en el paso Conceptos: se llega como el profesional.
      const corte = await abrirConceptos(pag);
      if (corte) { ciegos.push(`${ancho}px → no llegué al paso Conceptos: ${corte}`); continue; }

      if (!await teclear(pag, '.quote-line .quote-line__concept input', 'Pieza QA 909')
        || !await teclear(pag, '.quote-line .quote-line__qty input', '8')
        || !await teclear(pag, '.quote-line .quote-line__price input', '24.95')) {
        ciegos.push(`${ancho}px → no encontré concepto, cantidad o precio de la primera línea`); continue;
      }
      // Fuera el foco: con el cursor dentro, `:focus-within` cambia el pliegue de móvil y se
      // mediría una línea que el profesional no está mirando.
      await pag.evaluate(new Function(`if (document.activeElement && document.activeElement.blur) document.activeElement.blur();`));
      await espera(700);

      const m = await pag.evaluate(MEDIR);
      if (m.error) { ciegos.push(`${ancho}px → ${m.error}`); continue; }
      if (!m.total || m.total === '0,00 €') { ciegos.push(`${ancho}px → lo tecleado no llegó al total (${m.total ?? 'sin total'}): el editor no está vivo`); continue; }
      const conRotulo = m.campos.filter((c) => c.tieneRotulo);
      if (conRotulo.length < 3) { ciegos.push(`${ancho}px → sólo encuentro ${conRotulo.length} rótulos en la línea; esperaba al menos 3`); continue; }
      const concepto = m.campos.find((c) => c.esConcepto);
      if (!concepto) { ciegos.push(`${ancho}px → no encuentro el campo del concepto`); continue; }

      filas.push({ ancho, m, concepto });

      const mal = [];
      // A · cada rótulo cabe en su caja.
      for (const c of conRotulo) {
        if (c.desbordado) mal.push(`el rótulo «${c.texto}» pide ${c.scrollWidth} px y su caja mide ${c.clientWidth} px: se pinta FUERA, encima de la columna de al lado`);
      }
      // B · el concepto es el campo más ancho de la línea (AB3: «concepto protagonista»).
      const masAncho = m.campos.reduce((a, b) => (b.campo && (!a.campo || b.campo.ancho > a.campo.ancho) ? b : a), m.campos[0]);
      if (!masAncho.esConcepto) {
        mal.push(`el concepto mide ${concepto.campo.ancho} px y «${masAncho.texto}» mide ${masAncho.campo.ancho} px: el protagonista de la línea es el más estrecho`);
      }
      // C · NEGATIVO: nada de scroll lateral, en ninguna anchura.
      if (m.lineaDesborda) mal.push(`la línea desborda de lado (scroll lateral), y AB3 lo prohíbe en cualquier anchura`);
      if (m.listaDesborda) mal.push(`la lista de líneas desborda de lado (scroll lateral)`);
      // D · POSITIVO del móvil: el concepto ocupa la línea entera, como hoy.
      if (ancho === MOVIL && concepto.campo.ancho < m.anchoContenido - 1) {
        mal.push(`POSITIVO roto: a ${MOVIL} px el concepto mide ${concepto.campo.ancho} px dentro de un contenido de ${m.anchoContenido} px; hoy la ocupa entera`);
      }
      if (errores.length) mal.push(`errores de página: ${errores.join(' | ')}`);
      if (mal.length) hallazgos.push({ ancho, mal });
    } finally {
      await contexto.close();
    }
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log('');
console.log('  SCRUM-909 · LOS RÓTULOS DE LA LÍNEA DEL EDITOR (panel real, DOM renderizado)');
console.log(`  POBLACIÓN: ${ANCHOS.length} anchuras medidas — ${ANCHOS.join(', ')} px`);
console.log('  ' + '─'.repeat(108));
for (const f of filas) {
  const c = f.concepto;
  console.log(`  ${String(f.ancho).padStart(4)}px · línea ${String(f.m.anchoLinea).padStart(6)} px · concepto ${String(c.campo.ancho).padStart(6)} px · rótulo «${c.texto}» ${c.scrollWidth}/${c.clientWidth}${c.desbordado ? ' ⚠️ SE SALE' : ''}`);
}
console.log('  ' + '─'.repeat(108));

if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MEDIR — esto NO es «los rótulos están bien»:\n');
  for (const c of ciegos) console.error('     · ' + c);
  process.exit(SALIDA_NO_SUPE_MEDIR);
}
if (hallazgos.length) {
  console.error(`\n  🔴 EN ${hallazgos.length} DE ${ANCHOS.length} ANCHURAS EL CONCEPTO NO CABE EN SU SITIO:\n`);
  for (const h of hallazgos) {
    console.error(`     [${h.ancho}px]`);
    for (const m of h.mal) console.error('       · ' + m);
  }
  console.error('\n  El profesional escribe QUÉ HA HECHO en ese campo. Si desaparece, la pantalla le está');
  console.error('  pidiendo el dato más importante del presupuesto por una rendija.\n');
  process.exit(SALIDA_HALLAZGO);
}
console.log(`\n  ✔ en las ${ANCHOS.length} anchuras: cada rótulo cabe, el concepto es el campo más ancho y no hay scroll lateral.\n`);
