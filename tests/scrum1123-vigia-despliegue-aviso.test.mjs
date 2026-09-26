// tests/scrum1123-vigia-despliegue-aviso.test.mjs — SCRUM-1123 (seguimiento)
//
// LA DECISIÓN DE «AVISAR DE VERDAD» DEL VIGÍA DEL DESPLIEGUE, PROBADA CONTRA DOBLES.
//
// `scripts/vigia-despliegue-aviso.mjs` es la parte de `.github/workflows/vigia-despliegue.yml`
// que antes vivía en bash+jq: componer el cuerpo del aviso y decidir si hay que abrir un Issue
// nuevo o comentar uno existente (dedupe por marcador). Este fichero ejercita esa decisión con
// listas de Issues FABRICADAS (el equivalente, para una decisión JSON-en/JSON-fuera, del servidor
// falso que usa `scrum1127-sif-client` para un cliente HTTP) y, al final, el binario real vía CLI.
//
// ⚠️ SUELO, dicho sin rodeos: esto prueba la FORMA de la decisión y que el CLI la expone bien.
// NO prueba que `api.github.com` acepte el `gh issue create`/`comment` real — eso es exactamente
// el mismo hueco que ya acepta `avisador-rojo.yml` para su `gh pr comment`, no uno nuevo.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { componerCuerpo, elegirIssueExistente, decidirAviso } from '../scripts/vigia-despliegue-aviso.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'vigia-despliegue-aviso.mjs');
const MARCA = '<!-- vigia-despliegue:produccion-congelada -->';

// ── componerCuerpo ───────────────────────────────────────────────────────────────────────────

test('SCRUM-1123 · componerCuerpo: lleva la constancia, la URL del run y la marca — en ese orden', () => {
  const cuerpo = componerCuerpo({ renglon: '2026-09-26 · prod=abc · main=def · 3h', runUrl: 'https://x/run/1', marca: MARCA });
  assert.match(cuerpo, /```\n2026-09-26 · prod=abc · main=def · 3h\n```/, '🔴 no lleva la constancia dentro del bloque de código');
  assert.match(cuerpo, /Ejecución: https:\/\/x\/run\/1/, '🔴 no lleva la URL del run');
  assert.ok(cuerpo.trim().endsWith(MARCA), '🔴 la marca tiene que ir al final, como exige el dedupe');
  assert.ok(cuerpo.indexOf('```') < cuerpo.indexOf('Ejecución'), '🔴 el orden importa: la constancia va antes que la URL');
});

test('SCRUM-1123 · componerCuerpo: sin renglón, dice que no hay constancia — no inventa una vacía', () => {
  const cuerpo = componerCuerpo({ renglon: '', runUrl: 'https://x/run/1', marca: MARCA });
  assert.match(cuerpo, /sin constancia: no se pudo leer \.vigia\/constancias\.log/);
});

// ── elegirIssueExistente ─────────────────────────────────────────────────────────────────────

test('SCRUM-1123 · elegirIssueExistente: sin Issues abiertos, no hay nada que elegir', () => {
  assert.equal(elegirIssueExistente([], MARCA), null);
});

test('SCRUM-1123 · elegirIssueExistente: la marca es un SUBSTRING dentro de un cuerpo más largo', () => {
  const issues = [{ number: 42, body: `algo de prosa antes\n${MARCA}\nalgo después`, pull_request: null }];
  assert.equal(elegirIssueExistente(issues, MARCA), 42);
});

test('SCRUM-1123 · elegirIssueExistente: un PR con la marca en el cuerpo NO cuenta (la API de Issues incluye PRs)', () => {
  const issues = [{ number: 7, body: MARCA, pull_request: { url: 'x' } }];
  assert.equal(elegirIssueExistente(issues, MARCA), null);
});

test('SCRUM-1123 · elegirIssueExistente: un Issue SIN la marca no casa, aunque haya otros de por medio', () => {
  const issues = [
    { number: 1, body: 'nada que ver', pull_request: null },
    { number: 2, body: `ruido\n${MARCA}`, pull_request: null },
  ];
  assert.equal(elegirIssueExistente(issues, MARCA), 2);
});

