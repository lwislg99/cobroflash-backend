// tests/scrum736-el-suelo-que-no-avisa.test.mjs — SCRUM-736
//
// Sin gate: todo es PURO (entra texto de TAP y un número, sale un veredicto) más una lectura del
// árbol. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN AVISO QUE NADIE ESTÁ OBLIGADO A MIRAR NO ES UN AVISO
//
// `SUELO_TESTS` llevaba **657 de margen** y `SUELO_TOTAL` **6.257**, y lo único que lo decía era
// una línea impresa en el camino VERDE de una tanda de casi 7.000 tests: «Subir el suelo a N es
// una línea, y lo puede hacer cualquier sesión.» Llevaba ocho días imprimiéndola.
//
// ── EL DEFECTO, PROVOCADO ANTES DE TOCAR NADA ───────────────────────────────────────────
// Sobre el TAP REAL de la tanda de hoy (6903), bajando el total 441 tests:
//
//     con el suelo declarado (6246)  ->  margen 216   ✅ VERDE, exit 0
//
// Cuatrocientos cuarenta y un tests podían desaparecer y el instrumento escrito para cazar
// exactamente eso salía en verde.
//
// ── POR QUÉ NO SE ARREGLA CON UNA BANDA DE MARGEN, Y ESTÁ MEDIDO ────────────────────────
// `tests-declarados` en `origin/main`, un commit por día, con el censo del trinquete de SCRUM-810b:
// **3595 → 6756 en 14 pasos. Suben 14, bajan 0. Media +226/día, pico +647.** A ese ritmo, una banda
// del 5% caduca en día y medio y una del 25% en semana y media: toda banda vuelve a ser el
// trinquete a mano que se sube por inercia.
//
// Lo que sí aguanta es comparar contra una población INDEPENDIENTE: lo que el árbol DECLARA
// (`test(`/`it(` por AST) frente a lo que la tanda REGISTRÓ (`# tests` del TAP). Una tanda a
// medias hunde el segundo y no toca el primero — por eso esta comparación puede caer, y aquí se
// hace caer. Es el patrón que el bloque ④b de `_evidencia-tanda.mjs` ya usaba para los FICHEROS
// llamándolo «la versión exacta del suelo, sin número mágico»; faltaba en el número de al lado.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  veredictoDelSuelo, sueloEfectivo, CUENTA_DEL_ARBOL_MINIMA, SUELO_TESTS,
  SALIDA_POR_DEBAJO,
} from '../scripts/_suelo-de-la-tanda.mjs';
import { validarEvidencia, SUELO_TOTAL } from '../scripts/_evidencia-tanda.mjs';
import { testsDeclaradosEn } from './_poblacion-de-tests.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const FUENTE = path.join(RAIZ, 'scripts/_suelo-de-la-tanda.mjs');

/** Un TAP mínimo con el total que se le pida. Lo mismo que usa `scrum672`. */
const tap = (n) => `TAP version 13\nok 1 - algo\n1..${n}\n# tests ${n}\n# pass ${n}\n# fail 0\n`;

/** La pérdida del enunciado del ticket, que es la que hay que cazar. */
const PERDIDA_DEL_TICKET = 441;

