// scripts/guard-caja-semaforo.mjs — SCRUM-648 (fase B) · LA CAJA DEL MOTIVO DEL SEMÁFORO,
// MEDIDA EN NAVEGADOR.
//
// Uso:  npm run guard:caja-semaforo
//
// ── QUÉ MIDE Y POR QUÉ ───────────────────────────────────────────────────────────────────
// La decisión C de SCRUM-648: cuando el semáforo NO PUEDE saber el plazo, sale **ámbar** — y el
// motivo viaja al lado, porque ámbar puede significar dos cosas («se acerca el plazo» y «no he
// podido comprobarlo») y la acción correcta es la misma, pero el porqué no se comparte.
//
// Ese motivo es una FRASE, y una frase necesita una caja. Esto la mide.
//
// ── 🔴 SE MIDE CON TEXTO DENTRO, Y ÉSA ES LA LECCIÓN ─────────────────────────────────────
// Una caja vacía puede computar **0 px de alto** y ese cero se leería como «no cabe nada», que es
// lo contrario de lo que pasa. Aquí cada nodo se mide **con su texto puesto**, y además se exige
// que el texto esté de verdad en el DOM antes de creerse ninguna cifra.
//
// ── POR QUÉ EN NAVEGADOR Y NO CON ARITMÉTICA ─────────────────────────────────────────────
// El ancho útil se podría «calcular»: viewport − padding del `.view-container` − del
// `.data-card-body` − de la card. Eso da un número y no sabe nada del `.sidebar` fijo que a 929 px
// desplaza el `.main` con un `margin-left`, ni de dónde parte la línea. Es el mismo hueco que
// SCRUM-460 declaró en su entrada y que SCRUM-469 cerró poniendo de árbitro al motor de maquetado.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────
// Misma decisión que `guard:contraste`, `guard:caja-avisos` y los demás: la suite no arranca un
// navegador. La red que SÍ corre siempre es `tests/scrum648b-motivo-del-ambar.test.mjs`, que
// vigila el mecanismo y el TOPE de caracteres.
//
// ── ⚠️ QUE LA PÁGINA MEDIDA SEA LA QUE CREO ──────────────────────────────────────────────
// Una medición en navegador no es fiable por ser en navegador. Antes de dar ningún número se
// comprueba (a) que el CSS del árbol se sirvió, (b) que **se aplicó** —la card computa sus 16 px
// de padding y el sidebar su ancho— y (c) que el texto medido está en pantalla. Si algo de eso
// falla, esto NO da un número: dice que no supo mirar.
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

/** Los anchos que pidió el fundador. 929 = portátil con sidebar · 390 = iPhone estándar. */
const ANCHOS = [929, 390];

/** Lo que la página necesita del árbol. */
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];

/** El candidato del fundador, pendiente de esta medida. 34 caracteres. */
const CANDIDATO = 'No hemos podido comprobar el plazo.';

/** Un texto de referencia que YA está aprobado y vive en esta misma card (SCRUM-171b). */
const REFERENCIA = '🗓️ Toca facturarle: lo tienes pactado cada quince días.';

const TIPOS = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html' };

/**
 * La página de medida. Reproduce el shell donde importa para la caja: `.layout` + `.sidebar`
 * (fijo, y a 929 px desplaza el contenido) + `.main` + `.view-container` + `.data-card-body` +
 * la card del grupo con su `padding:16px`, que es la estructura de `renderGrupoCard`.
 */
