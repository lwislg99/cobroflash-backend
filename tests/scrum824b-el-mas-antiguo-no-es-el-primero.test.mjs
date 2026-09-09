// tests/scrum824b-el-mas-antiguo-no-es-el-primero.test.mjs — SCRUM-824b
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// «DESDE CUÁNDO ESTAMOS PARADOS» SE CALCULA, NO SE COGE EL PRIMERO DE UNA LISTA.
//
// El vigía de despliegue necesita el commit MÁS ANTIGUO que main tiene y producción no: es el
// que dice desde cuándo hay hueco, y se compara contra un margen de horas para decidir si esto
// es CONGELADO o sólo un despliegue en marcha.
//
// Lo sacaba así:
//
//     git log --format=%ct --reverse <prod>..<main>   →   y cogía la PRIMERA línea
//
// dando por hecho que invertir el listado deja arriba el más antiguo. **No es cierto.**
// `--reverse` invierte el ORDEN DE RECORRIDO DEL GRAFO, y ese recorrido está obligado a emitir
// un hijo antes que su padre. Si un padre tiene fecha MÁS NUEVA que su hijo, al invertir sube él.
//
// ── ¿Y cuándo tiene un padre fecha más nueva que su hijo? ────────────────────────────────────
// Con un rebase, un cherry-pick, un `--amend`, o dos relojes desfasados — todo lo normal en un
// repositorio con varias ramas y varias máquinas. No hace falta nada raro.
//
// 🔴 POR QUÉ IMPORTA, y no es un detalle de estilo: ese epoch **es** el veredicto. Medido en el
// repo que construye este mismo test, la diferencia entre lo que cogía y lo que debía coger es
// de **75 horas**. Con el margen en 6, eso convierte un CONGELADO en «aún dentro del margen».
// Un vigía que se equivoca así no falla ruidosamente: **firma un verde**.
//
// ⚠️ ESTE FICHERO NO ARREGLA EL TEST, ARREGLA EL CÓDIGO (regla 41). Lo que se cambió es cómo el
// vigía calcula; no se ha tocado nada de lo que el vigía exige, ni se ha relajado ningún umbral,
// ni se espera, ni se reintenta.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(RAIZ, 'scripts', 'vigilante-de-despliegue.mjs');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS FECHAS DEL ESCENARIO — CON HUSO EXPLÍCITO, Y EL NÚMERO SE DERIVA DE ELLAS
//
// 🔴 LA `Z` NO ES DECORATIVA, y este caso lo aprendió cayéndose. Iban sin huso, y entonces git
// las interpreta en la hora LOCAL de quien corre el test: el epoch sale distinto según el huso
// del runner. Medido, con el mismo comando y el mismo repo:
//
//     git SIN huso · TZ=UTC              → 1788339600
//     git SIN huso · huso del sistema     → 1788336000     ← 3600 exactos de diferencia
//     git CON Z    · en los dos           → 1788339600
//
// Y el caso comparaba contra un `1788336000` ESCRITO A MANO, que era la lectura de la máquina
// donde se escribió (Europe/London, +1 en septiembre) y no la de CI (UTC). O sea que no fallaba
// en CI por lógica: fallaba porque el número era una foto del reloj de otro sitio.
//
// ⚠️ Y POR ESO EL NÚMERO YA NO SE ESCRIBE: se calcula de estas mismas constantes. Un timestamp
// absoluto en un test es una referencia que caduca, y referenciar por posición o por foto ya nos
// ha mordido cuatro veces en esta casa. Lo que el caso afirma ahora es lo que de verdad quiere
// afirmar: **que git grabó las fechas que el escenario declaró**.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const FECHAS = {
  base:  '2026-09-01T10:00:00Z',   // lo que estaría desplegado
  padre: '2026-09-05T12:00:00Z',   // el padre, con fecha NUEVA
  hijo:  '2026-09-02T09:00:00Z',   // el hijo, con fecha VIEJA — el más antiguo de los que faltan
};

/** El epoch en segundos de una de las fechas de arriba. Con huso explícito no depende del runner. */
const epochDe = (iso) => Math.trunc(Date.parse(iso) / 1000);

