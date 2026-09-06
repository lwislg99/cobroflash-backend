// scripts/guard-objetivo-tactil.mjs — SCRUM-542 · panel en SCRUM-782 · dos más en SCRUM-791
//
// Mide EN NAVEGADOR (Edge vía puppeteer-core) el ÁREA QUE RECIBE EL TOQUE de cada objetivo
// interactivo, contra los 44 px de AB6, en CUATRO superficies:
//
//   · LA LANDING (`/`) a 1280 y 360 px — lo que este guard hizo desde SCRUM-542.
//   · EL PANEL · lista de Clientes a 929 y 390 px — desde SCRUM-782.
//   · EL PANEL · editor de presupuesto y ficha de Trabajo a 929 y 390 px — desde SCRUM-791.
//
// 🔴 SON CUATRO Y NO DIECIOCHO, y eso es una decisión medida: SCRUM-787 censó el panel entero
// —76 objetivos cortos distintos, de los que 57 son `.btn-sm`— y dejó escrito que MEDIR es barato
// pero VIGILAR se paga en cada PR. Estas dos entran por su motivo: el editor es la pantalla que
// más se usa, y la ficha de Trabajo tiene los dos peores del árbol (14,0 y 19,6 px) y se usa de
// pie en obra. Las otras dieciséis siguen medidas por el censo (`npm run censo:tactil-panel`) y
// sin vigilar, a propósito.
//
// 🔴 POR QUÉ ENTRA EL PANEL, Y POR QUÉ NO BASTABA CON RENOMBRAR ESTE GUARD.
//
// Hasta hoy este fichero hacía `goto('/')` y nada más: medía LA LANDING y se llamaba
// «objetivo-tactil», sin decir de qué. Quien leyera el nombre creería que la casa está cubierta.
// SCRUM-582 metió tres casillas de selección en la lista de Clientes y NADIE las midió: cuando se
// midieron a mano (SCRUM-782) daban **19 px de área de toque contra los 44 de AB6**, a 929 y a 390.
//
// Se valoró la otra salida —renombrarlo a `guard:objetivo-tactil-landing` y declarar su alcance— y
// se descartó MIDIENDO: el nombre aparece 33 veces en 17 ficheros, tres de ellos tests que fijan
// la cadena exacta (`scrum522` lo lleva en una lista, `scrum542` exige que aparezca UNA vez en
// package.json), o sea un diff mayor y más arriesgado que añadir la cobertura… y que además
// dejaría el panel igual de descubierto. Cubrir quita el agujero Y hace verdadero el nombre.
//
// ⚠️ Y LA CEGUERA ERA DOBLE: `INTERACTIVOS` tampoco incluía `input[type="checkbox"]`, así que
// visitar la página no habría bastado — habría dado «✅ todo cumple» sin mirar el control del que
// iba el ticket. Eso se arregló en `_medidor-de-toque.mjs`, y allí está escrito por qué.
//
// ── POR QUÉ ESTE GUARD NO SE PARECE AL DE SCRUM-543 ──────────────────────────────────────────
// `guard-a11y-landing.mjs` vigila DOS táctiles escritos a mano (el logo y «Ver planes →»). Sirve
// para lo que nació. Pero una lista a mano sólo protege lo que alguien se acordó de apuntar: el
// enlace que se añada mañana no está en ella y su 17 px pasa sin que nadie lo vea.
// Aquí el censo es DERIVADO del DOM: se pregunta al navegador qué hay que se pueda pulsar.
//
// ── LAS TRES COSAS QUE HACEN QUE ESTA MEDICIÓN VALGA ──────────────────────────────────────────
//
// ① HACE SCROLL, Y ESO NO ES UN DETALLE.
//    `elementsFromPoint` SÓLO VE EL VIEWPORT. Sin llevar cada elemento a la vista, todo lo que
//    esté bajo el pliegue —el pie, que es justo donde están los peores— devuelve «no se alcanza»
//    y el censo sale con cero defectos. Es el modo de fallo REAL que se midió en este ticket:
//    el primer censo dio «0 táctiles a 360 px» y era CEGUERA, NO LIMPIEZA.
//    Por eso el arranque trae un CONTROL del propio scroll (§ `controlDelScroll`): comprueba que
//    sin scroll el pie NO se alcanza y con scroll SÍ. Si las dos respuestas fueran iguales, el
//    scroll no estaría haciendo nada y este guard no sabría lo que cree saber.
//
// ② EL ÁRBITRO ES «QUÉ ACTIVARÍA EL DEDO AQUÍ», NO «ESTÁ EL ELEMENTO EN LA PILA».
//    El idioma de la casa era `elementsFromPoint(x,y).includes(el)`. Eso da por bueno un
//    elemento TAPADO por otro: sigue en la pila, pero el toque se lo lleva el de encima. Con
//    áreas ampliadas por pseudo-elemento —que es como la casa arregla los táctiles en línea— dos
//    enlaces seguidos se solapan, y con `.includes` los dos parecen cumplir mientras uno de los
//    dos es INALCANZABLE.
//    Aquí se mira el elemento de ENCIMA y se le pregunta a qué interactivo pertenece:
//        elementsFromPoint(x,y)[0].closest(INTERACTIVOS) === el
//    Eso acierta con los hijos (el `<span class="ar">→</span>` de dentro de un enlace pertenece a
//    su enlace) y deja de mentir con los solapes.
//
// ③ LA CAJA CSS NO DECIDE. `min-height:44px` puede estar puesto y el área real ser otra: un
//    enlace en línea con `display:inline` ignora el alto, y un `::after` ampliado lo cambia sin
//    tocar la caja. Se mide expandiendo desde el centro hasta que el punto deja de pertenecer al
//    elemento. Verificar que el fichero cambió no es verificar que el comportamiento cambió.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Un cero aquí PARECE una respuesta. Por eso: si el censo no encuentra táctiles, o si falta
// alguno de los CONOCIDOS declarados abajo, el guard NO dice «todo bien»: dice que no supo mirar.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
// SCRUM-562 · el árbitro y el afinado viven en UN solo sitio, con su porqué. Aquí estaban
// en línea, y una copia en línea es lo que dejó que este guard y el de SCRUM-543 midieran
// distinto durante dos días.
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL } from './_medidor-de-toque.mjs';
// SCRUM-782 · la vista del panel, montada por el banco y serializada. `scripts/` importando de
// `tests/` no es nuevo: ya lo hacen censo-internos-de-prisma, censo-tablero-vs-arbol y
// diagnostico-dependencias.
import { paginaDeClientes, paginaDeVista, CLIENTES_DE_MUESTRA } from './_pagina-panel.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';
// SCRUM-522 · la ruta ya no se escribe aqui. Era una ruta de WINDOWS por defecto, identica en
// los nueve guards, y por eso ninguno podia correr en el runner de CI —Ubuntu— donde de verdad
// hacen falta. `rutaDelNavegador` busca en los sitios conocidos y, si no hay ninguno, PARA
// declarandose ciega en vez de devolver una ruta plausible. `EDGE_PATH` sigue mandando.
// SCRUM-620 (2/2) · PUERTO EFÍMERO POR DEFECTO. `0` le pide al sistema uno libre, y el que
// toca de verdad se lee del `levantarServidor`. Quita las colisiones de raíz: contra la pasada
// anterior del propio guard (sockets en TIME_WAIT, el caso de SCRUM-617) y contra los otros.
// ⚠️ El efímero es HIGIENE; no sustituye al diagnóstico del commit anterior, que sigue
// diciendo con código 4 lo que pasa si un puerto pedido está ocupado.
let PUERTO = 0;

