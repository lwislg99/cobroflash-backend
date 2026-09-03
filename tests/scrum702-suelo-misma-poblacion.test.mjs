// tests/scrum702-suelo-misma-poblacion.test.mjs — SCRUM-702
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO CANTÓ «HA PERDIDO 9 TESTS» Y NO FALTABA NI UNO — qué era en realidad
//
// ── 🔴 LO PRIMERO, PORQUE CAMBIA EL DIAGNÓSTICO: NO ERA EL SISTEMA OPERATIVO ─────────────
//
// La sospecha de partida era que Windows y Ubuntu cuentan distinto. **Medido, no es así.** Dos
// árboles, los dos entornos, el número que el guard lee (`# tests` del TAP):
//
//     c71635ce   local (Windows) 4812   ·   CI (Ubuntu) 4812
//     4e9e114d   local (Windows) 4928   ·   CI (Ubuntu) 4928   ← y NOMBRE A NOMBRE idénticos
//
// El TAP del CI se sacó del artefacto `tanda-tap` de esos mismos commits. Lo que **sí** difiere
// entre los dos entornos es `# skipped` (84 en local, 74 en el CI: allí hay bases de datos que
// aquí no) y algún `# fail`. Pero `# skipped` no entra en `# tests`, que es lo que se compara.
//
// ── LO QUE ERA: EL ÁRBOL, NO LA MÁQUINA ─────────────────────────────────────────────────
//
// El suelo se DECLARA en un commit y se EVALÚA en otro, y `main` se mueve deprisa. Medido sobre
// los artefactos del CI de la noche del 2-sep-2026:
//
//     22:19  cc67773b  main       4805
//     22:30  c71635ce  scrum-694  4812      ← una rama con SUS tests dentro
//     22:33  21a1920b  main       4812
//     22:42  1ef99272  main       4832
//     22:58  b1ae3fd9  main       4841      ← 36 tests en cuarenta minutos
//
// Y la prueba con nombre: el commit `deeb89a9` (rama `scrum-697`) declaró `SUELO_TESTS = 4814`
// mientras **su propio CI medía 4805**. Cualquier rama hermana que no tuviera esos tests quedaba
// nueve por debajo sin haber perdido nada. Por eso es la primera vez que canta: 4766 y 4798 no
// estaban mejor medidos, estaban más flojos.
//
// ── EL ARREGLO: MIRAR EL DEFECTO, NO SU SOMBRA ──────────────────────────────────────────
//
// El total es un INDICIO —compara con un número declarado en otro sitio y en otro momento—. El
// defecto que SCRUM-672 persigue, en cambio, deja una firma EXACTA en el mismo TAP que se está
// evaluando: cuando un fichero de `tests/` carga y no registra ni un test, `node --test` emite
// una entrada con el NOMBRE DEL FICHERO. Y la emite **en verde**.
//
// Eso es «la misma población» de verdad: sale del TAP que se juzga, así que no puede
// equivocarse por haberse medido sobre otro árbol.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloCodigo } from './_solo-codigo.mjs';
import { ficherosMudosDelTap, veredictoDelSuelo, SALIDA_POR_DEBAJO } from '../scripts/_suelo-de-la-tanda.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Un TAP sano, con la forma que emite `node --test`. */
const TAP_SANO = [
  'TAP version 13',
  '# Subtest: hace lo que dice',
  'ok 1 - hace lo que dice',
  '# Subtest: y lo otro',
  'ok 2 - y lo otro',
  '1..2',
  '# tests 2',
  '# pass 2',
  '# fail 0',
].join('\n');

/**
 * El MISMO TAP con un fichero mudo. La línea `ok 3 - b.test.mjs` no está inventada: es
 * literalmente lo que emitió `node --test` en el laboratorio con un fichero que cargaba bien y
 * no registraba nada.
 */
