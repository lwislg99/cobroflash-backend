// SCRUM-1827 · el guard de la rama (SCRUM-1801) ARRANCA sin `node_modules`.
//
// Medido el 24-nov-2026 por la S0 de Luis (SCRUM-1801 c.22558) y repetido por J6: el paso que
// `pr-automatico.yml` iba a llevar (SCRUM-1809) corre SIN `node_modules`, y el guard cargaba
// `typescript` por `_puerta-de-entrada.mjs` (que lo importa para su censo de puertas, no para la
// puerta). En limpio salía 1 con `ERR_MODULE_NOT_FOUND` para TODA rama: verde y rojo, idénticos.
//
// Este test repite ese ensayo: copia el guard y lo que importa (la cadena se DERIVA del fuente, no
// se escribe a mano) a un `mkdtemp` de `os.tmpdir()`, comprueba que allí `typescript` NO resuelve
// (si resuelve, el ensayo no mide nada: CIEGO) y lanza el guard con un entorno sin `NODE_PATH`.
// Una cadena mal derivada falla CERRADA: falta un fichero → `ERR_MODULE_NOT_FOUND` → rojo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { esPrincipal } from '../scripts/guard-rama-con-numero.mjs';
import { ejecutadoDirectamente } from '../scripts/_puerta-de-entrada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = 'scripts/guard-rama-con-numero.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/guard-rama-con-numero.mjs',
    de: "import { agruparRamas } from './_censo-reparto.mjs';\n",
    a: "import { agruparRamas } from './_censo-reparto.mjs';\n"
      + "import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';\n",
    cae: 'SCRUM-1827 · en limpio, VERDE para `scrum-1801-x`',
  },
];

/** Los `import … from './x'` relativos de un fuente, sin las líneas de comentario (A23 nº 2 y 3). */
function importsRelativos(codigo) {
  const sinComentarios = codigo.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const re = /^\s*(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]|^\s*import\s*['"](\.[^'"]+)['"]/gm;
  return [...sinComentarios.matchAll(re)].map((m) => m[1] ?? m[2]);
}

/** La cadena de ficheros que el guard carga, derivada de su fuente. */
function cadenaDe(entrada) {
  const vistos = new Set();
  const pendientes = [entrada];
  while (pendientes.length) {
    const rel = pendientes.pop();
    if (vistos.has(rel)) continue;
    vistos.add(rel);
    const codigo = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    for (const s of importsRelativos(codigo)) pendientes.push(path.posix.join(path.posix.dirname(rel), s));
  }
  return [...vistos].sort();
}

const LIMPIO = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1827-'));
after(() => fs.rmSync(LIMPIO, { recursive: true, force: true })); // sólo ficheros copiados: ni un enlace
const CADENA = cadenaDe(ENTRADA);
for (const rel of CADENA) {
  fs.mkdirSync(path.join(LIMPIO, path.dirname(rel)), { recursive: true });
  fs.copyFileSync(path.join(RAIZ, rel), path.join(LIMPIO, rel));
}

/** Entorno del hijo: sin lo que hereda de `node --test`, de GitHub ni `NODE_PATH`. */
function entornoLimpio(extra = {}) {
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR', 'NODE_PATH',
    'GITHUB_HEAD_REF', 'GITHUB_REF_NAME', 'GITHUB_REF_TYPE']) delete env[k];
  return { ...env, ...extra };
}

/** ¿Resuelve `typescript` desde `cwd`? 0 sí, 1 no; otro código, la sonda no arrancó. */
function resuelveTypescript(cwd) {
  return spawnSync(process.execPath, ['-e', "require.resolve('typescript')"],
    { cwd, env: entornoLimpio(), encoding: 'utf8' }).status;
}

function lanzarEnLimpio(rama) {
  const r = spawnSync(process.execPath, [path.join(LIMPIO, ENTRADA)],
    { cwd: LIMPIO, env: entornoLimpio({ GITHUB_HEAD_REF: rama }), encoding: 'utf8' });
  return { status: r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

test('SCRUM-1827 · el banco es LIMPIO: allí `typescript` no resuelve, y la sonda sí lo ve en el repo', () => {
  assert.ok(CADENA.length >= 2 && CADENA.includes(ENTRADA),
    `NO PUDE MIRAR: la cadena derivada no tiene el guard y lo que importa (${CADENA.join(', ')})`);
  assert.equal(resuelveTypescript(RAIZ), 0, 'control positivo: desde el repo, `typescript` SÍ resuelve');
  assert.equal(resuelveTypescript(LIMPIO), 1,
    `CIEGO: \`typescript\` resuelve desde ${LIMPIO} (hay un node_modules en sus padres): este ensayo no mide nada`);
});

test('SCRUM-1827 · en limpio, VERDE para `scrum-1801-x` (salida 0 y declara su población)', () => {
  const { status, salida } = lanzarEnLimpio('scrum-1801-x');
  assert.doesNotMatch(salida, /ERR_MODULE_NOT_FOUND/, `el guard no arranca sin node_modules:\n${salida}`);
  assert.match(lanzarEnLimpio('scrum-1787aa-x').salida, /guard-rama-con-numero · 1 rama mirada: /,
    'positivo del mismo token: el guard SÍ imprime su línea de población');
  assert.equal(status, 0, `cadena copiada: ${CADENA.join(', ')}\n${salida}`);
  assert.match(salida, /1 rama mirada: scrum-1801-x \(de GITHUB_HEAD_REF\)/);
});

test('SCRUM-1827 · en limpio, ROJO para `scrum-1787aa-x` (salida 1 y nombra la rama)', () => {
  const { status, salida } = lanzarEnLimpio('scrum-1787aa-x');
  assert.equal(status, 1, salida);
  assert.match(salida, /ROJO: tu rama `scrum-1787aa-x` no tiene número/);
});

test('SCRUM-1827 · la puerta del guard dice lo mismo que `ejecutadoDirectamente` (dos anclas, atadas)', () => {
  const guard = path.join(RAIZ, ENTRADA);
  const url = pathToFileURL(guard).href;
  const pares = [
    [url, guard],
    [url, fileURLToPath(import.meta.url)],
    [url, undefined],
    [url, ''],
    ['data:text/javascript,1', guard],
    [url, path.join(RAIZ, 'no-existe-scrum1827.mjs')],
  ];
  const del = pares.map(([u, a]) => esPrincipal(u, a));
  const casa = pares.map(([u, a]) => ejecutadoDirectamente(u, a));
  assert.deepEqual(del, casa, 'la puerta del guard y la de la casa (SCRUM-765) han divergido');
  assert.ok(del.includes(true) && del.includes(false), `los pares no ejercitan los dos lados: ${del}`);
});
