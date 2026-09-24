// scripts/guard-caja-documento-suelto.mjs — SCRUM-776 · LA CAJA DE LOS RÓTULOS DEL DOCUMENTO
// SUELTO, MEDIDA EN NAVEGADOR, EN LOS DOS MODOS.
//
// Uso:  npm run guard:caja-documento-suelto
//
// ── QUÉ MIDE Y POR QUÉ ───────────────────────────────────────────────────────────────────
// SCRUM-776 hace que los rótulos del documento suelto sigan al modo de emisión: en modo
// justificante dicen «justificante» y en modo factura siguen diciendo «factura». Los del modo
// justificante son MÁS LARGOS —«Justificantes» contra «Facturas», «Emitir justificante» contra
// «Emitir factura», y la frase de error crece nueve caracteres—, así que el texto está firmado y LA
// CAJA SE ADAPTA AL TEXTO. Esto comprueba que se adapta de verdad, en los dos modos y los dos anchos.
//
// Son CINCO cajas en DOS pantallas:
//   · EL LISTADO de Facturas — «título de listado» y «columna Nº».
//   · LA PÁGINA del documento suelto — «título de la página», «botón primario» y «error al emitir».
//
// ── 🔴 SE MIDE CON TEXTO DENTRO ──────────────────────────────────────────────────────────
// Una caja vacía computa 0 px y ese cero se lee como «no cabe nada», que es lo contrario. Cada nodo
// se mide con su texto puesto, y se exige que sea EXACTAMENTE el rótulo de la fuente antes de
// creerse ninguna cifra. Misma lección que `guard:caja-semaforo` (SCRUM-648).
//
// ── 🔴 LA PÁGINA ES LA DE VERDAD, NO UNA COPIA (SCRUM-875) ───────────────────────────────
// Hasta SCRUM-867 las tres cajas de abajo se medían en el MODAL viejo, que se abría de verdad. Ese
// modal se retiró por muerto y el guard se quedó midiendo dos cajas de cinco. SCRUM-875 las recupera
// MONTANDO la página del documento suelto, sin reproducir nada de ella:
//
//   · los scripts son LOS DEL ÍNDICE, derivados de `public/dashboard/index.html` y cargados en su
//     orden —como `guard-marcadores-en-pantalla`—, no una lista escrita aquí que se quede atrás;
//   · la página la pinta `renderDocumentoSueltoView`, la misma función que llama el router;
//   · lo único que es de la PRUEBA es lo que no puede estar: la sesión y la API. El servidor de este
//     guard contesta `/admin/*` con datos fijos;
//   · y el error NO SE INYECTA: se rellena el documento, se pulsa «Emitir», la API contesta 500 sin
//     mensaje y la página pinta su aviso por su propio camino (`setAlert` →
//     `rotulosDelDocumento.errorAlEmitir()`).
//
// El shell (`.layout`/`.sidebar`/`.main`) sí se reproduce, como en `guard-caja-semaforo`: es donde
// vive la caja, y el CSS que lo maqueta es el del árbol. El listado se sigue midiendo como en
// SCRUM-776, con sus dos celdas escritas desde la fuente única.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────
// La suite no arranca navegador (misma decisión que `guard:contraste`, `guard:caja-avisos` y
// `guard:caja-semaforo`). La red que SÍ corre siempre es `tests/scrum776-una-sola-voz.test.mjs`,
// que vigila el MECANISMO: que los rótulos deriven de una sola fuente y no vuelvan a pelo.
//
// ── SUELOS ───────────────────────────────────────────────────────────────────────────────
// Antes de dar un número se comprueba que el CSS del árbol se sirvió y SE APLICÓ, que el detector
// de desborde sabe decir que no (control negativo en CADA página), que la página se montó, que cada
// texto medido es el rótulo de la fuente y que el alta llegó a la red. Si algo falla, NO da número:
// dice que no supo mirar y sale con 2.
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

