// tests/scrum935b-main-no-cancela.test.mjs — SCRUM-935 (opción B, decisión del comentario 16227)
//                                              + SCRUM-1498c (concurrencia por job, c.20758)
//
// En una rama de PR, los commits intermedios son borradores: un push nuevo cancela el CI anterior.
// En `main` cada commit es un estado YA desplegado: cancelarlo no ahorra trabajo, decide que ese
// estado no se comprueba nunca (38 de 44 runs cancelados en 5 h, 87 % el 21-sep).
//
// SCRUM-1498c: el grupo de concurrencia era UNO por run, y lo retenía el job más largo (el
// meta-guard, ~29 min) en vez del obligatorio (~12 min): `build + tests` daba veredicto en el
// 28,9 % de los commits de `main` (81 de 280, 17 al 24-oct). Desde entonces cada job lleva su
// propio grupo. Lo que fija este fichero, evaluado sobre los dos únicos refs en los que corre ci.yml
// (A23·5: no busca un texto, evalúa la expresión):
//   · NO hay `concurrency:` de workflow (devolvería la cola al job más largo).
//   · CADA job tiene el suyo, con un grupo por ref que no comparte con ningún otro job.
//   · `refs/heads/main`      → NO cancela.
//   · `refs/pull/<n>/merge`  → SIGUE cancelando.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CI = fs.readFileSync(path.join(RAIZ, '.github/workflows/ci.yml'), 'utf8');

