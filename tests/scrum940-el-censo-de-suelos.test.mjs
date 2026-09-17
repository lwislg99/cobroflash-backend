// tests/scrum940-el-censo-de-suelos.test.mjs — SCRUM-940
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ ESTO **NO ES UN TRINQUETE**. SCRUM-940 dice por escrito: mide y propone, no subas ningún
// suelo. Así que este fichero no afirma nada sobre el árbol de verdad — ni que los suelos muertos
// bajen, ni que los desnudos se vistan. Sólo le pone al instrumento un CASO CONOCIDO delante, que
// es lo que esta casa exige de cualquier medición (SCRUM-846).
//
//     🔒 Un 52 % de instrumentos desnudos no se puede juzgar si el detector no ha demostrado que
//        distingue un suelo de una comparación cualquiera sobre una longitud.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { suelosDeFuente, clasificar } from '../scripts/_censo-de-suelos.mjs';

const NL = '\n';
const clases = (fuente) => suelosDeFuente('fabricado.mjs', fuente.join(NL));

// ═══ ① ¿QUÉ ES UN SUELO? · por forma, no por nombre ══════════════════════════════════════════

test('SCRUM-940 · 🔴 ① CASO CONOCIDO: reconoce las tres formas de suelo, y no se guía por el nombre', () => {
  // ① por el NOMBRE del tope
  assert.equal(clases([
    'const SUELO_COSAS = 10;',
    'assert.ok(censo.length >= SUELO_COSAS, "faltan cosas");',
  ]).length, 1, '🔴 no ve un suelo declarado con una constante `SUELO_*`.');

  // ② por el MENSAJE de ceguera, sin constante ninguna
  assert.equal(clases([
    'assert.ok(filas.length > 0, "🔴 CIEGO: el barrido no ha mirado nada");',
  ]).length, 1, '🔴 no ve un suelo que se declara CIEGO en su mensaje: sin eso sólo detecta nombres.');

  // ③ por ABORTAR, sin constante y sin mensaje
  assert.equal(clases([
    'if (todas.length < 3) { throw new Error("no hay bastante"); }',
  ]).length, 1, '🔴 no ve un `if (n < 3) throw`, que el encargo nombra expresamente como suelo.');

  // 🔴 LA MITAD NEGATIVA: una comparación de longitud cualquiera NO es un suelo.
  assert.deepEqual(clases([
    'assert.ok(html.length > 0, "la página no está vacía");',
  ]), [], '🔴 cuenta como suelo una comprobación del SUJETO. Con ese criterio salen 1.766 y el censo no separa nada.');

  // Ni un reloj ni una báscula, aunque tengan la misma forma y un mensaje parecido.
  assert.deepEqual(clases([
    'const TOPE_MS = 20000;',
    'assert.ok(duracion >= TOPE_MS, "🔴 CIEGO: no ha mirado");',
  ]), [], '🔴 cuenta un TIMEOUT como suelo de población. Un reloj no envejece con el árbol.');
});

// ═══ ② EL TOPE SE RESUELVE, VENGA DE DONDE VENGA ═════════════════════════════════════════════

test('SCRUM-940 · 🔴 ② CASO CONOCIDO: resuelve el valor del tope, y la magnitud puede ser una variable ya contada', () => {
  const [s] = clases([
    'const MINIMO_CASOS = 42;',
    'assert.ok(vistos.length >= MINIMO_CASOS, "pocos");',
  ]);
  assert.equal(s?.declarado, 42, '🔴 no resuelve el valor de una constante local: sin valor no hay cociente.');

  // 🔴 La magnitud NO siempre lleva `.length`: `guards >= SUELO_GUARDS` es el caso conocido que
  // se perdía con la primera versión del detector.
  const [t] = clases([
    'const SUELO_GUARDS = 20;',
    'assert.ok(guards >= SUELO_GUARDS, "por debajo del suelo");',
  ]);
  assert.equal(t?.declarado, 20, '🔴 pierde el suelo cuando la magnitud es una variable ya contada.');
  assert.equal(t?.magnitud, 'guards');

  // Y un tope importado se resuelve pasándole las constantes de fuera.
  const [u] = suelosDeFuente('x.mjs',
    'assert.ok(censo.poblacion >= SUELO_DE_OTRO, "🔴 CIEGO");',
    new Map([['SUELO_DE_OTRO', 54]]));
  assert.equal(u?.declarado, 54, '🔴 no resuelve un tope declarado en otro módulo: así se perdía SUELO_DECLARACIONES.');
});

// ═══ ③ LA CLASIFICACIÓN ══════════════════════════════════════════════════════════════════════

test('SCRUM-940 · 🔴 ③ CASO CONOCIDO: el cociente decide, y una lista escrita a mano no es un AJUSTADO', () => {
  assert.equal(clasificar(20, 86), 'MUERTO', '🔴 20 sobre 86 (habría que perder el 77%) no es MUERTO.');
  assert.equal(clasificar(196, 287), 'VIVO', '🔴 196 sobre 287 no es VIVO: perder un tercio lo dispara.');
  assert.equal(clasificar(14, 14), 'AJUSTADO', '🔴 un suelo pegado a su población no sale AJUSTADO.');
  assert.equal(clasificar(50, null), 'NO_DECIDIBLE', '🔴 sin valor real debe ser NO DECIDIBLE, nunca «está bien».');
  // Lo dudoso, del lado malo: sin real no se presume sano.
  assert.notEqual(clasificar(50, null), 'VIVO');
  // Y la corrección que costó tres acusaciones falsas de once.
  assert.equal(clasificar(14, 14, true), 'LISTA_FIJA',
    '🔴 una lista escrita a mano, pegada a propósito, se acusa como AJUSTADA. Un suelo de '
    + 'población envejece solo; un trinquete sobre una lista fija, no.');
});
