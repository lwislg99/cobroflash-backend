// SCRUM-1363 — La tanda dirigida no puede elegirse por nombre: qué tests cubren lo que has tocado.
//
// Medido el 1-oct-2026: un PR cayó en CI por `scrum713c` (estilos escritos desde JS: 337 contra un
// techo de 336). Quien tocó `albaranDetailView.js` había corrido en local «los tests que lo
// nombran», en verde. `scrum713c` hace `readdirSync` de `public/dashboard/js` y no nombra ningún
// fichero: ninguna selección por nombre lo incluye nunca. La tanda completa, que sí lo habría
// cazado, ese día la mataba la máquina por falta de memoria.
//
// `scripts/tests-que-cubren.mjs` contesta «¿qué tests me pueden caer?» con tres cubos por test
// —NOMBRA, RECORRE, NO SÉ— y el tercero entra siempre. Aquí se sujeta:
//   ① EL CASO REAL, en rojo primero: por nombre `scrum713c` no sale; por el comando, sí, y dice por qué.
//   ② las dos mitades de cada cubo, sobre un árbol fabricado donde se sabe la respuesta.
//   ③ fail-closed: un tocado que nadie cubre a la vista SALE DICHO, y un análisis sin población
//      se declara no fiable.
//   ④ lo que rodea al lanzamiento: `dist/` más viejo que el fuente, y el recuento del TAP.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { temporal } from './_temporal.mjs';
import {
  analizarArbol, seleccionar, seleccionPorNombre, motivosParaNoFiarse, NOMBRA, RECORRE, NO_SE,
} from '../scripts/_tests-que-cubren.mjs';
import {
  distQueNoCorresponde, cuentasDelTap, concurrenciaEfectiva, CONCURRENCIA,
} from '../scripts/tests-que-cubren.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'tests-que-cubren.mjs');
const T713C = 'tests/scrum713c-trinquete-de-estilos-en-js.test.mjs';
const TOCADO = 'public/dashboard/js/albaranDetailView.js';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Deja de apuntar los directorios que un test lista: los censos vuelven a ser invisibles.
    fichero: 'scripts/_tests-que-cubren.mjs',
    de: "if (r.estado === 'd') { listados.add(r.ruta); return false; }",
    a: "if (r.estado === 'd') { return false; }",
    cae: 'el caso REAL',
  },
  {
    // Lo que no se sabe leer deja de entrar: una lista corta que parece completa.
    fichero: 'scripts/_tests-que-cubren.mjs',
    de: "if (r.estado === 'desconocido') apuntarNoSe(donde, que);",
    a: '',
    cae: 'cada cubo, con su mitad que absuelve',
  },
];

// El árbol de verdad se analiza UNA vez: son los mil y pico tests, y tres casos lo usan.
const ARBOL = analizarArbol(RAIZ);

test('SCRUM-1363 ① 🔴 el caso REAL: por nombre `scrum713c` no sale; por el comando sí, y dice por qué', () => {
  assert.deepEqual(motivosParaNoFiarse(ARBOL), [], '🔴 NO MEDIDO: el análisis del árbol no es fiable');
  assert.ok(fs.existsSync(path.join(RAIZ, T713C)) && fs.existsSync(path.join(RAIZ, TOCADO)),
    '🔴 NO MEDIDO: ya no existen el trinquete o la vista del caso. Busca otro censo que recorra un directorio y cámbialo aquí.');

  // LA MITAD EN ROJO, que es el defecto: la selección que se hacía a mano no lo contiene.
  const porNombre = seleccionPorNombre(RAIZ, ARBOL, TOCADO);
  assert.ok(porNombre.length > 0, '🔴 el banco está mal: ni un test nombra la vista, así que «no sale 713c» no diría nada');
  assert.equal(porNombre.includes(T713C), false,
    '🔴 `scrum713c` ya nombra la vista: este caso ha dejado de reproducir el defecto. Busca otro censo.');

  const s = seleccionar(ARBOL, [TOCADO]);
  const r = s.elegidos.get(T713C);
  assert.ok(r, '🔴 EL COMANDO TAMPOCO SELECCIONA `scrum713c` al tocar una vista del panel: es el defecto de SCRUM-1363');
  assert.deepEqual([r.cubo, r.por], [RECORRE, 'public/dashboard/js'], '🔴 lo selecciona, pero no por recorrer la carpeta del panel');
  // Y no pierde a nadie de los que SÍ se elegían a mano con motivo: los que lo nombran en código.
  assert.ok(s.cuenta[NOMBRA] > 0 && s.cuenta[RECORRE] > 0, `🔴 un cubo vacío sobre el árbol de verdad: ${JSON.stringify(s.cuenta)}`);
  assert.ok(s.elegidos.size < ARBOL.tests.length,
    '🔴 selecciona TODOS los tests: eso no es una dirigida, es la tanda completa con otro nombre');
});

