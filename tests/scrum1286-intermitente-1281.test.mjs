// tests/scrum1286-intermitente-1281.test.mjs — SCRUM-1286 (la parte CI de SCRUM-1281)
//
// `scripts/equipo/intermitente-1281.mjs` decide si el rojo de `build + tests` es SOLO el intermitente
// de la fixture de censos. Su error caro es uno: decir INTERMITENTE de un rojo que no lo es, porque
// entonces se relanza y el fallo de verdad entra en main. Por eso cada camino a INTERMITENTE tiene
// aquí su pareja que NO lo es, y los fragmentos de log son copia de los cuatro casos reales
// (jobs 109374096698, 109078700133, 108191585134 y 109001455555), recortados.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  clasificar, traeLaFirma, enCI, cuerpoDelComentario, marcaDelComentario,
  ETIQUETA, MARCADOR, PASO_DE_LA_TANDA, SALIDA,
} from '../scripts/equipo/intermitente-1281.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/intermitente-1281.mjs',
    de: '  if (otros.length) {',
    a: '  if (false) {',
    cae: 'si cae OTRO paso además de la tanda, no es el intermitente',
  },
  {
    fichero: 'scripts/equipo/intermitente-1281.mjs',
    de: '  if (sin.length === 0) {',
    a: '  if (sin.length < detalle.length) {',
    cae: 'el rojo MIXTO del 25-sep (775 con firma + 804b real) NO es el intermitente',
  },
  {
    fichero: 'scripts/equipo/intermitente-1281.mjs',
    de: '  return bloque.includes(fichero) ? bloque : \'\';',
    a: '  return bloque;',
    cae: 'la firma de OTRO fichero no se le atribuye al que cayó',
  },
  {
    fichero: 'scripts/equipo/intermitente-1281.mjs',
    de: "  if (c.veredicto === 'CIEGO') return res; // sin veredicto no se toca ninguna etiqueta",
    a: '',
    cae: 'sin log legible, o sin PR legible, NO se toca ninguna etiqueta',
  },
  {
    fichero: '.github/workflows/avisador-rojo.yml',
    de: '        name: ¿Es el intermitente de SCRUM-1281?\n        continue-on-error: true\n',
    a: '        name: ¿Es el intermitente de SCRUM-1281?\n',
    cae: 'el avisador llama al clasificador ANTES del aviso, sin poder tumbarlo',
  },
];

const Z = (l) => `2026-09-29T10:59:13.9213645Z ${l}`;
const log = (...lineas) => lineas.map(Z).join('\n');
const FIN = ['##[error]Process completed with exit code 1.'];

// Caso 388 (29-sep, main): el fichero cae A NIVEL DE PROCESO; la sección de fallos solo dice
// «'test failed'» y el error está ENCIMA, como stderr.
const STDERR_388 = [
  '✔ SCRUM-387 · «presupuesto aprobado» NO es una marca de aprobación (0.902103ms)',
  'Error: Command failed: git commit -q -m chore: relleno 73',
  'error: unable to create temporary file: No such file or directory',
  'fatal: failed to write commit object',
  '    at repoFixture (file:///home/runner/work/x/x/tests/_censo-fixture.mjs:105:21)',
  '    at file:///home/runner/work/x/x/tests/scrum388-censo-mecanismo.test.mjs:28:14',
  'Node.js v24.21.0',
  '✖ tests/scrum388-censo-mecanismo.test.mjs (1351.97382ms)',
];
const FALLO_388 = ['test at tests/scrum388-censo-mecanismo.test.mjs:1:1', '✖ tests/scrum388-censo-mecanismo.test.mjs (1351.97382ms)', "  'test failed'"];
// Caso 775 (28-sep): falla un SUBTEST; el error sale dentro de la sección de fallos.
const FALLO_775 = [
  'test at tests/scrum775-suelo-que-no-dispara.test.mjs:82:1',
  '✖ SCRUM-775 · 🔴 el banco reproduce el encogimiento, y el suelo lo VE (1938.37099ms)',
  '  Error: Command failed: git clone --quiet /tmp/censo-fixture-W89SKC /tmp/suelo-wgHpq1',
  "  fatal: failed to copy file to '/tmp/suelo-wgHpq1/.git/objects/e6/2c82c5efdec854fb4daa2e4415091aacb4fd11': No such file or directory",
];
// Caso 804b (25-sep, en el MISMO job que un 775): un fallo real.
const FALLO_804B = [
  'test at tests/scrum804b-el-barrido-de-la-42.test.mjs:64:1',
  '✖ SCRUM-804b · 🔴 SUELO y CONTROLES: el criterio reconoce lo que SÍ está y lo que NO (1128.38006ms)',
  "  AssertionError [ERR_ASSERTION]: 🔴 SCRUM-1118 tiene rama viva SIN mergear",
];
const JOB_TANDA = { steps: [
  { name: 'Compilar (tsc)', conclusion: 'success' },
  { name: PASO_DE_LA_TANDA, conclusion: 'failure' },
  { name: 'Carrera de tramos, aislada (emite facturas y MIDE una carrera)', conclusion: 'skipped' },
] };

