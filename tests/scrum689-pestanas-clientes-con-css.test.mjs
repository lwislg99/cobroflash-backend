// tests/scrum689-pestanas-clientes-con-css.test.mjs — SCRUM-689
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS PESTAÑAS DE CLIENTES ESTABAN SIN UNA SOLA REGLA DE CSS, Y ESO SE VE
//
// Todos | Empresas | Personas entraron con el PR #874 (`ac69385e`). Medido el 2-sep-2026:
// **cero apariciones de `.customers-tabs` y `.customers-tab` en todo `public/`** salvo el marcado
// que las pinta. El profesional abría su lista de clientes y veía tres botones crudos del
// navegador dentro de una barra que sí estaba estilada — un control que parece roto. No era una
// regresión que evitar: era un defecto en producción.
//
// ── POR QUÉ ESTE FICHERO NO CUENTA «QUE EXISTA LA CLASE» ─────────────────────────────────
// Una clase en el CSS y una clase que APLICA a lo que se pinta son dos cosas. Aquí se atan las
// dos puntas: el marcado que las usa (`customersView.js`) y las reglas que las visten
// (`styles.css`), leídas de las hojas que el índice CARGA de verdad — no de un fichero elegido a
// mano, que es como un censo acaba mirando donde no es.
//
//   ① SUELO             — si no se encuentran hojas o reglas, CIEGO. Cero es el defecto de ayer;
//                         el mismo cero hoy significaría que el censo no sabe leer CSS.
//   ② CONTROL POSITIVO  — una clase que YA estaba estilada (`.segmented`) tiene que salir también.
//   ③ EL CENSO          — `.customers-tabs` y `.customers-tab` tienen reglas, y aplican.
//   ④ LO QUE EXIGE AB6  — objetivo táctil, foco visible, activo por MÁS de una señal.
//   ⑤ CONTROL NEGATIVO  — tocar un comentario del CSS no tumba nada.
//
// Sin gate: lee ficheros. Ni BD, ni red, ni navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hojasDelDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = 'public/dashboard/js/customersView.js';

/** El CSS de las hojas que el índice carga, concatenado. Una sola lectura para todo el fichero. */
function cssDelDashboard() {
  return hojasDelDashboard(RAIZ).map((h) => fs.readFileSync(h, 'utf8')).join('\n');
}

/**
 * Las reglas cuyo SELECTOR menciona la clase, con su cuerpo. PURA sobre el CSS que recibe, para
 * que los controles se ejerciten con corpus sintético.
 *
 * 🔴 SE QUITAN LOS COMENTARIOS ANTES DE MIRAR. Este mismo fichero y el bloque de `styles.css`
 * nombran las clases en prosa para explicar por qué existen; contarlas sería contar la
 * documentación como si fuera diseño — y entonces borrar todo el CSS y dejar el comentario
 * pasaría en verde.
 */
export function reglasDe(css, clase) {
  const limpio = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  const fuera = [];
  for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    // La clase, como palabra entera: `.customers-tab` no puede casar con `.customers-tabs`.
    if (new RegExp(`\\${clase}(?![\\w-])`).test(selector)) {
      fuera.push({ selector, cuerpo: m[2].trim() });
    }
  }
  return fuera;
}

// ═══ ① SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-689 · 🔴 SUELO: el censo encuentra las hojas del índice y LEE reglas', () => {
  const hojas = hojasDelDashboard(RAIZ);
  assert.ok(hojas.length >= 2,
    `🔴 CENSO CIEGO: sólo ${hojas.length} hoja(s) local(es). El índice carga tokens.css y ` +
    'css/styles.css; si esto se queda corto, todo lo de abajo mira un CSS que no es el que ve ' +
    'el profesional.');
  for (const h of hojas) {
    assert.ok(fs.existsSync(h), `🔴 el índice declara una hoja que NO existe en el árbol: ${h}`);
  }
  const css = cssDelDashboard();
  assert.ok(css.length > 5000,
    `🔴 CENSO CIEGO: sólo ${css.length} bytes de CSS. «No hay reglas» y «no supe leerlas» son el ` +
    'mismo cero con significados opuestos, y este ticket nace justo de un cero.');
});

// ═══ ② CONTROL POSITIVO — sin esto, un cero no distingue «no hay CSS» de «no encuentro nada» ═══

test('SCRUM-689 · 🔴 CONTROL POSITIVO: una clase YA estilada sale en el censo', () => {
  // `.segmented` es el control «uno de N» que ya estaba en el sistema, y del que estas pestañas
  // heredan el lenguaje. Si el censo no lo viera, su veredicto sobre `.customers-tab` no
  // significaría nada: estaría diciendo «no hay CSS» cuando lo que pasa es que no sabe mirar.
  const css = cssDelDashboard();
  const yaEstilada = reglasDe(css, '.segmented-option');
  assert.ok(yaEstilada.length > 0,
    '🔴 EL CENSO NO VE UNA CLASE QUE SÍ ESTÁ ESTILADA (`.segmented-option`). No puede opinar ' +
    'sobre ninguna otra: un cero suyo sería ceguera, no un hallazgo.');
  assert.ok(yaEstilada.some((r) => /min-height/.test(r.cuerpo)),
    '🔴 el censo encuentra el selector pero no lee su cuerpo: entonces no puede comprobar nada ' +
    'de lo que hay dentro.');
});