/** Los dos modos que el profesional puede tener HOY. */
const MODOS = ['justificante', 'factura'];

/** El control negativo del detector de desborde: una caja que NO puede crecer con un texto que no cabe. */
const CONTROL_NEGATIVO = '<div id="control-desborde" style="width:80px;white-space:nowrap;overflow:hidden">'
  + 'No hemos podido emitir el justificante. Inténtalo otra vez.</div>';

/**
 * Los `<script src>` del panel, DERIVADOS del índice y en su orden. Se quitan antes los comentarios
 * HTML: un `<script>` comentado no carga nada, y el índice cita ficheros retirados en su prosa.
 *
 * `onboardingView.js` se excluye DECLARADO, no en silencio: el asistente de alta se planta encima de
 * todo cuando cree que el merchant es nuevo, y taparía la página que se mide (misma exclusión que
 * `guard-marcadores-en-pantalla`).
 */
function scriptsDelIndice() {
  const indice = fs.readFileSync(path.join(PUBLIC, 'dashboard', 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  return [...indice.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']\.\/js\/([A-Za-z0-9_.-]+\.js)["']/gi)]
    .map((m) => m[1])
    .filter((f) => f !== 'onboardingView.js');
}

/** El LISTADO: las dos celdas se escriben con la fuente única, como en SCRUM-776. */
function paginaDelListado(modo) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${CSS.map((c) => `<link rel="stylesheet" href="${c}">`).join('\n')}
</head><body>
<div class="layout">
  <aside class="sidebar"><div class="sidebar-logo"><div class="sidebar-logo-text">YaQu</div></div></aside>
  <main class="main">
    <div class="view-container">
      <div class="view-header"><h1 class="view-title" id="titulo-pagina"></h1></div>
      ${CONTROL_NEGATIVO}
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
<script>
  var R = window.rotulosDelDocumento || null;
  document.getElementById('titulo-pagina').textContent = R ? R.tituloListado() : 'Facturas';
  document.getElementById('col-numero').textContent = R ? R.columnaNumero() : 'Nº factura';
  document.getElementById('celda-numero').textContent = '2026-FG-001';
  window.__hayFuenteUnica = !!R;
</script>
</body></html>`;
}

/**
 * LA PÁGINA del documento suelto, con el panel ENTERO cargado.
 *
 * La sesión va ANTES de los scripts, y es lo que hace que esto mida algo: sin ella el arranque del
 * panel manda a `login.html`, el documento se sustituye y no queda nada que medir.
 */
function paginaDelDocumento(modo, scripts) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${CSS.map((c) => `<link rel="stylesheet" href="${c}">`).join('\n')}
</head><body>
<div class="layout">
  <aside class="sidebar"><div class="sidebar-logo"><div class="sidebar-logo-text">YaQu</div></div></aside>
  <main class="main">
    <div class="view-container">
      ${CONTROL_NEGATIVO}
      <div id="pagina-875"></div>
    </div>
  </main>
</div>
<script>
  localStorage.setItem('token', 'guard');
  window.appDocumentoSuelto = ${JSON.stringify(modo)};
</script>
${scripts.map((f) => `<script src="/dashboard/js/${f}"></script>`).join('\n')}
</body></html>`;
}

/** La API de la PRUEBA. Cuenta las altas: el suelo exige que el «Emitir» haya llegado a la red. */
function responderApi(req, res, modo, altas) {
  const url = req.url.split('?')[0];
  const json = (codigo, cuerpo) => {
    res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(cuerpo));
  };
  if (/^\/admin\/me$/.test(url)) {
    return json(200, { ok: true, id: 7, name: 'Negocio', role: 'admin', plan: 'pro', merchantId: 7,
      documentoSuelto: modo, modoDocumentoSuelto: modo, defaultCurrency: 'EUR', version: '1' });
  }
  if (/^\/admin\/customers/.test(url)) return json(200, [{ id: 7, name: 'Construcciones Ejemplo S.L.' }]);
  if (/^\/admin\/merchant/.test(url)) return json(200, { id: 7, name: 'Negocio', defaultCurrency: 'EUR' });
  if (/^\/admin\/invoices$/.test(url) && req.method === 'POST') {
    altas.push(url);
    // 500 SIN MENSAJE, a propósito: con mensaje, la página enseñaría el del servidor y no el rótulo.
    return json(500, {});
  }
  if (/^\/admin\/templates/.test(url)) return json(200, []);
  return json(200, {});
}