test('SCRUM-1286 · los tres casos reales con la firma salen INTERMITENTE', () => {
  const r388 = clasificar({ log: log(...STDERR_388, '✖ failing tests:', '', ...FALLO_388, ...FIN), job: JOB_TANDA });
  assert.equal(r388.veredicto, 'INTERMITENTE', r388.motivo);
  const r775 = clasificar({ log: log('✖ failing tests:', '', ...FALLO_775, ...FIN), job: JOB_TANDA });
  assert.equal(r775.veredicto, 'INTERMITENTE', r775.motivo);
  assert.equal(r775.codigo, SALIDA.INTERMITENTE);
});

test('SCRUM-1286 · el marcador de la fixture de S3 basta por sí solo', () => {
  assert.equal(traeLaFirma(`${MARCADOR} git commit perdió un fichero bajo .git/objects (cwd /x): error: …`), true);
  const r = clasificar({ log: log('✖ failing tests:', '', 'test at tests/scrum388-x.test.mjs:1:1', `  Error: ${MARCADOR} git commit perdió un fichero`, ...FIN), job: JOB_TANDA });
  assert.equal(r.veredicto, 'INTERMITENTE');
});

test('SCRUM-1286 · 🔴 el rojo MIXTO del 25-sep (775 con firma + 804b real) NO es el intermitente', () => {
  const r = clasificar({ log: log('✖ failing tests:', '', ...FALLO_775, '', ...FALLO_804B, ...FIN), job: JOB_TANDA });
  assert.equal(r.veredicto, 'NO-ES-EL-INTERMITENTE');
  assert.match(r.motivo, /1 de 2 .*scrum804b/);
});

test('SCRUM-1286 · 🔴 si cae OTRO paso además de la tanda, no es el intermitente aunque los tests traigan la firma', () => {
  const job = { steps: [...JOB_TANDA.steps, { name: '¿Ha perdido tests la tanda?', conclusion: 'failure' }] };
  const r = clasificar({ log: log('✖ failing tests:', '', ...FALLO_775, ...FIN), job });
  assert.equal(r.veredicto, 'NO-ES-EL-INTERMITENTE');
  assert.match(r.motivo, /Ha perdido tests/);
});

