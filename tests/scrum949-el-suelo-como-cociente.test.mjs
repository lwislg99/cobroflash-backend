// tests/scrum949-el-suelo-como-cociente.test.mjs — SCRUM-949
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// El suelo como COCIENTE, no como número — aplicado a UN caso: `tests/public-js-parsea.test.mjs`
// ══════════════════════════════════════════════════════════════════════════════════════════
//
// ── POR QUÉ ESTE CASO Y NO OTRO ───────────────────────────────────────────────────────────
// · Su suelo (`SUELO_FICHEROS = 40` contra 96 reales) estaba MUERTO, no SUSTITUIDO: el otro
//   vigilante de la misma población, el registro de SCRUM-810b, recorre `public/` con SU PROPIA
//   copia del recorrido —no se entera si el del guard se rompe— y en CI se salta (SCRUM-948).
// · Su población es un conjunto de rutas, así que tiene una segunda sonda EXACTA: git.
// · Nadie importa su suelo: cambiarlo no le quita el control negativo a nadie (lo que sí pasaría
//   con `SUELO_GUARDS` y `SUELO_DECLARACIONES`, que no se tocan).
// · Y se puede probar ENTERO sin tocar el árbol: se copia el instrumento real, byte a byte, a un
//   árbol temporal con su propio git, y se le hace crecer, perder y quedarse ciego allí.
//
// ── CÓMO SE LEEN LOS CONTROLES ────────────────────────────────────────────────────────────
// Cada ejecución de la copia corre SÓLO el test de SUELO (`--test-name-pattern`), que no lanza
// `node --check` sobre cada fichero. Y cada una deja TESTIGO (A21): o la línea de población, o el
// nombre del test en la salida. Una cobaya que no se ejecuta da el mismo verde que un arreglo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica (SCRUM-730)
import { temporal } from './_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase
import {
  censoDeGit, explicarCociente, medirCociente, umbralDe,
} from '../scripts/_suelo-por-cociente.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTRUMENTO = 'tests/public-js-parsea.test.mjs';
/** Lo que el instrumento necesita para arrancar en la copia. Si importa algo más, la copia lo dice. */
const PIEZAS = [INSTRUMENTO, 'tests/_temporal.mjs', 'scripts/_suelo-por-cociente.mjs'];
const NOMBRE_DEL_SUELO = 'public/ · SUELO: el guard encuentra los ficheros que dice comprobar';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El espejo: si el acuerdo es la población entera, el cociente es 1 pase lo que pase.
    fichero: 'scripts/_suelo-por-cociente.mjs',
    de: '  const acuerdo = [...universo].filter((p) => a.has(p) && b.has(p)).length;',
    a: '  const acuerdo = universo.size;',
    cae: 'el cociente cruza CONJUNTOS: perder uno y ganar otro no cuadra',
  },
  {
    fichero: 'scripts/_suelo-por-cociente.mjs',
    de: '    cociente: universo.size ? acuerdo / universo.size : 0,',
    a: '    cociente: universo.size ? acuerdo / universo.size : 1,',
    cae: 'cero sobre cero es CERO: dos sondas vacías no están de acuerdo, no han mirado',
  },
  {
    // Sin descontar los borrados sin indexar, un `rm` honesto separaría las dos sondas.
    fichero: 'scripts/_suelo-por-cociente.mjs',
    de: "    borrados = new Set(lista(['--deleted']));",
    a: '    borrados = new Set();',
    cae: '✅ NEGATIVO · un borrado legítimo pequeño NO dispara',
  },
  {
    // Sin los no indexados, un fichero nuevo sin `git add` separaría las dos sondas.
    fichero: 'scripts/_suelo-por-cociente.mjs',
    de: "    enDisco = lista(['--cached', '--others']);",
    a: "    enDisco = lista(['--cached']);",
    cae: '✅ NEGATIVO · ningún cambio honesto separa las dos sondas',
  },
  {
    // 🔴 LA QUE DECIDE LA FORMA: un porcentaje fijo por debajo de 1 ve la ceguera realista con 96
    // ficheros y la deja pasar con 196. Si esta mutación sobrevive, el control que decide no mide.
    fichero: 'tests/public-js-parsea.test.mjs',
    de: 'const COCIENTE_MINIMO = 1;',
    a: 'const COCIENTE_MINIMO = 0.97;',
    cae: '🔴 EL QUE DECIDE · crecer mueve el umbral solo, y la ceguera realista sigue saltando',
  },
  {
    // Y prueba que los controles de la copia ejercen el instrumento REAL, no uno de mentira.
    fichero: 'tests/public-js-parsea.test.mjs',
    de: "  assert.ok(m.cociente >= COCIENTE_MINIMO, explicarCociente('los .js de public/', m, COCIENTE_MINIMO));",
    a: "  assert.ok(true, explicarCociente('los .js de public/', m, COCIENTE_MINIMO));",
    cae: '🔴 ROJO · un recorrido ciego salta y NOMBRA lo que no ve',
  },
];