/** AB6 y la definición de «pulsable» salen del medidor único: aquí no se redeclaran. */
const MINIMO = MINIMO_TACTIL;
const ANCHOS = [1280, 360];

/**
 * Secciones que NACEN TAPADAS y que hay que destapar PARA MEDIR.
 *
 * ⚠️ Se destapa EN EL DOM DE UNA PESTAÑA DE USAR Y TIRAR. `public/index.html` no se toca: el
 *    `hidden` sigue en el fichero y en producción. Es el mismo recurso que ya usa
 *    `guard-a11y-landing.mjs` con su campo `destapar`.
 * ⚠️ Y se destapa PORQUE SI NO, NO SE MIDE. Un táctil de 17 px dentro de una sección tapada no
 *    es un táctil correcto: es un defecto con fecha de estreno. El día que la sección se
 *    publique ya nadie va a volver a mirar.
 */
const DESTAPAR = [
  {
    sel: '#announce',
    motivo: 'la barra de anuncio nace `hidden` y su CSS la deja `visibility:hidden`: ocupa sitio '
      + 'pero no recibe toque. Sin destapar, «Ver planes →» no se mide.',
  },
  {
    sel: '#gremios',
    motivo: 'sección en propuesta (SCRUM-555). Sus seis `a.p-link` son enlaces REALES a '
      + '/register.html: el día que se publique son táctiles de verdad, y hoy son los únicos '
      + '`.p-link` que un dedo puede pulsar.',
  },
];

/**
 * SUELO CON NOMBRES. No basta con «encontré alguno»: estos tienen que aparecer MEDIDOS.
 * Si uno falta, o el scroll dejó de funcionar, o alguien retiró algo — en ambos casos el verde
 * de los demás no significa nada y hay que decirlo.
 */
const CONOCIDOS = {
  1280: [
    { nombre: 'el logo', busca: (m) => m.sel === 'A.logo' },
    { nombre: 'los 3 enlaces del nav', busca: (m) => m.sel.startsWith('A.t'), cuantos: 3 },
    { nombre: '«Volver a empezar»', busca: (m) => m.sel === 'BUTTON.try-reset' },
    { nombre: 'los 5 del pie', busca: (m) => m.seccion === 'footer', cuantos: 5 },
    { nombre: '«Ver planes →» (destapado)', busca: (m) => m.seccion === 'announce' },
    { nombre: 'los 6 a.p-link de #gremios (destapado)', busca: (m) => m.seccion === 'gremios', cuantos: 6 },
  ],
  360: [
    { nombre: 'el logo', busca: (m) => m.sel === 'A.logo' },
    { nombre: '«Volver a empezar»', busca: (m) => m.sel === 'BUTTON.try-reset' },
    { nombre: 'los 5 del pie', busca: (m) => m.seccion === 'footer', cuantos: 5 },
  ],
};

/**
 * EXCEPCIONES DECLARADAS. Un elemento aquí NO cumple 44 px y se sabe por qué.
 * Cada una lleva motivo y quién la retira. Sin eso, no es una excepción: es un umbral bajado.
 */
const EXCEPCIONES = [];

const TIPOS = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
// SCRUM-782 · LA PÁGINA DEL PANEL. Se monta con el banco de vistas y se SERIALIZA: el marcado que
// llega al navegador lo produce el PRODUCTO (`renderCustomersView`), no una tabla escrita aquí.
// Si no se puede montar, se dice y se sale CIEGO — no se mide media casa y se llama verde.
const PANEL = await paginaDeClientes(RAIZ);
const PANEL_HTML = PANEL.html && `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css">
</head><body><div class="view-container">${PANEL.html}</div></body></html>`;