// Sin comentarios (A23·2/3): por líneas, con `\r?\n`, y sin `.*$` sobre el fichero entero.
function lineas(texto) {
  return texto.split(/\r?\n/)
    .map((l) => l.replace(/^\s*#.*$/, '').replace(/\s+#.*$/, ''))
    .filter((l) => l.trim() !== '');
}

const sangria = (l) => l.length - l.trimStart().length;

// Las líneas hijas de la línea `i` (las que tienen más sangría que ella), sin recortar.
function hijas(ls, i) {
  const dentro = [];
  for (let j = i + 1; j < ls.length && sangria(ls[j]) > sangria(ls[i]); j++) dentro.push(ls[j]);
  return dentro;
}

function clave(ls, nombre) {
  const l = ls.map((x) => x.trim()).find((x) => x.startsWith(`${nombre}:`));
  return l === undefined ? null : l.slice(nombre.length + 1).trim();
}

// Lee un ci.yml: el `concurrency` de workflow (o null) y, por job, su nombre y su `concurrency`.
function analiza(texto) {
  const ls = lineas(texto);
  const iWf = ls.findIndex((l) => l === 'concurrency:');
  const iJobs = ls.findIndex((l) => l === 'jobs:');
  const jobs = [];
  if (iJobs >= 0) {
    const cuerpo = hijas(ls, iJobs);
    const s = cuerpo.length ? sangria(cuerpo[0]) : 0;
    cuerpo.forEach((l, k) => {
      if (sangria(l) !== s || !/^[A-Za-z0-9_-]+:$/.test(l.trim())) return;
      const dentro = hijas(cuerpo, k);
      const ss = dentro.length ? sangria(dentro[0]) : 0;
      const propias = dentro.filter((x) => sangria(x) === ss);
      const iC = dentro.findIndex((x) => sangria(x) === ss && x.trim() === 'concurrency:');
      const conc = iC < 0 ? null : hijas(dentro, iC);
      jobs.push({
        id: l.trim().slice(0, -1),
        nombre: clave(propias, 'name'),
        grupo: conc && clave(conc, 'group'),
        cancela: conc && clave(conc, 'cancel-in-progress'),
      });
    });
  }
  return { workflow: iWf < 0 ? null : hijas(ls, iWf), jobs, ls };
}

// Evalúa `cancel-in-progress` para un ref. Una forma que no sabe evaluar NO es un verde: lanza.
function cancela(valor, ref) {
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  const m = String(valor).match(/^\$\{\{\s*github\.ref\s*(==|!=)\s*'([^']+)'\s*\}\}$/);
  assert.ok(m, `🔴 no sé evaluar cancel-in-progress: «${valor}». Un guard que no puede mirar no da verde.`);
  return m[1] === '==' ? ref === m[2] : ref !== m[2];
}

// Lo que tiene que cumplir un ci.yml. Devuelve la lista de defectos (vacía = sano).
function defectos({ workflow, jobs }) {
  const d = [];
  if (workflow !== null) d.push('hay `concurrency:` de workflow: el grupo lo retiene el run entero');
  const vistos = new Map();
  for (const j of jobs) {
    if (j.grupo === null || j.cancela === null) { d.push(`${j.id}: sin concurrency (group/cancel-in-progress)`); continue; }
    if (!j.grupo.includes('${{ github.ref }}')) d.push(`${j.id}: el grupo «${j.grupo}» no es por ref`);
    if (/github\.(sha|run_id|run_number|run_attempt)/.test(j.grupo)) d.push(`${j.id}: grupo único por run`);
    if (vistos.has(j.grupo)) d.push(`${j.id}: comparte el grupo «${j.grupo}» con ${vistos.get(j.grupo)}`);
    vistos.set(j.grupo, j.id);
    if (cancela(j.cancela, REF_MAIN) !== false) d.push(`${j.id}: cancela en main`);
    if (cancela(j.cancela, REF_PR) !== true) d.push(`${j.id}: ya no cancela en PR`);
  }
  return d;
}

const REF_MAIN = 'refs/heads/main';
const REF_PR = 'refs/pull/1234/merge';
const OBLIGATORIO = 'build + tests (con banco desechable)';
const REAL = analiza(CI);

test('SCRUM-935b · 🔴 SUELO: los jobs de ci.yml y su concurrency se leen de verdad', () => {
  assert.ok(CI.length > 2000, `🔴 CIEGO: ci.yml tiene ${CI.length} bytes.`);
  assert.ok(REAL.jobs.length >= 5, `🔴 sólo veo ${REAL.jobs.length} jobs en ci.yml: el lector no ve el fichero.`);
  const obl = REAL.jobs.filter((j) => j.nombre === OBLIGATORIO);
  assert.equal(obl.length, 1, `🔴 no encuentro UN job llamado «${OBLIGATORIO}» (el check obligatorio de main).`);
  assert.ok(obl[0].grupo !== null, '🔴 el job obligatorio no tiene `concurrency:` propio.');
});

test('SCRUM-935b · POBLACIÓN: ci.yml solo corre en PR y en push a main (los dos refs de abajo son todos)', () => {
  assert.ok(REAL.ls.includes('  pull_request:') && REAL.ls.includes('  push:'), '🔴 cambiaron los eventos de ci.yml.');
  const ramas = REAL.ls.filter((l) => /^\s+branches:/.test(l)).map((l) => l.trim());
  assert.deepEqual(ramas, ['branches: [main]', 'branches: [main]'],
    '🔴 ci.yml corre ahora sobre otras ramas: este guard tendría que evaluar también sus refs.');
});

test('SCRUM-935b/1498c · 🔴 ROJO: cada job en su grupo por ref; en main no cancela, en PR sí; nada de grupo de workflow', () => {
  assert.deepEqual(defectos(REAL), [],
    `🔴 la concurrencia de ci.yml está mal (${REAL.jobs.length} jobs mirados):\n  ` + defectos(REAL).join('\n  '));
});

test('SCRUM-935b/1498c · CONTROL del instrumento: ve cada defecto si vuelve (mecanismo, A23·12)', () => {
  assert.equal(cancela('true', REF_MAIN), true);
  assert.equal(cancela("${{ github.ref != 'refs/heads/main' }}", REF_MAIN), false);
  assert.equal(cancela("${{ github.ref != 'refs/heads/main' }}", REF_PR), true);
  assert.equal(cancela("${{ github.ref == 'refs/heads/main' }}", REF_MAIN), true);
  assert.throws(() => cancela("${{ github.event_name == 'push' }}", REF_MAIN), /no sé evaluar/);

  const job = (id, grupo, canc = "${{ github.ref != 'refs/heads/main' }}") =>
    `  ${id}:\n    name: ${id}\n    runs-on: ubuntu-latest\n    concurrency:\n      group: ${grupo}\n      cancel-in-progress: ${canc}\n    steps:\n      - run: echo\n`;
  const yml = (cab, ...js) => `name: CI\non:\n  push:\n    branches: [main]\n${cab}jobs:\n${js.join('')}`;
  const sano = yml('', job('a', 'ci-a-${{ github.ref }}'), job('b', 'ci-b-${{ github.ref }}'));
  assert.deepEqual(defectos(analiza(sano)), [], 'el control SANO tiene que salir sin defectos');
  assert.equal(analiza(sano).jobs.length, 2, 'el lector tiene que ver los 2 jobs del control');

  // El defecto de antes de 1498c: un grupo de workflow.
  const conWf = yml("concurrency:\n  group: ci-${{ github.ref }}\n  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}\n",
    job('a', 'ci-a-${{ github.ref }}'), job('b', 'ci-b-${{ github.ref }}'));
  assert.match(defectos(analiza(conWf)).join(), /de workflow/);
  // Dos jobs del mismo run en el mismo grupo se sustituyen entre ellos.
  assert.match(defectos(analiza(yml('', job('a', 'ci-x-${{ github.ref }}'), job('b', 'ci-x-${{ github.ref }}')))).join(), /comparte/);
  // Un job sin concurrency.
  const sinConc = sano.replace(/    concurrency:\n      group: ci-b-\$\{\{ github\.ref \}\}\n      cancel-in-progress: [^\n]+\n/, '');
  assert.notEqual(sinConc, sano, 'la mutación del control tiene que aplicarse');
  assert.match(defectos(analiza(sinConc)).join(), /b: sin concurrency/);
  // Cancela en main / grupo por run.
  assert.match(defectos(analiza(yml('', job('a', 'ci-a-${{ github.ref }}', 'true')))).join(), /cancela en main/);
  assert.match(defectos(analiza(yml('', job('a', 'ci-a-${{ github.sha }}')))).join(), /no es por ref/);
  // Un `concurrency:` en un PASO (sangría más honda) no cuenta como el del job.
  const enPaso = yml('', `  a:\n    name: a\n    steps:\n      - run: echo\n        concurrency:\n          group: ci-a-\${{ github.ref }}\n`);
  assert.match(defectos(analiza(enPaso)).join(), /a: sin concurrency/);
});
