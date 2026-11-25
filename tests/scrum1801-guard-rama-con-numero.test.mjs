// SCRUM-1801 ① · el guard de la puerta: una rama `scrum-<dígito>…` sin número para el censo sale ROJA
// ANTES de empujar. Contexto y población medida, en la cabecera de scripts/guard-rama-con-numero.mjs y
// en docs/master/SCRUM-1801.md.
//
// Los casos se lanzan como proceso (`spawnSync` del guard) con `GITHUB_HEAD_REF` inyectado: así no hace
// falta crear ramas, y se prueba la puerta de entrada del script, no sólo su función.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { numeroDeRama } from '../scripts/_numero-de-rama.mjs';
import { agruparRamas } from '../scripts/_censo-reparto.mjs';
import { FILTRO_DE_SCRUM804 } from '../scripts/guard-rama-con-numero.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = path.join(RAIZ, 'scripts', 'guard-rama-con-numero.mjs');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/guard-rama-con-numero.mjs',
    de: '  const n = numeroDeRama(limpio);\n',
    a: '  const n = limpio.length;\n',
    cae: 'SCRUM-1801 · ROJO para `scrum-1787aa-x`',
  },
];

/** Entorno del hijo sin lo que hereda de `node --test` ni de GitHub (memoria: hijo de node --test). */
function entornoLimpio(extra = {}) {
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR',
    'GITHUB_HEAD_REF', 'GITHUB_REF_NAME', 'GITHUB_REF_TYPE']) delete env[k];
  return { ...env, ...extra };
}

function lanzar({ env, cwd = RAIZ }) {
  const r = spawnSync(process.execPath, [GUARD], { cwd, env, encoding: 'utf8' });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  // Suelo: un hijo que no arrancó no da veredicto, y su silencio no es un verde.
  assert.match(salida, /guard-rama-con-numero · 1 rama mirada: /,
    `🔴 CIEGO: el guard no declaró su población (status ${r.status}, error ${r.error?.message ?? '—'}):\n${salida}`);
  return { status: r.status, salida };
}

test('SCRUM-1801 · rojo primero: sin el guard, `scrum-1787aa-x` entra en el censo SIN número y scrum804 sí la cruza', () => {
  // El hueco que el guard tapa, medido con las piezas de la casa y sin el guard: el censo la acepta
  // callado en `sinNumero`, y el filtro de scrum804 la exige en el censo. Ésa es la caída del 24-nov.
  const nombre = 'scrum-1787aa-x';
  assert.equal(numeroDeRama(nombre), null);
  const { porTicket, sinNumero } = agruparRamas([`0000000 refs/heads/${nombre}`]);
  assert.equal(porTicket.size, 0);
  assert.deepEqual(sinNumero.map((s) => s.nombre), [nombre]);
  assert.ok(FILTRO_DE_SCRUM804.test(nombre), 'scrum804 la cruza: por eso cae en todos los PR');
});

test('SCRUM-1801 · verde para `scrum-1801-guard-rama-con-numero` (control positivo)', () => {
  const { status, salida } = lanzar({ env: entornoLimpio({ GITHUB_HEAD_REF: 'scrum-1801-guard-rama-con-numero' }) });
  assert.equal(status, 0, salida);
  assert.match(salida, /1 rama mirada: scrum-1801-guard-rama-con-numero \(de GITHUB_HEAD_REF\)/);
  assert.match(salida, /SCRUM-1801\./);
});

test('SCRUM-1801 · ROJO para `scrum-1787aa-x`', () => {
  const { status, salida } = lanzar({ env: entornoLimpio({ GITHUB_HEAD_REF: 'scrum-1787aa-x' }) });
  assert.equal(status, 1, salida);
  assert.match(salida, /tu rama `scrum-1787aa-x` no tiene número para el censo \(scripts\/_numero-de-rama\.mjs\): scrum804 caerá en TODOS los PR\. A la 27ª pieza de un ticket, ticket hijo\./);
});

test('SCRUM-1801 · `relevo/sin-numero` y `main` no caen: scrum804 no las cruza', () => {
  // Población medida el 24-nov: 68 de 191 ramas del remoto sin número (54 `claude/pr-*`) y scrum804
  // en verde con ellas. Rojo aquí tumbaría las PR del workflow `@claude` sin nada roto.
  for (const nombre of ['relevo/sin-numero', 'claude/pr-1190-20260915-1027']) {
    const { status, salida } = lanzar({ env: entornoLimpio({ GITHUB_HEAD_REF: nombre }) });
    assert.equal(status, 0, salida);
    assert.match(salida, /no empieza por `scrum-<dígito>`/);
  }
  const { status, salida } = lanzar({ env: entornoLimpio({ GITHUB_REF_NAME: 'main' }) });
  assert.equal(status, 0, salida);
  assert.match(salida, /1 rama mirada: main \(de GITHUB_REF_NAME\)/);
});

test('SCRUM-1801 · sin rama que leer sale CIEGO (2), no verde', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1801-'));
  try {
    const env = entornoLimpio({ GIT_CEILING_DIRECTORIES: path.dirname(dir) });
    const { status, salida } = lanzar({ env, cwd: dir });
    assert.equal(status, 2, salida);
    assert.match(salida, /CIEGO/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-1801 · el filtro copiado sigue siendo el de scrum804 (dos copias que no divergen en silencio)', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'tests', 'scrum804-la-rama-viva.test.mjs'), 'utf8');
  const literal = `/${FILTRO_DE_SCRUM804.source}/${FILTRO_DE_SCRUM804.flags}.test(n)`;
  assert.ok(fuente.includes(literal),
    `🔴 scrum804 ya no filtra con \`${literal}\`: el guard de SCRUM-1801 pone rojo a otra población que la que scrum804 cruza. Sincroniza FILTRO_DE_SCRUM804.`);
});

test('SCRUM-1801 · la rama de ESTE árbol (o la del PR en CI) tiene número para el censo', (t) => {
  // Sin inyectar nada: en CI de un PR lee GITHUB_HEAD_REF; en local, git. Es lo que pone el aviso
  // delante de quien corre la suite antes de empujar.
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
  const { status, salida } = lanzar({ env });
  if (status === 2) { t.skip(`CIEGO en este entorno (HEAD suelto sin variables de GitHub): ${salida.trim()}`); return; }
  assert.equal(status, 0, salida);
});