const TAP_CON_MUDO = [
  'TAP version 13',
  '# Subtest: hace lo que dice',
  'ok 1 - hace lo que dice',
  '# Subtest: y lo otro',
  'ok 2 - y lo otro',
  '# Subtest: b.test.mjs',
  'ok 3 - b.test.mjs',
  '1..3',
  '# tests 3',
  '# pass 3',
  '# fail 0',
].join('\n');

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL DETECTOR DEL FICHERO MUDO — el defecto visto, no deducido del recuento
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-702 · 🔴 CONTROL POSITIVO: un fichero que no registra tests se caza por su nombre', () => {
  assert.deepEqual(ficherosMudosDelTap(TAP_CON_MUDO), ['b.test.mjs'],
    '🔴 no se ve el fichero mudo en el TAP. Es el defecto que SCRUM-672 persigue y viene EN '
    + 'VERDE: sin esto sólo se notaría de refilón, por un total que además baja menos de lo que '
    + 'se ha perdido, porque la entrada del fichero suma uno.');
});

test('SCRUM-702 · 🔴 CONTROL NEGATIVO: un TAP sano no tiene ni un mudo', () => {
  // Si el detector viera mudos donde no los hay, el guard saltaría siempre y alguien lo apagaría
  // — que es como mueren los guards buenos.
  assert.deepEqual(ficherosMudosDelTap(TAP_SANO), []);
  assert.deepEqual(ficherosMudosDelTap(''), [], '🔴 inventa mudos sobre un TAP vacío');
});

test('SCRUM-702 · 🔴 y un test que HABLA de un fichero no es un fichero mudo', () => {
  // La distinción es la que decide si esto es usable: hay tests cuyo nombre MENCIONA un fichero
  // de test, y no pueden hacer saltar nada. Sólo cuenta el nombre que es EXACTAMENTE el fichero.
  const tap = [
    'ok 1 - SCRUM-694 · scrum625-formato-importe-pdf.test.mjs sigue usando el mecanismo',
    'ok 2 - repara tests/scrum419-ci-declara-lo-que-no-corre.test.mjs cuando toca',
    '# tests 2',
  ].join('\n');
  assert.deepEqual(ficherosMudosDelTap(tap), [],
    '🔴 un test que NOMBRA un fichero se está contando como fichero mudo: el guard saltaría por '
    + 'la forma de escribir un título.');
});

test('SCRUM-702 · el veredicto pone el fichero mudo POR DELANTE del recuento', () => {
  // Si mandara el margen, el mensaje acusaría al árbol de algo que está localizado y con nombre.
  const v = veredictoDelSuelo(TAP_CON_MUDO, 99999);
  assert.equal(v.ok, false);
  assert.equal(v.salida, SALIDA_POR_DEBAJO);
  assert.match(v.titulo, /NO REGISTRARON NI UN TEST/, '🔴 con un mudo delante manda el recuento');
  assert.match(v.titulo, /b\.test\.mjs/, '🔴 el mensaje no NOMBRA el fichero que se ha quedado mudo');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE: no hemos apagado el guard
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-702 · 🔴 una pérdida REAL de tests SIGUE cantando', () => {
  // Lo que este ticket viene a quitar es un falso positivo. Si de paso apagara el guard, sería
  // peor que el ruido: un test que desaparece no falla, y nadie se entera.
  const v = veredictoDelSuelo(TAP_SANO, 10);
  assert.equal(v.ok, false, '🔴 SE HA APAGADO EL GUARD: 2 tests contra un suelo de 10 y dice que bien');
  assert.equal(v.salida, SALIDA_POR_DEBAJO);
  assert.match(v.titulo, /8 TEST\(S\) POR DEBAJO/, '🔴 no dice cuántos faltan');
});

test('SCRUM-702 · 🔴 y el mensaje distingue ÁRBOL de COBERTURA', () => {
  // Hoy decía «LA TANDA HA PERDIDO 9 TESTS» cuando no se había perdido ninguno: acertaba el
  // veredicto tanto como el diagnóstico, o sea nada. Un guard puede acertar y mentir en el
  // porqué, y quien lo lee actúa sobre el porqué.
  const v = veredictoDelSuelo(TAP_SANO, 10);
  assert.match(v.detalle, /DESCARTA QUE SEA OTRO ÁRBOL/,
    '🔴 el mensaje no ofrece la causa que de verdad se midió: el suelo declarado sobre otro árbol.');
  assert.match(v.detalle, /mezcla `main`/,
    '🔴 no dice qué HACER en el caso más probable, que es una rama salida de un main anterior.');
  assert.equal(/HA PERDIDO \d+ TEST/.test(v.titulo), false,
    '🔴 el título vuelve a AFIRMAR una pérdida que no ha comprobado. Por debajo del suelo es un '
    + 'indicio; el que afirma es el de los ficheros mudos.');
});