test('SCRUM-1363 ① bis el comando de verdad lo dice, con su población', () => {
  // El entorno, a mano: el del runner trae `NODE_OPTIONS` y color.
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot };
  const r = spawnSync(process.execPath, [SCRIPT, '--porque', TOCADO], { cwd: RAIZ, encoding: 'utf8', env });
  assert.equal(r.status, 0, `🔴 el comando sale ${r.status}:\n${r.stderr}`);
  assert.match(r.stdout, new RegExp(`POBLACIÓN: ${ARBOL.tests.length} tests analizados \\(${ARBOL.tests.length} en disco\\)`),
    '🔴 no declara su población: un «seleccionados: N» sin «de cuántos» es una frase');
  const i = r.stdout.indexOf(T713C);
  assert.ok(i > 0, '🔴 el comando no lista `scrum713c`');
  assert.match(r.stdout.slice(i, i + 200), /RECORRE · public\/dashboard\/js/, '🔴 lo lista sin decir por qué entra');
});

// ─── El árbol fabricado: aquí se SABE qué cubre cada test ────────────────────────────────────
const RAIZ_DE = "const RAIZ = path.resolve(import.meta.dirname, '..');\n";
const FABRICADOS = {
  'public/js/a.js': 'export const a = 1;\n',
  'public/js/b.js': 'export const b = 1;\n',
  'docs/x.md': '# x\n',
  'tests/_andar.mjs': "import fs from 'node:fs';\nimport path from 'node:path';\n"
    + 'export function andar(dir, out = []) {\n'
    + '  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {\n'
    + '    if (e.isDirectory()) andar(path.join(dir, e.name), out); else out.push(e.name);\n  }\n  return out;\n}\n',
  'tests/nombra-a.test.mjs': RAIZ_DE + "fs.readFileSync(path.join(RAIZ, 'public', 'js', 'a.js'), 'utf8');\n",
  'tests/recorre.test.mjs': RAIZ_DE + "const DIR = path.join(RAIZ, 'public', 'js');\nfor (const f of fs.readdirSync(DIR)) cuenta(f);\n",
  'tests/caminante.test.mjs': "import { andar } from './_andar.mjs';\n" + RAIZ_DE + "andar(path.join(RAIZ, 'public'));\n",
  'tests/caminante-ciego.test.mjs': "import { andar } from './_andar.mjs';\nandar(process.argv[2]);\n",
  'tests/opaco.test.mjs': "const todos = execFileSync('git', ['ls-files'], { encoding: 'utf8' });\n",
  'tests/suelto.test.mjs': "const leer = (f) => fs.readFileSync(path.join(DIR_QUE_VIENE_DE_FUERA, f), 'utf8');\nleer('b.js');\n",
  'tests/ajeno.test.mjs': RAIZ_DE + "fs.readFileSync(path.join(RAIZ, 'docs', 'x.md'), 'utf8');\n",
  'tests/comentario.test.mjs': "// Esto habla de public/js/a.js y de 'a.js', pero no lo lee.\nconst uno = 1;\n",
  'tests/lista-otra.test.mjs': RAIZ_DE + "for (const f of fs.readdirSync(path.join(RAIZ, 'docs'))) cuenta(f);\n",
};

function arbolFabricado() {
  const raiz = temporal('yaqu-1363-');
  for (const [rel, texto] of Object.entries(FABRICADOS)) {
    const abs = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, texto);
  }
  return raiz;
}