// ═══ SCRUM-791 · LAS DOS SUPERFICIES QUE PROPUSO EL CENSO DE SCRUM-787 ═══════════════════════
//
// Entran ÉSTAS y no las dieciocho: medir es barato, vigilar se paga en cada PR. El censo dejó el
// número (76 objetivos cortos distintos en el panel) y estas dos son las que el asesor aceptó:
//
//   · `renderQuotesView`    — 8 cortos, y es la pantalla que más se usa: el presupuesto en 30
//                             segundos es el producto entero.
//   · `renderJobDetailView` — 6 cortos, y tiene LOS DOS PEORES DEL ÁRBOL (14,0 y 19,6 px de área
//                             de toque). Se usa DE PIE EN OBRA, con una mano y con guantes.
//
// ⚠️ `renderSettingsView` tiene MÁS (10) y NO entra: es configuración —se toca sentado y una vez—
// y arrastra 9 nodos «sin pintar» que nadie ha mirado. Un guard sobre una población que no se sabe
// leer entra ciego. Entra el día que alguien mire esos nueve.
//
// Los datos de muestra son los del censo de SCRUM-787: sin ellos las dos se quedan en su estado
// vacío y medirían otra pantalla.
const DATOS_791 = (url) => {
  const u = String(url || '');
  if (u.includes('/admin/merchant')) return { id: 1, name: 'Fontanería Soler' };
  if (/\/admin\/customers/.test(u)) return CLIENTES_DE_MUESTRA;
  if (/\/albaranes\//.test(u)) return { id: 1, estado: 'borrador', lines: [], items: [] };
  return [];
};
/** El elemento de la SONDA: 12 px, deliberadamente por debajo de todo. */
const SONDA_TEXTO = '·';
const SONDA_HTML = '<button id="__sonda-791" style="width:12px;height:12px;padding:0;border:0">' + SONDA_TEXTO + '</button>';

const envolver = (cuerpo) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css">
</head><body><div class="view-container">${cuerpo}</div></body></html>`;

const SUPERFICIES_791 = [
  // 🔴 SCRUM-794 · 6-sep-2026 · 8 → 7, y el que falta VA NOMBRADO. Este suelo hizo justo lo que
  // se le pide: saltó en cuanto la pantalla dejó de pintar uno de los objetivos censados. No era
  // un fallo, era el aviso, así que se DECIDE en vez de bajar el número y seguir.
  //
  // El que se ha ido está identificado corriendo ESTE MISMO guard sobre el árbol de antes
  // (`ff4e1c4a`), no restando 8 − 7: allí salían DOS excusados con el mismo selector
  // —`BUTTON.btn.btn-secondary «+ Añadir línea»` y `«Limpiar formulario»`, los dos a 36,8 px— y
  // aquí sólo queda el segundo. El primero era el duplicado del rótulo que el fundador mandó
  // borrar: había dos «+ Añadir línea» idénticos y se queda el de abajo, que mide 44,9 px y por
  // eso nunca estuvo entre los cortos. O sea que la vista no ha dejado de pintar nada que
  // debiera: hay un objetivo menos porque hay un botón menos, y encima uno que no cumplía AB6.
  { ruta: '/__quotes', vista: 'renderQuotesView', titulo: 'editor de presupuesto', distintosEsperados: 7 },
  { ruta: '/__jobdetail', vista: 'renderJobDetailView', titulo: 'ficha de Trabajo', distintosEsperados: 6 },
];
for (const s of SUPERFICIES_791) {
  const p = await paginaDeVista(RAIZ, s.vista, { datos: DATOS_791, minimoNodos: 10 });
  s.aviso = p.aviso;
  s.html = p.html && envolver(p.html);
  s.htmlSonda = p.html && envolver(p.html + SONDA_HTML);
}

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/__panel' && PANEL_HTML) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(PANEL_HTML);
  }
  // SCRUM-791 · las dos superficies nuevas y sus gemelas con sonda.
  for (const s of SUPERFICIES_791) {
    if (p === s.ruta && s.html) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(s.html);
    }
    if (p === s.ruta + '__sonda' && s.htmlSonda) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(s.htmlSonda);
    }
  }
  if (p === '/') p = '/index.html';
  const abs = path.join(PUBLIC, p);
  if (!abs.startsWith(PUBLIC) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(abs)] || 'application/octet-stream' });
  res.end(fs.readFileSync(abs));                 // del DISCO en cada petición
});

let fallos = 0;
const decir = (s) => console.log(s);
const mal = (s) => { console.error(s); fallos += 1; };

// SCRUM-620 · el servidor se levanta por el módulo común: el ÚNICO sitio donde se decide
// qué pasa si NO se puede. Antes cada guard hacía su propio `listen` sin tratar el error, y un
// puerto ocupado subía como excepción → exit 1 → la puerta lo pintaba `rojo(1)`, o sea «he
// encontrado un defecto». Ahora para con 4 y lo dice.
PUERTO = await levantarServidor(srv, PUERTO);
// SCRUM-617 · el arranque pasa por el módulo común: es el ÚNICO sitio donde se decide cómo
// arranca el navegador. Antes cada guard lo escribía a mano y el flag de aislamiento se
// propagó por COPIA de uno a otro — por eso el más antiguo (contraste) se quedó sin él. Y aquí
// está lo que arregla este ticket: si no levanta, `lanzarNavegador` PARA con código 3 («no
// pude arrancarlo»), que no es 2 («no lo encuentro») ni 1 («he encontrado un defecto»).
// La comprobación de existencia que había aquí SALE: segunda copia del suelo; el módulo común
// ya para con 2 si no hay navegador.
process.on('exit', () => { try { srv.close(); } catch { /* ya cerrado */ } });
const navegador = await lanzarNavegador(puppeteer, { headless: 'new' });

/** El código que corre DENTRO de la página. Va como cadena para poder inyectarlo dos veces. */
const MEDIDOR = `(async (INTERACTIVOS, MIN, DESTAPAR_SELS, CON_SCROLL) => {
  const espera = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const destapados = [];
  for (const s of DESTAPAR_SELS) {
    const n = document.querySelector(s);
    if (!n) { destapados.push({ sel: s, ok: false }); continue; }
    n.removeAttribute('hidden');
    n.style.visibility = 'visible';
    n.style.display = '';
    destapados.push({ sel: s, ok: true });
  }
  await espera();

  const nombreDe = (el) => {
    let c = '';
    if (el.className && typeof el.className === 'string') c = el.className.trim().split(/\\s+/).filter(Boolean).join('.');
    return el.tagName + (c ? '.' + c : '');
  };
  const porQueNo = (el, x, y) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') return 'visibility:hidden';
    if (cs.display === 'none') return 'display:none';
    if (cs.pointerEvents === 'none') return 'pointer-events:none';
    if (Number(cs.opacity) === 0) return 'opacity:0';
    let p = el.parentElement;
    while (p) {
      const pc = getComputedStyle(p);
      const quien = '<' + p.tagName.toLowerCase() + (p.id ? '#' + p.id : '') + '>';
      if (pc.visibility === 'hidden') return 'un ancestro ' + quien + ' tiene visibility:hidden';
      if (pc.display === 'none') return 'un ancestro ' + quien + ' tiene display:none';
      if (Number(pc.opacity) === 0) return 'un ancestro ' + quien + ' tiene opacity:0';
      p = p.parentElement;
    }
    const arriba = document.elementsFromPoint(x, y)[0];
    if (!arriba) return 'no hay nada en ese punto: el elemento cae fuera del viewport';
    return 'lo tapa ' + nombreDe(arriba);
  };

  const todos = [...document.querySelectorAll(INTERACTIVOS)];
  const medidos = [], sinPintar = [], noTocables = [];

  for (const el of todos) {
    const r0 = el.getBoundingClientRect();
    const ficha = () => ({
      sel: nombreDe(el),
      texto: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) || '(sin texto)',
      seccion: (() => { const s = el.closest('section, footer, nav, header, div[id]'); return s ? (s.id || s.tagName.toLowerCase()) : '(suelto)'; })(),
    });
    if (!r0.width || !r0.height) { sinPintar.push({ ...ficha(), motivo: 'caja de 0×0' }); continue; }

    // 🔴 EL SCROLL, el árbitro y el afinado, los tres, viven en _medidor-de-toque.mjs.
    //    (Sin acentos graves: esto va DENTRO de un literal de plantilla y los cerraría.)
    const m = await window.__areaDeToque(el, INTERACTIVOS, { scroll: CON_SCROLL });
    const r = el.getBoundingClientRect();
    if (m.error) {
      const cx = r.left + r.width / 2;
      // El medidor dice QUE no se pudo; el porqué lo averigua este guard, que es quien lo reporta.
      const motivo = m.error.includes('no lo alcanza') ? porQueNo(el, cx, r.top + r.height / 2) : m.error;
      noTocables.push({ ...ficha(), caja: m.caja ?? +r.height.toFixed(1), motivo });
      continue;
    }
    medidos.push({ ...ficha(), caja: m.caja, tocable: m.tocable, cumple: m.tocable >= MIN });
  }
  return { medidos, sinPintar, noTocables, total: todos.length, destapados };
})`;

for (const ancho of ANCHOS) {
  const page = await navegador.newPage();
  await page.setViewport({ width: ancho, height: 900 });
  await page.goto(`http://127.0.0.1:${PUERTO}/`, { waitUntil: 'load' });

  decir('\n════════════════════════════════════════════════════════════════════════════');
  decir(`ANCHO ${ancho} px`);
  decir('════════════════════════════════════════════════════════════════════════════');

  // ── ⓪ CONTROL DEL SCROLL: ¿está el scroll haciendo algo, o me lo estoy creyendo? ─────────
  const sinScroll = await page.evaluate(`${FUENTE_MEDIDOR};${MEDIDOR}(${JSON.stringify(INTERACTIVOS)}, ${MINIMO}, ${JSON.stringify(DESTAPAR.map((d) => d.sel))}, false)`);
  await page.goto(`http://127.0.0.1:${PUERTO}/`, { waitUntil: 'load' });   // página limpia
  const r = await page.evaluate(`${FUENTE_MEDIDOR};${MEDIDOR}(${JSON.stringify(INTERACTIVOS)}, ${MINIMO}, ${JSON.stringify(DESTAPAR.map((d) => d.sel))}, true)`);

  const pieSin = sinScroll.medidos.filter((m) => m.seccion === 'footer').length;
  const pieCon = r.medidos.filter((m) => m.seccion === 'footer').length;
  decir(`⓪ control del scroll · enlaces del pie medidos SIN scroll: ${pieSin}  ·  CON scroll: ${pieCon}`);
  if (pieCon === 0) {
    mal('   🔴 NO SUPE MIRAR: ni con scroll aparece el pie. El cero de abajo sería ceguera.');
  } else if (pieSin >= pieCon) {
    mal('   🔴 EL CONTROL NO DISCRIMINA: sin scroll se mide lo mismo. O el scroll no hace falta '
      + '(y este guard cree saber algo que no sabe), o el medidor no está usándolo.');
  } else {
    decir(`   ✅ el scroll es lo que hace visible el pie (+${pieCon - pieSin}). Sin él, este censo mentiría.`);
  }

  for (const d of DESTAPAR) {
    const hecho = r.destapados.find((x) => x.sel === d.sel);
    if (!hecho || !hecho.ok) {
      mal(`   🔴 NO SUPE MIRAR: el destapar declarado \`${d.sel}\` ya no existe en la página. `
        + 'O la sección se retiró (actualiza DESTAPAR y di por qué) o el censo está ciego ahí.');
    }
  }

  decir(`\n① censo derivado · interactivos en el DOM: ${r.total}  ·  medidos: ${r.medidos.length}`
    + `  ·  sin pintar: ${r.sinPintar.length}  ·  presentes pero no tocables: ${r.noTocables.length}`);

  // ── ① SUELO ────────────────────────────────────────────────────────────────────────────
  if (r.medidos.length === 0) {
    mal('   🔴 CIEGO: cero táctiles medidos. Eso no es «no hay defectos», es «no supe mirar».');
    await page.close();
    continue;
  }
  for (const c of CONOCIDOS[ancho] || []) {
    const n = r.medidos.filter(c.busca).length;
    const esperados = c.cuantos || 1;
    if (n < esperados) mal(`   🔴 CIEGO: falta(n) ${c.nombre} — esperaba ${esperados}, medí ${n}. El verde del resto no vale.`);
  }

  // ── ② LOS QUE NO SE PUDIERON MEDIR, CON SU MOTIVO ──────────────────────────────────────
  if (r.noTocables.length) {
    decir('\n② presentes pero NO tocables (no son «pequeños»: es que ahí el dedo no los activa):');
    for (const m of r.noTocables) decir(`   · [${m.seccion}] ${m.sel} «${m.texto}» — caja ${m.caja}px — ${m.motivo}`);
  }

  // ── ③ EL VEREDICTO ─────────────────────────────────────────────────────────────────────
  const cortos = r.medidos.filter((m) => !m.cumple);
  const excusados = cortos.filter((m) => EXCEPCIONES.some((e) => e.sel === m.sel));
  const culpables = cortos.filter((m) => !EXCEPCIONES.some((e) => e.sel === m.sel));

  decir(`\n③ contra AB6 (${MINIMO} px) · cumplen: ${r.medidos.length - cortos.length}`
    + `  ·  se quedan cortos: ${cortos.length}  ·  de ésos, excusados con motivo: ${excusados.length}`);
  for (const m of culpables) {
    mal(`   ✖ ${m.tocable}px < ${MINIMO} · [${m.seccion}] ${m.sel} «${m.texto}» (caja CSS ${m.caja}px)`);
  }
  for (const m of excusados) {
    const e = EXCEPCIONES.find((x) => x.sel === m.sel);
    decir(`   ⚠️ EXCEPCIÓN ${m.tocable}px · ${m.sel} — ${e.motivo}`);
  }
  if (!culpables.length) decir('   ✅ todo lo que se puede pulsar llega a 44 px.');

  await page.close();
}

