// scripts/guard-caja-avisos.mjs — SCRUM-469: la caja del aviso de desalojo, MEDIDA EN NAVEGADOR.
//
// Uso:  npm run guard:caja-avisos
//
// ── POR QUÉ EN NAVEGADOR Y NO CON ARITMÉTICA ─────────────────────────────────
// SCRUM-460 midió su microcopy a mano —ancho útil del `.view-container`, `.alert` a 13,5 px,
// avance medio del carácter ~0,50 em— y **lo declaró como hueco en su propia entrada**: «la
// medida de la caja es aritmética, no una captura». Esa aritmética no sabe nada del `overflow-x:
// clip` de `html, body`, ni de si el aviso queda por encima del pliegue, ni de qué hace el
// `<strong>` con el interlineado. Aquí el árbitro es el motor de maquetado, como en
// `guard:contraste` (SCRUM-368).
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────
// Misma decisión que `guard:contraste`, y no es una excepción nueva: la suite no arranca un
// navegador. La red que SÍ corre siempre es `tests/scrum469-aviso-desalojo.test.mjs`, que vigila
// el mecanismo (que el aviso salga, que no salga a quien no ha perdido nada, y que el texto siga
// partido en dos campos, que es lo que lo hace caber).
//
// ── ⚠️ QUE LA PÁGINA MEDIDA SEA LA QUE CREO ─────────────────────────────────
// Una medición en navegador no es fiable POR SER en navegador: un servidor viejo sirviendo el
// HTML de antes del arreglo da números perfectos de otra cosa. Por eso el servidor de aquí lee
// del disco en cada petición, anota QUÉ sirvió, y antes de medir nada se comprueba (a) que el CSS
// pedido es el del árbol, (b) que de verdad se aplicó —`.alert` computa 13,5 px— y (c) que el
// texto en pantalla es el literal aprobado que publica `estadoFirma.js`. Si algo de eso falla, el
// guard NO da un número: dice que no supo mirar.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const PUBLIC = path.join(RAIZ, 'public');
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PUERTO = Number(process.env.CAJA_PUERTO || 4401);

/** Los anchos que se miden. 390 = iPhone estándar; 320 = el más estrecho que soportamos. */
const ANCHOS = [390, 320];

/** Lo que la página necesita del árbol, en el orden en que lo necesita. */
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];
const JS = ['/dashboard/js/resistenciaAlmacen.js', '/dashboard/js/estadoFirma.js'];

const TIPOS = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html' };

/**
 * La página de medida. No se escribe en `public/`: un fichero nuevo ahí entra en el precache del
 * service worker y eso es otro carril (SCRUM-274). Se sirve desde una ruta virtual.
 *
 * El marcado reproduce el del dashboard EXACTAMENTE donde importa para la caja: `.view-container`
 * es quien pone el padding lateral, y el aviso cuelga de él como en la home.
 */
function paginaDeMedida() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${CSS.map((c) => `<link rel="stylesheet" href="${c}">`).join('\n')}
</head><body>
<div class="view-container">
  <div id="home-desalojo"></div>
  <div id="ref-pendientes"></div>
  <div id="ref-sin-partir"></div>
  <div id="control-negativo"></div>
</div>
${JS.map((j) => `<script src="${j}"></script>`).join('\n')}
<script>
  // El aviso se pinta con LA FUNCIÓN DEL PRODUCTO, no con una copia del marcado: si alguien
  // cambia el pintado, esto mide lo cambiado.
  document.getElementById('home-desalojo').innerHTML =
    window.pintarDesalojo({ estado: window.POSIBLE_PERDIDA });
  // REFERENCIA (no falla): el aviso vecino, que es el que motivó partir el texto en dos campos.
  document.getElementById('ref-pendientes').innerHTML =
    window.pintarPendientesDeSubir({ sabemos: true, n: 2, texto: window.textoDelContador(2) });
  // REFERENCIA (no falla): EL MISMO CONTENIDO SIN PARTIR, para que «partirlo es el arreglo de la
  // caja» sea un número medido y no una afirmación. Es el mismo texto, en una sola frase corrida.
  document.getElementById('ref-sin-partir').innerHTML =
    '<div class="alert error">' + window.TEXTO_DESALOJO.titulo + '. ' + window.TEXTO_DESALOJO.cuerpo + '</div>';
  // 🔴 CONTROL NEGATIVO DEL DETECTOR: un nodo que SÍ se sale. Si el guard no lo caza, su verde
  // sobre el aviso de verdad no significa nada.
  document.getElementById('control-negativo').innerHTML =
    '<div class="alert error" style="white-space:pre">' + 'X'.repeat(400) + '</div>';