// ═══ ③ EL CENSO — las dos puntas atadas ══════════════════════════════════════════════════

test('SCRUM-689 · el marcado usa las dos clases (si no, no hay nada que estilar)', () => {
  const vista = fs.readFileSync(path.join(RAIZ, VISTA), 'utf8');
  assert.match(vista, /createElement\("div", "customers-tabs"\)/,
    '🔴 la barra ya no se pinta con `customers-tabs`: el CSS de este ticket quedaría huérfano y ' +
    'las pestañas volverían a verse crudas, sin que nada fallara.');
  assert.match(vista, /className = "customers-tab"/,
    '🔴 las pestañas ya no se pintan con `customers-tab`.');
  assert.match(vista, /aria-pressed/,
    '🔴 el marcado ya no anuncia cuál está activa. `aria-pressed` es lo que lee el lector de ' +
    'pantalla Y el gancho del que cuelga el estilo del activo: sin él se pierden las dos cosas.');
});

test('SCRUM-689 · 🔴 las dos clases TIENEN reglas — el cero de ayer era el defecto', () => {
  const css = cssDelDashboard();
  for (const clase of ['.customers-tabs', '.customers-tab']) {
    const reglas = reglasDe(css, clase);
    assert.ok(reglas.length > 0,
      `🔴 «${clase}» NO TIENE NI UNA REGLA DE CSS. Es el defecto que este ticket vino a corregir: ` +
      'el profesional ve un control crudo del navegador dentro de una barra estilada, y parece roto.');
  }
});

// ═══ ④ LO QUE EXIGE EL CHECKLIST AB6 ═════════════════════════════════════════════════════

test('SCRUM-689 · el objetivo táctil llega a 44 px (AB6)', () => {
  const base = reglasDe(cssDelDashboard(), '.customers-tab')
    .find((r) => r.selector === '.customers-tab');
  assert.ok(base, '🔴 no hay regla base para `.customers-tab`.');
  assert.match(base.cuerpo, /min-height:\s*44px/,
    '🔴 la pestaña no llega a 44 px de alto. Es donde el profesional pulsa con el pulgar, en obra ' +
    'y con guantes: por debajo de eso se falla el toque y se cambia de pestaña sin querer.');
});

test('SCRUM-689 · 🔴 el ACTIVO no se distingue sólo por el tono', () => {
  // El encargo lo pide con esas palabras, y es de AB6: quien no distinga el color tiene que poder
  // ver cuál está seleccionada. Se exigen al menos DOS señales además del color de texto.
  const activo = reglasDe(cssDelDashboard(), '.customers-tab')
    .filter((r) => /aria-pressed="true"/.test(r.selector));
  assert.ok(activo.length > 0,
    '🔴 no hay regla para el estado activo. Las tres pestañas se verían iguales y el profesional ' +
    'no sabría cuál está mirando — que es peor que no tener pestañas.');

  const cuerpo = activo.map((r) => r.cuerpo).join(' ');
  // 🔴 SE EXIGEN TRES ADEMÁS DE LA TINTA, y el número sale de una medición en navegador: el FONDO
  // del activo contra la barra da **1,07:1** (`--surface` #ffffff sobre `--bg` #f6f7f5 son casi el
  // mismo color). Con el fondo solo, quien no distinga el tono no ve cuál está seleccionada. Por
  // eso van también BORDE (forma) y ELEVACIÓN.
  const senales = ['background', 'border-color', 'box-shadow'].filter((p) => new RegExp(`${p}\\s*:`).test(cuerpo));
  assert.deepEqual(senales, ['background', 'border-color', 'box-shadow'],
    '🔴 el activo se distingue con MENOS señales de las necesarias. El fondo por sí solo da 1,07:1 ' +
    'contra la barra —medido—, así que hacen falta además borde y elevación, que se ven sin ' +
    `distinguir un color. Encontradas: ${senales.join(', ') || 'ninguna'}.`);
});

test('SCRUM-689 · el foco del teclado deja rastro visible, y con el token de Foco', () => {
  const foco = reglasDe(cssDelDashboard(), '.customers-tab')
    .filter((r) => /focus-visible/.test(r.selector));
  assert.ok(foco.length > 0,
    '🔴 no hay `:focus-visible`. A un `<button>` sin borde se le quita el rastro del navegador y, ' +
    'sin esto, quien navega con teclado no sabe dónde está.');
  assert.match(foco.map((r) => r.cuerpo).join(' '), /var\(--ring\)/,
    '🔴 el anillo de foco no usa `--ring`. Los colores no se eligen a ojo: salen de DESIGN.md.');
});