/**
 * 🔴 SCRUM-782 · EXCEPCIONES **DEL PANEL**, y por qué existen separadas de las de la landing.
 *
 * En cuanto este guard miró la lista de Clientes por primera vez encontró TRECE objetivos cortos
 * que nadie había medido nunca: los botones `.btn-sm` de la pantalla, a **30,8–31,0 px** contra
 * los 44 de AB6 (caja CSS de 30 px). No son un estreno de hoy: llevan ahí desde que existen esas
 * acciones. Lo que estrena hoy es que se VEN.
 *
 * NO SE ABSORBEN CALLANDO Y NO SE ARREGLAN AQUÍ, y las dos mitades tienen motivo:
 *
 *   · Arreglar `.btn-sm` es tocar una clase compartida por TODA la aplicación —la usan la lista de
 *     clientes, la de presupuestos, los detalles…— y eso cambia el alto de botones en pantallas
 *     que este ticket no ha medido. Es una decisión de producto, no de una sesión.
 *   · Dejarlos sin declarar sería peor: el guard saldría rojo por algo ajeno a su ticket y el
 *     siguiente que lo viera lo apagaría, que es como muere un guard.
 *
 * ⚠️ LA EXCEPCIÓN ESTÁ ACOTADA AL PANEL A PROPÓSITO. Metida en la lista compartida excusaría
 * cualquier `.btn-sm` corto que apareciera MAÑANA en la landing, y eso sí sería bajar el umbral.
 *
 * QUIÉN LA RETIRA: el fundador, decidiendo qué hacer con `.btn-sm` (subirla a 44, o darle área con
 * un pseudo como se ha hecho aquí con la casilla). El día que se decida, esta lista se vacía.
 */