test('SCRUM-702 · CONTROL NEGATIVO: por encima del suelo y sin mudos, no dice nada', () => {
  const v = veredictoDelSuelo(TAP_SANO, 2);
  assert.equal(v.ok, true);
  assert.deepEqual(v.mudos, []);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CENSO: cuántas comprobaciones más dependen del entorno
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// Aparecieron dos sin buscarlas —el suelo y `scrum480`—, y dos encontradas por accidente casi
// nunca son dos. Medido el 3-sep-2026 sobre el CÓDIGO (no sobre los comentarios, que hablan de
// esto a menudo): 11 ficheros de `tests/` y `scripts/` leen una señal del entorno.
//
// De los que están en `tests/`, sólo UNO cambia el veredicto según dónde corra —`scrum480`, y lo
// declara y lo razona—. Los demás normalizan rutas por plataforma o, en `scripts/`, deciden si
// imprimir una anotación de GitHub. El tope no dice «esto está mal»: dice que la próxima que
// entre se vea.

/** Medido el 3-sep-2026. Este número BAJA con motivo; si sube, hay que mirar la nueva. */
const TOPE_LEEN_EL_ENTORNO = 11;

/**
 * 🔴 PARTIDAS A PROPÓSITO, para que el censo NO SE CACE A SÍ MISMO. Escritas enteras, este
 * fichero contendría las cuatro señales en su propio código y se contaría — que es el error que
 * `scrum636` documenta al revés («escrita entera para que el censo no se cace solo», porque allí
 * la trampa era la contraria). La alternativa, excluirse de la lista, es peor: dejaría este
 * fichero fuera de vigilancia para siempre.
 */
const SENALES = [
  'process.env' + '.CI',
  'GITHUB' + '_ACTIONS',
  'process' + '.platform',
  'process.env' + '.RUNNER',
];

function censoDeEntorno() {
  const filas = [];
  for (const dir of ['tests', 'scripts']) {
    for (const nombre of fs.readdirSync(path.join(RAIZ, dir))) {
      if (!nombre.endsWith('.mjs')) continue;
      const rel = dir + '/' + nombre;
      const codigo = soloCodigo(fs.readFileSync(path.join(RAIZ, rel), 'utf8'), nombre);
      const cuales = SENALES.filter((s) => codigo.includes(s));
      if (cuales.length) filas.push(rel + '  (' + cuales.join(', ') + ')');
    }
  }
  return filas;
}

test('SCRUM-702 · 🔴 SUELO: el censo de dependencias del entorno VE las que hay', () => {
  // Un cero aquí no sería una buena noticia: sabemos de al menos dos, así que sería el detector
  // roto. «No hay» y «no supe mirar» son el mismo número con significados opuestos.
  const censo = censoDeEntorno();
  assert.ok(censo.length > 0,
    '🔴 el censo no encuentra NI UNA lectura del entorno, y hay al menos dos conocidas '
    + '(`scrum480` y `suelo-de-la-tanda`). El detector ha dejado de ver.');
  assert.ok(censo.some((f) => f.startsWith('tests/scrum480-fin-de-linea')),
    '🔴 el censo no ve `scrum480`, que es la que se encontró por accidente y sí condiciona un '
    + 'assert. Si no la ve, no está midiendo lo que dice.');
});

test('SCRUM-702 · 🔴 no entra NINGUNA dependencia del entorno nueva sin declararla', () => {
  const censo = censoDeEntorno();
  assert.ok(censo.length <= TOPE_LEEN_EL_ENTORNO,
    '🔴 hay ' + censo.length + ' ficheros leyendo una señal del entorno y el tope es '
    + TOPE_LEEN_EL_ENTORNO + '. Una comprobación que sólo asevera en un entorno no se comprueba '
    + 'en el otro, y eso no se ve en ningún verde. Si la nueva es legítima, sube el tope EN EL '
    + 'MISMO COMMIT y di qué hace.\n  ' + censo.join('\n  '));
});