// ══ LA COPIA ════════════════════════════════════════════════════════════════════════════════

const git = (dir, args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });

const vista = (i) => `public/dashboard/js/vista${String(i).padStart(3, '0')}.js`;

/**
 * Un árbol con la FORMA de `public/` de hoy (medida el 18-sep-2026: 93 en `dashboard/js`, 2 en
 * `js/`, 1 suelto) y el instrumento real copiado byte a byte. Todo indexado.
 *
 * Devuelve el directorio y los dos únicos modos de escribir en él. Van como CIERRES sobre
 * `const dir = temporal(…)`, y no como funciones que reciben `dir`, a propósito: así el censo de
 * SCRUM-824 puede PROBAR que todo lo que se crea aquí cuelga de `os.tmpdir()`. Con `dir` como
 * parámetro no podía, y lo dijo (lo cazó la primera tanda completa).
 */
const copia = ({ vistas = 93 } = {}) => {
  const dir = temporal('yaqu-949-');
  /** Un fichero sintético que parsea. El test de SUELO no lo parsea, pero así la copia es honesta. */
  const escribir = (rel) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), `var x = ${JSON.stringify(rel)};\n`);
  };
  /** Cambia UNA línea del instrumento EN LA COPIA. Si el ancla no está exactamente una vez, para. */
  const mutar = (de, a) => {
    const texto = fs.readFileSync(path.join(dir, INSTRUMENTO), 'utf8');
    assert.equal(texto.split(de).length - 1, 1, `el ancla tiene que estar UNA vez en el instrumento: ${de}`);
    fs.writeFileSync(path.join(dir, INSTRUMENTO), texto.replace(de, a));
  };
  for (const rel of PIEZAS) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, rel), path.join(dir, rel));
  }
  for (let i = 0; i < vistas; i++) escribir(vista(i));
  escribir('public/js/landing.js');
  escribir('public/js/auth.js');
  escribir('public/sw.js');
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  return { dir, escribir, mutar };
};

const LINEA = /población (\d+) \(recorrido (\d+) · censo (\d+)\) · de acuerdo (\d+) · cociente ([\d.]+) · mínimo ([\d.]+) → umbral (\d+)/;

/** Corre SÓLO el test de SUELO del instrumento en `dir`. */
function correrSuelo(dir, envExtra = {}) {
  const env = { ...process.env, ...envExtra };
  delete env.NODE_TEST_CONTEXT; // heredada de la tanda, cambia la salida del hijo (scrum trinquete-zona)
  const r = spawnSync(process.execPath,
    ['--test', '--test-reporter=spec', '--test-name-pattern=SUELO', path.join(dir, INSTRUMENTO)],
    { cwd: dir, env, encoding: 'utf8', timeout: 60_000 });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  // A21 · el testigo: si el test de SUELO no aparece en la salida, la cobaya no corrió.
  assert.ok(salida.includes(NOMBRE_DEL_SUELO),
    `🔴 la copia NO corrió el test de SUELO (status ${r.status}):\n${salida.slice(0, 1500)}`);
  const m = LINEA.exec(salida);
  return {
    status: r.status,
    salida,
    poblacion: m ? Number(m[1]) : null,
    recorrido: m ? Number(m[2]) : null,
    censo: m ? Number(m[3]) : null,
    acuerdo: m ? Number(m[4]) : null,
    umbral: m ? Number(m[7]) : null,
  };
}

// ══ ① EL MECANISMO, sintético ════════════════════════════════════════════════════════════════

