// tests/scrum751-clave-duplicada-en-silencio.test.mjs — SCRUM-751
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UNA CLAVE DUPLICADA EN UN CENSO NO PUEDE VOLVER A PASAR EN SILENCIO
//
// ── EL INCIDENTE, MEDIDO ────────────────────────────────────────────────────────────────
//
// El 5-sep-2026 `main` se mergeó EN ROJO (PR #1065) y nadie lo vio venir. El objeto `CENSO` de
// `scrum402-marcador-no-se-pinta.test.mjs` abre en la línea 54 y cierra en la 593, y dentro
// tenía la clave `'invoicesView.js'` DOS VECES:
//
//     línea 139 — la puso SCRUM-748  (4-sep): el rótulo del cuarto estado del semáforo
//     línea 578 — la puso SCRUM-648b (5-sep): el motivo del ámbar en la bandeja
//
// Cada ticket «ENTRÓ con 1» sin ver al otro, y git los mezcló limpio porque estaban a 439
// líneas de distancia: ningún conflicto que revisar. JavaScript se queda CALLADO ante una clave
// repetida y gana la última, así que el censo declaraba 1 mientras la pantalla pintaba 2. El
// trinquete del 402 no podía apretar, y el rojo salió DESPUÉS del merge.
//
// 🔴 LO QUE FALTABA NO ERA UNA ENTRADA NUEVA: era subir a 2 la que ya había.
//
// ── POR QUÉ SOBRE EL FUENTE ─────────────────────────────────────────────────────────────
//
// Porque en ejecución la prueba ya no existe: `{ a: 1, a: 2 }` construye un objeto con UNA
// clave. Un guard que importara el módulo y contara claves llegaría tarde por diseño, y
// `Object.freeze` no ayuda —el pisado ocurre ANTES de congelar—. Se lee el fuente por AST.
//
// ── Y LA TRAMPA QUE HACE FALTA NOMBRAR ──────────────────────────────────────────────────
//
// Tras firmar el rótulo, las dos claves valían 1 y el valor correcto pasaba a ser 1: el censo
// habría ACERTADO POR CASUALIDAD. Por eso este guard NO compara valores —no le importa si el
// duplicado cambia el resultado—, sino que exige que la clave aparezca UNA SOLA VEZ. Un
// instrumento que acierta por accidente es peor que uno que falla.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clavesDuplicadas, censoDeClavesDuplicadas } from './_claves-duplicadas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Las familias que se censan, con su SUELO propio. 🔴 POR FAMILIA y no un total: un agregado
// escondería que una rama entera dejó de leerse. Escritos A MANO a propósito (la lección de
// SCRUM-377): derivarlos haría que añadir un fichero subiera el listón solo y el suelo dejaría
// de poder caer nunca. Medido el 5-sep-2026: tests 759 · scripts 117 · src 268 · public 84.
const FAMILIAS = Object.freeze({
  tests: 700,
  scripts: 100,
  src: 240,
  public: 75,
  prisma: 1,
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · un detector que no distingue da el mismo verde sobre un árbol limpio y sobre uno roto
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-751 · SUELO: el detector DISTINGUE, y no da por bueno lo que no sabe leer', () => {
  // ① ve el duplicado que tiene que ver
  const visto = clavesDuplicadas('const X = { a: 1, b: 2, a: 3 };');
  assert.equal(visto.length, 1, '🔴 CIEGO: no ve un duplicado fabricado');
  assert.equal(visto[0].clave, 'a');

  // ② y NO inventa donde no hay. Sin esto, un detector que grita siempre pasaría ①.
  assert.deepEqual(clavesDuplicadas('const X = { a: 1, b: 2, c: 3 };'), [],
    '🔴 FALSO ROJO: ve un duplicado en un objeto sano');

  // ③ la GRAFÍA no salva: `a` y `'a'` son la misma clave. Comparar cómo se escribió dejaría
  // pasar exactamente el mismo defecto con comillas de por medio.
  assert.equal(clavesDuplicadas("const X = { a: 1, 'a': 2 };").length, 1,
    "🔴 CIEGO A LA GRAFÍA: `a` y `'a'` son la MISMA clave");
  assert.equal(clavesDuplicadas('const X = { 1: 1, "1": 2 };').length, 1,
    '🔴 CIEGO A LA GRAFÍA: `1` y `"1"` son la MISMA clave');

  // ④ un accessor NO es un duplicado. Sin este caso el guard nacería con falsos rojos y lo
  // apagaría alguien en una hora, que es como mueren los guards (la lección del propio 402).
  assert.deepEqual(clavesDuplicadas('const X = { get a() { return 1; }, set a(v) {} };'), [],
    '🔴 FALSO ROJO: `get a`/`set a` es la forma legítima de un accessor');

  // ⑤ lo que no se puede saber leyendo se IGNORA, no se adivina.
  assert.deepEqual(clavesDuplicadas('const k = "a"; const X = { [k]: 1, [k]: 2 };'), [],
    '🔴 una clave computada no se puede resolver leyendo: adivinarla daría falsos rojos');
});

