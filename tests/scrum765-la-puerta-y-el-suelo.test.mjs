// tests/scrum765-la-puerta-y-el-suelo.test.mjs — SCRUM-765
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA PUERTA QUE NUNCA CASABA, Y EL SUELO QUE ESTE INSTRUMENTO LE EXIGÍA A TODOS MENOS A SÍ MISMO.
//
// `scripts/meta-guard-mutaciones.mjs` es el guard que sostiene el requisito de entrega de toda la
// casa. Su bloque de arranque preguntaba «¿me han ejecutado a mí?» comparando `import.meta.url`
// con `'file://' + argv[1]`, que en Windows **no casa nunca** (tres barras vs dos, normales vs
// invertidas, `%20` vs espacio). Arrancaba SÓLO por su respaldo `endsWith(<su nombre>)`, que
// compara por NOMBRE DE FICHERO: **copiado a otro nombre salía exit 0 en 0,28 s ejecutando CERO
// mutaciones**, frente a 76 s y 31 por su nombre real.
//
// ── 🔴 Y LA SEGUNDA MITAD LA ENCONTRÓ CI, MIDIENDO UNA PREDICCIÓN MÍA ───────────────────────
// La primera versión de este guard llevaba pares `argv[1]`/`import.meta.url` **congelados** de una
// sonda de Windows. En el runner de Linux, una cadena `C:\Users\…` no es una ruta absoluta: es un
// nombre de fichero relativo. El guard se puso rojo, y con razón — **el defecto estaba en la
// simulación del test**, no en la puerta (CI lo demostró a la vez: el meta-guard ejecutó allí 42
// mutaciones, o sea que su puerta SÍ abría en Linux).
//
// Al medirlo apareció un defecto REAL de la puerta, que era un hueco declarado: Node resuelve el
// módulo de ENTRADA pasando por `realpath`, así que con un ENLACE de por medio `import.meta.url`
// trae la ruta real y `argv[1]` la escrita, y **la puerta no abría**. Medido con un junction en
// Windows: `false`. Con `realpath` a los dos lados: `true`.
//
// ⛔ POR ESO AQUÍ YA NO SE SIMULA NADA. Se arranca `tests/_sonda-puerta.mjs` DE VERDAD, en cada
// forma de invocación, en la plataforma en la que esté corriendo el guard.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { censoDePuertasFragiles, ejecutadoDirectamente, puertasFragilesEn } from '../scripts/_puerta-de-entrada.mjs';
import {
  SUELO_DECLARACIONES, SUELO_GUARDS, censoDeDeclaraciones, sueloDeEjecucion, sueloDelCenso,
} from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SONDA_REL = 'tests/_sonda-puerta.mjs';