const EXCEPCIONES_PANEL = [
  { sel: 'BUTTON.btn-secondary.btn-sm', motivo: 'clase compartida `.btn-sm` (30 px de caja) — «Importar CSV», «Editar», «Portal». Pre-existente, medido 30,8–31,0 px. Lo retira el fundador al decidir sobre `.btn-sm`.' },
  { sel: 'BUTTON.btn-primary.btn-sm', motivo: 'clase compartida `.btn-sm` — el botón «Nuevo». Pre-existente, medido 31,0 px.' },
  { sel: 'BUTTON.btn-ghost.btn-sm', motivo: 'clase compartida `.btn-sm` — «📊 Historial». Pre-existente, medido 30,9 px.' },
];

// ═══ SCRUM-782 · SEGUNDA SUPERFICIE: EL PANEL (lista de Clientes) ═══════════════════════════
//
// A 929 y 390 px, que son los anchos con los que se midió el defecto. No se reutilizan los 1280 y
// 360 de la landing: 929 es donde el editor pasa a dos columnas y 390 es el móvil de referencia
// de esta casa, y son los que el ticket dejó medidos.
const ANCHOS_PANEL = [929, 390];
/** Por selector: si en ALGUNA anchura se queda corto, su excepción sigue haciendo falta. */
const vistosEnPanel = new Map();

