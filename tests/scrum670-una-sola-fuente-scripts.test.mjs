// SCRUM-670 · TRES REGEX LEÍAN EL MISMO ÍNDICE Y COINCIDÍAN POR CASUALIDAD.
//
// Sin gate: lee el índice y funciones puras. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE HABÍA, CON FICHERO Y LÍNEA
//
//   dashboard-colision-declaraciones.test.mjs:40  /<script src="\.\/js\/([^"]+)"><\/script>/g
//   _banco-vistas.mjs:323                         /<script src="\.\/([^"]+)"><\/script>/g
//   scrum274-shell-alineado.test.mjs:115          /<script[^>]+src\s*=\s*"([^"]+)"/gi
//   (y una cuarta que solo contaba: scrum274-huella-estaticos.test.mjs:56)
//
// Las dos primeras exigen que el `src` sea LO PRIMERO y que `</script>` vaya PEGADO. La tercera
// admite atributos antes del `src` y no mira el cierre. Sobre el índice de hoy las cuatro
// devuelven 71 — y de ahí la falsa tranquilidad: **coinciden porque hoy todas las etiquetas están
// escritas igual**, no porque estén de acuerdo en qué es un script.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 Y LO QUE SE ROMPE NO ES UN NÚMERO
//
// Si alguien escribe `<script src="./js/x.js" defer></script>` —que es HTML correcto y de lo más
// normal—, el guard de colisiones DEJA DE PARSEAR ese fichero y sigue diciendo «cero colisiones»,
// mientras el del service worker sí lo exige en el precache. Dos guards, dos poblaciones, ninguna
// señal.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  etiquetasScript, srcsDelIndice, srcsLocales, nombresDelDashboard, scriptsDelIndiceOFalla,
} from './_scripts-del-indice.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(RAIZ, 'public/dashboard/index.html');
const html = () => fs.readFileSync(INDEX, 'utf8');

/**
 * Las tres regex de antes, COPIADAS TAL CUAL, para poder demostrar la divergencia con el caso
 * real en vez de contarla. No se usan en producción: viven aquí como el «antes» del ticket.
 */
