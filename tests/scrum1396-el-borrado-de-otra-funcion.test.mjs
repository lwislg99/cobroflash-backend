// tests/scrum1396-el-borrado-de-otra-funcion.test.mjs — SCRUM-1396
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL GUARD SE SATISFACÍA ARREGLANDO UNO DE N
//
// `scripts/_censo-mkdtemp.mjs` emparejaba cada temporal con su borrado por el NOMBRE de la
// variable, en todo el fichero. Dos funciones con un `dir` cada una eran el mismo `dir`: el
// `finally` de una cubría a la otra. Medido el 6-oct-2026 con cuatro fugas que se llamaban igual:
// arreglar UNA dejaba las cuatro en GARANTIZADA, y `scrum864c` salía verde con tres dentro.
//
// `scrum864c` ①b ya vigilaba «el borrado de OTRA variable no es el mío», pero con otro NOMBRE.
// Lo que no se le había puesto delante es otra variable con el MISMO nombre, que es la forma
// corriente: casi todos los temporales de la casa se llaman `dir`.
//
// Este fichero es el rojo de eso, y su otra mitad: lo que tiene que SEGUIR saliendo GARANTIZADA,
// porque un censo que acuse a quien limpia bien acaba apagado.
//
// ⛔ No crea ningún temporal y no ejecuta las fuentes: se las pasa al censo como texto.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censar, clasificaFuente, lineaDePoblacion } from '../scripts/_censo-mkdtemp.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NL = '\n';

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/_censo-mkdtemp.mjs',
    de: '      if (c.variable && !b.variables.has(c.variable)) return false;',
    a: '      if (false) return false;',
    cae: '🔴 ① UNO DE N: arreglar una fuga no pone en verde a las que se llaman igual',
  },
];

const CREA = "  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-'));";
const fuga = (nombre) => [`function ${nombre}() {`, CREA, '  usar(dir);', '}'];
const limpia = (nombre, variable = 'dir') => [
  `function ${nombre}() {`,
  CREA.replace('const dir', 'const ' + variable),
  `  try { usar(${variable}); } finally { fs.rmSync(${variable}, { recursive: true, force: true }); }`,
  '}',
];
const dice = (lineas) => clasificaFuente('fabricado.mjs', lineas.join(NL)).map((l) => l.categoria);

test('SCRUM-1396 · 🔴 ① UNO DE N: arreglar una fuga no pone en verde a las que se llaman igual', () => {
  // Las tres fuentes del ticket: b() sola, b() con una a() homónima que sí limpia, y el control.
  assert.deepEqual(dice(fuga('b')), ['SIN_LIMPIEZA'],
    '🔴 CONTROL: una función que crea y no borra ya no sale SIN_LIMPIEZA. Sin esto, lo de abajo no mide nada.');
  assert.deepEqual(dice([...limpia('a'), ...fuga('b')]), ['GARANTIZADA', 'SIN_LIMPIEZA'],
    '🔴 EL BORRADO DE a() CUBRE A b() PORQUE SUS VARIABLES SE LLAMAN IGUAL. Es el defecto del ticket: el '
    + 'censo empareja por nombre y no por variable. Mira el filtro de `suyos` en `clasificaFuente`.');
  assert.deepEqual(dice([...limpia('a', 'otro'), ...fuga('b')]), ['GARANTIZADA', 'SIN_LIMPIEZA'],
    '🔴 CONTROL: con otro nombre en a(), b() tiene que seguir saliendo SIN_LIMPIEZA.');

  // Y el rojo raro: N fugas homónimas, se arregla UNA, y las otras N-1 se tienen que seguir viendo.
  const N = 4;
  const nombres = ['uno', 'dos', 'tres', 'cuatro'];
  assert.deepEqual(dice(nombres.flatMap(fuga)), Array(N).fill('SIN_LIMPIEZA'),
    '🔴 CONTROL: las cuatro fugas, antes de arreglar ninguna, tienen que salir las cuatro.');
  assert.deepEqual(
    dice([...limpia(nombres[0]), ...nombres.slice(1).flatMap(fuga)]),
    ['GARANTIZADA', ...Array(N - 1).fill('SIN_LIMPIEZA')],
    `🔴 ARREGLAR UNA DE ${N} PONE EN VERDE A LAS ${N} — quedan ${N - 1} fugas dentro y el guard calla.`,
  );
});

// ═══ ② LO QUE TIENE QUE SEGUIR SALIENDO GARANTIZADA ══════════════════════════════════════════
//
// La mitad que puede tumbar el arreglo. «Por variable» no es «en la misma función»: una variable
// de módulo que se llena en un `before` y se borra en un `after` es UNA variable en dos funciones,
// y es la forma más corriente de limpiar bien en un test.

const SIGUEN = [
  {
    porque: 'crea y borra en la misma función, bajo `finally`',
    fuente: limpia('a'),
    espera: ['GARANTIZADA'],
  },
  {
    porque: 'dos funciones, cada una con su `dir` y su `finally`: ninguna depende de la otra',
    fuente: [...limpia('a'), ...limpia('b')],
    espera: ['GARANTIZADA', 'GARANTIZADA'],
  },
  {
    porque: 'UNA variable de módulo: se llena en un `before` y se borra en un `after` — otra función, la misma variable',
    fuente: [
      'let dir;',
      "before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caso-')); });",
      'after(() => fs.rmSync(dir, { recursive: true, force: true }));',
    ],
    espera: ['GARANTIZADA'],
  },
  {
    porque: "`process.on('exit')` dentro de la función que crea, con el borrado detrás de una comprobación",
    fuente: [
      'function montar() {',
      CREA,
      "  process.on('exit', () => { const e = soltar(dir); if (e.quitado) fs.rmSync(dir, { recursive: true, force: true }); });",
      '  usar(dir);',
      '}',
    ],
    espera: ['GARANTIZADA'],
  },
  {
    porque: 'el nombre guarda una ruta DE DENTRO y el `finally` de su función sube con `dirname`',
    fuente: [
      'function a() {',
      "  const copia = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'caso-')), 'x.mjs');",
      '  try { usar(copia); } finally { fs.rmSync(path.dirname(copia), { recursive: true, force: true }); }',
      '}',
    ],
    espera: ['GARANTIZADA'],
  },
  {
    porque: 'una función de limpieza anidada que borra la variable de la función que la contiene',
    fuente: [
      'function a() {',
      CREA,
      '  after(() => { fs.rmSync(dir, { recursive: true, force: true }); });',
      '}',
    ],
    espera: ['GARANTIZADA'],
  },
];

