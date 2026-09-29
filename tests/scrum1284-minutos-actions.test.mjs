// tests/scrum1284-minutos-actions.test.mjs — SCRUM-1284
//
// El guion que mide la factura de Actions (`scripts/equipo/minutos-actions.mjs`) tiene dos formas de
// mentir, y las dos dan un número creíble:
//   1. contar mal el minuto: la duración de la CORRIDA en vez de cada JOB redondeado, o cobrar los
//      jobs `skipped` (el primer borrador los contaba: el avisador salía a 824 min en vez de 333);
//   2. sumar sobre una población incompleta (la API corta en 1.000) y salir en verde.
// Cada una tiene aquí su caso, y el caso que DEBE salir rojo va con su pareja que sale verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { minutosDeJob, resumir, veredicto, SALIDA } from '../scripts/equipo/minutos-actions.mjs';
import { soloDocs, esDocumentacion } from '../scripts/equipo/solo-docs.mjs';

// Las cinco se comprobaron a mano en rojo antes del primer commit (29-sep-2026); el meta-guard las
// vuelve a aplicar en cada PR.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/minutos-actions.mjs',
    de: "if (!job || job.conclusion === 'skipped' || !job.started_at",
    a: 'if (!job || !job.started_at',
    cae: 'un job skipped se cobra a 1 min',
  },
  {
    fichero: 'scripts/equipo/minutos-actions.mjs',
    de: 'if (leidas < declaradas) motivos.push',
    a: 'if (false) motivos.push',
    cae: 'una población truncada sale en verde',
  },
  {
    fichero: 'scripts/equipo/solo-docs.mjs',
    de: 'return lista.length > 0 && lista.every(esDocumentacion);',
    a: 'return lista.every(esDocumentacion);',
    cae: 'un diff vacío se lee como «solo docs» y se saltan los guards',
  },
  {
    fichero: '.github/workflows/ci.yml',
    de: "      - name: Guards de navegador\n        if: steps.alcance.outputs.solo_docs != 'true'\n",
    a: '      - name: Guards de navegador\n',
    cae: 'el paso de los guards deja de saltarse',
  },
  {
    fichero: '.github/workflows/ci.yml',
    de: "    if: github.event_name == 'push'\n\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          # El historial ENTERO: el vigía",
    a: "\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          # El historial ENTERO: el vigía",
    cae: 'el vigía vuelve a correr en cada PR',
  },
];

