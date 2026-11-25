// SCRUM-1846 · un guard que importa de `dist/` y no lo encuentra salía con 1 («hay hallazgos»), el
// código de node al morir por `MODULE_NOT_FOUND`. Tiene que salir con 2 («no supe medir») y decir qué
// faltó y cómo se arregla. El manejo vive en UN sitio: `vigilarArranque()` de
// `scripts/_hallazgos-y-ciegos.mjs`.
//
// Cómo se quita `dist/` sin tocarlo: un gancho de resolución (`module.registerHooks`, por `--import`)
// que hace fallar como «módulo que falta» todo lo que resuelve dentro de `<raíz>/dist/`, por import
// y por require. El `dist/` de verdad no se mueve: la tanda lo comparte.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { entornoLimpio } from '../scripts/_trinquete-de-zona.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/guard-vias-de-cobro.mjs',
    de: 'vigilarArranque();\n',
    a: '\n',
    cae: 'SCRUM-1846 · sin dist/, cada guard que llega a él sale con 2',
  },
  {
    fichero: 'scripts/_hallazgos-y-ciegos.mjs',
    de: "    process.exit(v.codigo);\n",
    a: "    process.exit(1);\n",
    cae: 'SCRUM-1846 · sin dist/, cada guard que llega a él sale con 2',
  },
];

// Censo del 25-nov-2026 (registro docs/master/SCRUM-1846.md): de 46 guards, éstos llegaban a dist/
// por un import literal y morían con 1. Los otros tres que lo leen (nif-del-gasto, notas-en-la-ficha,
// pad-de-firma-cabe) ya miraban su falta y salían con 2; guard-detalle-trabajo-917 es de la S4.
const GUARDS = [
  'scripts/guard-aviso-bizum.mjs',
  'scripts/guard-firma-con-tramos.mjs',
  'scripts/guard-vias-de-cobro.mjs',
  'scripts/guard-objetivo-tactil.mjs',
];

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1846-'));
const GANCHO = path.join(dir, 'sin-dist.mjs');
fs.writeFileSync(GANCHO, [
  "import { registerHooks } from 'node:module';",
  `const DIST = ${JSON.stringify(pathToFileURL(path.join(RAIZ, 'dist')).href + '/')};`,
  'registerHooks({ resolve(especificador, contexto, siguiente) {',
  "  let url = '';",
  '  try { url = new URL(especificador, contexto.parentURL).href; } catch {}',
  '  if (url.toLowerCase().startsWith(DIST.toLowerCase())) {',
  "    const e = new Error(`Cannot find module '${url}' (SCRUM-1846: sin dist/)`);",
  "    e.code = contexto.conditions?.includes('require') ? 'MODULE_NOT_FOUND' : 'ERR_MODULE_NOT_FOUND';",
  '    throw e;',
  '  }',
  '  return siguiente(especificador, contexto);',
  '} });',
  '',
].join('\n'));

function correr(args) {
  const r = spawnSync(process.execPath, args, {
    cwd: RAIZ, encoding: 'utf8', timeout: 90_000, env: entornoLimpio(process.env.TZ ?? 'UTC'),
  });
  return { status: r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}`, error: r.error };
}

test('SCRUM-1846 · sin dist/, cada guard que llega a él sale con 2 y dice qué faltó y «npm run build»', () => {
  assert.equal(GUARDS.length, 4, 'la población del censo');
  for (const g of GUARDS) {
    assert.ok(fs.existsSync(path.join(RAIZ, g)), `el guard del censo existe: ${g}`);
    const { status, salida, error } = correr(['--import', pathToFileURL(GANCHO).href, g]);
    assert.equal(error, undefined, `${g} no llegó a correr: ${error}`);
    assert.match(salida, /SCRUM-1846: sin dist\//, `${g}: el gancho no llegó a quitarle dist/ (control):\n${salida}`);
    assert.equal(status, 2, `${g} salió con ${status}, no con 2:\n${salida.slice(-1500)}`);
    assert.match(salida, /no llegó a arrancar/, `${g}: no dice que no arrancó:\n${salida}`);
    assert.match(salida, /npm run build/, `${g}: no dice cómo se arregla:\n${salida}`);
    assert.match(salida, /salida 2/, `${g}: sin la línea de veredicto de la casa:\n${salida}`);
  }
});

test('SCRUM-1846 · ningún guard importa de dist/ con un import estático: fallaría antes de vigilarArranque', () => {
  const guards = fs.readdirSync(path.join(RAIZ, 'scripts')).filter((n) => /^guard-.*\.mjs$/.test(n));
  assert.ok(guards.length >= 40, `población: ${guards.length} guards`);
  const estatico = /^\s*import\b[^;]*?\bfrom\s*['"]\.\.\/dist\//m;
  assert.match("import { x } from '../dist/a.js';", estatico, 'control positivo: el patrón caza un import estático de dist/');
  assert.doesNotMatch("const { x } = await import('../dist/a.js');", estatico, 'y no un import dinámico');
  const con = guards.filter((n) => estatico.test(fs.readFileSync(path.join(RAIZ, 'scripts', n), 'utf8')));
  assert.deepEqual(con, [], `importan dist/ en estático (pásalo a await import tras vigilarArranque()): ${con.join(', ')}`);
});

test('SCRUM-1846 · vigilarArranque solo cambia el módulo que falta: otro error sigue saliendo con 1, y sin error con 0', () => {
  const helper = pathToFileURL(path.join(RAIZ, 'scripts', '_hallazgos-y-ciegos.mjs')).href;
  const caso = (nombre, cuerpo) => {
    const f = path.join(dir, `${nombre}.mjs`);
    fs.writeFileSync(f, `import { vigilarArranque } from ${JSON.stringify(helper)};\nvigilarArranque();\n${cuerpo}\n`);
    return correr([f]);
  };
  const falta = caso('falta', "import { createRequire } from 'node:module';\ncreateRequire(import.meta.url)('./no-existe-1846.js');");
  assert.equal(falta.status, 2, `require de un módulo que falta:\n${falta.salida}`);
  assert.match(falta.salida, /no llegó a arrancar/);
  const otro = caso('otro', "throw new Error('fallo-que-no-es-de-modulo-1846');");
  assert.equal(otro.status, 1, `otro error:\n${otro.salida}`);
  assert.match(otro.salida, /fallo-que-no-es-de-modulo-1846/, 'node sigue imprimiendo el error de siempre');
  assert.doesNotMatch(otro.salida, /no llegó a arrancar/, 'y no lo disfraza de arranque fallido');
  const bien = caso('bien', "console.log('medido-1846');");
  assert.equal(bien.status, 0, `sin error:\n${bien.salida}`);
  assert.match(bien.salida, /medido-1846/);
  assert.doesNotMatch(bien.salida, /no llegó a arrancar/);
});

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