function servidor(modoActual, scripts) {
  const servidos = new Map();
  const altas = [];
  const s = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    const lis = url.match(/^\/__caja-(justificante|factura)\.html$/);
    if (lis) {
      const cuerpo = paginaDelListado(lis[1]);
      servidos.set(url, cuerpo.length);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(cuerpo);
    }
    const doc = url.match(/^\/__pagina-(justificante|factura)\.html$/);
    if (doc) {
      const cuerpo = paginaDelDocumento(doc[1], scripts);
      servidos.set(url, cuerpo.length);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(cuerpo);
    }
    if (url.startsWith('/admin/')) return responderApi(req, res, modoActual.valor, altas);
    const dest = path.join(PUBLIC, url.replace(/^\/+/, ''));
    if (!dest.startsWith(PUBLIC) || !fs.existsSync(dest) || fs.statSync(dest).isDirectory()) { res.writeHead(404); return res.end(); }
    const cuerpo = fs.readFileSync(dest);
    servidos.set(url, cuerpo.length);
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(dest)] || 'application/octet-stream' });
    return res.end(cuerpo);
  });
  return { s, servidos, altas };
}

function noSupeMirar(porque) {
  console.error('\n🔴 NO SUPE MIRAR — no se da ningún número.');
  console.error('   ' + porque);
  process.exit(2);
}

/** Mide una caja en el navegador. Se inyecta en cada `evaluate` como texto. */
const CAJA = `(nodo, etiqueta) => {
  if (!nodo) return { etiqueta, ausente: true };
  const r = nodo.getBoundingClientRect();
  const cs = getComputedStyle(nodo);
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
  const texto = (nodo.textContent || '').trim();
  return {
    etiqueta, texto, chars: texto.length,
    width: r.width, height: r.height,
    lineas: r.height > 0 ? Math.max(1, Math.round(r.height / lh)) : 0,
    desborda: nodo.scrollWidth > nodo.clientWidth + 1,
    scrollWidth: nodo.scrollWidth, clientWidth: nodo.clientWidth,
    fueraDelViewport: r.right > window.innerWidth + 1,
  };
}`;

const scripts = scriptsDelIndice();
if (scripts.length < 40) noSupeMirar(`sólo ${scripts.length} scripts derivados de index.html: eso no es el panel.`);

const modoActual = { valor: MODOS[0] };
const { s, servidos, altas } = servidor(modoActual, scripts);
const puerto = await levantarServidor(s, 0, '127.0.0.1');
const base = `http://127.0.0.1:${puerto}`;
const navegador = await lanzarNavegador(puppeteer, {});
const hallazgos = [];
let fuenteUnica = null;

