// SCRUM-928b · EL COLOR NO PUEDE TAPAR EL VEREDICTO DE LA TANDA.
//
// Sin gate: tandas FABRICADAS en un temporal y órdenes de una línea, lanzadas a través de
// `scripts/tanda-con-veredicto.mjs`. Ni BD, ni red, ni la suite real.
//
// EL DEFECTO (medido el 17-sep-2026 sobre origin/main 6775cd9c, cuadro 2×2 rama/main × con/sin
// color): con `FORCE_COLOR` en el entorno, el envoltorio de SCRUM-858b convierte una tanda SANA
// que salió 0 en un exit 4 «TANDA SIN RESUMEN». Y como `package.json` define `test` a través del
// envoltorio, `npm test` da rojo con el árbol entero en verde, para cualquier sesión.
//
// LOS BYTES, que son los que deciden el arreglo:
//     sin color   E2 84 B9 20 74 65 73 74 73 20 31                                  «ℹ tests 1»
//     con color   1B 5B 33 34 6D  E2 84 B9 20 74 65 73 74 73 20 31  1B 5B 33 39 6D
//                 ESC[34m         «ℹ tests 1»                       ESC[39m
// El reporter pinta la línea ENTERA: un ESC DELANTE del glifo y otro DETRÁS del número. El glifo
// y los dígitos no cambian.
//
// 🔴 POR QUÉ LA SEMILLA LLEVA EL ESC DE DELANTE, y no uno cualquiera. Probado cada forma contra
// cada regex, el 17-sep-2026:
//
//     caso                 envoltorio (RESUMEN)   guards-entrada.mjs
//     sin color            casa                   casa
//     solo ESC delante     NO CASA                casa
//     solo ESC detrás      casa                   NO CASA
//     los dos (lo real)    NO CASA                NO CASA
//
// O sea que son DOS defectos con el mismo síntoma y ESC distintos: a este envoltorio lo rompe el de
// DELANTE (el `\s*` de `RESUMEN` no se traga el ESC); a `guards-entrada.mjs` lo rompe el de DETRÁS
// (su `[^\n]*` sí absorbe el de delante, y lo que no casa es el `\s*$` final contra el `ESC[39m`).
// Una semilla con el ESC sólo detrás dejaría este fichero en VERDE sobre el defecto vivo, y una con
// el ESC sólo delante dejaría en verde el de S5. Cada uno siembra el suyo.
//
// ⚠️ REPARTO: `scripts/guards-entrada.mjs` es de la Sesión 5 (SCRUM-928 punto 2) y aquí NO se toca.
// Este fichero cubre SÓLO `scripts/tanda-con-veredicto.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ENVOLTORIO = path.join(RAIZ, 'scripts', 'tanda-con-veredicto.mjs');

/** Lo que el meta-guard de la casa EJECUTA contra este fichero. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Apagar la limpieza de color devuelve el defecto entero: la tanda sana vuelve a salir con 4.
    fichero: 'scripts/tanda-con-veredicto.mjs',
    de: '  if (!conResumen && RESUMEN.test(sinColor(cola))) conResumen = true;',
    a: '  if (!conResumen && RESUMEN.test(cola)) conResumen = true;',
    cae: '🔴 EL CONTROL QUE DECIDE: una tanda sana cuyo recuento viene con color sale con 0',
  },
  {
    // La limpieza que se lleva por delante el recuento entero: nunca habría resumen y todo saldría 4.
    fichero: 'scripts/tanda-con-veredicto.mjs',
    de: "const sinColor = (s) => s.replace(CSI, '');",
    a: "const sinColor = (s) => '';",
    cae: '✅ POSITIVO: sin color el envoltorio sigue dando exactamente el mismo veredicto que antes',
  },
];

const ESC = '\u001B';
const GLIFO = 'ℹ'; // «ℹ», el del reporter `spec`
const RECUENTO_PLANO = `${GLIFO} tests 1`;
const RECUENTO_COLOR = `${ESC}[34m${GLIFO} tests 1${ESC}[39m`;

/**
 * El entorno de una tanda FABRICADA: sin `NODE_TEST_CONTEXT`, o `node --test` no corre nada y sale
 * 0; y sin `NODE_OPTIONS`, que en el CI trae un reporter a la salida estándar y le regala a la
 * tanda un recuento que no era suyo (medido en el CI del #1441).
 */