test('SCRUM-1123 · elegirIssueExistente: un Issue con `body: null` (la API lo devuelve así a veces) no revienta y no casa', () => {
  const issues = [{ number: 3, body: null, pull_request: null }];
  assert.equal(elegirIssueExistente(issues, MARCA), null);
});

// ── decidirAviso ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-1123 · decidirAviso: sin Issue previo → CREAR, con el cuerpo compuesto', () => {
  const r = decidirAviso({ issues: [], marca: MARCA, renglon: 'x', runUrl: 'https://x/run/1' });
  assert.equal(r.accion, 'crear');
  assert.match(r.cuerpo, /Ejecución: https:\/\/x\/run\/1/);
  assert.equal(r.numero, undefined, '🔴 crear no lleva número de Issue');
});

test('SCRUM-1123 · decidirAviso: CON Issue previo con la marca → COMENTAR ese número, no crear otro', () => {
  const issues = [{ number: 99, body: `lectura de ayer\n${MARCA}`, pull_request: null }];
  const r = decidirAviso({ issues, marca: MARCA, renglon: 'y', runUrl: 'https://x/run/2' });
  assert.equal(r.accion, 'comentar');
  assert.equal(r.numero, 99);
  assert.match(r.cuerpo, /Ejecución: https:\/\/x\/run\/2/, '🔴 el cuerpo del comentario es la lectura de HOY, no la de ayer');
});

test('SCRUM-1123 · 🔴 FAIL-CLOSED: sin marca no se decide nada (no se puede deduplicar)', () => {
  const r = decidirAviso({ issues: [], marca: '', renglon: 'x', runUrl: 'https://x' });
  assert.equal(r.accion, 'no-se-sabe');
  assert.match(r.motivo, /sin marca/);
});

// ── EL CLI, DE VERDAD (subproceso real, no un import) ───────────────────────────────────────

function correrCli(env) {
  const r = spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { status: r.status, salida: r.stdout ? JSON.parse(r.stdout) : null, stderr: r.stderr };
}

test('SCRUM-1123 · CLI: issues=[] por env → crea, exit 0', () => {
  const { status, salida } = correrCli({
    VIGIA_ISSUES_JSON: '[]', VIGIA_MARCA: MARCA, VIGIA_RENGLON: 'x', VIGIA_RUN_URL: 'https://x/run/1',
  });
  assert.equal(status, 0);
  assert.equal(salida.accion, 'crear');
});

test('SCRUM-1123 · CLI: con un Issue que YA lleva la marca → comenta ese número, exit 0', () => {
  const issues = JSON.stringify([{ number: 55, body: `algo\n${MARCA}`, pull_request: null }]);
  const { status, salida } = correrCli({
    VIGIA_ISSUES_JSON: issues, VIGIA_MARCA: MARCA, VIGIA_RENGLON: 'x', VIGIA_RUN_URL: 'https://x/run/1',
  });
  assert.equal(status, 0);
  assert.equal(salida.accion, 'comentar');
  assert.equal(salida.numero, 55);
});

test('SCRUM-1123 · 🔴 CLI FAIL-CLOSED: VIGIA_ISSUES_JSON ilegible (la API pudo devolver un error) → exit 1, no-se-sabe', () => {
  const { status, salida } = correrCli({
    VIGIA_ISSUES_JSON: 'esto no es JSON', VIGIA_MARCA: MARCA, VIGIA_RENGLON: 'x', VIGIA_RUN_URL: 'https://x/run/1',
  });
  assert.equal(status, 1, '🔴 un JSON ilegible tiene que fallar el paso, no seguir con una lista vacía inventada');
  assert.equal(salida.accion, 'no-se-sabe');
});

test('SCRUM-1123 · 🔴 CLI FAIL-CLOSED: sin VIGIA_MARCA en el entorno → exit 1, no-se-sabe', () => {
  const env = { ...process.env, VIGIA_ISSUES_JSON: '[]', VIGIA_RENGLON: 'x', VIGIA_RUN_URL: 'https://x' };
  delete env.VIGIA_MARCA;
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).accion, 'no-se-sabe');
});