</script>
</body></html>`;
}

function servidor() {
  const servidos = new Map();
  const s = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/' || url === '/__caja-avisos.html') {
      const cuerpo = paginaDeMedida();
      servidos.set(url, cuerpo.length);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(cuerpo);
    }
    const f = path.join(PUBLIC, url.replace(/^\/+/, ''));
    // No se sirve nada de fuera de `public/`.
    if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) {
      res.writeHead(404); return res.end('no');
    }
    // Se LEE DEL DISCO en cada petición: sin caché no hay «servidor viejo».
    const cuerpo = fs.readFileSync(f);
    servidos.set(url, cuerpo.length);
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(cuerpo);
  });
  return { s, servidos };
}

const fallos = [];
const ciego = [];

const { s, servidos } = servidor();
await new Promise((r) => s.listen(PUERTO, '127.0.0.1', r));

let navegador;
try {
  navegador = await puppeteer.launch({ executablePath: EDGE, args: ['--no-sandbox'] });
} catch (e) {
  s.close();
  console.error(`🔴 NO SE PUDO ABRIR EL NAVEGADOR (${EDGE}): ${e.message}\n`
    + '   Esto NO es «la caja está bien»: es «no supe mirar». Apunta `EDGE_PATH` a un Edge o\n'
    + '   Chrome instalado y vuelve a lanzarlo. El mecanismo del aviso lo cubre `npm test`\n'
    + '   (tests/scrum469-aviso-desalojo.test.mjs); esto mide la CAJA y no se puede sustituir.');
  process.exit(2);
}

const medidas = [];
try {
  for (const ancho of ANCHOS) {
    const page = await navegador.newPage();
    await page.setViewport({ width: ancho, height: 844, deviceScaleFactor: 2 });
    await page.goto(`http://127.0.0.1:${PUERTO}/__caja-avisos.html`, { waitUntil: 'networkidle0' });

    const m = await page.evaluate(() => {
      const mirar = (id) => {
        const caja = document.getElementById(id);
        const el = caja && caja.querySelector('.alert');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          texto: el.textContent,
          top: r.top, left: r.left, right: r.right, alto: r.height, ancho: r.width,
          desbordaH: el.scrollWidth > el.clientWidth + 1,
          desbordaV: el.scrollHeight > el.clientHeight + 1,
          fontSize: cs.fontSize, lineHeight: cs.lineHeight, paddingLeft: cs.paddingLeft,
          // ⚠️ Los BORDES cuentan: `.alert` lleva `border: 1px solid transparent`, y sin restarlos
          // 3 líneas exactas salían 3,11 y el número dejaba de ser un número.
          lineas: (r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
            - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth))
            / (parseFloat(cs.lineHeight) || 1),
        };
      };
      return {
        viewport: window.innerWidth,
        paginaScrollea: document.documentElement.scrollWidth > window.innerWidth,
        util: (() => {
          const c = document.querySelector('.view-container');
          const cs = getComputedStyle(c);
          return c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        })(),
        aviso: mirar('home-desalojo'),
        referencia: mirar('ref-pendientes'),
        sinPartir: mirar('ref-sin-partir'),
        controlNegativo: mirar('control-negativo'),
        textoOficial: window.TEXTO_DESALOJO,
      };
    });
    await page.close();

    // ── SUELOS: ¿estoy midiendo lo que creo? ──────────────────────────────────────────────
    if (!m.aviso) { ciego.push(`${ancho}px · el aviso NO ESTÁ EN LA PÁGINA: no hay nada que medir.`); continue; }
    if (m.aviso.alto <= 0) { ciego.push(`${ancho}px · el aviso mide 0 de alto: el CSS no se aplicó.`); continue; }
    if (m.aviso.fontSize !== '13.5px') {
      ciego.push(`${ancho}px · \`.alert\` computa ${m.aviso.fontSize} y en el árbol son 13.5px: `
        + 'la página medida NO es la del repo.');
      continue;
    }
    const esperado = `${m.textoOficial.titulo}${m.textoOficial.cuerpo}`;
    if (m.aviso.texto.replace(/\s+/g, ' ').trim() !== esperado.replace(/\s+/g, ' ').trim()) {
      ciego.push(`${ancho}px · el texto en pantalla no es el aprobado que publica \`estadoFirma.js\`.`);
      continue;
    }
    if (!m.controlNegativo || !(m.controlNegativo.desbordaH || m.controlNegativo.right > m.viewport)) {
      ciego.push(`${ancho}px · EL DETECTOR NO CAZA EL CONTROL NEGATIVO (400 caracteres sin cortar). `
        + 'Su verde sobre el aviso de verdad no significaría nada.');
      continue;
    }

    // ── LA MEDIDA ─────────────────────────────────────────────────────────────────────────
    const a = m.aviso;
    if (a.left < 0 || a.right > m.viewport + 0.5) {
      fallos.push(`${ancho}px · EL AVISO SE SALE de la pantalla (x de ${a.left.toFixed(1)} a `
        + `${a.right.toFixed(1)}, viewport ${m.viewport}). Con \`overflow-x: clip\` en html/body no `
        + 'hay scroll que lo alcance: queda recortado y el profesional no lee el aviso entero.');
    }
    if (a.desbordaH) fallos.push(`${ancho}px · el contenido del aviso desborda su caja en horizontal.`);
    if (a.desbordaV) fallos.push(`${ancho}px · el aviso está RECORTADO en vertical: sobra texto que nadie lee.`);
    if (m.paginaScrollea) {
      fallos.push(`${ancho}px · la PÁGINA scrollea en horizontal con el aviso puesto. Es la red de `
        + 'seguridad móvil-first de `styles.css`, y la rompe este aviso.');
    }
    if (a.top < 0) fallos.push(`${ancho}px · el aviso nace por encima del borde superior: inalcanzable.`);

    medidas.push({ ancho, util: Math.round(m.util), altoAviso: Math.round(a.alto),
      lineasAviso: Math.round(a.lineas), anchoAviso: Math.round(a.ancho),
      altoReferencia: m.referencia ? Math.round(m.referencia.alto) : null,
      lineasReferencia: m.referencia ? Math.round(m.referencia.lineas) : null,
      lineasSinPartir: m.sinPartir ? Math.round(m.sinPartir.lineas) : null,
      altoSinPartir: m.sinPartir ? Math.round(m.sinPartir.alto) : null });
  }
} finally {
  await navegador.close();
  s.close();
}