const REGEX_DE_ANTES = [
  { quien: 'dashboard-colision:40', leer: (h) => [...h.matchAll(/<script src="\.\/js\/([^"]+)"><\/script>/g)].map((m) => m[1]) },
  { quien: '_banco-vistas:323', leer: (h) => [...h.matchAll(/<script src="\.\/([^"]+)"><\/script>/g)].map((m) => m[1]) },
  { quien: 'scrum274-shell:115', leer: (h) => [...h.matchAll(/<script[^>]+src\s*=\s*"([^"]+)"/gi)].map((m) => m[1]) },
];

/** El caso real, escrito como lo escribiría cualquiera. */
const ANCLA = '  <script src="./js/quoteApartados.js"></script>';
const CON_DEFER = ANCLA + '\n  <script src="./js/pruebaDefer.js" defer></script>';

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 1 · 🔴 LA DIVERGENCIA, DEMOSTRADA CON EL CASO REAL
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-670 · 🔴 con un `defer` las regex de antes DIVERGEN, y la fuente única no', () => {
  const original = html();
  assert.ok(original.includes(ANCLA), '🔴 el ancla del vector ya no está en el índice');
  const conDefer = original.replace(ANCLA, CON_DEFER);

  // ── ANTES: hoy coinciden…
  const hoy = REGEX_DE_ANTES.map((r) => r.leer(original).length);
  assert.equal(new Set(hoy).size, 1,
    `🔴 el vector no reproduce el punto de partida: las tres regex tienen que COINCIDIR sobre el `
    + `índice de hoy (${hoy.join(', ')}). Si ya divergen, el ticket es otro.`);

  // …y con una sola etiqueta con `defer` dejan de coincidir.
  const conDeferCuentas = REGEX_DE_ANTES.map((r) => r.leer(conDefer).length);
  assert.equal(new Set(conDeferCuentas).size, 2,
    `🔴 LAS REGEX DE ANTES YA NO DIVERGEN (${conDeferCuentas.join(', ')}).\n`
    + '  Este test existe para demostrar que coincidían por casualidad; si dejan de divergir, o el\n'
    + '  vector cambió o alguien las tocó, y hay que volver a mirar.');

  // 🔴 Y el detalle que hace peligroso el fallo: las que NO lo ven son las dos que PARSEAN.
  assert.ok(!REGEX_DE_ANTES[0].leer(conDefer).includes('pruebaDefer.js'),
    '🔴 la regex del guard de colisiones sí ve el `defer`: el vector ya no reproduce el caso.');
  assert.ok(REGEX_DE_ANTES[2].leer(conDefer).some((s) => s.includes('pruebaDefer')),
    '🔴 la regex del service worker NO ve el `defer`: entonces no hay divergencia que demostrar.');

  // ── DESPUÉS: la fuente única lo ve, y da una sola respuesta.
  assert.ok(nombresDelDashboard(conDefer).includes('pruebaDefer.js'),
    '🔴 LA FUENTE ÚNICA NO VE UNA ETIQUETA CON `defer`. Entonces no arregla nada: el guard de\n'
    + '  colisiones seguiría sin parsear ese fichero y diría «cero colisiones» igual.');
  assert.equal(nombresDelDashboard(conDefer).length, nombresDelDashboard(original).length + 1,
    '🔴 la fuente única no cuenta exactamente un script más.');
});

test('SCRUM-670 · 🔴 EL CASO PEOR NO ES `defer`: ES EL CERO UNÁNIME DE LAS COMILLAS SIMPLES', () => {
  // Con `defer` las tres DISCREPAN (71/71/72), y una discrepancia se acaba viendo: dos guards
  // dicen cosas distintas del mismo fichero.
  //
  // 🔴 Con COMILLAS SIMPLES las tres coinciden — en CERO. Y un cero unánime es el resultado más
  // convincente y más falso que puede dar este sistema: tres extractores independientes de
  // acuerdo en que ahí no hay ningún script, con el script delante. Nadie duda de un consenso.
  const soloComillasSimples = "<!doctype html>\n<script src='./js/soloYo.js'></script>\n";

  const cuentas = REGEX_DE_ANTES.map((r) => r.leer(soloComillasSimples).length);
  assert.deepEqual(cuentas, [0, 0, 0],
    `🔴 el vector no reproduce el caso peor: las tres tienen que dar CERO (${cuentas.join(', ')}).`);

  // La fuente única sí lo ve — y por eso su cero significa algo.
  assert.deepEqual(nombresDelDashboard(soloComillasSimples), ['soloYo.js'],
    '🔴 LA FUENTE ÚNICA TAMPOCO VE UNA ETIQUETA CON COMILLAS SIMPLES. Entonces no arregla el caso\n'
    + '  peor: el documento cargaría un script que ningún guard vigila, y los tres dirían que no\n'
    + '  hay ninguno. Es HTML correcto; la comilla simple no es un caso raro, es otra forma de\n'
    + '  escribir lo mismo.');

  // Y el suelo de ceguera NO se dispara aquí, que es lo que lo hace útil: hay UN script y se ve.
  assert.deepEqual(scriptsDelIndiceOFalla(soloComillasSimples, 'el caso de comillas simples'),
    ['soloYo.js'],
    '🔴 el suelo ha declarado ceguera sobre un documento que SÍ tiene un script: un suelo que se\n'
    + '  dispara con datos buenos acaba desactivado.');

  // 🔴 Lo que SCRUM-559 midió y este ticket cierra por la causa: con la regex de antes, ese
  // documento deja el fichero fuera de TODA vigilancia sin que salte nada.
  assert.equal(REGEX_DE_ANTES[0].leer(soloComillasSimples).length, 0,
    '🔴 si la regex de antes ya lo viera, no habría nada que arreglar.');
});

test('SCRUM-670 · la fuente lee la ETIQUETA, no su forma: cinco casos que la regex perdía', () => {
  // Ninguno es un caso especial añadido a mano: salen de recorrer la etiqueta como estructura.
  const casos = [
    ['con defer', '<script src="./js/a.js" defer></script>', './js/a.js'],
    ['con type antes del src', '<script type="module" src="./js/b.js"></script>', './js/b.js'],
    ['con comillas simples', "<script src='./js/c.js'></script>", './js/c.js'],
    ['partida en varias líneas', '<script\n  src="./js/d.js"\n  defer>\n</script>', './js/d.js'],
    ['sin comillas', '<script src=./js/e.js></script>', './js/e.js'],
  ];
  for (const [rotulo, fragmento, esperado] of casos) {
    assert.deepEqual(srcsDelIndice(fragmento), [esperado],
      `🔴 la fuente pierde el caso «${rotulo}»: ${JSON.stringify(fragmento)}`);
  }
  // Y lo que NO debe ver: un script en línea no tiene `src`, y `<scriptable>` no es un script.
  assert.deepEqual(srcsDelIndice('<script>window.x = 1;</script>'), [],
    '🔴 un script EN LÍNEA no tiene `src` y no puede aparecer en la lista.');
  assert.deepEqual(srcsDelIndice('<scriptable src="./js/no.js">'), [],
    '🔴 `<scriptable>` se ha tomado por un `<script>`: detrás del nombre tiene que venir un separador.');
  // Las externas quedan fuera de `srcsLocales`, que es lo que consume el service worker.
  assert.deepEqual(srcsLocales('<script src="https://cdn.ejemplo/x.js"></script>'), [],
    '🔴 una externa ha entrado como local: el precache intentaría guardarla y `addAll` es atómico.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · UNA SOLA FUENTE: nadie vuelve a leer el índice con su propia regex
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-670 · 🔴 ningún test se escribe su propia regex de `<script src` sobre el índice', () => {
  // El trinquete: si mañana alguien añade la cuarta, cae aquí NOMBRADO. Se mira el CÓDIGO, no los
  // comentarios — este mismo fichero contiene las tres regex de antes en su cabecera y en
  // `REGEX_DE_ANTES`, que es material declarado del ticket y está exento por nombre.
  const EXENTOS = new Set([
    // Aquí viven a propósito: son el «antes» que este ticket demuestra.
    'scrum670-una-sola-fuente-scripts.test.mjs',
    // La fuente única: es la que tiene derecho a leer la etiqueta.
    '_scripts-del-indice.mjs',
  ]);
  const dir = path.join(RAIZ, 'tests');
  const ofensores = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.mjs') || EXENTOS.has(f)) continue;
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    // Solo el índice del dashboard: otras páginas tienen sus propios lectores y no son de aquí.
    if (!src.includes('dashboard/index.html') && !src.includes("'dashboard', 'index.html'")) continue;
    const sinComentarios = src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
    // La señal es un LITERAL DE REGEX que extrae el `src`, en la MISMA línea que la
    // extracción. Mirar el fichero entero acusaba a quien hace un `replace` con una cadena
    // literal, o a quien escribe «<script src» dentro de un mensaje de error — y un detector que
    // acusa a los sanos acaba desactivado, que es como se pierden los guards.
    const sospechosas = sinComentarios.split('\n').filter((l) => /\/<script/.test(l)
      && /src/.test(l) && /matchAll|\.match\(|\.exec\(/.test(l)
      // ⚠️ Y NO cuenta el que extrae los scripts EN LÍNEA —`(?![^>]*\bsrc=)`—: ésa es otra
      // población, la de los `<script>` SIN `src`, y este trinquete es sobre la lista de los que
      // SÍ lo tienen. No es una exención por fichero: es que la pregunta es distinta.
      && !/\(\?!\[\^>\]\*\\b?src=?\)/.test(l) && !/\(\?!\[\^>\]\*/.test(l));
    if (sospechosas.length > 0) ofensores.push(f);
  }
  assert.deepEqual(ofensores, [],
    '🔴 ESTOS FICHEROS VUELVEN A LEER EL ÍNDICE CON SU PROPIA REGEX:\n'
    + ofensores.map((f) => `   · tests/${f}`).join('\n')
    + '\n\n  Tres regex sobre el mismo fichero ya coincidieron POR CASUALIDAD hasta que una\n'
    + '  etiqueta con `defer` las partió. La respuesta no es una regex más lista: es\n'
    + '  `tests/_scripts-del-indice.mjs`, que recorre la etiqueta en vez de adivinar su forma.');

  // SUELO: si el barrido no mirara ningún fichero, el cero de arriba no diría nada.
  const mirados = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')
    && fs.readFileSync(path.join(dir, f), 'utf8').includes('dashboard/index.html'));
  assert.ok(mirados.length >= 5,
    `🔴 CIEGO: solo ${mirados.length} ficheros de tests leen el índice, y son más de cinco.`);
});

test('SCRUM-670 · los cuatro consumidores dan LA MISMA lista', () => {
  // Lo que antes era casualidad ahora es la misma llamada. Se comprueba sobre el índice real y
  // sobre el índice con `defer`: si una respuesta se separase, saldría aquí.
  const original = html();
  const conDefer = original.replace(ANCLA, CON_DEFER);
  for (const [rotulo, doc] of [['el índice de hoy', original], ['el índice con defer', conDefer]]) {
    const porNombre = nombresDelDashboard(doc);
    const porSrc = srcsLocales(doc).filter((s) => /(^|\/)js\//.test(s)).map((s) => s.replace(/^.*\/js\//, ''));
    assert.deepEqual(porNombre, porSrc,
      `🔴 sobre ${rotulo}, dos vistas de la MISMA fuente ya no coinciden. La fuente única ha `
      + 'dejado de ser única.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3 · SUELO DE CEGUERA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-670 · 🔴 SUELO: cero scripts es «no supe leer», y la fuente lo DECLARA', () => {
  assert.throws(() => scriptsDelIndiceOFalla('', 'un documento vacío'), /CIEGO/,
    '🔴 con el documento vacío la fuente devuelve una lista vacía en silencio. Un cero ahí no es\n'
    + '  «no hay scripts»: es «no supe leerlo», y los guards que dependen de esta población\n'
    + '  afirmarían «cero colisiones» y «ninguna vista falla» sin haber mirado nada.');
  assert.throws(() => scriptsDelIndiceOFalla('<p>hola</p>', 'un documento sin scripts'), /CIEGO/);

  // Y el contraste: sobre el índice real NO lanza, y devuelve una población grande.
  const n = scriptsDelIndiceOFalla(html(), 'public/dashboard/index.html');
  assert.ok(n.length > 50,
    `🔴 la fuente solo ve ${n.length} scripts en el índice real y el dashboard carga más de 50.`);
});

test('SCRUM-670 · el recorrido no se queda colgado con HTML roto', () => {
  // Determinista y sin bucles infinitos: una comilla sin cerrar o una etiqueta sin `>` tienen que
  // terminar. Un guard que se cuelga es peor que uno que falla — el CI no dice nada, solo espera.
  for (const roto of ['<script src="./js/a.js', '<script', '<script src=', '<script src=\'x']) {
    assert.doesNotThrow(() => etiquetasScript(roto), `🔴 se ha roto con ${JSON.stringify(roto)}`);
  }
  assert.deepEqual(etiquetasScript(''), []);
});