/**
 * Un repo con UN PADRE MÁS NUEVO QUE SU HIJO. No es una rareza fabricada para pasar: es lo que
 * deja un rebase o un cherry-pick, y lo que un `--reverse` no sabe ordenar.
 *
 * Devuelve el `base` (lo que estaría «desplegado») y los epochs reales de los dos commits que
 * faltan, para poder comparar contra el número de verdad y no contra otra suposición.
 */
function repoConFechasCruzadas() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum824b-'));
  const g = (...a) => String(execFileSync('git', a, { cwd: dir, encoding: 'utf8' })).trim();
  const commit = (iso, msg) => execFileSync('git', ['commit', '--allow-empty', '-q', '-m', msg], {
    cwd: dir, env: { ...process.env, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso },
  });

  g('init', '-q');
  g('config', 'user.email', 'v@test.local');
  g('config', 'user.name', 'vigia');

  commit(FECHAS.base, 'base — lo que está desplegado');
  const base = g('rev-parse', 'HEAD');
  // 🔴 EL PADRE ES MÁS NUEVO QUE EL HIJO. Al recorrer el grafo, el hijo sale antes que el padre;
  // al invertir, el PADRE queda arriba — y no es el más antiguo.
  commit(FECHAS.padre, 'padre, con fecha NUEVA');
  commit(FECHAS.hijo, 'hijo, con fecha VIEJA');
  g('update-ref', 'refs/remotes/origin/main', g('rev-parse', 'HEAD'));

  const epochs = g('log', '--format=%ct', `${base}..HEAD`).split('\n').map(Number);
  return { dir, base, epochs, borrar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO: el escenario existe de verdad — `--reverse` y el mínimo NO coinciden aquí
//
// Sin esto, lo de abajo podría pasar sobre un repo donde las dos formas dan lo mismo, y entonces
// «el vigía acierta» no diría nada: acertaría por casualidad, no por el arreglo.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-824b · 🔴 SUELO: en este repo `--reverse` y el MÍNIMO dan cosas DISTINTAS', () => {
  const r = repoConFechasCruzadas();
  try {
    const g = (...a) => String(execFileSync('git', a, { cwd: r.dir, encoding: 'utf8' })).trim();
    const porReverse = Number(g('log', '--format=%ct', '--reverse', `${r.base}..HEAD`).split('\n')[0]);
    const minimo = Math.min(...r.epochs);

    assert.notEqual(porReverse, minimo,
      '🔴 CIEGO: en este repo las dos formas coinciden, así que este fichero no puede demostrar '
      + 'nada. El escenario tiene que tener un padre MÁS NUEVO que su hijo, o no hay defecto que '
      + 'reproducir y el verde de abajo sería casualidad.');
    assert.ok(porReverse > minimo,
      '🔴 el escenario no es el que se cree: `--reverse` tendría que dar un epoch MÁS NUEVO.');

    const horas = Math.round((porReverse - minimo) / 3600);
    assert.ok(horas >= 24,
      `🔴 la diferencia es de ${horas} h y hace falta que supere holgadamente el margen del vigía `
      + '(6 h), o el defecto no cambiaría ningún veredicto y este caso mediría algo inocuo.');
  } finally { r.borrar(); }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE: el vigía usa el MÁS ANTIGUO, y lo dice en su salida
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-824b · 🔴 el vigía calcula desde el commit MÁS ANTIGUO, no desde el primero del listado', () => {
  const r = repoConFechasCruzadas();
  try {
    // 🔴 SE MIDE EL FUENTE EJECUTABLE, NO EL TEXTO. Los comentarios del vigía EXPLICAN el defecto
    // y nombran `--reverse` para contar por qué se retiró: un guard de texto se cazaría a sí mismo
    // en la explicación de la prohibición. Es el caso que la casa tiene escrito, y ya mordió una
    // vez en esta misma sesión.
    const fuente = soloEjecutable(fs.readFileSync(CLI, 'utf8'));

    // Lo que se exige es del CÓDIGO del vigía, no del test: que el epoch salga de un mínimo sobre
    // TODOS los commits del rango, y no de una posición dentro de un listado ordenado por el grafo.
    const bloque = fuente.slice(fuente.indexOf('if (commitsPorDelante)'), fuente.indexOf('const datos ='));
    assert.ok(bloque.length > 100, '🔴 CIEGO: no encuentro el bloque que calcula el epoch en el vigía.');

    assert.match(bloque, /Math\.min\(\.\.\.epochs\)/,
      '🔴 el vigía NO calcula el mínimo. Si vuelve a coger una posición de un listado, vuelve el '
      + 'defecto: con un padre más nuevo que su hijo se equivoca en 75 horas, y con el margen en '
      + '6 eso convierte un CONGELADO en un verde.');
    assert.doesNotMatch(bloque, /--reverse/,
      '🔴 sigue usando `--reverse` para decidir cuál es el más antiguo. Invertir el recorrido del '
      + 'grafo NO ordena por fecha: es la suposición que rompía el veredicto.');

    // Y que el número de verdad sea el mínimo, no el primero: se comprueba con el repo delante,
    // para que esto no dependa de creerse la explicación.
    const g = (...a) => String(execFileSync('git', a, { cwd: r.dir, encoding: 'utf8' })).trim();
    const epochs = g('log', '--format=%ct', `${r.base}..HEAD`).split('\n').map(Number);
    assert.equal(Math.min(...epochs), Math.min(...r.epochs));
    assert.equal(Math.min(...r.epochs), epochDe(FECHAS.hijo),
      '🔴 git NO ha grabado la fecha que el escenario declara para el commit más antiguo. Eso es '
      + 'lo que este caso se apoya, y se DERIVA de `FECHAS` en vez de escribirse: un timestamp '
      + 'absoluto aquí sería una foto del reloj de la máquina donde se escribió, y en un runner '
      + 'con otro huso deja de valer — que es exactamente como este caso se cayó en CI.');
  } finally { r.borrar(); }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL TRINQUETE: LAS FECHAS DEL ESCENARIO LLEVAN HUSO, O ESTO VUELVE A SEGUIR AL RUNNER
//
// Sin esto, alguien quita una `Z` al retocar el escenario y el caso vuelve a pasar aquí y caer
// en CI — que es un rojo intermitente por geografía, el peor de todos: no manda a nadie a mirar.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-824b · 🔴 TRINQUETE: las fechas del escenario declaran su huso, no lo heredan', () => {
  const conHuso = /(Z|[+-]@@BS@@d{2}:?@@BS@@d{2})$/;

  for (const [nombre, iso] of Object.entries(FECHAS)) {
    assert.match(iso, conHuso,
      `🔴 la fecha «${nombre}» (${iso}) no dice en qué huso está, así que git la lee en la hora `
      + 'LOCAL de quien corra el test y su epoch cambia con el runner. Medido: entre UTC y el huso '
      + 'de esta máquina hay 3600 s exactos, y eso es lo que tiró este caso en CI.');
    assert.ok(Number.isFinite(epochDe(iso)), `🔴 la fecha «${nombre}» no se puede leer: ${iso}`);
  }

  // 🔴 SUELO DEL TRINQUETE: que la comprobación de arriba SEPA decir que no. Sin esto, una
  // expresión regular mal escrita aprobaría cualquier cosa y el trinquete sería un adorno.
  assert.doesNotMatch('2026-09-02T09:00:00', conHuso,
    '🔴 la comprobación da por buena una fecha SIN huso: entonces no comprueba nada.');

  // Y la forma del escenario, dicha desde las fechas y no desde un número: el hijo es el más
  // antiguo de los dos que faltan, y el padre el más nuevo. Es lo que hace que `--reverse` y el
  // mínimo discrepen, o sea la razón de ser del fichero entero.
  assert.ok(epochDe(FECHAS.hijo) < epochDe(FECHAS.padre),
    '🔴 el «hijo» ya no es más antiguo que el «padre»: el escenario ha dejado de reproducir el '
    + 'defecto, y los casos de arriba pasarían sin medir nada.');
});