function informar(modo, ancho, pantalla, m) {
  if (parseFloat(m.anchoSidebar) <= 0) noSupeMirar(`${pantalla}: el sidebar computa 0 px, el CSS no se aplicó como en el producto.`);
  // 🔴 EL DETECTOR TIENE QUE SABER DECIR QUE NO, en CADA pantalla: una caja de 80 px con una frase
  // de 59 caracteres. Si no sale desbordada, «todo cabe» sería el verde de un detector apagado.
  if (!m.controlDesborde || !m.controlDesborde.desborda) {
    noSupeMirar(`${pantalla}: el CONTROL NEGATIVO no salió desbordado, así que «todos caben» significaría «no supe mirar».`);
  }
  console.log(`\n── ${pantalla.toUpperCase()} · MODO ${modo.toUpperCase()} · VIEWPORT ${ancho} px ──`);
  for (const c of m.cajas) {
    if (c.ausente) noSupeMirar(`${pantalla}: no se encontró el nodo de «${c.etiqueta}».`);
    if (c.width <= 0 || c.height <= 0) {
      noSupeMirar(`${pantalla}: la caja de «${c.etiqueta}» mide 0. Se está midiendo vacía, y ese cero se `
        + 'leería como «no cabe» cuando lo que pasa es que no hay texto.');
    }
    const mal = c.desborda || c.fueraDelViewport;
    console.log(`   ${mal ? '🔴' : '  '} ${c.etiqueta.padEnd(20)} ${JSON.stringify(c.texto).padEnd(60)} `
      + `${String(c.chars).padStart(3)} car · ${c.width.toFixed(1)}×${c.height.toFixed(1)} px · ${c.lineas} línea(s)`
      + `${c.desborda ? ` · DESBORDA (scroll ${c.scrollWidth} > client ${c.clientWidth})` : ''}`
      + `${c.fueraDelViewport ? ' · SE SALE DEL VIEWPORT' : ''}`);
    if (mal) hallazgos.push(`${modo} @${ancho}px · ${c.etiqueta}: ${JSON.stringify(c.texto)}`);
  }
}