test('SCRUM-1396 · 🔴 ② EL POSITIVO: quien borra SU temporal sigue saliendo GARANTIZADA', () => {
  const dichas = SIGUEN.map((c) => ({ porque: c.porque, espera: c.espera, dice: dice(c.fuente) }));
  assert.deepEqual(
    dichas.filter((d) => JSON.stringify(d.dice) !== JSON.stringify(d.espera)),
    [],
    '🔴 EL CENSO ACUSA A QUIEN LIMPIA BIEN. Un arreglo que convierte en fuga lo que está bien es peor que '
    + 'el defecto: este guard tiene que seguir siendo usable o alguien lo apagará.',
  );
});

test('SCRUM-1396 · ③ un `dir` de dentro que tapa al de fuera es OTRA variable, y el `b.dir` del llamador no es ninguna', () => {
  // Sombreado: el `finally` borra el `dir` de FUERA; el de dentro, que se llama igual, no se borra.
  assert.deepEqual(dice([
    'function a() {',
    CREA,
    '  try {',
    "    for (const x of xs) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dentro-')); usar(dir, x); }",
    '  } finally { fs.rmSync(dir, { recursive: true, force: true }); }',
    '}',
  ]), ['GARANTIZADA', 'SIN_LIMPIEZA'],
  '🔴 el `dir` del bucle sale cubierto por el `finally` que borra el `dir` de fuera: son dos variables.');

  // La decisión del 17-sep-2026 NO se toca: el directorio que sale por un `return` es ESCAPA aunque
  // el llamador lo borre, porque «el llamador no se acuerda» (`sinDueno` en el censo). Antes de
  // SCRUM-1396 este caso salía GARANTIZADA sólo porque el llamador escribía `b.dir`.
  assert.deepEqual(dice([
    'function banco() {',
    CREA,
    '  return { dir };',
    '}',
    'function prueba() {',
    '  const b = banco();',
    '  try { usar(b.dir); } finally { fs.rmSync(b.dir, { recursive: true, force: true }); }',
    '}',
  ]), ['ESCAPA'],
  '🔴 el `b.dir` del llamador cuenta como el borrado de la variable `dir` de la función que crea.');
});

test("SCRUM-1396 · ④ el caso legítimo medido el 1-oct sigue GARANTIZADA: el `process.on('exit')` del banco de SCRUM-1391", () => {
  const censo = censar(RAIZ);
  const delBanco = censo.nuestras.filter((l) => l.fichero === 'docs/master/evidencias/SCRUM-1391/banco.mjs');
  assert.equal(delBanco.length, 1,
    `🔴 CIEGO: esperaba UNA llamada a mkdtemp en el banco de SCRUM-1391 y hay ${delBanco.length}. Si el banco `
    + 'cambió, este caso ya no mide lo que dice.');
  assert.deepEqual([delBanco[0].categoria, delBanco[0].cobertura, delBanco[0].enlace],
    ['GARANTIZADA', "process.on('exit')", 'variable'],
    '🔴 el censo ya no acepta el borrado del banco de SCRUM-1391, que quita el enlace a node_modules antes '
    + 'de borrar. Ese caso es correcto y su autor midió por qué: se para y se dice, no se «arregla» el banco.');
});

test('SCRUM-1396 · ⑤ la línea de población sale SIEMPRE, también con cero, y dice sobre qué se emparejó', (t) => {
  const censo = censar(RAIZ);
  const linea = lineaDePoblacion(censo);
  t.diagnostic(linea);
  assert.match(linea, /^\d+ ficheros con temporales \(\d+ llamadas, de \d+ ficheros mirados\) · \d+ con nombres repetidos · \d+ emparejamientos fuera de ámbito, que ya no cuentan · \d+ emparejadas sólo por nombre$/,
    '🔴 la línea de población no tiene la forma que se lee en el registro.');
  assert.ok(censo.conTemporales.length > 0 && censo.conNombresRepetidos.length > 0,
    `🔴 CIEGO: ${censo.conTemporales.length} ficheros con temporales y ${censo.conNombresRepetidos.length} con nombres `
    + 'repetidos. El 6-oct-2026 eran 99 y 21: un cero aquí es un censo que no ha mirado.');
  assert.ok(censo.conNombresRepetidos.every((f) => censo.conTemporales.includes(f)),
    '🔴 hay ficheros «con nombres repetidos» que no están entre los que tienen temporales.');

  // Con cero también: un árbol sin un solo temporal da la línea entera, no una cadena vacía.
  const vacio = { conTemporales: [], nuestras: [], ficheros: 0, conNombresRepetidos: [], fueraDeAmbito: [], porNombre: [] };
  assert.equal(lineaDePoblacion(vacio),
    '0 ficheros con temporales (0 llamadas, de 0 ficheros mirados) · 0 con nombres repetidos · 0 emparejamientos fuera de ámbito, que ya no cuentan · 0 emparejadas sólo por nombre');
});