if (!PANEL_HTML) {
  mal(`   🔴 CIEGO: no he podido montar la vista del panel (${PANEL.aviso}). `
    + 'El verde de la landing NO cubre esta superficie, así que esto no se traga.');
} else {
  for (const ancho of ANCHOS_PANEL) {
    const page = await navegador.newPage();
    await page.setViewport({ width: ancho, height: 900 });
    await page.goto(`http://127.0.0.1:${PUERTO}/__panel`, { waitUntil: 'load' });

    decir('\n════════════════════════════════════════════════════════════════════════════');
    decir(`PANEL · lista de Clientes · ANCHO ${ancho} px`);
    decir('════════════════════════════════════════════════════════════════════════════');

    const r = await page.evaluate(`${FUENTE_MEDIDOR};${MEDIDOR}(${JSON.stringify(INTERACTIVOS)}, ${MINIMO}, ${JSON.stringify([])}, true)`);

    decir(`① censo derivado · interactivos en el DOM: ${r.total}  ·  medidos: ${r.medidos.length}`
      + `  ·  sin pintar: ${r.sinPintar.length}  ·  presentes pero no tocables: ${r.noTocables.length}`);

    // ── SUELO ①: sin táctiles medidos no hay veredicto, hay ceguera.
    if (r.medidos.length === 0) {
      mal('   🔴 CIEGO: cero táctiles medidos en el panel. Eso no es «no hay defectos».');
      await page.close();
      continue;
    }

    // ── SUELO ②, EL QUE IMPORTA: las CASILLAS DE SELECCIÓN tienen que estar entre lo medido.
    // Es el suelo que faltaba antes de SCRUM-782: el selector no las veía y el guard habría dado
    // verde sin mirarlas. Si un día vuelven a desaparecer del censo, esto lo dice.
    const casillas = r.medidos.filter((m) => m.sel.startsWith('INPUT'));
    const MINIMO_CASILLAS = ancho === 390 ? 4 : 5;   // a 390 la cabecera va oculta (`thead:none`)
    if (casillas.length < MINIMO_CASILLAS) {
      mal(`   🔴 CIEGO: sólo ${casillas.length} casillas medidas y esperaba al menos `
        + `${MINIMO_CASILLAS}. O el selector volvió a dejarlas fuera, o la vista dejó de pintarlas: `
        + 'en los dos casos el verde de abajo no significa nada.');
    } else {
      decir(`   ✅ suelo: ${casillas.length} casillas de selección MEDIDAS (mínimo ${MINIMO_CASILLAS}).`);
    }

    if (r.noTocables.length) {
      decir('\n② presentes pero NO tocables (no son «pequeños»: ahí el dedo no los activa):');
      for (const m of r.noTocables) decir(`   · [${m.seccion}] ${m.sel} «${m.texto}» — caja ${m.caja}px — ${m.motivo}`);
    }

    const cortos = r.medidos.filter((m) => !m.cumple);
    const excusados = cortos.filter((m) => EXCEPCIONES_PANEL.some((e) => e.sel === m.sel));
    const culpables = cortos.filter((m) => !EXCEPCIONES_PANEL.some((e) => e.sel === m.sel));
    decir(`\n③ contra AB6 (${MINIMO} px) · cumplen: ${r.medidos.length - cortos.length}`
      + `  ·  se quedan cortos: ${cortos.length}  ·  de ésos, excusados con motivo: ${excusados.length}`);
    for (const m of culpables) {
      mal(`   ✖ ${m.tocable}px < ${MINIMO} · [${m.seccion}] ${m.sel} «${m.texto}» (caja CSS ${m.caja}px)`);
    }
    // Las excepciones se IMPRIMEN una a una: una deuda que no se ve por pantalla deja de existir.
    for (const m of excusados) {
      const e = EXCEPCIONES_PANEL.find((x) => x.sel === m.sel);
      decir(`   ⚠️ EXCEPCIÓN ${m.tocable}px · ${m.sel} «${m.texto}» — ${e.motivo}`);
    }
    // Se apuntan para el control de sobrantes, que va DESPUÉS del bucle (ver abajo).
    for (const m of r.medidos) {
      if (!vistosEnPanel.has(m.sel)) vistosEnPanel.set(m.sel, { corto: false });
      if (!m.cumple) vistosEnPanel.get(m.sel).corto = true;
    }
    if (!culpables.length) decir('   ✅ todo lo que se puede pulsar en el panel llega a 44 px (o está excusado con motivo).');

    await page.close();
  }
}

