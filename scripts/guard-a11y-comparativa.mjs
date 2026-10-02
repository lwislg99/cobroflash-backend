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
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';
import { veredictoDe, recorrerCasos } from './_hallazgos-y-ciegos.mjs';
// SCRUM-522 · la ruta ya no se escribe aqui. Era una ruta de WINDOWS por defecto, identica en
// los nueve guards, y por eso ninguno podia correr en el runner de CI —Ubuntu— donde de verdad
// hacen falta. `rutaDelNavegador` busca en los sitios conocidos y, si no hay ninguno, PARA
// declarandose ciega en vez de devolver una ruta plausible. `EDGE_PATH` sigue mandando.
// SCRUM-620 (2/2) · PUERTO EFÍMERO POR DEFECTO. `0` le pide al sistema uno libre, y el que
// toca de verdad se lee del `levantarServidor`. Quita las colisiones de raíz: contra la pasada
// anterior del propio guard (sockets en TIME_WAIT, el caso de SCRUM-617) y contra los otros.
// ⚠️ `A11Y_PUERTO` SIGUE MANDANDO: quien quiera fijarlo, lo fija — y si ese puerto está ocupado, el
// diagnóstico del commit anterior sigue diciéndolo con su código 4. El efímero es HIGIENE;
// no sustituye al diagnóstico, y por eso entró después y en un commit propio.
let PUERTO = Number(process.env.A11Y_PUERTO || 0);

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

/**
 * 🔴 CÓMO SE MIDE «LO QUE SE OYE», Y POR QUÉ NO SE CONCATENA A MANO (SCRUM-550).
 *
 * Este guard nació concatenando el árbol a mano, y ESO SE VEÍA EN SU PROPIA SALIDA sin abrir el
 * código: «TU MÉTODO ACTUAL TU MÉTODO ACTUAL Tu palabra contra la suya. Tu palabra contra la
 * suya.» — cada texto DUPLICADO. Con `interestingOnly:false` el árbol trae el nodo genérico Y su
 * hijo de texto con el mismo contenido, así que se contaba dos veces; y, peor, el espacio que
 * metía el `join` entre padre e hijo **creaba la separación que este guard tiene que comprobar**.
 * Medía su propio separador: un ruido con forma de verde.
 *
 * (En SCRUM-543 se probó también la variante opuesta —unir sólo las hojas SIN separador— y da
 * ROJO PERMANENTE, porque el `name` de cada hoja viene ya recortado. Las dos formas de
 * concatenar a mano están medidas y las dos están mal.)
 *
 * Lo que se oye lo decide el algoritmo **accname** del navegador, que es el que une los nodos. Se
 * le pide a él: se le pone al nodo un rol que EXIGE nombre por contenido, se lee ese nombre y se
 * le quita el rol. Sobre la PÁGINA CARGADA, nunca sobre el fichero.
 *
 * Copiado de `scripts/guard-a11y-landing.mjs` (SCRUM-543), donde ya está probado.
 * ⚠️ DEUDA DECLARADA: cuando 543 esté en main habrá dos copias de este medidor y del arranque de
 * Edge. Unificarlas es su propio ticket; duplicar aquí es mejor que importar de una rama abierta.
 */
async function loQueSeOye(page, indiceCelda) {
  const marca = (n, poner) => page.evaluate(([i, p]) => {
    const el = document.querySelectorAll('.cmp-cell')[i];
    if (el) p ? el.setAttribute('role', 'button') : el.removeAttribute('role');
  }, [n, poner]);
  await marca(indiceCelda, true);
  const nodo = (await page.$$('.cmp-cell'))[indiceCelda];
  const snap = nodo ? await page.accessibility.snapshot({ root: nodo }) : null;
  await marca(indiceCelda, false);
  return (snap?.name || '').trim();
}

/**
 * CALIBRACIÓN del medidor, con dos casos sintéticos de respuesta CONOCIDA y el mismo patrón que
 * las celdas: un `<span>` en `display:block` y texto. Con espacio tiene que dar «uno dos»; sin
 * espacio, TAMBIÉN «uno dos» — porque un elemento en block ya separa por sí solo, que es
 * justamente lo que hace inerte al separador de las celdas (medido en SCRUM-546).
 * Lo que se exige aquí es que el medidor SEPA LEER: si devolviera vacío, no hay veredicto.
 */