function paginaDeMedida() {
  const card = 'border:1px solid var(--neutral-200);border-radius:var(--radius-lg);'
    + 'padding:16px;margin-bottom:12px;background:#fff';
  const linea = 'margin-top:8px;font-size:13px;color:var(--neutral-700)';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${CSS.map((c) => `<link rel="stylesheet" href="${c}">`).join('\n')}
</head><body>
<div class="layout">
  <aside class="sidebar"><div class="sidebar-logo"><div class="sidebar-logo-text">YaQu</div></div></aside>
  <main class="main">
    <div class="view-container">
      <div class="data-card-body">
        <div id="tarjeta" style="${card}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <div style="font-weight:700;font-size:14.5px">Construcciones Ejemplo S.L.</div>
              <div style="font-size:13px;color:var(--neutral-500);margin-top:2px">marzo 2026 · 3 partes</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <span class="status-pill status-pill-pending">PLAZO PRÓXIMO</span>
              <div style="font-size:12px;color:var(--neutral-500)">Plazo: 31/03/2026</div>
            </div>
          </div>
          <div id="motivo" style="${linea}"></div>
          <div id="referencia" style="${linea}"></div>
          <div id="control" style="${linea}"></div>
        </div>
      </div>
    </div>
  </main>
</div>
<script>
  // 🔴 CON TEXTO DENTRO. Una caja vacía puede medir 0 px de alto y ese cero se leería como «no
  // cabe nada», que es justo lo contrario. Nada se mide vacío aquí.
  document.getElementById('motivo').textContent = ${JSON.stringify(CANDIDATO)};
  document.getElementById('referencia').textContent = ${JSON.stringify(REFERENCIA)};
  // 🔴 CONTROL NEGATIVO DEL DETECTOR: un texto que SÍ tiene que ocupar más de una línea.
  //
  // ⚠️ LA PRIMERA VERSIÓN ERA 'X'.repeat(300) Y NO SERVÍA: una palabra sin espacios no se puede
  // partir, así que el navegador la desborda en UNA sola línea y el detector medía 1 línea igual
  // que el candidato. El rojo que no sale acusa al CASO, no al detector. Con espacios sí envuelve,
  // que es lo que le pasaría a una frase de verdad.
  document.getElementById('control').textContent =
    'No hemos podido comprobar el plazo de este grupo de partes porque la fecha límite que llegó no se pudo leer, así que conviene revisarlo a mano antes de facturar.';
</script>
</body></html>`;
}

function servidor() {
  const servidos = new Map();
  const s = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/' || url === '/__caja-semaforo.html') {
      const cuerpo = paginaDeMedida();
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

// SCRUM-648 · MODO SERVIR: levanta la MISMA página y no mide. Existe porque en este entorno el
// navegador de la casa (Edge) no arranca, y la medida se tomó con otro motor apuntando aquí — así
// la página medida es byte a byte la de este fichero, no una copia que se quedaría vieja.
if (process.argv.includes('--servir')) {
  const p = await levantarServidor(s, Number(process.env.PUERTO_MEDIDA || 0), '127.0.0.1');
  console.log('sirviendo en http://127.0.0.1:' + p + '/__caja-semaforo.html');
  await new Promise(() => {});
}
const puerto = await levantarServidor(s, 0, '127.0.0.1');
const base = `http://127.0.0.1:${puerto}`;
const navegador = await lanzarNavegador(puppeteer, {});
const resultados = [];

try {
  const page = await navegador.newPage();
  for (const ancho of ANCHOS) {
    await page.setViewport({ width: ancho, height: 900 });
    await page.goto(`${base}/__caja-semaforo.html`, { waitUntil: 'networkidle0' });

    const m = await page.evaluate(() => {
      const caja = (id) => {
        const n = document.getElementById(id);
        const r = n.getBoundingClientRect();
        const cs = getComputedStyle(n);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
        return {
          texto: n.textContent,
          chars: n.textContent.length,
          left: r.left, right: r.right, width: r.width, height: r.height,
          fontSize: parseFloat(cs.fontSize),
          lineHeight: lh,
          lineas: Math.max(1, Math.round(r.height / lh)),
          scrollWidth: n.scrollWidth,
        };
      };
      const tarjeta = document.getElementById('tarjeta');
      const cst = getComputedStyle(tarjeta);
      return {
        viewport: window.innerWidth,
        paddingTarjeta: parseFloat(cst.paddingLeft),
        anchoSidebar: getComputedStyle(document.querySelector('.sidebar')).width,
        mainMarginLeft: parseFloat(getComputedStyle(document.querySelector('.main')).marginLeft),
        motivo: caja('motivo'),
        referencia: caja('referencia'),
        control: caja('control'),
      };
    });

    // ── SUELOS: ¿estoy midiendo lo que creo? ────────────────────────────────────────────
    if (!servidos.has('/dashboard/css/styles.css')) noSupeMirar('el CSS del dashboard no llegó a servirse.');
    if (m.paddingTarjeta !== 16) {
      noSupeMirar(`la card computa ${m.paddingTarjeta}px de padding y el marcado pide 16. `
        + 'El CSS no se aplicó como en el producto, así que el ancho útil sería de otra caja.');
    }
    if (m.motivo.texto !== CANDIDATO) noSupeMirar('el texto medido no es el candidato.');
    if (m.motivo.chars !== CANDIDATO.length) noSupeMirar('el candidato no tiene los caracteres que dice.');
    if (m.motivo.width <= 0 || m.motivo.height <= 0) {
      noSupeMirar('la caja del motivo mide 0. Se está midiendo vacía, y un cero ahí se lee como '
        + '«no cabe nada» cuando lo que pasa es que no hay texto.');
    }
    // 🔴 CONTROL NEGATIVO: el texto largo TIENE que ocupar más líneas que el candidato.
    if (!(m.control.lineas > m.motivo.lineas)) {
      noSupeMirar(`el control negativo (300 caracteres) ocupa ${m.control.lineas} línea(s) y el `
        + `candidato ${m.motivo.lineas}. El detector no distingue una caja que se llena de una que `
        + 'no, así que su veredicto sobre el candidato no significa nada.');
    }

    resultados.push({ ancho, m });

    const px = (n) => `${n.toFixed(1)} px`;
    console.log(`\n── VIEWPORT ${ancho} px ──`);
    console.log(`   sidebar ${m.anchoSidebar} · .main margin-left ${px(m.mainMarginLeft)}`);
    console.log(`   ANCHO ÚTIL de la línea:        ${px(m.motivo.width)}`);
    console.log(`   candidato (${m.motivo.chars} car.):        ${m.motivo.lineas} línea(s) · alto ${px(m.motivo.height)} · fuente ${m.motivo.fontSize} px`);
    console.log(`   referencia aprobada (${m.referencia.chars} car.): ${m.referencia.lineas} línea(s) · alto ${px(m.referencia.height)}`);
    console.log(`   control negativo (300 car.):   ${m.control.lineas} líneas ✔ el detector distingue`);
    // Caracteres que caben en UNA línea, derivado del avance real del candidato.
    const avance = m.motivo.width / m.motivo.chars;
    console.log(`   → avance medio del carácter:   ${avance.toFixed(2)} px`);
    console.log(`   → caben en UNA línea:          ~${Math.floor(m.motivo.width / (m.motivo.width / m.motivo.chars * (m.motivo.lineas || 1)) * (m.motivo.lineas || 1))} car. (ver nota)`);
  }

  console.log('\n════ VEREDICTO ════');
  for (const { ancho, m } of resultados) {
    console.log(`   ${String(ancho).padStart(4)} px → el candidato de ${m.motivo.chars} caracteres ocupa `
      + `${m.motivo.lineas} línea(s) en ${m.motivo.width.toFixed(0)} px de ancho útil.`);
  }
  console.log('\n   El TOPE de caracteres que se ata en el test sale de aquí, y su motivo es que si el');
  console.log('   texto crece por encima de lo medido hay que VOLVER A MEDIR antes de pintarlo.');
} finally {
  await navegador.close();
  s.close();
}