test('SCRUM-1363 ② cada cubo, con su mitad que absuelve, sobre un árbol donde se sabe la respuesta', () => {
  const arbol = analizarArbol(arbolFabricado());
  assert.equal(arbol.tests.length, 9, 'el banco no ha montado sus nueve tests');
  const cubos = (tocado) => Object.fromEntries([...seleccionar(arbol, [tocado]).elegidos]
    .map(([t, r]) => [t.replace(/^tests\/|\.test\.mjs$/g, ''), r.cubo]).sort());

  assert.deepEqual(cubos('public/js/a.js'), {
    'nombra-a': NOMBRA,          // escribe la ruta, trozo a trozo, en un `path.join`
    recorre: RECORRE,            // lista la carpeta a través de una constante
    caminante: RECORRE,          // se la pasa a un caminante que vive en OTRO fichero
    'caminante-ciego': NO_SE,    // le pasa algo que no se puede leer: entra siempre
    opaco: NO_SE,                // le pregunta la lista a git: entra siempre
  }, '🔴 los cubos de `public/js/a.js` no son los que tienen que ser');
  // LO QUE NO ENTRA, y por qué cada uno: `suelto` nombra OTRO fichero · `ajeno` lee otra carpeta ·
  // `comentario` sólo lo menciona en un comentario · `lista-otra` recorre un directorio que no lo contiene.

  assert.equal(cubos('public/js/b.js').suelto, NOMBRA,
    '🔴 no ve el NOMBRE SUELTO: `leer("b.js")` con la carpeta en otra parte es como lee media casa');
  assert.equal(cubos('public/js/b.js')['nombra-a'], undefined, '🔴 quien nombra `a.js` entra por tocar `b.js`');
  assert.equal(cubos('docs/x.md')['lista-otra'], RECORRE);
  assert.equal(cubos('docs/x.md').recorre, undefined, '🔴 quien recorre `public/js` entra por tocar `docs/`');
});

test('SCRUM-1363 ③ fail-closed: lo que nadie cubre a la vista SALE DICHO, y sin población no hay veredicto', () => {
  const arbol = analizarArbol(arbolFabricado());
  const s = seleccionar(arbol, ['otra/carpeta/nueva.txt', 'public/js/a.js']);
  assert.deepEqual(s.sinCobertura, ['otra/carpeta/nueva.txt'],
    '🔴 un fichero que ningún test nombra ni recorre no sale señalado: la lista corta parecería completa');
  // Y aun así los que no se saben leer entran: «no sé qué lee» no es «no lee esto».
  assert.deepEqual([...seleccionar(arbol, ['otra/carpeta/nueva.txt']).elegidos.values()].map((r) => r.cubo).sort(), [NO_SE, NO_SE]);

  // Sin tests no hay población, y se dice.
  const vacio = temporal('yaqu-1363-vacio-');
  assert.match(motivosParaNoFiarse(analizarArbol(vacio)).join(' '), /CERO tests/,
    '🔴 un árbol sin tests se da por analizado: «0 seleccionados» se leería como «no hay nada que correr»');
  // Y un análisis que pierde tests por el camino, también.
  const cojo = { ...arbol, enDisco: arbol.tests.length + 1 };
  assert.equal(motivosParaNoFiarse(cojo).length, 1, '🔴 analizar menos tests de los que hay en disco no se denuncia');
});

test('SCRUM-1363 ④ el lanzamiento: `dist/` viejo es CIEGO, y el TAP se cuenta', () => {
  const raiz = temporal('yaqu-1363-dist-');
  const escribir = (rel, cuando) => {
    const abs = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, '');
    fs.utimesSync(abs, cuando, cuando);
  };
  const ayer = new Date('2026-09-30T10:00:00Z');
  const hoy = new Date('2026-10-01T10:00:00Z');
  escribir('src/al-dia.ts', ayer); escribir('dist/al-dia.js', hoy);
  escribir('src/viejo.ts', hoy); escribir('dist/viejo.js', ayer);
  escribir('src/sin-compilar.ts', hoy);
  assert.deepEqual(
    distQueNoCorresponde(['src/al-dia.ts', 'src/viejo.ts', 'src/sin-compilar.ts', 'src/borrado.ts', 'public/x.js'], raiz),
    ['src/viejo.ts', 'src/sin-compilar.ts'],
    '🔴 no distingue el compilado viejo del que está al día: la dirigida mediría el código de antes');

  const tap = '# tests 12\n# pass 11\n# fail 1\nnot ok 3 - el que cae\nok 4 - otro\n';
  assert.deepEqual(cuentasDelTap(tap), { tests: 12, pass: 11, fail: 1, caidos: ['el que cae'] });
  assert.equal(cuentasDelTap('').tests, null, '🔴 un TAP vacío da un recuento: una tanda que no arrancó parecería un verde');

  // La concurrencia se puede bajar desde el entorno, nunca subir.
  assert.equal(concurrenciaEfectiva('2'), 2);
  assert.equal(concurrenciaEfectiva('64'), CONCURRENCIA);
  assert.equal(concurrenciaEfectiva(undefined), CONCURRENCIA);
});