test('el cociente cruza CONJUNTOS: perder uno y ganar otro no cuadra', () => {
  const m = medirCociente(['a', 'b', 'c'], ['a', 'b', 'd']);
  assert.equal(m.universo, 4);
  assert.equal(m.acuerdo, 2, 'tres contra tres no es acuerdo si no son los MISMOS tres');
  assert.equal(m.cociente, 0.5);
  assert.deepEqual(m.noVistos, ['d'], 'tiene que NOMBRAR lo que el recorrido no ve');
  assert.deepEqual(m.noCensados, ['c'], 'y lo que el censo no tiene');
  const dicho = explicarCociente('x', m, 1);
  assert.match(dicho, /el RECORRIDO no ve 1[\s\S]*\bd\b/);
  assert.match(dicho, /el CENSO no tiene 1[\s\S]*\bc\b/);
  assert.equal(medirCociente(['a', 'b'], ['b', 'a']).cociente, 1, 'el orden no importa');
});

test('cero sobre cero es CERO: dos sondas vacías no están de acuerdo, no han mirado', () => {
  const m = medirCociente([], []);
  assert.equal(m.cociente, 0, 'si esto diera 1, un suelo sobre la nada saldría verde');
  assert.match(explicarCociente('x', m, 1), /CERO en las dos sondas/);
});

test('el umbral usa la misma comparación que el aserto, sin redondeos', () => {
  assert.equal(umbralDe(96, 1), 96);
  // 0.97 × 96 = 93,12 → hace falta 94: 93/96 = 0,96875 no llega. `Math.ceil` de un producto en
  // coma flotante se equivoca por uno en casos como 0.81 × 100 = 81,00000000000001.
  assert.equal(umbralDe(96, 0.97), 94);
  assert.equal(umbralDe(100, 0.81), 81);
  assert.equal(umbralDe(0, 1), 1, 'con población cero el umbral es inalcanzable: no hay acuerdo que valga');
});

// ══ ② LOS CONTROLES, sobre el instrumento REAL ═══════════════════════════════════════════════

test('✅ POSITIVO · el árbol de hoy, intacto, sigue verde y declara su población', () => {
  const r = correrSuelo(RAIZ);
  assert.equal(r.status, 0, `el árbol tal cual tiene que estar en verde:\n${r.salida.slice(0, 3000)}`);
  const censo = censoDeGit(RAIZ, 'public', (p) => p.endsWith('.js'));
  assert.ok(censo && censo.size > 0, 'CIEGO: git no dice que haya ni un .js en public/');
  assert.equal(r.poblacion, censo.size, 'el instrumento tiene que DECLARAR la población que ha mirado');
  assert.equal(r.acuerdo, r.poblacion);
});

test('🔴 EL QUE DECIDE · crecer mueve el umbral solo, y la ceguera realista sigue saltando', () => {
  const c = copia();
  const original = fs.readFileSync(path.join(RAIZ, INSTRUMENTO));

  const hoy = correrSuelo(c.dir);
  assert.equal(hoy.status, 0, hoy.salida);
  assert.deepEqual([hoy.poblacion, hoy.umbral], [96, 96]);

  // Crece donde crece de verdad, en `dashboard/js`: 50 indexados y 50 sin `git add`.
  for (let i = 93; i < 193; i++) c.escribir(vista(i));
  git(c.dir, ['add', '--', ...Array.from({ length: 50 }, (_, k) => vista(93 + k))]);
  const crecido = correrSuelo(c.dir);
  assert.equal(crecido.status, 0, crecido.salida);
  assert.deepEqual([crecido.poblacion, crecido.umbral], [196, 196], 'el umbral tiene que moverse SOLO con la población');
  assert.equal(Buffer.compare(fs.readFileSync(path.join(c.dir, INSTRUMENTO)), original), 0,
    'y sin editar NADA: si hubiera que tocar el instrumento para recalibrarlo, sería el mismo defecto con otra sintaxis');

  // La ceguera plausible: el recorrido se estrecha a `dashboard/js`. Pierde 3 ficheros de 196, y
  // esos 3 NO crecen con el árbol. Un porcentaje fijo por debajo de 1 acabaría dejándolos pasar.
  c.mutar("const DIR = path.join(RAIZ, 'public');",
    "const DIR = path.join(RAIZ, 'public', 'dashboard', 'js');");
  const ciego = correrSuelo(c.dir);
  assert.notEqual(ciego.status, 0, `con 196 ficheros, perder 3 tiene que seguir saltando:\n${ciego.salida.slice(0, 3000)}`);
  assert.equal(ciego.poblacion, 196);
  assert.equal(ciego.recorrido, 193);
  for (const falta of ['public/sw.js', 'public/js/landing.js', 'public/js/auth.js']) {
    assert.ok(ciego.salida.includes(falta), `tiene que NOMBRAR ${falta}`);
  }
});