const entorno = (extra = {}) => {
  const e = { ...process.env };
  delete e.NODE_TEST_CONTEXT;
  delete e.NODE_OPTIONS;
  delete e.FORCE_COLOR; // el que trae el chat que lanza la sesión; cada caso pone el suyo
  return { ...e, ...extra };
};

/** El envoltorio sobre una orden de una línea que escribe lo que se le diga y sale con 0. */
const envueltaEscribiendo = (texto, extra = {}) => spawnSync(
  process.execPath,
  [ENVOLTORIO, 'node', '-e', `process.stdout.write(${JSON.stringify(texto)})`],
  { env: entorno(extra), encoding: 'utf8', timeout: 60_000 },
);

/** El envoltorio sobre una tanda de verdad, fabricada en un temporal. */
function envueltaTanda(extra = {}, ficheros = { 'sano.test.mjs': "import test from 'node:test';\ntest('sano', () => {});\n" }) {
  const dir = temporal('yaqu-928b-');
  for (const [n, c] of Object.entries(ficheros)) fs.writeFileSync(path.join(dir, n), c);
  return spawnSync(process.execPath, [ENVOLTORIO, 'node', '--test', '--test-force-exit', ...Object.keys(ficheros)],
    { cwd: dir, env: entorno(extra), encoding: 'utf8', timeout: 120_000 });
}

// ── SUELO ──────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-928b · SUELO: el envoltorio existe, `npm test` pasa por él, y node SÍ colorea con FORCE_COLOR', () => {
  assert.ok(fs.existsSync(ENVOLTORIO), '🔴 NO PUDE MIRAR: no existe scripts/tanda-con-veredicto.mjs');
  const script = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts.test;
  assert.match(script, /node scripts\/tanda-con-veredicto\.mjs node --test /,
    `🔴 \`npm test\` no pasa por el envoltorio, así que este defecto no le costaría nada a nadie. Script: ${script}`);

  // Y el suelo que impide que este fichero entero sea una tautología: si node dejara de colorear,
  // los casos de abajo pasarían SIN TOCAR NADA y esto se leería como «arreglado». Que grite.
  const r = spawnSync(process.execPath, ['-e', 'console.log(7)'],
    { env: entorno({ FORCE_COLOR: '3' }), encoding: 'utf8', timeout: 30_000 });
  assert.equal(r.status, 0, `🔴 NO PUDE MIRAR: la sonda de color no corrió (${r.error?.message})`);
  assert.ok(r.stdout.includes(ESC),
    `🔴 NO PUDE MIRAR: con FORCE_COLOR=3 este node ya no mete códigos de color (${JSON.stringify(r.stdout)}).`
    + ' Los casos de este fichero dejarían de medir el defecto y pasarían solos: revísalos antes de creerte el verde.');
});

// ── EL CONTROL QUE DECIDE ──────────────────────────────────────────────────────────────────────

test('SCRUM-928b · 🔴 EL CONTROL QUE DECIDE: una tanda sana cuyo recuento viene con color sale con 0', () => {
  // Semilla DETERMINISTA: los bytes exactos medidos, sin depender de cómo pinte node mañana.
  const r = envueltaEscribiendo(`ok 1 - algo\n${RECUENTO_COLOR}\n`);
  assert.equal(r.status, 0,
    `🔴 el envoltorio ha convertido un 0 en ${r.status} porque el recuento venía con color.`
    + ` Eso es SCRUM-928: un verde leído como rojo. stderr: ${r.stderr.slice(-300)}`);
  assert.doesNotMatch(r.stderr, /TANDA SIN RESUMEN/,
    '🔴 ha visto el recuento pero igual ha gritado «TANDA SIN RESUMEN»');

  // Y la variante que rompe al OTRO instrumento (el ESC sólo detrás) aquí también tiene que pasar:
  // el arreglo no puede acertar con una forma y fallar con la otra.
  const soloDetras = envueltaEscribiendo(`${RECUENTO_PLANO}${ESC}[39m\n`);
  assert.equal(soloDetras.status, 0, `🔴 con el ESC sólo detrás ha salido ${soloDetras.status}`);
  const soloDelante = envueltaEscribiendo(`${ESC}[34m${RECUENTO_PLANO}\n`);
  assert.equal(soloDelante.status, 0, `🔴 con el ESC sólo delante ha salido ${soloDelante.status}`);
});

