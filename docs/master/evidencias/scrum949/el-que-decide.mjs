// docs/master/evidencias/scrum949/el-que-decide.mjs — SCRUM-949 · por qué el mínimo es 1 y no un porcentaje
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// La tabla que decide la FORMA. Cada celda es el código de salida del INSTRUMENTO REAL
// (`tests/public-js-parsea.test.mjs`, sólo su test de SUELO) corrido en una copia con su propio
// git — no una cuenta hecha a mano.
//
//   filas     · cuatro suelos: el CABLEADO de `origin/main` (`SUELO_FICHEROS = 40`), y el de esta
//               rama con el mínimo a 0,818 (lo que da el historial entero), 0,97 (lo que da el
//               historial si se elige mirar sólo desde que hubo 50 ficheros) y 1.
//   columnas  · la población crece donde crece de verdad, en `public/dashboard/js`: 96 (hoy),
//               196 y 496.
//   escenarios · ① CEGUERA PLAUSIBLE: el recorrido se estrecha a `public/dashboard/js` y pierde
//                  `sw.js` y `public/js/` — 3 ficheros que NO crecen con el árbol. Tiene que SALTAR.
//               ② BORRADO HONESTO: un fichero borrado a mano, sin `git rm`. Tiene que CALLAR.
//
// Uso:  node docs/master/evidencias/scrum949/el-que-decide.mjs      (necesita `origin/main`)
// Sale 2 si no puede fiarse de su propia medida.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { temporal } = await import(pathToFileURL(path.join(RAIZ, 'tests/_temporal.mjs')).href);
const INSTRUMENTO = 'tests/public-js-parsea.test.mjs';
const git = (dir, args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const CABLEADO = git(RAIZ, ['show', `origin/main:${INSTRUMENTO}`]);
const DE_ESTA_RAMA = fs.readFileSync(path.join(RAIZ, INSTRUMENTO), 'utf8');
const ANCLA_DIR = "const DIR = path.join(RAIZ, 'public');";
const ANCLA_MIN = 'const COCIENTE_MINIMO = 1;';

const noMeFio = [];
if (!CABLEADO.includes('const SUELO_FICHEROS = 40;')) noMeFio.push('origin/main ya no trae el suelo cableado de 40: esta tabla compara contra otra cosa');
for (const [n, t, a] of [['cableado', CABLEADO, ANCLA_DIR], ['rama', DE_ESTA_RAMA, ANCLA_DIR], ['rama', DE_ESTA_RAMA, ANCLA_MIN]]) {
  if (t.split(a).length - 1 !== 1) noMeFio.push(`el ancla «${a}» no está UNA vez en la versión ${n}`);
}
if (noMeFio.length) { console.error('🔴 NO ME FÍO:\n  · ' + noMeFio.join('\n  · ')); process.exit(2); }

const SUELOS = [
  { nombre: 'cableado · SUELO_FICHEROS = 40 (origin/main)', fuente: CABLEADO },
  { nombre: 'cociente fijo 0,818 (historial entero)', fuente: DE_ESTA_RAMA.replace(ANCLA_MIN, 'const COCIENTE_MINIMO = 0.818;') },
  { nombre: 'cociente fijo 0,97 (historial desde 50)', fuente: DE_ESTA_RAMA.replace(ANCLA_MIN, 'const COCIENTE_MINIMO = 0.97;') },
  { nombre: 'cociente 1 contra git (ESTA RAMA)', fuente: DE_ESTA_RAMA },
];

function arbol(vistas) {
  const dir = temporal('yaqu-949-decide-');
  for (const rel of ['tests/_temporal.mjs', 'scripts/_suelo-por-cociente.mjs']) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, rel), path.join(dir, rel));
  }
  const esc = (rel) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), `var x = ${JSON.stringify(rel)};\n`);
  };
  for (let i = 0; i < vistas; i++) esc(`public/dashboard/js/vista${String(i).padStart(3, '0')}.js`);
  esc('public/js/landing.js'); esc('public/js/auth.js'); esc('public/sw.js');
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  return dir;
}

/** Corre el SUELO de `fuente` en `dir`. Devuelve 'SALTA' | 'calla', o aborta si no llegó a correr. */
function correr(dir, fuente) {
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(dir, INSTRUMENTO), fuente);
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', '--test-name-pattern=SUELO', path.join(dir, INSTRUMENTO)],
    { cwd: dir, env, encoding: 'utf8', timeout: 60_000 });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  // A21 · testigo: el test de SUELO tiene que aparecer en la salida, o la celda no vale nada.
  if (!salida.includes('SUELO: el guard encuentra los ficheros')) {
    console.error(`🔴 la cobaya NO corrió en ${dir}:\n${salida.slice(0, 1200)}`); process.exit(2);
  }
  return r.status === 0 ? 'calla' : 'SALTA';
}

const POBLACIONES = [93, 193, 493]; // + 3 fuera de dashboard/js = 96, 196, 496
const tabla = [];
for (const s of SUELOS) {
  const fila = { suelo: s.nombre, ceguera: [], borrado: [] };
  for (const v of POBLACIONES) {
    const d1 = arbol(v);
    fila.ceguera.push(correr(d1, s.fuente.replace(ANCLA_DIR, "const DIR = path.join(RAIZ, 'public', 'dashboard', 'js');")));
    const d2 = arbol(v);
    fs.rmSync(path.join(d2, 'public/dashboard/js/vista007.js')); // a mano, sin `git rm`
    fila.borrado.push(correr(d2, s.fuente));
  }
  tabla.push(fila);
}

// Control de la tabla: el cableado DEBE callar ante la ceguera plausible (es el defecto) y el de esta
// rama DEBE saltar. Si no, la tabla no mide lo que dice medir.
const [cab, , , rama] = tabla;
if (cab.ceguera.some((x) => x !== 'calla')) noMeFio.push('el suelo cableado SALTA ante la ceguera plausible: la tabla no reproduce el defecto');
if (rama.ceguera.some((x) => x !== 'SALTA')) noMeFio.push('el suelo de esta rama CALLA ante la ceguera plausible');
if (noMeFio.length) { console.error('🔴 NO ME FÍO:\n  · ' + noMeFio.join('\n  · ')); process.exit(2); }

const tot = POBLACIONES.map((v) => v + 3);
console.log(`medido contra origin/main = ${git(RAIZ, ['rev-parse', 'origin/main']).trim()} · ${new Date().toISOString()}`);
console.log(`\n① CEGUERA PLAUSIBLE (pierde 3: sw.js + public/js/*) — tiene que SALTAR`);
console.log(`   ${'suelo'.padEnd(46)} ${tot.map((t) => `P=${t}`.padStart(8)).join('')}`);
for (const f of tabla) console.log(`   ${f.suelo.padEnd(46)} ${f.ceguera.map((x) => x.padStart(8)).join('')}`);
console.log(`\n② BORRADO HONESTO (1 fichero, sin git rm) — tiene que CALLAR`);
console.log(`   ${'suelo'.padEnd(46)} ${tot.map((t) => `P=${t}`.padStart(8)).join('')}`);
for (const f of tabla) console.log(`   ${f.suelo.padEnd(46)} ${f.borrado.map((x) => x.padStart(8)).join('')}`);