// ═══ SCRUM-791 · LAS DOS SUPERFICIES NUEVAS ══════════════════════════════════════════════════
//
// Bucle APARTE, y a propósito: el de Clientes y sus `EXCEPCIONES_PANEL` no se tocan. Lo que
// funciona sigue igual y esto se suma.
//
// 🔴 LAS EXCEPCIONES VAN ACOTADAS A SU SUPERFICIE. Metidas en la lista compartida excusarían el
// mismo selector en CUALQUIER pantalla —incluida una que aparezca mañana—, y eso no es declarar
// una deuda: es bajar el umbral. Cada superficie declara las suyas y responde de ellas.
const EXCEPCIONES_791 = {
  renderQuotesView: [
    { sel: 'BUTTON.btn-ghost.btn-sm', motivo: 'clase compartida `.btn-sm` (29,5–30,8 px) — «✨ Sugerir con IA», «+ Añadir descuento». Pre-existente. La retira el fundador al decidir sobre `.btn-sm` (SCRUM-787: 57 de los 76 son de esa clase).' },
    { sel: 'BUTTON.btn-ghost.btn-sm.quote-header-btn', motivo: 'clase compartida `.btn-sm` (30,8 px a 390) — «📋 Usar plantilla», «💾 Guardar como plantilla». Misma decisión que la anterior.' },
    { sel: 'BUTTON.btn.btn-primary', motivo: 'el BOTÓN BASE mide 36,8 px, no 44 — «Generar presupuesto». NO es `.btn-sm`: es el segundo grupo que destapó SCRUM-787 (14 de 76). Decisión propia del fundador, distinta de la de `.btn-sm`.' },
    // 🔴 SCRUM-794 · el motivo NOMBRABA DOS VÍCTIMAS y una ya no existe. El detector de sobrantes
    // de abajo mira el SELECTOR, no el motivo: como «Limpiar formulario» sigue midiendo 36,8 px,
    // la excepción sigue haciendo falta y NADA habría avisado de que su motivo señala a un botón
    // borrado. Es la misma avería que este fichero persigue —«una mentira con antigüedad»— por la
    // cara que el mecanismo no ve, así que se corrige a mano y se deja dicho.
    { sel: 'BUTTON.btn.btn-secondary', motivo: 'el BOTÓN BASE a 36,8 px — «Limpiar formulario». Mismo grupo que el anterior. (Hasta SCRUM-794 este motivo nombraba también «+ Añadir línea»: era el duplicado de la cabecera de «2. Líneas», y se borró. El que quedó mide 44,9 px y cumple.)' },
    { sel: 'INPUT', motivo: 'casillas del editor a 17,0 px de área de toque. TERCER grupo de SCRUM-787: no es cuestión de una clase compartida, sino de darles área en este sitio. Sin decidir.' },
  ],
  renderJobDetailView: [
    { sel: 'BUTTON.btn-ghost.btn-sm', motivo: 'clase compartida `.btn-sm` (30,9 px) — «Cambiar». Pre-existente; la retira el fundador con `.btn-sm`.' },
    { sel: 'BUTTON.btn-secondary.btn-sm', motivo: 'clase compartida `.btn-sm` (30,9 px) — «+ Nuevo albarán», «Parte de trabajo». Ídem.' },
    { sel: 'BUTTON.btn-primary', motivo: 'el BOTÓN BASE a 37,0 px — el CTA del héroe. Segundo grupo de SCRUM-787, decisión aparte de `.btn-sm`.' },
    { sel: 'BUTTON.detail-miga-link', motivo: '19,6 px de ÁREA DE TOQUE — la miga «Trabajos». Uno de los DOS PEORES del árbol, y su caja CSS no lo delata: es el ejemplo de por qué el árbitro es el área y no la caja. Sin decidir.' },
    { sel: 'INPUT', motivo: '14,0 px — la casilla de precios de la barra de documentos. EL PEOR del árbol entero, y en la pantalla que se usa de pie en obra. Sin decidir.' },
  ],
};

for (const s of SUPERFICIES_791) {
  if (!s.html) {
    mal(`   🔴 CIEGO: no he podido montar «${s.vista}» (${s.aviso}). No se cuenta como cero: `
      + 'esa superficie NO está medida.');
    continue;
  }
  const excs = EXCEPCIONES_791[s.vista] || [];
  const vistos = new Map();          // selector → { corto } — para el detector de sobrantes
  const distintos = new Set();       // sel|texto — para el suelo que reencuentra lo ya medido

  for (const ancho of ANCHOS_PANEL) {
    const page = await navegador.newPage();
    await page.setViewport({ width: ancho, height: 900 });

    // ✅ LA SONDA, superficie por superficie y anchura por anchura. Un objetivo de 12 px inyectado
    // TIENE que salir corto. La superficie que no lo caza NO está medida, aunque devuelva cero —
    // y un cero así parecería cobertura. La sonda vive en una página aparte servida en memoria:
    // no se toca ningún fichero del árbol.
    await page.goto(`http://127.0.0.1:${PUERTO}${s.ruta}__sonda`, { waitUntil: 'load' });
    const rs = await page.evaluate(`${FUENTE_MEDIDOR};${MEDIDOR}(${JSON.stringify(INTERACTIVOS)}, ${MINIMO}, ${JSON.stringify([])}, true)`);
    const sonda = rs.medidos.find((m) => m.sel === 'BUTTON' && m.texto === SONDA_TEXTO);
    if (!sonda) {
      mal(`   🔴 SUPERFICIE NO MEDIDA · ${s.vista} @${ancho}px: la sonda de 12 px ni siquiera se ha `
        + 'medido. Todo lo que diga esta superficie es ceguera.');
    } else if (sonda.cumple) {
      mal(`   🔴 SUPERFICIE NO MEDIDA · ${s.vista} @${ancho}px: la sonda de 12 px sale como que `
        + `CUMPLE los ${MINIMO} px. El medidor no está midiendo lo que cree.`);
    }

    await page.goto(`http://127.0.0.1:${PUERTO}${s.ruta}`, { waitUntil: 'load' });
    const r = await page.evaluate(`${FUENTE_MEDIDOR};${MEDIDOR}(${JSON.stringify(INTERACTIVOS)}, ${MINIMO}, ${JSON.stringify([])}, true)`);

    decir('\n════════════════════════════════════════════════════════════════════════════');
    decir(`PANEL · ${s.titulo} (${s.vista}) · ANCHO ${ancho} px`);
    decir('════════════════════════════════════════════════════════════════════════════');
    decir(`① censo derivado · interactivos en el DOM: ${r.total}  ·  medidos: ${r.medidos.length}`
      + `  ·  sin pintar: ${r.sinPintar.length}  ·  presentes pero no tocables: ${r.noTocables.length}`
      + `  ·  sonda: ${sonda ? (sonda.cumple ? '🔴 NO cazada' : '✅ cazada') : '🔴 ausente'}`);

    if (r.medidos.length === 0) {
      mal(`   🔴 CIEGO: cero táctiles medidos en ${s.vista}. Eso no es «no hay defectos».`);
      await page.close();
      continue;
    }
    if (r.noTocables.length) {
      decir('\n② presentes pero NO tocables (no son «pequeños»: ahí el dedo no los activa):');
      for (const m of r.noTocables) decir(`   · [${m.seccion}] ${m.sel} «${m.texto}» — caja ${m.caja}px — ${m.motivo}`);
    }

    const cortos = r.medidos.filter((m) => !m.cumple);
    for (const m of cortos) distintos.add(`${m.sel}|${m.texto}`);
    const excusados = cortos.filter((m) => excs.some((e) => e.sel === m.sel));
    const culpables = cortos.filter((m) => !excs.some((e) => e.sel === m.sel));
    decir(`\n③ contra AB6 (${MINIMO} px) · cumplen: ${r.medidos.length - cortos.length}`
      + `  ·  se quedan cortos: ${cortos.length}  ·  de ésos, excusados con motivo: ${excusados.length}`);
    for (const m of culpables) {
      mal(`   ✖ ${m.tocable}px < ${MINIMO} · [${m.seccion}] ${m.sel} «${m.texto}» (caja CSS ${m.caja}px)`);
    }
    for (const m of excusados) {
      const e = excs.find((x) => x.sel === m.sel);
      decir(`   ⚠️ EXCEPCIÓN ${m.tocable}px · ${m.sel} «${m.texto}» — ${e.motivo}`);
    }
    for (const m of r.medidos) {
      if (!vistos.has(m.sel)) vistos.set(m.sel, { corto: false });
      if (!m.cumple) vistos.get(m.sel).corto = true;
    }
    if (!culpables.length) decir(`   ✅ todo lo pulsable de ${s.titulo} llega a 44 px (o está excusado con motivo).`);
    await page.close();
  }

  // 🔴 EL SUELO QUE DECIDE: el guard tiene que REENCONTRAR lo que ya midió el censo de SCRUM-787.
  // Si encuentra MENOS, ha entrado ciego — y ése es el peor resultado posible, porque la
  // superficie PARECERÍA cubierta. Se cuentan elementos DISTINTOS (selector + texto), no
  // mediciones: el mismo botón medido a dos anchuras es UNO, y confundirlo fue el error del dato
  // de partida de SCRUM-787 (los «13» de Clientes eran 11 sumados dos veces).
  if (distintos.size < s.distintosEsperados) {
    mal(`   🔴 CIEGO · ${s.vista}: he encontrado ${distintos.size} objetivos cortos DISTINTOS y el `
      + `censo de SCRUM-787 midió ${s.distintosEsperados}. Faltan ${s.distintosEsperados - distintos.size}: `
      + 'o la vista ya no pinta lo mismo con estos datos, o el censo dejó de verlos. Un verde aquí '
      + 'diría que la pantalla está cubierta cuando no lo está.');
  } else {
    decir(`\n   ✅ suelo de ${s.vista}: ${distintos.size} objetivos cortos DISTINTOS `
      + `(el censo de SCRUM-787 midió ${s.distintosEsperados}).`);
  }

  // Y el detector de sobrantes, ACOTADO a esta superficie y SOBRE LAS DOS ANCHURAS — que es la
  // corrección que ya costó un falso rojo en Clientes: `BUTTON.btn-ghost.btn-sm` cumple a 390 y no
  // a 929, así que una excepción sólo sobra cuando ya no hace falta EN NINGUNA.
  for (const e of excs) {
    const v = vistos.get(e.sel);
    if (!v) {
      mal(`   🔴 EXCEPCIÓN CADUCA · ${s.vista}: \`${e.sel}\` ya no aparece en esa pantalla. Bórrala.`);
    } else if (!v.corto) {
      mal(`   🔴 EXCEPCIÓN SOBRANTE · ${s.vista}: \`${e.sel}\` cumple los ${MINIMO} px en TODAS las `
        + 'anchuras medidas. Bórrala: mientras esté, ese objetivo no está vigilado.');
    }
  }
}