/** Arranca la sonda y devuelve lo que imprime. `args[0]` es la ruta con la que se la invoca. */
function arrancarSonda(ruta, cwd = RAIZ) {
  return execFileSync(process.execPath, [ruta], { cwd, encoding: 'utf8', timeout: 120000 }).trim();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ① LA PUERTA, MEDIDA EN LA PLATAFORMA EN LA QUE CORRE — arrancando procesos de verdad
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-765 · la puerta ABRE en todas las formas de invocación, incluida a través de un enlace', () => {
  const formas = [
    { como: 'ruta relativa (lo que hace `npm run`)', ruta: SONDA_REL, cwd: RAIZ },
    { como: 'ruta absoluta', ruta: path.join(RAIZ, SONDA_REL), cwd: RAIZ },
    { como: 'ruta relativa desde otro cwd', ruta: path.join('..', SONDA_REL), cwd: path.join(RAIZ, 'scripts') },
  ];

  // 🔴 EL CASO DEL ENLACE, que es el defecto que destapó CI. Un enlace de DIRECTORIO no exige
  // privilegios en ninguna de las dos plataformas (`junction` en Windows, `dir` en Linux), así que
  // este caso CORRE, no se salta. Si aun así no se pudiera crear, el test se declara CIEGO en vez
  // de pasar sin haberlo probado.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum765-'));
  let motivoSinEnlace = null;
  try {
    const enlace = path.join(tmp, 'repo');
    fs.symlinkSync(RAIZ, enlace, process.platform === 'win32' ? 'junction' : 'dir');
    formas.push({ como: 'A TRAVÉS DE UN ENLACE al repositorio', ruta: path.join(enlace, SONDA_REL), cwd: RAIZ });
  } catch (e) {
    motivoSinEnlace = `${e.code}: ${e.message}`;
  }

  try {
    assert.equal(motivoSinEnlace, null,
      '🔴 CIEGO: no he podido crear el enlace, así que NO he probado el caso que destapó CI. '
      + `No es un verde: es que no he medido. (${motivoSinEnlace})`);

    // SUELO: sin formas que probar esto no probaría nada.
    assert.ok(formas.length >= 4, `🔴 SUELO: sólo ${formas.length} formas de invocación.`);

    for (const f of formas) {
      assert.equal(arrancarSonda(f.ruta, f.cwd), 'PUERTA:ABRE',
        `🔴 la puerta NO abre con ${f.como} (${process.platform}). El script no arrancaría, y un `
        + 'script que no arranca sale con 0 sin haber hecho nada — que es el defecto entero de '
        + 'SCRUM-765.');
    }

    // 🔴 CONTROL POSITIVO DEL INSTRUMENTO: la sonda TIENE que saber decir que no. Sin esto, una
    // sonda que imprimiera siempre `PUERTA:ABRE` pasaría los cuatro casos de arriba sin medir nada.
    const importadora = path.join(tmp, 'importadora.mjs');
    fs.writeFileSync(importadora, `import ${JSON.stringify(pathToFileURL(path.join(RAIZ, SONDA_REL)).href)};\n`);
    assert.equal(arrancarSonda(importadora), 'PUERTA:NO-ABRE',
      '🔴 la sonda dice ABRE aunque la hayan IMPORTADO. O la puerta está rota por el otro lado '
      + '—arrancaría sus mutaciones dentro de cualquier proceso que la importe— o la sonda '
      + 'imprime una constante y los cuatro verdes de arriba no significan nada.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('SCRUM-765 · CONTRASTE: la puerta NO abre para nadie que no sea el fichero de entrada', () => {
  // Con valores REALES de este proceso: `process.argv[1]` es este fichero de test.
  const otro = pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href;
  assert.equal(ejecutadoDirectamente(otro, process.argv[1]), false,
    '🔴 el meta-guard se creería el punto de entrada mientras lo importa un test: ejecutaría sus '
    + 'mutaciones dentro de la suite.');

  // Sin fichero de entrada (`node -e`, REPL) no hay nada con lo que casar.
  assert.equal(ejecutadoDirectamente(otro, undefined), false);
  assert.equal(ejecutadoDirectamente(otro, ''), false);

  // Un `metaUrl` que no es `file:` no se puede resolver a un fichero: ante la duda, NO se arranca.
  assert.equal(ejecutadoDirectamente('data:text/javascript,1', process.argv[1]), false);

  // Una ruta que ya no está en disco tampoco afirma nada.
  assert.equal(ejecutadoDirectamente(otro, path.join(RAIZ, 'no-existe-scrum765.mjs')), false);

  // CONTROL POSITIVO: consigo mismo SÍ abre. Sin esto, una función que devolviera `false` siempre
  // pasaría todos los asertos de arriba.
  assert.equal(ejecutadoDirectamente(pathToFileURL(process.argv[1]).href, process.argv[1]), true,
    '🔴 la puerta no abre ni consigo misma: el comparador está roto, no protegiendo.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ② EL CENSO DE PUERTAS FRÁGILES · por AST
//
// 🔴 POR AST Y NO POR TEXTO: la cabecera de `_puerta-de-entrada.mjs` escribe la forma prohibida
// varias veces para poder explicarla, así que un censo por `grep` se cazaría a sí mismo en la
// prosa — el defecto de SCRUM-614/617, y el motivo de la regla de SCRUM-203.
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-765 · el censo de puertas frágiles VE lo que dice ver', () => {
  // CONTROL POSITIVO ①: la forma de plantilla.
  const conPlantilla = puertasFragilesEn(
    'if (import.meta.url === `file://${process.argv[1]}`) { corre(); }', 'sintetico.mjs');
  assert.equal(conPlantilla.length, 1, '🔴 el censo no ve la forma de plantilla.');

  // CONTROL POSITIVO ②: la forma de suma, y la variante que sólo cambia el sentido de las barras
  // (la de `scripts/backfill-job-assignees.mjs`), que TAMPOCO casa en Windows.
  const conSuma = puertasFragilesEn(
    "if (import.meta.url === 'file://' + process.argv[1]) { corre(); }", 'sintetico.mjs');
  assert.equal(conSuma.length, 1, '🔴 el censo no ve la forma de suma.');
  const conReplace = puertasFragilesEn(
    'if (import.meta.url === `file://${process.argv[1].replace(/x/g, "/")}`) { corre(); }',
    'sintetico.mjs');
  assert.equal(conReplace.length, 1, '🔴 el censo no ve la variante con `.replace()` dentro.');

  // CONTROL NEGATIVO: la forma buena NO se denuncia. Sin esto, un censo que marcara todo pasaría
  // los tres controles de arriba y dejaría el techo de abajo inservible.
  const buena = puertasFragilesEn(
    'if (import.meta.url === pathToFileURL(process.argv[1]).href) { corre(); }', 'sintetico.mjs');
  assert.equal(buena.length, 0, '🔴 el censo marca como frágil la forma que SÍ casa.');

  // Y no se caza en un comentario, que es como se envenenan estos censos.
  const comentada = puertasFragilesEn(
    '// prohibido: import.meta.url === `file://${process.argv[1]}`\nconst x = 1;', 'sintetico.mjs');
  assert.equal(comentada.length, 0, '🔴 el censo se caza a sí mismo en la prosa que lo explica.');
});

/**
 * TECHO DEL ÁRBOL — este número SÓLO BAJA.
 *
 * Medido el 6-sep-2026 sobre `scripts/` y `tests/`: DOS puertas frágiles, las dos fuera de este
 * ticket y las dos REPORTADAS sin tocar, porque cambiar cuándo arranca un script no es cosmética:
 *
 *   · `scripts/_prisma-sync.mjs` — misma forma y mismo respaldo `endsWith()` que tenía el
 *     meta-guard: arranca sólo por el respaldo.
 *   · `scripts/backfill-job-assignees.mjs` — la variante que invierte las barras, y SIN respaldo:
 *     su bloque de arranque no se ejecuta nunca en Windows. Y ese bloque ESCRIBE EN UNA BASE DE
 *     DATOS. Arreglarle la puerta es ENCENDER un backfill que hoy está apagado, y eso lo decide
 *     el fundador con el diff delante — no una sesión que pasaba por aquí (reglas 9 y 37).
 *
 * Lo que este techo impide es que aparezcan MÁS. Bajarlo al arreglar una de las dos es el camino
 * previsto; subirlo es meter el defecto otra vez.
 */
const TECHO_PUERTAS_FRAGILES = 2;

test('SCRUM-765 · el árbol NO gana puertas frágiles, y el meta-guard ya no es una de ellas', () => {
  const { puertas, ficherosVistos } = censoDePuertasFragiles(RAIZ);

  // SUELO: un censo que no encuentra ficheros diría «0 puertas frágiles» con la misma cara.
  assert.ok(ficherosVistos > 50,
    `🔴 el censo sólo ha mirado ${ficherosVistos} ficheros: su cero no significaría nada.`);

  assert.ok(puertas.length <= TECHO_PUERTAS_FRAGILES,
    `🔴 hay ${puertas.length} puertas frágiles y el techo es ${TECHO_PUERTAS_FRAGILES}:\n  · `
    + puertas.map((p) => `${p.fichero}:${p.linea} (${p.forma})`).join('\n  · ')
    + '\n\nEsa comparación NUNCA casa en Windows: el script no arranca, o arranca por un respaldo '
    + 'que compara por nombre de fichero. Usa `ejecutadoDirectamente()` de '
    + '`scripts/_puerta-de-entrada.mjs`.');

  // Y el instrumento de este ticket, por su nombre: que el techo no se lo trague por el hueco.
  assert.equal(puertas.filter((p) => p.fichero.includes('meta-guard-mutaciones')).length, 0,
    '🔴 el meta-guard ha vuelto a la puerta que nunca casa.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ③ LOS DOS SUELOS · exigiéndoles el rojo, no leyéndolos
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-765 · SUELO DEL CENSO: si el censo encoge, es CIEGO', () => {
  // Verde con lo que hay hoy.
  assert.equal(sueloDelCenso({ guards: SUELO_GUARDS, declaraciones: SUELO_DECLARACIONES }), null);

  // 🔴 EL ROJO, PROVOCADO. Un `MUTACIONES_QUE_ME_TUMBAN` borrado entero baja el censo en uno.
  const unGuardMenos = sueloDelCenso({
    guards: SUELO_GUARDS - 1, declaraciones: SUELO_DECLARACIONES,
  });
  assert.ok(unGuardMenos && unGuardMenos.includes('ENCOGIDO'),
    '🔴 borrar la declaración de un guard entero no dispara el suelo: el censo baja de N a N-1 '
    + 'y el job sigue verde, que es el hueco hermano de SCRUM-745.');

  // Y una declaración menos dentro de un guard que conserva otras: mismo agujero, más pequeño.
  assert.ok(sueloDelCenso({ guards: SUELO_GUARDS, declaraciones: SUELO_DECLARACIONES - 1 }),
    '🔴 perder UNA declaración no dispara el suelo.');

  // El trinquete tiene que ser honesto: si el suelo estuviera por encima de lo que hay, el job
  // estaría rojo y alguien lo bajaría para callarlo. Si está muy por debajo, no sujeta nada.
  const censo = censoDeDeclaraciones();
  const guards = censo.filter((c) => c.mutaciones.length).length;
  const declaraciones = censo.reduce((n, c) => n + c.mutaciones.length, 0);
  assert.ok(guards >= SUELO_GUARDS && declaraciones >= SUELO_DECLARACIONES,
    `🔴 el árbol tiene ${guards} guards y ${declaraciones} declaraciones, por DEBAJO del suelo `
    + `declarado (${SUELO_GUARDS} / ${SUELO_DECLARACIONES}).`);
});

test('SCRUM-765 · SUELO DE EJECUCIÓN: cero mutaciones ejecutadas es CIEGO, no verde', () => {
  // 🔴 EL CASO QUE PASÓ: el script llega al final sin haber mutado nada y sale con 0.
  const nada = sueloDeEjecucion({ vivas: 0, mudas: 0 });
  assert.ok(nada && nada.includes('NI UNA MUTACIÓN'),
    '🔴 cero mutaciones ejecutadas sale VERDE: es exactamente el exit 0 de 0,28 s del ticket.');

  // Y las CIEGAS no cuentan como trabajo: se descartaron antes de tocar el árbol.
  assert.ok(sueloDeEjecucion({ vivas: 0, mudas: 0, ciegas: 99 }),
    '🔴 99 ciegas se están contando como «he medido». «No supe medir» no es medir.');

  // CONTROL POSITIVO: con trabajo hecho, el suelo calla. Una viva basta, y una muda también —
  // una muda es un hallazgo, no una ceguera.
  assert.equal(sueloDeEjecucion({ vivas: 1, mudas: 0 }), null);
  assert.equal(sueloDeEjecucion({ vivas: 0, mudas: 1 }), null);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ④ DE PUNTA A PUNTA · que el meta-guard ARRANQUE de verdad
//
// Los de arriba miden la puerta con la sonda. Éste mide el sujeto real: si su puerta se rompiera,
// saldría con 0 sin decir nada. `--solo-censo` existe para poder comprobarlo en segundos.
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-765 · el meta-guard ARRANCA de verdad al invocarlo por su ruta', () => {
  const salida = execFileSync(process.execPath,
    [path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs'), '--solo-censo'],
    { cwd: RAIZ, encoding: 'utf8', timeout: 120000 });

  assert.match(salida, /censo · \d+ guards · \d+ declaraciones/,
    '🔴 el script ha salido sin decir nada: la puerta no ha abierto. Es el defecto de SCRUM-765 '
    + 'otra vez — un exit 0 sobre cero trabajo.');
  assert.match(salida, /NO se ha ejecutado ninguna mutación/,
    '🔴 el modo censo ya no avisa de que no ha mutado nada: un verde suyo se leería como el '
    + 'del trabajo completo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MUTACIÓN QUE ME TUMBA (SCRUM-745)
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La puerta deja de comparar y no abre nunca: el script no arranca y sale con 0 sin trabajar.
    fichero: 'scripts/_puerta-de-entrada.mjs',
    de: '    return fs.realpathSync(fileURLToPath(metaUrl)) === fs.realpathSync(argv1);',
    a: '    return false;',
    cae: 'la puerta ABRE en todas las formas de invocación',
  },
  {
    // El `catch` deja de fallar cerrado: un `metaUrl` que no se puede resolver a un fichero
    // pasaría por «sí, soy yo». Es la puerta abriéndose por no saber, que es peor que no abrir.
    //
    // 📌 AQUÍ IBA OTRA, Y LA RETIRÉ CON LA MEDICIÓN DELANTE. Era `la comparación → return true`
    // (la puerta abre para todos). `npm run meta:mutaciones` la declaró **MUDA**, y no lo era:
    // con la puerta abierta de par en par, el `import` que este fichero hace de
    // `meta-guard-mutaciones.mjs` **ejecuta su bloque principal dentro del proceso del test**, que
    // es exactamente para lo que la puerta existe. Medido a mano: el fichero entero muere —
    // `not ok 1 - tests\scrum765-…test.mjs`, `exitCode: 2`— y por eso NINGÚN nombre de test llega
    // a reportarse. El guard SÍ cae; lo que no cae es el test que la declaración nombraba.
    //
    // 🔴 Es un hueco del contrato de SCRUM-745, no de este guard: **una mutación cuyo radio mata
    // al fichero sale MUDA aunque el árbol se haya puesto rojo**. Va reportado aparte. Aquí se
    // elige una mutación del mismo valor y sin ese radio: el `catch` no lo pisa ningún `import`.
    fichero: 'scripts/_puerta-de-entrada.mjs',
    de: '    // que seamos la entrada, y ante la duda no se arranca.\n    return false;',
    a: '    return true;',
    cae: 'CONTRASTE: la puerta NO abre para nadie que no sea el fichero de entrada',
  },
  {
    // Sin fichero de entrada (`node -e`, REPL) la puerta se daría por abierta.
    fichero: 'scripts/_puerta-de-entrada.mjs',
    de: '  if (!argv1) return false; // `node -e`, REPL: no hay fichero de entrada, luego no somos él',
    a: '  if (!argv1) return true;',
    cae: 'CONTRASTE: la puerta NO abre para nadie que no sea el fichero de entrada',
  },
  {
    // Aflojar el suelo del censo hasta que deje de sujetar: un guard menos pasaría en silencio.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (guards >= SUELO_GUARDS && declaraciones >= SUELO_DECLARACIONES) return null;',
    a: '  if (guards >= 0 && declaraciones >= 0) return null;',
    cae: 'SUELO DEL CENSO: si el censo encoge, es CIEGO',
  },
  {
    // Contar las ciegas como trabajo hecho: «no supe medir» pasaría por «he medido».
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (vivas + mudas > 0) return null;',
    a: '  if (vivas + mudas >= 0) return null;',
    cae: 'SUELO DE EJECUCIÓN: cero mutaciones ejecutadas es CIEGO, no verde',
  },
];