test('SCRUM-689 · 🔴 MÓVIL: la barra no puede empujar la página a lo ancho', () => {
  const barra = reglasDe(cssDelDashboard(), '.customers-tabs')
    .find((r) => r.selector === '.customers-tabs');
  assert.ok(barra, '🔴 no hay regla base para `.customers-tabs`.');
  assert.match(barra.cuerpo, /overflow-x:\s*auto/,
    '🔴 la barra no scrollea por dentro. Hoy cada rótulo sale como «[PENDIENTE microcopy oficial] ' +
    'Empresas» —37 caracteres— porque su copy aún no está aplicada: sin esto, tres de ésos ' +
    'empujan la vista entera y el profesional scrollea su lista en horizontal.');

  const tab = reglasDe(cssDelDashboard(), '.customers-tab').find((r) => r.selector === '.customers-tab');
  // 🔴 `max-content`, NO `0`. Y esto lo corrigió una CAPTURA, no el CSS: con `min-width: 0` los
  // botones se aplastaban por debajo de su texto y el rótulo SE SOLAPABA con el de al lado — se
  // veía peor que sin estilar, que era justo el defecto a corregir. Medido en navegador a 360 px.
  assert.match(tab.cuerpo, /min-width:\s*max-content/,
    '🔴 la pestaña puede encogerse por debajo de su texto. Con rótulos largos —hoy salen como ' +
    '«[PENDIENTE microcopy oficial] Empresas»— el texto se solapa con el de la pestaña vecina en ' +
    'vez de scrollear. Un control ilegible es peor que uno sin estilar.');
  assert.match(tab.cuerpo, /white-space:\s*nowrap/,
    '🔴 el rótulo se puede partir en dos líneas, y entonces las tres pestañas quedan a distinta ' +
    'altura y la barra se descuadra.');
});

test('SCRUM-689 · los colores salen de los TOKENS, no elegidos a ojo', () => {
  const reglas = [...reglasDe(cssDelDashboard(), '.customers-tabs'), ...reglasDe(cssDelDashboard(), '.customers-tab')];
  const cuerpos = reglas.map((r) => r.cuerpo).join(' ');
  // Ningún color literal: ni hex, ni rgb(), ni nombres de color.
  const literales = [...cuerpos.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g)].map((m) => m[0]);
  assert.deepEqual(literales, [],
    '🔴 HAY COLORES LITERALES EN LAS PESTAÑAS:\n    ' + literales.join('\n    ') +
    '\n\n  `DESIGN.md` es la única fuente de tokens (regla del máster, Parte AB). Un valor suelto ' +
    'que «se ve bien en mi pantalla» es deuda con apariencia de arreglo: el día que cambie la ' +
    'paleta, este control se queda con el color viejo y nadie se entera.');
  assert.match(cuerpos, /var\(--/, '🔴 SUELO: no se usa ni un token — el detector miraría en vacío.');
});

// ═══ ⑤ CONTROL NEGATIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-689 · 🔴 NEGATIVO: tocar un COMENTARIO del CSS no tumba nada', () => {
  // Si un comentario contara como regla, bastaría con nombrar la clase en prosa para que el censo
  // diera verde sobre un control sin estilar — y este fichero mismo la nombra muchas veces.
  const conRegla = '.customers-tab { color: var(--muted); }';
  const soloComentario = '/* .customers-tab: pendiente de estilar, ver SCRUM-689 */';

  assert.equal(reglasDe(conRegla, '.customers-tab').length, 1,
    '🔴 SUELO del negativo: el detector no ve una regla de verdad.');
  assert.equal(reglasDe(soloComentario, '.customers-tab').length, 0,
    '🔴 un COMENTARIO que nombra la clase se está contando como CSS. Con eso, borrar el estilo y ' +
    'dejar la explicación pasaría en verde.');

  // Y el caso real: añadirle un comentario al CSS bueno no cambia el veredicto.
  assert.equal(reglasDe(conRegla + '\n' + soloComentario, '.customers-tab').length, 1,
    '🔴 añadir un comentario ha cambiado el recuento de reglas.');
});

test('SCRUM-689 · 🔴 NEGATIVO: `.customers-tab` no casa con `.customers-tabs`', () => {
  // Son dos clases distintas y una es prefijo de la otra. Si el detector confundiera una con otra,
  // estilar sólo la barra haría creer que las pestañas también están hechas.
  const soloBarra = '.customers-tabs { display: flex; }';
  assert.equal(reglasDe(soloBarra, '.customers-tab').length, 0,
    '🔴 `.customers-tab` está casando con `.customers-tabs`. Con eso, estilar sólo la barra daría ' +
    'por bueno un control sin pestañas estiladas — el defecto de este ticket, otra vez.');
  assert.equal(reglasDe(soloBarra, '.customers-tabs').length, 1);
});