test('SCRUM-928b · 🔴 y con una tanda DE VERDAD y FORCE_COLOR puesto, `npm test` no puede dar rojo', () => {
  const r = envueltaTanda({ FORCE_COLOR: '3' });
  // Control de la cobaya ANTES de juzgar: si la tanda no llegó a colorear, este caso no mide nada.
  assert.ok(r.stdout.includes(ESC),
    '🔴 NO PUDE MIRAR: la tanda fabricada no ha sacado ni un código de color, así que su verde no'
    + ` dice nada sobre el defecto. stdout: ${JSON.stringify(r.stdout.slice(0, 200))}`);
  assert.match(r.stdout.replace(/\u001B\[[0-9;]*m/g, ''), /(ℹ|#) tests \d+/,
    '🔴 NO PUDE MIRAR: la tanda fabricada no ha emitido línea de recuento ni quitándole el color');
  assert.equal(r.status, 0,
    `🔴 una tanda sana con color ha salido con ${r.status}. stderr: ${r.stderr.slice(-300)}`);
});

// ── POSITIVO: lo de antes no se mueve ──────────────────────────────────────────────────────────

test('SCRUM-928b · ✅ POSITIVO: sin color el envoltorio sigue dando exactamente el mismo veredicto que antes', () => {
  const sano = envueltaEscribiendo(`${RECUENTO_PLANO}\n`);
  assert.equal(sano.status, 0, `🔴 una tanda sana SIN color ha salido con ${sano.status}`);
  assert.equal(sano.stderr, '', '🔴 el envoltorio escribe algo en una tanda sana');

  // La salida pasa TAL CUAL, byte a byte, con color y sin él: la limpieza es sólo para LEER el
  // recuento, nunca para lo que se imprime. Es la propiedad que 858b ya exigía.
  assert.equal(sano.stdout, `${RECUENTO_PLANO}\n`, '🔴 el envoltorio ha alterado la salida sin color');
  const conColor = envueltaEscribiendo(`${RECUENTO_COLOR}\n`);
  assert.equal(conColor.stdout, `${RECUENTO_COLOR}\n`,
    '🔴 el envoltorio se ha comido los códigos de color de la salida: la limpieza es para leer, no para imprimir');
});

// ── NEGATIVO: el arreglo no puede abrir el agujero que 858b cerró ──────────────────────────────

test('SCRUM-928b · 🔴 NEGATIVO: una tanda que de verdad NO emite recuento sigue saliendo con 4, con color y sin él', () => {
  const sinColor = envueltaEscribiendo('hola, no soy una tanda\n');
  assert.equal(sinColor.status, 4, `🔴 un 0 sin recuento ha salido con ${sinColor.status}: el agujero de 858 está abierto`);
  assert.match(sinColor.stderr, /TANDA SIN RESUMEN/);

  // Y el caso que la limpieza podría estropear: algo coloreado que NO es un recuento. Si el arreglo
  // fuera «cualquier cosa vale», esto pasaría a 0 y habríamos cambiado un falso rojo por un falso verde.
  const conColor = envueltaEscribiendo(`${ESC}[32mhola, no soy una tanda${ESC}[39m\n`);
  assert.equal(conColor.status, 4, `🔴 un 0 sin recuento, coloreado, ha salido con ${conColor.status}`);
  assert.match(conColor.stderr, /TANDA SIN RESUMEN/);

  // Un recuento a MEDIAS tampoco vale: `tests` sin número no es un veredicto.
  const aMedias = envueltaEscribiendo(`${ESC}[34m${GLIFO} tests${ESC}[39m\n`);
  assert.equal(aMedias.status, 4, `🔴 «tests» sin número ha contado como recuento (salió ${aMedias.status})`);
});