test('SCRUM-1286 · 🔴 la firma de OTRO fichero no se le atribuye al que cayó a nivel de proceso', () => {
  // Mismo stderr con firma, pero la pila no nombra el fichero que cayó: no es suyo.
  const ajeno = STDERR_388.map((l) => l.replace(/scrum388-censo-mecanismo/g, 'scrum999-otro'));
  ajeno[ajeno.length - 1] = '✖ tests/scrum500-cae-por-otra-cosa.test.mjs (10ms)';
  const falloAjeno = ['test at tests/scrum500-cae-por-otra-cosa.test.mjs:1:1', '✖ tests/scrum500-cae-por-otra-cosa.test.mjs (10ms)', "  'test failed'"];
  const r = clasificar({ log: log(...ajeno, '✖ failing tests:', '', ...falloAjeno, ...FIN), job: JOB_TANDA });
  assert.equal(r.veredicto, 'NO-ES-EL-INTERMITENTE');
});

test('SCRUM-1286 · 🔴 CONTROL: sin log, sin pasos o sin lista de fallos sale CIEGO, nunca INTERMITENTE', () => {
  assert.equal(clasificar({ log: '', job: JOB_TANDA }).veredicto, 'CIEGO');
  assert.equal(clasificar({ log: log(...FALLO_775), job: { steps: [] } }).veredicto, 'CIEGO');
  assert.equal(clasificar({ log: log('nada que ver', ...FIN), job: JOB_TANDA }).veredicto, 'CIEGO',
    'el paso de la tanda cayó y no hay «✖ failing tests:»: no se sabe, que no es «no hay nada»');
  assert.equal(clasificar({ log: log('✖ failing tests:', '', ...FIN), job: JOB_TANDA }).veredicto, 'CIEGO');
});

// ── Modo CI, con un `fetch` falso que anota lo que se le pide ────────────────────────────────────

function fetchFalso({ jobConclusion = 'failure', logTexto, logFalla = false, pullsFalla = false, comentarios = [] } = {}) {
  const llamadas = [];
  const resp = (status, cuerpo) => ({ ok: status < 300, status, json: async () => cuerpo, text: async () => cuerpo });
  const fn = async (url, init = {}) => {
    const ruta = url.replace('https://api.github.com/', '');
    const metodo = init.method ?? 'GET';
    llamadas.push(`${metodo} ${ruta}`);
    if (/\/attempts\/\d+\/jobs/.test(ruta)) return resp(200, { jobs: [{ id: 7, name: 'build + tests (con banco desechable)', conclusion: jobConclusion, steps: JOB_TANDA.steps }, { id: 8, name: 'meta-guard', conclusion: 'failure' }] });
    if (/actions\/jobs\/7\/logs$/.test(ruta)) return logFalla ? resp(500, '') : resp(200, logTexto);
    if (/commits\/[0-9a-f]+\/pulls$/.test(ruta)) return pullsFalla ? resp(404, {}) : resp(200, [{ number: 42, state: 'open' }, { number: 41, state: 'closed' }]);
    if (metodo === 'GET' && /issues\/42\/comments/.test(ruta)) return resp(200, comentarios);
    return resp(metodo === 'DELETE' ? 404 : 201, {});
  };
  return { fn, llamadas };
}
const ENV = { GH_TOKEN: 't', REPO: 'o/r', RUN_ID: '1', INTENTO: '2', SHA: 'abcdef1234567890', URL_RUN: 'https://x/run/1' };
const LOG_775 = log('✖ failing tests:', '', ...FALLO_775, ...FIN);

test('SCRUM-1286 · CI: INTERMITENTE → etiqueta y UN comentario en el PR abierto (no en el cerrado), sin @claude', async () => {
  const f = fetchFalso({ logTexto: LOG_775 });
  const r = await enCI({ env: ENV, fetchFn: f.fn });
  assert.equal(r.veredicto, 'INTERMITENTE');
  assert.deepEqual(r.prs, [42]);
  assert.ok(f.llamadas.includes('GET repos/o/r/actions/runs/1/attempts/2/jobs?per_page=100'), 'lee el INTENTO que cayó, no el primero');
  assert.ok(f.llamadas.includes('POST repos/o/r/issues/42/labels'));
  assert.ok(f.llamadas.includes('POST repos/o/r/issues/42/comments'));
  assert.ok(!f.llamadas.some((l) => /issues\/41/.test(l)), 'un PR cerrado no se toca');
  const cuerpo = cuerpoDelComentario({ sha: ENV.SHA, motivo: 'm', urlRun: ENV.URL_RUN });
  assert.ok(!cuerpo.includes('@claude'), '🔴 este comentario informa; si llevara @claude despertaría a una sesión por un rojo que no es suyo');
  assert.ok(cuerpo.startsWith(marcaDelComentario(ENV.SHA)));
});