test('🔴 ROJO · un recorrido ciego salta y NOMBRA lo que no ve', () => {
  const c = copia();
  // El recorrido deja de bajar a los subdirectorios: sólo ve `public/sw.js`.
  c.mutar('    if (e.isDirectory()) out.push(...ficherosJs(p));',
    '    if (e.isDirectory()) continue;');
  const r = correrSuelo(c.dir);
  assert.notEqual(r.status, 0, `un recorrido que no ve 95 de 96 tiene que saltar:\n${r.salida.slice(0, 3000)}`);
  assert.deepEqual([r.poblacion, r.recorrido, r.acuerdo], [96, 1, 1]);
  assert.match(r.salida, /el RECORRIDO no ve 95 que el censo sí tiene — por carpeta: public\/dashboard\/js\/ 93 · public\/js\/ 2/,
    'tiene que decir QUÉ CARPETAS ha dejado de mirar: una ceguera suele ser estructural');
  assert.ok(r.salida.includes(vista(0)), 'y NOMBRAR los que faltan, no sólo contarlos');
});

test('🔴 ROJO · un censo ciego también salta: ninguna sonda se queda ciega en silencio', () => {
  const c = copia();
  // El censo se estrecha a `public/js`: el recorrido ve 96 y el censo 2.
  c.mutar("const censoDePublic = () => censoDeGit(RAIZ, 'public', (p) => p.endsWith('.js'));",
    "const censoDePublic = () => censoDeGit(RAIZ, 'public/js', (p) => p.endsWith('.js'));");
  const r = correrSuelo(c.dir);
  assert.notEqual(r.status, 0, r.salida.slice(0, 3000));
  assert.deepEqual([r.poblacion, r.censo], [96, 2]);
  assert.match(r.salida, /el CENSO no tiene 94 que el recorrido sí ve/);
});

test('✅ NEGATIVO · un borrado legítimo pequeño NO dispara', () => {
  const c = copia();
  fs.rmSync(path.join(c.dir, vista(7))); // borrado a mano, SIN `git rm`: el índice aún lo tiene
  const r = correrSuelo(c.dir);
  assert.equal(r.status, 0, `un borrado honesto no puede poner el suelo en rojo:\n${r.salida.slice(0, 3000)}`);
  assert.deepEqual([r.poblacion, r.acuerdo], [95, 95]);
});

test('✅ NEGATIVO · ningún cambio honesto separa las dos sondas', () => {
  const c = copia();
  // Un borrado GRANDE, indexado. `-f` porque la copia no tiene commits: sin él, git se niega a
  // borrar ficheros con cambios en el índice (lo cazó la primera ejecución de este control).
  git(c.dir, ['rm', '-q', '-f', '--', ...Array.from({ length: 30 }, (_, k) => vista(k))]);
  c.escribir('public/dashboard/js/nueva-sin-add.js'); // nuevo, sin `git add`
  c.escribir('public/dashboard/js/nueva-con-add.js');
  git(c.dir, ['add', '--', 'public/dashboard/js/nueva-con-add.js']);
  fs.renameSync(path.join(c.dir, vista(40)), path.join(c.dir, 'public/dashboard/js/renombrada.js')); // mv sin git
  git(c.dir, ['rm', '-q', '--cached', '--', vista(41)]); // sale del índice, se queda en disco
  fs.writeFileSync(path.join(c.dir, '.gitignore'), 'public/generado.js\n');
  c.escribir('public/generado.js'); // ignorado: el recorrido lo ve, así que el censo también
  const r = correrSuelo(c.dir);
  assert.equal(r.status, 0, `ningún cambio honesto puede separar las sondas:\n${r.salida.slice(0, 3000)}`);
  assert.deepEqual([r.poblacion, r.acuerdo, r.recorrido, r.censo], [69, 69, 69, 69]);
});

test('🔴 sin git no hay suelo, y eso es ROJO, no un salto', () => {
  const c = copia();
  // `GIT_DIR` a una ruta que no existe: git no contesta, pase lo que pase por encima de la copia.
  const r = correrSuelo(c.dir, { GIT_DIR: path.join(c.dir, 'no-hay-git') });
  assert.notEqual(r.status, 0, `sin segunda sonda el suelo NO puede salir verde:\n${r.salida.slice(0, 3000)}`);
  // Rojo con su motivo, y no un `skip`: un salto sale 0, que es justo el defecto de SCRUM-948.
  assert.match(r.salida, /CIEGO: no he podido preguntarle a git/);
});
