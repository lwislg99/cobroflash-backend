// scripts/guard-a11y-comparativa.mjs — SCRUM-541 · la comparativa, MEDIDA EN EL ÁRBOL DE
// ACCESIBILIDAD RENDERIZADO (Edge via puppeteer-core).
//
// Uso:  npm run guard:a11y-comparativa
//
// ── QUÉ SE VIGILA, Y POR QUÉ NO ES COSMÉTICO ─────────────────────────────────
// La comparativa tiene dos columnas: «Tu método actual» y «Con YaQu». Si una celda llega a un
// lector de pantalla SIN su etiqueta de columna, el mensaje no se degrada: SE INVIERTE. Quien no
// ve la tabla puede entender que lo que ofrecemos NOSOTROS es el problema. Ése es el daño.
//
// ── POR QUÉ EL ÁRBITRO ES EL ÁRBOL Y NO EL MARCADO ───────────────────────────
// 🔴 Un `aria-label` bien puesto y uno mal puesto SE VEN IGUAL EN EL FUENTE. Un `assert.match`
// sobre `index.html` diría verde con la etiqueta fuera de la celda, con un `id` que no resuelve,
// o con un `display:none` que la saca del árbol. Es la misma lección que ya costó dos tandas
// aquí (SCRUM-515: el aviso estaba en el fichero y un `innerHTML` lo borraba cuatro líneas
// después). Aquí el árbitro es `page.accessibility.snapshot()`: lo que el navegador expone.
//
// ── LOS DOS ESTADOS SON DOS PROBLEMAS DISTINTOS ──────────────────────────────
// Desde 641 px hay grid de 3 columnas y la etiqueta va CLIPADA (se oye, no se ve). Por debajo no
// hay grid: las celdas se apilan y la etiqueta se ve. Una solución que arregle uno y rompa el
// otro no vale, así que se mide en LOS DOS: 1280 y 360.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────
// Misma decisión que `guard:contraste`, `guard:caja-avisos`, `guard:aviso-bizum` y
// `guard:vias-de-cobro`, y no es una excepción nueva: la suite no arranca un navegador. La red
// que SÍ corre siempre es `tests/scrum541-comparativa-a11y.test.mjs`, que vigila el mecanismo en
// el marcado y que este guard no desaparezca.
//
// ── ⚠️ QUE LA PÁGINA MEDIDA SEA LA QUE CREO ─────────────────────────────────
// El servidor lee del disco en cada petición. Antes de medir nada se comprueba (a) que la
// sección existe, (b) que el CSS se aplicó de verdad —el grid está o no según el ancho— y (c)
// que el detector SABE FALLAR (control negativo). Si algo de eso no cuadra, el guard no da un
// veredicto: dice que NO SUPO MIRAR.
//
// ── LA SECCIÓN ESTÁ OCULTA A PROPÓSITO (regla 30) ────────────────────────────
// Su copy sigue siendo PROPUESTA sin aprobar, así que en `index.html` lleva `hidden`. El guard
// lo retira EN LA PÁGINA CARGADA (nunca en el fichero) para poder medir. Así, el día que se
// apruebe el copy y se publique, esto sigue midiendo lo mismo sin tocar una línea.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const PUBLIC = path.join(RAIZ, 'public');
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PUERTO = Number(process.env.A11Y_PUERTO || 4402);

/** Los dos estados. 1280 = grid de 3 columnas; 360 = apilado, el más estrecho que soportamos. */
const ANCHOS = [1280, 360];

/** Las dos columnas, con el texto EXACTO que cada celda tiene que traer consigo. */
const COLUMNAS = { 'cmp-yaqu': 'Con YaQu', otra: 'Tu método actual' };

const TIPOS = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

function servidor() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const abs = path.join(PUBLIC, p);
    if (!abs.startsWith(PUBLIC) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      res.writeHead(404); return res.end('no');
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(abs)] || 'application/octet-stream' });
    res.end(fs.readFileSync(abs));           // del DISCO en cada petición: nada de caché vieja
  });
}