// 🔴 UNA EXCEPCIÓN QUE YA NO HACE FALTA ES UNA MENTIRA CON ANTIGÜEDAD: si alguien arregla
// `.btn-sm` y nadie limpia la lista, el guard deja de vigilar esos botones para siempre.
//
// ⚠️ SE COMPRUEBA SOBRE LAS DOS ANCHURAS, NO DENTRO DEL BUCLE. La primera versión lo hacía por
// anchura y saltó en falso: `BUTTON.btn-ghost.btn-sm` cumple a 390 px —la tabla apila y el botón
// gana sitio— y NO cumple a 929. Una excepción sólo sobra cuando ya no hace falta EN NINGUNA.
for (const e of EXCEPCIONES_PANEL) {
  const v = vistosEnPanel.get(e.sel);
  if (!v) {
    mal(`   🔴 EXCEPCIÓN CADUCA: \`${e.sel}\` ya no aparece en el panel. Bórrala: una excepción `
      + 'para algo que no existe es ruido que tapa a la siguiente.');
  } else if (!v.corto) {
    mal(`   🔴 EXCEPCIÓN SOBRANTE: \`${e.sel}\` cumple los ${MINIMO} px en TODAS las anchuras `
      + 'medidas. Bórrala de EXCEPCIONES_PANEL: mientras esté, ese botón no está vigilado.');
  }
}

await navegador.close();
srv.close();

decir('\n' + '─'.repeat(76));
if (fallos) {
  console.error(`🔴 SCRUM-542 · ${fallos} problema(s). AB6 no se baja: si algún caso no puede llegar a `
    + `${MINIMO} px, va a EXCEPCIONES con su motivo y quién la retira.`);
  process.exit(1);
}
// El mensaje final NOMBRA LAS CUATRO. Un «todo bien» que no dice de qué es cómo este guard
// empezó: se llamaba «objetivo-tactil» y sólo miraba la landing (SCRUM-782).
decir('✅ objetivos de toque: todos llegan a los 44 px de AB6 (o están excusados con motivo) — '
  + 'LANDING (1280 y 360) · PANEL/clientes, editor de presupuesto y ficha de Trabajo (929 y 390). '
  + 'SCRUM-542 + SCRUM-782 + SCRUM-791. Las otras 16 vistas del panel NO se vigilan aquí: están '
  + 'medidas en `npm run censo:tactil-panel` (SCRUM-787).');