const CI = fs.readFileSync(path.join(import.meta.dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
/** El bloque de un job de ci.yml: desde `  <id>:` hasta el siguiente job de dos espacios. */
function bloqueDelJob(id) {
  const i = CI.search(new RegExp(`^  ${id}:\\s*$`, 'm'));
  assert.notEqual(i, -1, `🔴 CIEGO: no encuentro el job ${id} en ci.yml`);
  const resto = CI.slice(i + 3);
  const j = resto.search(/^  [a-z][a-z0-9-]*:\s*$/m);
  return j === -1 ? CI.slice(i) : CI.slice(i, i + 3 + j);
}

const job = (name, segundos, conclusion = 'success') => ({
  name, conclusion,
  started_at: '2026-09-22T10:00:00Z',
  completed_at: new Date(Date.parse('2026-09-22T10:00:00Z') + segundos * 1000).toISOString(),
});

test('SCRUM-1284 · un job se factura redondeado al minuto hacia arriba, mínimo 1', () => {
  assert.equal(minutosDeJob(job('a', 1)), 1);
  assert.equal(minutosDeJob(job('a', 0)), 1);
  assert.equal(minutosDeJob(job('a', 60)), 1);
  assert.equal(minutosDeJob(job('a', 61)), 2);
  assert.equal(minutosDeJob(job('a', 12 * 60 + 5)), 13);
});

test('SCRUM-1284 · 🔴 un job `skipped` NO se paga, aunque traiga marcas de tiempo', () => {
  // La API devuelve started_at == completed_at en los skipped: sin el filtro, cada uno costaría 1 min.
  assert.equal(minutosDeJob(job('avisar', 0, 'skipped')), 0);
  assert.equal(minutosDeJob({ name: 'x', conclusion: null, started_at: null, completed_at: null }), 0);
});

test('SCRUM-1284 · la corrida suma sus JOBS, no su duración de reloj, e incluye los intentos previos', () => {
  // Seis jobs en paralelo de 10 min: 10 min de reloj, 60 de factura.
  const seis = Array.from({ length: 6 }, (_, k) => job(`j${k}`, 9 * 60 + 30));
  const r = resumir([{ name: 'CI', jobs: seis, intentosPrevios: [[job('j0', 30)]] }]);
  assert.equal(r.total, 61);
  assert.equal(r.porFlujo.get('CI').porJob.get('j0'), 11);
});

test('SCRUM-1284 · 🔴 CONTROL POSITIVO: población truncada → NO_PUDE_MIRAR, nunca verde', () => {
  assert.equal(veredicto({ declaradas: 855, leidas: 855, jobsSinLeer: 0 }).codigo, SALIDA.VERDE);
  const truncada = veredicto({ declaradas: 1200, leidas: 1000, jobsSinLeer: 0 });
  assert.equal(truncada.codigo, SALIDA.NO_PUDE_MIRAR);
  assert.match(truncada.motivos.join(), /faltan 200 de 1200/);
  assert.equal(veredicto({ declaradas: 10, leidas: 10, jobsSinLeer: 1 }).codigo, SALIDA.NO_PUDE_MIRAR);
  assert.equal(veredicto({ declaradas: 0, leidas: 0, jobsSinLeer: 0 }).codigo, SALIDA.NO_PUDE_MIRAR,
    '🔴 cero corridas no es «no gastamos nada»: es «no he mirado».');
});

// ── R1 · el job de navegador no arranca sobre un PR que solo trae prosa ─────────────────────────

test('SCRUM-1284 · R1 · solo-docs: prosa sí; cualquier fichero con código, no', () => {
  assert.equal(soloDocs(['docs/master/SCRUM-1.md', 'README.md', 'docs/master/evidencias/SCRUM-1/sonda.mjs']), true);
  assert.equal(soloDocs(['docs/master/SCRUM-1.md', 'public/dashboard/js/app.js']), false);
  assert.equal(esDocumentacion('public/legal/terminos.md'), false, '🔴 un .md bajo public/ se SIRVE: es pantalla');
  assert.equal(esDocumentacion('tests/banco-scrum911/README.md'), false);
  assert.equal(esDocumentacion('.github/workflows/ci.yml'), false);
});

test('SCRUM-1284 · R1 · 🔴 CONTROL POSITIVO: sin lista no hay «solo docs» — se corre todo', () => {
  assert.equal(soloDocs([]), false, '🔴 un diff vacío o ilegible NO es «solo docs»: es «no sé qué trae»');
  assert.equal(soloDocs(['', '  ']), false);
  assert.equal(soloDocs(undefined), false);
});

test('SCRUM-1284 · R1 · el salto vive SOLO en el job de navegador; meta-guard, trinquete y la tanda corren siempre', () => {
  const nav = bloqueDelJob('guards-visuales');
  assert.match(nav, /node scripts\/equipo\/solo-docs\.mjs/);
  assert.match(nav, /Guards de navegador\n\s+if: steps\.alcance\.outputs\.solo_docs != 'true'/,
    '🔴 el paso de los guards no está condicionado: el salto no ahorraría nada');
  assert.match(nav, /NO se han corrido/, '🔴 un salto que no se dice en el resumen se lee como un verde de los guards');
  // Medido: el meta-guard muta ficheros de docs/ y la tanda lee docs/ en 193 ficheros.
  for (const id of ['test', 'meta-mutaciones', 'trinquete-zona']) {
    assert.doesNotMatch(bloqueDelJob(id), /solo_docs|solo-docs/,
      `🔴 el job ${id} se salta en PR solo-docs, y ese job SÍ depende de docs/ (SCRUM-1284)`);
  }
});

// ── R4 · el vigía del despliegue, solo en push a main ───────────────────────────────────────────

test('SCRUM-1284 · R4 · el vigía del CI corre en push a main (no en cada PR) y sigue sin bloquear', () => {
  const v = bloqueDelJob('vigia-despliegue');
  assert.match(v, /\n    if: github\.event_name == 'push'\n/);
  assert.match(v, /continue-on-error:\s*true/);
  assert.match(CI, /^  push:\n    branches: \[main\]/m, '🔴 si el CI deja de correr en push a main, R4 deja al vigía sin corrida');
});