async function calibrar(page) {
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = 'cal-550'; d.setAttribute('role', 'button');
    d.innerHTML = '<span style="display:block">uno</span>dos';
    document.body.appendChild(d);
  });
  const n = await page.$('#cal-550');
  const nombre = ((await page.accessibility.snapshot({ root: n }))?.name || '').trim();
  await page.evaluate(() => document.querySelector('#cal-550')?.remove());
  return { ok: nombre === 'uno dos', nombre };
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

function celdaLlegaConSuEtiqueta(t, textoCelda, etiqueta) {
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

// ── SCRUM-1336 · «NO SUPE MIRAR» NO ES «HE MIRADO Y ESTÁ MAL» ────────────────────────────────
// Aquí había UNA cuenta (`fallos`) para las dos cosas, y un «NO SUPE MIRAR» salía con el mismo 1
// que una celda sin su columna. Visto correr (docs/master/evidencias/scrum1336/): sin la sección en
// la página, en los dos anchos, salía 1 y decía «2 problema(s)». Quien lo viera buscaba una celda
// mal etiquetada donde sólo había un guard que no encontró qué medir.
// Ahora son dos listas y el código lo da `veredictoDe`: 1 si hay hallazgos, 2 si sólo hay ciegos.
// Van en el módulo y no dentro de cada ancho a propósito: si un ancho LANZA a mitad, lo que ya
// había encontrado no se pierde.
const hallazgos = [];
const ciegos = [];
const hallazgo = (texto) => { console.error(texto); hallazgos.push(texto); };
const noSupeMirar = (texto) => { console.error(texto); ciegos.push(texto); };
/** Lo que devuelve cada ancho a `recorrerCasos`: sus cuentas ya están apuntadas arriba. */
const YA_APUNTADO = Object.freeze({ hallazgos: Object.freeze([]), ciegos: Object.freeze([]) });

const srv = servidor();
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
// La comprobación de existencia que había aquí SALE: era una segunda copia del suelo, y el
// módulo común ya para con 2 si no hay navegador. Dos sitios comprobando lo mismo divergen.
process.on('exit', () => { try { srv.close(); } catch { /* ya cerrado */ } });
const navegador = await lanzarNavegador(puppeteer, { headless: 'new' });

try {
  log('Guard de accesibilidad de la comparativa (SCRUM-541)');
  log('Árbitro: el árbol de accesibilidad renderizado, no el marcado.\n');

  // `recorrerCasos` y no un `for`: un ancho que lanza es un ciego de ESE ancho, y el otro se mide igual.
  const recorrido = await recorrerCasos(ANCHOS, async (ancho) => {
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
      noSupeMirar(`🔴 NO SUPE MIRAR a ${ancho}px: no encuentro la sección #comparativa ni sus filas.`);
      await page.close(); return YA_APUNTADO;
    }
    // ── SUELO ②: ¿se aplicó el CSS? El grid tiene que EXISTIR a 1280 y NO existir a 360.
    const hayGrid = estado.grid !== 'none' && estado.grid.split(' ').length === 3;
    if (ancho >= 641 && !hayGrid) {
      noSupeMirar(`🔴 NO SUPE MIRAR a ${ancho}px: se esperaba grid de 3 columnas y llegó «${estado.grid}». ¿Se sirvió el CSS?`);
      await page.close(); return YA_APUNTADO;
    }
    if (ancho < 641 && hayGrid) {
      noSupeMirar(`🔴 NO SUPE MIRAR a ${ancho}px: NO debería haber grid y llegó «${estado.grid}».`);
      await page.close(); return YA_APUNTADO;
    }

    // ── SUELO ③ · CALIBRACIÓN: ¿el medidor SABE LEER? ────────────────────────
    // Si `accname` devolviera vacío, todas las celdas saldrían «no aparecen en el árbol» y eso se
    // leería como un defecto de la página en vez de como un medidor mudo.
    const cal = await calibrar(page);
    if (!cal.ok) {
      noSupeMirar(`🔴 NO SUPE MIRAR a ${ancho}px: la calibración devolvió «${cal.nombre}» y se esperaba «uno dos».`);
      await page.close(); return YA_APUNTADO;
    }

    // Lo que se oye de cada celda, preguntándoselo al algoritmo accname del navegador.
    const seOyen = [];
    for (let i = 0; i < estado.celdas.length; i++) seOyen.push(await loQueSeOye(page, i));

    // ── SUELO ④ · CONTROL NEGATIVO: el detector tiene que saber decir que NO. ──
    // Se le da lo que se oye en una celda REAL y una etiqueta que NO está en ella. Si dice que
    // sí, el verde de abajo no valdría nada y es preferible no dar veredicto.
    const prueba = celdaLlegaConSuEtiqueta(seOyen[0], estado.celdas[0].texto, 'ETIQUETA QUE NO EXISTE');
    if (prueba.ok) {
      noSupeMirar(`🔴 NO SUPE MIRAR a ${ancho}px: el detector aprueba una etiqueta INVENTADA. No sabe fallar.`);
      await page.close(); return YA_APUNTADO;
    }
    // ── SUELO ⑤: y tiene que saber decir que SÍ cuando el texto está. Sin este control
    // positivo, un detector que devolviera siempre `false` pasaría el ④ y parecería riguroso.
    const pruebaSi = celdaLlegaConSuEtiqueta(seOyen[0], estado.celdas[0].texto, estado.celdas[0].texto.slice(0, 10));
    if (!pruebaSi.ok && !pruebaSi.motivo.includes('PEGADA')) {
      noSupeMirar(`🔴 NO SUPE MIRAR a ${ancho}px: el detector rechaza algo que SÍ está en la celda. Sólo sabe decir que no.`);
      await page.close(); return YA_APUNTADO;
    }

    log(`── ${ancho}px · ${estado.filas} filas · grid: ${hayGrid ? estado.grid : 'no hay (apilado)'}`);
    log(`   calibración «${cal.nombre}» · el detector rechaza una etiqueta inventada y acepta la que sí está`);

    let okAncho = 0, ejemplo = '';
    for (let i = 0; i < estado.celdas.length; i++) {
      const celda = estado.celdas[i];
      const etiqueta = COLUMNAS[celda.columna];
      const r = celdaLlegaConSuEtiqueta(seOyen[i], celda.texto, etiqueta);
      if (r.ok) { okAncho++; if (!ejemplo) ejemplo = r.seOye; }
      else hallazgo(`   ✖ @${ancho}px · fila "${celda.fila}" · columna «${etiqueta}» → ${r.motivo}`);
    }
    log(`   ✔ ${okAncho}/${estado.celdas.length} celdas llegan con su etiqueta de columna asociada`);
    if (ejemplo) log(`     se oye: «${ejemplo}»`);
    log('');
    await page.close();
    return YA_APUNTADO;
  }, (ancho) => `${ancho}px`);
  // Lo que apunta el propio recorrido: un ancho que LANZÓ, o que no se recorrió ninguno.
  for (const c of recorrido.ciegos) noSupeMirar(`🔴 NO SUPE MIRAR a ${c}`);
} finally {
  await navegador.close();
  srv.close();
}

const veredictoFinal = veredictoDe({ hallazgos, ciegos });
if (veredictoFinal.codigo !== 0) {
  if (hallazgos.length) console.error(`\n🔴 ${hallazgos.length} celda(s) mal. En una comparativa, una celda sin su columna no confunde: INVIERTE el mensaje.`);
  if (ciegos.length) console.error(`\n🔴 NO SUPE MIRAR ${ciegos.length} vez/veces: de eso no se da veredicto, ni bueno ni malo.`);
  console.error(veredictoFinal.linea);
  process.exit(veredictoFinal.codigo);
}
console.log('✓ En los dos anchos, cada celda llega con su etiqueta de columna asociada.');
// La línea de las dos cuentas sale SIEMPRE, también en verde: si sólo saliera con algo que contar,
// que no esté no distinguiría «0 hallazgos · 0 ciegos» de «nadie llegó a contar».
console.log(veredictoFinal.linea);