test('SCRUM-751 · 🔴 EL CONTROL QUE DECIDE: el defecto REAL del 5-sep, reproducido', () => {
  // Es el incidente literal: dos entradas iguales, MISMO VALOR, separadas por mucho código —que
  // es lo que hizo que git las mezclara sin conflicto y que nadie las viera.
  const relleno = Array.from({ length: 400 }, (_, i) => `  // linea de relleno ${i}`).join('\n');
  const comoEstabaMain = [
    'const CENSO = Object.freeze({',
    "  'jobAsignados.js': 1,",
    "  'invoicesView.js': 1,",
    relleno,
    "  'settingsView.js': 1,",
    "  'invoicesView.js': 1,",
    '});',
  ].join('\n');

  const dup = clavesDuplicadas(comoEstabaMain);
  assert.equal(dup.length, 1, '🔴 el detector NO ve el defecto que causó el rojo del PR #1065');
  assert.equal(dup[0].clave, 'invoicesView.js');
  assert.equal(dup[0].lineas.length, 2, '🔴 tiene que nombrar LAS DOS líneas, no solo decir «hay»');

  // 🔴 Y EL MISMO FIXTURE SIN LA SEGUNDA ENTRADA TIENE QUE SALIR LIMPIO. Sin esto, un detector
  // que gritara ante cualquier objeto grande pasaría la mitad de arriba sin significar nada.
  const arreglado = comoEstabaMain.split('\n').filter((l, i, a) =>
    !(l === "  'invoicesView.js': 1," && a.indexOf(l) !== i)).join('\n');
  assert.deepEqual(clavesDuplicadas(arreglado), [],
    '🔴 el detector sigue en rojo tras quitar el duplicado: acusa al objeto, no a la clave');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-751 · NINGÚN objeto literal del árbol repite una clave', () => {
  const { porFamilia, hallazgos, ilegibles } = censoDeClavesDuplicadas(RAIZ, Object.keys(FAMILIAS));

  // SUELO POR FAMILIA, antes de creerse el cero. Un cero sobre una familia que no se leyó no es
  // un cero: es un «no supe mirar» con la misma cara.
  for (const [fam, minimo] of Object.entries(FAMILIAS)) {
    assert.ok(porFamilia[fam] >= minimo,
      `🔴 ESCÁNER CIEGO en \`${fam}/\`: solo he leído ${porFamilia[fam]} ficheros y el suelo son `
      + `${minimo}. El cero de abajo no vale. ARREGLA EL ESCÁNER, no el número.`);
  }

  assert.deepEqual(ilegibles, [],
    '🔴 hay ficheros que no he podido leer, así que su «sin duplicados» es un no-lo-sé:\n'
    + ilegibles.map((f) => `    ${f}`).join('\n'));

  const pintado = hallazgos.map((h) => `    ${h.fichero} · clave \`${h.clave}\` en las líneas `
    + `${h.lineas.join(' y ')}`);
  assert.deepEqual(hallazgos, [],
    '🔴 HAY UNA CLAVE REPETIDA EN UN OBJETO LITERAL:\n' + pintado.join('\n') + '\n\n'
    + '  JavaScript se queda CALLADO y gana la última, así que lo que el objeto declara NO es lo\n'
    + '  que está escrito. Si es un censo, está midiendo mal sin decirlo (SCRUM-751, PR #1065).\n'
    + '  El arreglo NO es añadir otra entrada: es dejar UNA sola, con el valor que de verdad\n'
    + '  tenga el árbol.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN (SCRUM-745) · las ejecuta `npm run meta:mutaciones`
//
// Las dos van sobre el censo del 402 —el sitio del incidente— y prueban cosas distintas:
//   ① duplicado con el MISMO valor: es el caso REAL, el que «acertaría por casualidad».
//   ② duplicado con valor DISTINTO: prueba que el guard no depende de que los valores difieran.
// Si el guard solo cazara ②, seguiría ciego ante el incidente que vino a impedir.
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'tests/scrum402-marcador-no-se-pinta.test.mjs',
    de: "  'invoicesView.js': 1,",
    a: "  'invoicesView.js': 1,\n  'invoicesView.js': 1,",
    cae: 'NINGÚN objeto literal del árbol repite una clave',
  },
  {
    fichero: 'tests/scrum402-marcador-no-se-pinta.test.mjs',
    de: "  'settingsView.js': 1,",
    a: "  'settingsView.js': 1,\n  'settingsView.js': 9,",
    cae: 'NINGÚN objeto literal del árbol repite una clave',
  },
];