test('SCRUM-1286 · CI: un segundo aviso del mismo commit no duplica el comentario', async () => {
  const f = fetchFalso({ logTexto: LOG_775, comentarios: [{ body: `x\n${marcaDelComentario(ENV.SHA)}` }] });
  await enCI({ env: ENV, fetchFn: f.fn });
  assert.ok(!f.llamadas.includes('POST repos/o/r/issues/42/comments'));
});

test('SCRUM-1286 · CI: NO-ES → quita la etiqueta (ya no es verdad)', async () => {
  const f = fetchFalso({ logTexto: log('✖ failing tests:', '', ...FALLO_804B, ...FIN) });
  const r = await enCI({ env: ENV, fetchFn: f.fn });
  assert.equal(r.veredicto, 'NO-ES-EL-INTERMITENTE');
  assert.ok(f.llamadas.includes(`DELETE repos/o/r/issues/42/labels/${ETIQUETA}`));
  assert.ok(!f.llamadas.some((l) => l.startsWith('POST')));
});

test('SCRUM-1286 · 🔴 CI: sin log legible, o sin PR legible, NO se toca ninguna etiqueta', async () => {
  const a = fetchFalso({ logFalla: true });
  assert.equal((await enCI({ env: ENV, fetchFn: a.fn })).veredicto, 'CIEGO');
  assert.ok(!a.llamadas.some((l) => /labels|comments/.test(l)));
  const b = fetchFalso({ logTexto: LOG_775, pullsFalla: true });
  await enCI({ env: ENV, fetchFn: b.fn });
  assert.ok(!b.llamadas.some((l) => /labels|comments/.test(l)));
});

test('SCRUM-1286 · CI: si el obligatorio NO cayó (el rojo es de un informativo), NO-APLICA y no se toca nada', async () => {
  const f = fetchFalso({ jobConclusion: 'success', logTexto: LOG_775 });
  const r = await enCI({ env: ENV, fetchFn: f.fn });
  assert.equal(r.veredicto, 'NO-APLICA');
  assert.ok(!f.llamadas.some((l) => /logs|labels|comments/.test(l)));
});

test('SCRUM-1286 · el avisador llama al clasificador ANTES del aviso, sin poder tumbarlo, y con permiso de leer Actions', () => {
  const yml = fs.readFileSync(path.join(import.meta.dirname, '..', '.github', 'workflows', 'avisador-rojo.yml'), 'utf8');
  const i = yml.indexOf('- id: intermitente');
  assert.notEqual(i, -1, '🔴 el avisador no tiene el paso del intermitente');
  const paso = yml.slice(i, yml.indexOf('\n      - ', i + 5));
  assert.match(paso, /continue-on-error: true/);
  assert.match(paso, /GH_TOKEN: \$\{\{ github\.token \}\}/, 'con github.token: sus comentarios no disparan workflows');
  assert.match(paso, /INTENTO: \$\{\{ github\.event\.workflow_run\.run_attempt \}\}/);
  assert.match(paso, /node scripts\/equipo\/intermitente-1281\.mjs ci/);
  assert.ok(i < yml.indexOf('- name: Avisar a la sesión'), 'va antes del aviso, para que la sesión lo encuentre escrito');
  assert.match(yml, /^permissions:\n(?:  .*\n)*  actions: read\n/m);
});