/** Todo el texto que cuelga de un nodo del árbol de accesibilidad, concatenado. */
function textoDelSubarbol(nodo) {
  let t = (nodo.name || '') + ' ' + (nodo.value || '');
  for (const h of nodo.children || []) t += ' ' + textoDelSubarbol(h);
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * EL DETECTOR. Toma el árbol de accesibilidad **de esa celda** —`snapshot({root})` con el nodo
 * del DOM como raíz— y comprueba qué se oye dentro.
 *
 * ⚠️ La primera versión no anclaba al DOM: buscaba en el árbol de la página el subárbol MÍNIMO
 * que contuviera el texto de la celda. Daba 0/12 en los dos anchos, y era un ROJO FALSO — el
 * subárbol mínimo que contiene el texto de una celda es el NODO DE TEXTO, y un nodo de texto
 * nunca contiene a su etiqueta, que es su hermana. El guard medía su propia heurística.
 * Anclando al DOM la pregunta es exactamente la que interesa: «esta celda, ¿trae su etiqueta?».
 */
function loQueSeOyeEn(arbolDeLaCelda) {
  return arbolDeLaCelda ? textoDelSubarbol(arbolDeLaCelda) : '';
}

/**
 * 🔴 SE COMPARA SIN DISTINGUIR MAYÚSCULAS, y el motivo es una medición de este ticket, no una
 * comodidad: el árbol de accesibilidad devuelve la etiqueta como **«TU MÉTODO ACTUAL»**, no como
 * «Tu método actual». El `text-transform: uppercase` de `.cmp-lbl` NO se queda en la pintura —
 * el navegador expone el texto YA TRANSFORMADO. Comparando con la caja del HTML, este guard daba
 * 0/12 con la asociación perfectamente puesta.
 *
 * Se deja escrito porque es la clase de detalle que convierte un guard en un estorbo: habría
 * dado rojo permanente sin que nada estuviera roto, y el segundo en verlo lo habría desactivado.
 */
const caja = (s) => s.toLocaleUpperCase('es');

function celdaLlegaConSuEtiqueta(arbolDeLaCelda, textoCelda, etiqueta) {
  const t = loQueSeOyeEn(arbolDeLaCelda);
  if (!t) return { ok: false, motivo: 'la celda NO APARECE en el árbol de accesibilidad' };
  const T = caja(t);
  if (!T.includes(caja(textoCelda.slice(0, 25)))) {
    return { ok: false, motivo: `el árbol de la celda no trae su propio texto. Se oiría: «${t.slice(0, 90)}»` };
  }
  if (!T.includes(caja(etiqueta))) {
    return { ok: false, motivo: `llega SIN su etiqueta de columna. Se oiría: «${t.slice(0, 90)}»` };
  }
  // El separador: sin él, el sintetizador lee "actualTu palabra" pegado.
  if (T.includes(caja(etiqueta + textoCelda.slice(0, 1)))) {
    return { ok: false, motivo: `la etiqueta va PEGADA al texto: «${t.slice(0, 60)}»` };
  }
  return { ok: true, seOye: t };
}

const log = (...a) => console.log(...a);
let fallos = 0;

const srv = servidor();
await new Promise((r) => srv.listen(PUERTO, r));

if (!fs.existsSync(EDGE)) {
  console.error(`🔴 NO SUPE MIRAR: no encuentro Edge en ${EDGE}. Define EDGE_PATH.`);
  srv.close(); process.exit(2);
}

const navegador = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });

try {
  log('Guard de accesibilidad de la comparativa (SCRUM-541)');
  log('Árbitro: el árbol de accesibilidad renderizado, no el marcado.\n');

  for (const ancho of ANCHOS) {
    const page = await navegador.newPage();
    await page.setViewport({ width: ancho, height: 900 });
    await page.goto(`http://127.0.0.1:${PUERTO}/`, { waitUntil: 'load' });

    // La sección está oculta por la regla 30 (copy en propuesta). Se destapa AQUÍ, no en el fichero.
    const estado = await page.evaluate(() => {
      const s = document.querySelector('#comparativa');
      if (!s) return null;
      s.removeAttribute('hidden');
      const fila = document.querySelector('.cmp-row');
      return {
        filas: document.querySelectorAll('.cmp-row').length,
        grid: getComputedStyle(fila).gridTemplateColumns,
        celdas: [...document.querySelectorAll('.cmp-cell')].map((c) => ({
          columna: c.classList.contains('cmp-yaqu') ? 'cmp-yaqu' : 'otra',
          // El texto propio de la celda, sin la etiqueta: es lo que se busca en el árbol.
          texto: (c.querySelector('p')?.lastChild?.textContent || '').trim(),
          fila: c.closest('.cmp-row')?.dataset.fila,
        })),
      };
    });

    // ── SUELO ①: ¿estoy midiendo lo que creo? ──────────────────────────────────
    if (!estado || !estado.filas) {
      console.error(`🔴 NO SUPE MIRAR a ${ancho}px: no encuentro la sección #comparativa ni sus filas.`);
      fallos++; await page.close(); continue;
    }
    // ── SUELO ②: ¿se aplicó el CSS? El grid tiene que EXISTIR a 1280 y NO existir a 360.
    const hayGrid = estado.grid !== 'none' && estado.grid.split(' ').length === 3;
    if (ancho >= 641 && !hayGrid) {
      console.error(`🔴 NO SUPE MIRAR a ${ancho}px: se esperaba grid de 3 columnas y llegó «${estado.grid}». ¿Se sirvió el CSS?`);
      fallos++; await page.close(); continue;
    }
    if (ancho < 641 && hayGrid) {
      console.error(`🔴 NO SUPE MIRAR a ${ancho}px: NO debería haber grid y llegó «${estado.grid}».`);
      fallos++; await page.close(); continue;
    }

    // El árbol de accesibilidad DE CADA CELDA, con el nodo del DOM como raíz.
    const nodos = await page.$$('.cmp-cell');
    const arboles = [];
    for (const n of nodos) arboles.push(await page.accessibility.snapshot({ root: n, interestingOnly: false }));

    // ── SUELO ③ · CONTROL NEGATIVO: el detector tiene que saber decir que NO. ──
    // Se le da el árbol de una celda REAL y una etiqueta que NO está en ella. Si dice que sí, el
    // verde de abajo no valdría nada y es preferible no dar veredicto.
    const prueba = celdaLlegaConSuEtiqueta(arboles[0], estado.celdas[0].texto, 'ETIQUETA QUE NO EXISTE');
    if (prueba.ok) {
      console.error(`🔴 NO SUPE MIRAR a ${ancho}px: el detector aprueba una etiqueta INVENTADA. No sabe fallar.`);
      fallos++; await page.close(); continue;
    }
    // ── SUELO ④: y tiene que saber decir que SÍ cuando el texto está. Sin este control
    // positivo, un detector que devolviera siempre `false` pasaría el ③ y parecería riguroso.
    const pruebaSi = celdaLlegaConSuEtiqueta(arboles[0], estado.celdas[0].texto, estado.celdas[0].texto.slice(0, 10));
    if (!pruebaSi.ok && !pruebaSi.motivo.includes('PEGADA')) {
      console.error(`🔴 NO SUPE MIRAR a ${ancho}px: el detector rechaza algo que SÍ está en la celda. Sólo sabe decir que no.`);
      fallos++; await page.close(); continue;
    }

    log(`── ${ancho}px · ${estado.filas} filas · grid: ${hayGrid ? estado.grid : 'no hay (apilado)'}`);
    log(`   controles del detector OK: rechaza una etiqueta inventada y acepta la que sí está`);

    let okAncho = 0, ejemplo = '';
    for (let i = 0; i < estado.celdas.length; i++) {
      const celda = estado.celdas[i];
      const etiqueta = COLUMNAS[celda.columna];
      const r = celdaLlegaConSuEtiqueta(arboles[i], celda.texto, etiqueta);
      if (r.ok) { okAncho++; if (!ejemplo) ejemplo = r.seOye; }
      else {
        console.error(`   ✖ fila "${celda.fila}" · columna «${etiqueta}» → ${r.motivo}`);
        fallos++;
      }
    }
    log(`   ✔ ${okAncho}/${estado.celdas.length} celdas llegan con su etiqueta de columna asociada`);
    if (ejemplo) log(`     se oye: «${ejemplo}»`);
    log('');
    await page.close();
  }
} finally {
  await navegador.close();
  srv.close();
}

if (fallos) {
  console.error(`\n🔴 ${fallos} problema(s). En una comparativa, una celda sin su columna no confunde: INVIERTE el mensaje.`);
  process.exit(1);
}
console.log('✓ En los dos anchos, cada celda llega con su etiqueta de columna asociada.');