try {
  const page = await navegador.newPage();
  for (const modo of MODOS) {
    modoActual.valor = modo;
    for (const ancho of ANCHOS) {
      await page.setViewport({ width: ancho, height: 900 });

      // ── ① EL LISTADO ───────────────────────────────────────────────────────────────────
      await page.goto(`${base}/__caja-${modo}.html`, { waitUntil: 'networkidle0' });
      const lista = await page.evaluate((cajaSrc) => {
        const caja = eval(cajaSrc); // eslint-disable-line no-eval
        return {
          anchoSidebar: getComputedStyle(document.querySelector('.sidebar')).width,
          hayFuenteUnica: window.__hayFuenteUnica === true,
          controlDesborde: caja(document.getElementById('control-desborde'), 'control negativo'),
          cajas: [
            caja(document.getElementById('titulo-pagina'), 'título de listado'),
            caja(document.getElementById('col-numero'), 'columna Nº'),
          ],
        };
      }, CAJA);
      if (!servidos.has('/dashboard/css/styles.css')) noSupeMirar('el CSS del dashboard no llegó a servirse.');
      fuenteUnica = lista.hayFuenteUnica;
      informar(modo, ancho, 'listado', lista);

      // ── ② LA PÁGINA DEL DOCUMENTO SUELTO, MONTADA DE VERDAD ────────────────────────────
      const altasAntes = altas.length;
      await page.goto(`${base}/__pagina-${modo}.html`, { waitUntil: 'networkidle0' });
      const doc = await page.evaluate(async (cajaSrc) => {
        const caja = eval(cajaSrc); // eslint-disable-line no-eval
        const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
        const R = window.rotulosDelDocumento;
        const cont = document.getElementById('pagina-875');
        if (!R) return { ciego: 'no se cargó `rotulosDelDocumento`' };
        if (typeof window.renderDocumentoSueltoView !== 'function') return { ciego: 'no existe `renderDocumentoSueltoView`: el panel no se cargó' };

        cont.innerHTML = '';
        await window.renderDocumentoSueltoView(cont);
        await dormir(500);
        const nodos = cont.querySelectorAll('*').length;
        if (nodos < 80) return { ciego: `la página pinta ${nodos} nodos: eso no es la pantalla entera` };

        const titulo = cont.querySelector('h2.quotes-title');
        const boton = [...cont.querySelectorAll('button.btn.btn-primary')].find((b) => b.textContent.trim() === R.accionPrimaria());

        // El error, por su CAMINO REAL: se teclea un documento válido y se pulsa la acción primaria.
        const sel = cont.querySelector('select[name="customer_id"]');
        const concepto = cont.querySelector('input[placeholder="Concepto / servicio"]');
        const numeros = cont.querySelectorAll('input[type="number"]');
        if (!sel || !concepto || numeros.length < 2 || !boton) {
          return { ciego: `no encuentro el formulario (cliente ${!!sel} · concepto ${!!concepto} · números ${numeros.length} · botón ${!!boton})` };
        }
        const poner = (el, v, ev) => { el.value = v; el.dispatchEvent(new Event(ev, { bubbles: true })); };
        poner(sel, '7', 'change');
        poner(concepto, 'Mano de obra', 'input');
        poner(numeros[0], '2', 'input');
        poner(numeros[1], '50', 'input');
        // SCRUM-915d · el botón primario vive en el ÚLTIMO paso («Revisar y emitir»), cerrado al
        // entrar: medido sin llegar, su caja da 0 y este guard se declaraba ciego. Se llega como el
        // profesional, por los dos «Continuar», y sólo entonces se mide y se pulsa.
        for (let i = 0; i < 2; i++) {
          const seguir = [...cont.querySelectorAll('button')]
            .find((b) => b.textContent.trim() === 'Continuar' && b.checkVisibility() && !b.disabled);
          if (!seguir) return { ciego: `no hay un «Continuar» habilitado en el paso ${i + 1}: no llego al botón primario` };
          seguir.click();
          await dormir(150);
        }
        boton.click();
        await dormir(800);
        const alerta = [...cont.querySelectorAll('div.alert.error')].find((a) => a.style.display !== 'none');

        return {
          esperado: { titulo: R.tituloModal(), boton: R.accionPrimaria(), error: R.errorAlEmitir() },
          anchoSidebar: getComputedStyle(document.querySelector('.sidebar')).width,
          controlDesborde: caja(document.getElementById('control-desborde'), 'control negativo'),
          cajas: [
            caja(titulo, 'título de la página'),
            caja(boton, 'botón primario'),
            caja(alerta || null, 'error al emitir'),
          ],
        };
      }, CAJA);

      if (doc.ciego) noSupeMirar(`página (${modo} @${ancho}px): ${doc.ciego}`);
      // 🔴 EL ALTA TIENE QUE HABER LLEGADO A LA RED. Si no, el aviso que se mide no es el de «no se
      // pudo emitir», sino el de otra cosa (una validación del formulario, por ejemplo).
      if (altas.length !== altasAntes + 1) {
        noSupeMirar(`página (${modo} @${ancho}px): «Emitir» no llegó a \`POST /admin/invoices\` `
          + `(${altas.length - altasAntes} altas). El error medido no sería el de emitir.`);
      }
      // 🔴 CADA TEXTO ES EXACTAMENTE EL RÓTULO DE LA FUENTE: si no, se estaría midiendo otra caja.
      const [cTitulo, cBoton, cError] = doc.cajas;
      for (const [c, esperado] of [[cTitulo, doc.esperado.titulo], [cBoton, doc.esperado.boton], [cError, doc.esperado.error]]) {
        if (!c.ausente && c.texto !== esperado) {
          noSupeMirar(`página (${modo} @${ancho}px): «${c.etiqueta}» dice ${JSON.stringify(c.texto)} y la `
            + `fuente dice ${JSON.stringify(esperado)}. No es la caja que digo medir.`);
        }
      }
      informar(modo, ancho, 'página del documento suelto', doc);
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
console.log('   Las CINCO cajas caben: las dos del listado y las tres de la página montada de verdad,');
console.log('   en los dos modos y en los dos anchos.');
console.log('   (Envolver en varias líneas NO es un hallazgo; desbordar o salirse del viewport, sí.)');