/** Lo que el meta-guard de la casa EJECUTA contra este fichero (SCRUM-745). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/_suelo-de-la-tanda.mjs',
    de: "  const margen = total - efectivo.valor;",
    a: "  const margen = total - suelo;",
    cae: 'SCRUM-736 · 🔴 EL QUE DECIDE: perder 441 tests HOY hace caer el suelo, y BLOQUEA',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · si no hay suelos que mirar, o el censo no cuenta, esto es CIEGO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-736 · 🔴 SUELO: el árbol declara tests y la relación con el TAP es creíble', () => {
  const declarados = testsDeclaradosEn(RAIZ);
  assert.ok(Number.isFinite(declarados) && declarados > 3000,
    `🔴 CIEGO: el censo por AST dice ${declarados} tests declarados. Un suelo derivado de eso no `
    + 'significaría nada — y CERO no es «no hay tests», es «no supe contarlos».');

  assert.ok(CUENTA_DEL_ARBOL_MINIMA > 0.5 && CUENTA_DEL_ARBOL_MINIMA < 1,
    `🔴 la fracción declarada (${CUENTA_DEL_ARBOL_MINIMA}) no está entre 0,5 y 1: por debajo no `
    + 'vigila nada y en 1 exacto cualquier bucle fabrica un rojo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE · las dos direcciones sobre el MISMO total
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-736 · 🔴 EL QUE DECIDE: perder 441 tests HOY hace caer el suelo, y BLOQUEA', () => {
  const declarados = testsDeclaradosEn(RAIZ);
  const derivado = Math.ceil(declarados * CUENTA_DEL_ARBOL_MINIMA);

  // 🔴 LA TANDA SANA, SIN INVENTAR NINGUNA RELACIÓN. El TAP registra AL MENOS lo que el árbol
  // declara —SCRUM-702 midió que ningún fichero condiciona el registro de un test al entorno, y
  // hoy son 6903 contra 6764—, así que usar `declarados` como total sano es una COTA INFERIOR: si
  // la red caza la pérdida sobre esta cota, la caza sobre el total real, que es mayor.
  const sano = declarados;
  const menos = sano - PERDIDA_DEL_TICKET;

  // Y las dos condiciones que hacen que esto mida el defecto del ticket y no otra cosa. Si alguna
  // dejara de cumplirse, el control lo DICE en vez de seguir afirmando.
  assert.ok(menos > SUELO_TESTS,
    `🔴 este control ya no reproduce el defecto: perder ${PERDIDA_DEL_TICKET} tests desde ${sano} `
    + `deja ${menos}, que ya está por debajo del número a mano (${SUELO_TESTS}). Alguien lo subió, `
    + 'o el árbol encogió: hay que volver a medir antes de creerse lo de abajo.');
  assert.ok(menos < derivado,
    `🔴 la red no llega a la pérdida del enunciado: ${menos} sigue por encima del suelo derivado `
    + `(${derivado}). Con CUENTA_DEL_ARBOL_MINIMA = ${CUENTA_DEL_ARBOL_MINIMA} la red caza `
    + `pérdidas de más de ${sano - derivado} tests, y el ticket habla de ${PERDIDA_DEL_TICKET}.`);

  // ── ① EL DEFECTO, tal como estaba: con el número a mano, la pérdida pasa en VERDE ──────
  const conElDeclarado = veredictoDelSuelo(tap(menos), SUELO_TESTS, null);
  assert.equal(conElDeclarado.ok, true,
    `🔴 este control ya no reproduce el defecto: con el suelo declarado (${SUELO_TESTS}) y `
    + `${menos} tests corridos debería salir VERDE, que es lo que hacía que 441 tests pudieran `
    + 'desaparecer en silencio. Si sale rojo, el defecto se arregló por otra vía y hay que '
    + 'volver a escribir este control.');

  // ── ② Y CON LA RED: el mismo total, el mismo TAP, y ahora CAE ──────────────────────────
  const conLaRed = veredictoDelSuelo(tap(menos), SUELO_TESTS, declarados);
  assert.equal(conLaRed.ok, false,
    `🔴 perder ${PERDIDA_DEL_TICKET} tests sigue pasando en verde: el árbol declara ${declarados} `
    + `y la tanda sólo dio cuenta de ${menos}.`);
  assert.equal(conLaRed.salida, SALIDA_POR_DEBAJO,
    '🔴 tiene que salir con el código del hallazgo: es lo que hace que BLOQUEE en CI en vez de '
    + 'imprimir. Un aviso que no cambia el código de salida no obliga a nadie.');
  assert.match(conLaRed.titulo, new RegExp(String(declarados)),
    '🔴 el rojo no dice cuántos tests declara el árbol: sin eso, quien lo lea no sabe contra qué '
    + 'se le compara y lo primero que hará será bajar el suelo.');
  assert.equal(conLaRed.efectivo.de, 'derivado',
    '🔴 el suelo que rige tiene que ser el DERIVADO: si rige el declarado, la red no está puesta.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ✅ POSITIVO · la tanda sana de hoy sigue pasando, y con holgura
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-736 · ✅ POSITIVO: la tanda sana de hoy pasa, y la red no fabrica rojos', () => {
  // Si esta red empieza a bloquear ramas legítimas, la quitan en una semana. Así que se comprueba
  // con el total de hoy Y con lo que una rama normal le hace al número: añadir tests, no quitarlos.
  const declarados = testsDeclaradosEn(RAIZ);
  const derivado = Math.ceil(declarados * CUENTA_DEL_ARBOL_MINIMA);

  for (const [caso, total] of [
    ['una tanda que da cuenta de todo lo declarado', declarados],
    ['con los subtests y los bucles por encima (la relación real es >1)', declarados + 200],
    ['una rama que añade 647 (el mayor salto medido en un día)', declarados + 647],
    ['el borde exacto: justo en el suelo derivado', derivado],
  ]) {
    const v = veredictoDelSuelo(tap(total), SUELO_TESTS, declarados);
    assert.equal(v.ok, true,
      `🔴 ${caso} (${total} tests) sale ROJO contra un árbol que declara ${declarados}. `
      + `Suelo efectivo ${v.efectivo.valor}. Un rojo así se relaja en dos semanas y con él se va `
      + 'la vigilancia entera.');
  }

  // Y el margen que queda hoy es HOLGURA, no una tarea pendiente: nadie tiene que subir nada.
  const v = veredictoDelSuelo(tap(declarados), SUELO_TESTS, declarados);
  assert.ok(v.margen > 0, '🔴 la tanda de hoy no debería estar pegada al suelo.');
  assert.doesNotMatch(String(v.detalle), /Subir el suelo/,
    '🔴 el camino verde sigue pidiéndole a quien lo lea que suba el suelo a mano. Eso es el '
    + 'defecto de SCRUM-736: una tarea impresa que nadie está obligado a hacer.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SEGUNDO SUELO · `SUELO_TOTAL` estaba DOMINADO, y se mide
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-736 · 🔴 el suelo del recibo ya no es un número dominado', () => {
  const declarados = testsDeclaradosEn(RAIZ);
  const derivado = Math.ceil(declarados * CUENTA_DEL_ARBOL_MINIMA);

  // La medida del defecto: 646 contra un árbol que declara ~6756 es un margen de más de 6.000.
  assert.ok(derivado > SUELO_TOTAL * 5,
    `🔴 este control ya no mide nada: SUELO_TOTAL (${SUELO_TOTAL}) y el derivado (${derivado}) se `
    + 'han acercado, así que la dominancia que este ticket midió ya no existe.');

  // Y con la red puesta, un recibo con el 90% de la tanda fuera ya NO pasa por debajo.
  const problemas = (total, testsEsperados) => validarEvidencia({
    texto: JSON.stringify({ total, pass: total, fail: 0 }),
    commitActual: 'f'.repeat(40), huellaActual: null, ahoraMs: Date.now(),
    ficherosEsperados: 0, testsEsperados,
  }).problemas.filter((p) => p.clave === 'suelo');

  assert.equal(problemas(SUELO_TOTAL + 1, null).length, 0,
    '🔴 sin censo del árbol tiene que regir el número declarado, no un cero.');
  assert.equal(problemas(SUELO_TOTAL + 1, declarados).length, 1,
    `🔴 un recibo de ${SUELO_TOTAL + 1} tests pasa el suelo teniendo el árbol ${declarados} `
    + 'declarados. Eso es «correr un fichero y llamarlo tanda», que es lo que ese suelo existe '
    + 'para impedir.');
  assert.equal(problemas(derivado, declarados).length, 0,
    '🔴 un recibo justo en el suelo derivado tiene que pasar: el suelo es un mínimo, no un «más que».');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA RED ESTÁ DONDE BLOQUEA, no donde se lee
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-736 · 🔴 el CI ejecuta el suelo, y el suelo le pasa el censo del árbol', () => {
  // Una red que sólo existe en un módulo puro no bloquea nada. Las dos mitades:
  const ci = fs.readFileSync(path.join(RAIZ, '.github/workflows/ci.yml'), 'utf8');
  assert.match(ci, /node scripts\/suelo-de-la-tanda\.mjs/,
    '🔴 el CI ha dejado de ejecutar el suelo: entonces esto no bloquea nada.');

  const cli = fs.readFileSync(path.join(RAIZ, 'scripts/suelo-de-la-tanda.mjs'), 'utf8');
  assert.match(cli, /veredictoDelSuelo\([^)]*declaradosEnElArbol\(\)\)/,
    '🔴 el CLI ya no le pasa el censo del árbol al veredicto: sin eso rige el número a mano y la '
    + 'red vuelve a ser un console.log.');
  assert.match(cli, /testsDeclaradosEn/,
    '🔴 el CLI ya no usa el censo por AST de SCRUM-708: un segundo censo propio divergiría (regla 2).');
});

test('SCRUM-736 · 🔴 la fracción se declara UNA vez, y el razonamiento vive con ella', () => {
  // Dos copias del mismo umbral divergen. Y un umbral sin su medida es el número a ojo que este
  // ticket persigue: se exige que el fichero que lo declara traiga el ritmo medido.
  const fuente = fs.readFileSync(FUENTE, 'utf8');
  assert.equal([...fuente.matchAll(/export const CUENTA_DEL_ARBOL_MINIMA/g)].length, 1,
    '🔴 la fracción se declara más de una vez en su propio fichero.');

  const evidencia = fs.readFileSync(path.join(RAIZ, 'scripts/_evidencia-tanda.mjs'), 'utf8');
  assert.doesNotMatch(evidencia, /CUENTA_DEL_ARBOL_MINIMA\s*=/,
    '🔴 `_evidencia-tanda.mjs` ha vuelto a declarar la fracción por su cuenta: dos copias del '
    + 'mismo umbral divergen en dos semanas (regla 2). Se IMPORTA.');
  assert.match(evidencia, /import \{ CUENTA_DEL_ARBOL_MINIMA \}/,
    '🔴 `_evidencia-tanda.mjs` ya no importa la fracción de donde vive su razonamiento.');

  assert.match(fuente, /\+226/,
    '🔴 el fichero ya no trae el ritmo MEDIDO que justifica la fracción. Sin esa medida, 0,97 es '
    + 'un número a ojo — exactamente lo que este ticket persigue.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// AUTOPRUEBA de `sueloEfectivo`: el mayor de los dos, y sabe decir que no pudo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-736 · `sueloEfectivo` coge el mayor, y «no pude contar» no baja el suelo a cero', () => {
  assert.deepEqual(sueloEfectivo(100, 1000),
    { valor: Math.ceil(1000 * CUENTA_DEL_ARBOL_MINIMA), de: 'derivado', derivado: Math.ceil(1000 * CUENTA_DEL_ARBOL_MINIMA), medible: true });

  const alto = sueloEfectivo(5000, 1000);
  assert.equal(alto.valor, 5000, '🔴 el declarado tiene que regir cuando va por encima: no baja.');
  assert.equal(alto.de, 'declarado');

  // 🔴 LO IMPORTANTE: un censo que no contesta NO es un árbol de cero tests.
  for (const nada of [null, undefined, 0, -1, NaN, 'muchos']) {
    const v = sueloEfectivo(6246, nada);
    assert.equal(v.valor, 6246, `🔴 con un censo «${String(nada)}» el suelo se ha movido.`);
    assert.equal(v.medible, false, `🔴 con un censo «${String(nada)}» dice que sí pudo medir.`);
  }
});