// ── EL INFORME ───────────────────────────────────────────────────────────────────────────
console.log('SCRUM-469 · caja del aviso de desalojo, medida en Edge\n');
console.log(`servidos del disco: ${[...servidos.keys()].join(', ')}\n`);
for (const m of medidas) {
  console.log(`  ${m.ancho} px · caja del .alert ${m.anchoAviso} px (útil ${m.util - 28} px de texto)`);
  console.log(`           AVISO PARTIDO EN DOS CAMPOS   ${m.altoAviso} px · ${m.lineasAviso} líneas`);
  console.log(`           [ref] el mismo, SIN partir    ${m.altoSinPartir} px · ${m.lineasSinPartir} líneas`);
  console.log(`           [ref] aviso de pendientes     ${m.altoReferencia} px · ${m.lineasReferencia} líneas`);
}

if (ciego.length) {
  console.error('\n🔴 NO SUPE MIRAR — y eso no es un verde:\n' + ciego.map((c) => '  · ' + c).join('\n'));
  process.exit(2);
}
if (medidas.length !== ANCHOS.length) {
  console.error(`\n🔴 se midieron ${medidas.length} de ${ANCHOS.length} anchos.`);
  process.exit(2);
}
if (fallos.length) {
  console.error('\n🔴 LA CAJA NO AGUANTA EL AVISO:\n' + fallos.map((f) => '  · ' + f).join('\n'));
  process.exit(1);
}
console.log('\n✅ el aviso cabe y es alcanzable en los dos anchos.');
