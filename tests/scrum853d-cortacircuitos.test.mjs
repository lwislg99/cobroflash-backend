// SCRUM-853d — el cortacircuitos: un tope de despertares por ventana de tiempo, donde se despierta.
//
// EL NÚMERO Y DE DÓNDE SALE. Decisión del orquestador del 16-sep-2026: **6 despertares por ventana
// de 60 minutos**, sobre estos datos medidos:
//
//   · 15-sep: 116 ejecuciones de claude.yml, 58 despertares reales, y un PICO DE 34 EN UNA HORA.
//   · 16-sep, primera muestra de extremo a extremo con el avisador encendido: UN despertar legítimo
//     costó 0,7369 USD (31 turnos, 137,7 s, claude-sonnet-5).
//   · A ese precio, el pico de ayer habrían sido ~25 USD en una hora; con el tope, ~4,4 USD.
//
// QUÉ NO ES ESTE TOPE: no sustituye al del avisador (3 avisos por PR, intacto). Aquel cuenta avisos
// publicados en UN PR; éste cuenta DESPERTARES en el repositorio entero, los pida quien los pida —
// 🔒 «el tope va donde se despierta, no donde se llama».
//
// LAS TRES PROPIEDADES QUE SE EXIGEN AQUÍ:
//   ① el 7.º de la ventana NO despierta, y deja dicho por qué y CUÁNDO vuelve a poder;
//   ② el 6.º SÍ despierta — un tope que se queda corto por contar desde cero es un tope roto;
//   ③ si la cuenta no se puede leer, NO se despierta. Es la misma familia que ya mordió dos veces:
//     `gh api` escribe el CUERPO del error por stdout y los subcomandos del CLI no.
//
// SIN GATE: funciones puras + un laboratorio que ejecuta el paso real con un `gh` falso.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as P from '../scripts/puerta-avisador-rojo.mjs';
import { cortacircuitos, respuestaTopeAlcanzado, TOPE_POR_VENTANA, VENTANA_MINUTOS } from '../scripts/puerta-claude.mjs';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLAUDE_YML = path.join(RAIZ, '.github', 'workflows', 'claude.yml');
const AHORA = Date.parse('2026-09-16T12:00:00Z');
const MINUTO = 60000;

// Cada propiedad con el defecto EXACTO que la anula.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/puerta-claude.mjs',
    de: '  if (previos.length >= TOPE_POR_VENTANA) {',
    a: '  if (previos.length > TOPE_POR_VENTANA) {',
    cae: 'el 7.º despertar de la ventana NO despierta',
  },
  {
    fichero: 'scripts/puerta-claude.mjs',
    de: "    return { despertar: false, codigo: 'SIN-CUENTA-DE-DESPERTARES', motivo, previos: null, cuando: null };",
    a: "    return { despertar: true, codigo: 'SIN-CUENTA-DE-DESPERTARES', motivo, previos: null, cuando: null };",
    cae: 'si la cuenta de despertares no se puede leer, NO se despierta',
  },
  {
    fichero: 'scripts/puerta-claude.mjs',
    de: '    .filter((e) => Date.parse(e.createdAt) > ahora - VENTANA_MINUTOS * 60000);',
    a: '    .filter(() => true);',
    cae: 'lo que ya salió de la ventana no cuenta',
  },
  {
    fichero: 'scripts/puerta-claude.mjs',
    de: "    .filter((e) => e.id !== idActual && e.conclusion !== 'skipped')",
    a: '    .filter((e) => e.id !== idActual)',
    cae: 'una ejecución SALTADA no es un despertar',
  },
];

/** N ejecuciones dentro de la ventana, la más vieja hace `desdeMin` minutos. */
const ejecuciones = (n, { desdeMin = 50, conclusion = 'success', id0 = 1000 } = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: id0 + i,
    createdAt: new Date(AHORA - desdeMin * MINUTO + i * MINUTO).toISOString(),
    conclusion,
  }));

// ── ① EL 7.º NO DESPIERTA ──────────────────────────────────────────────────────────────────────

test('🔴 ① el 7.º despertar de la ventana NO despierta, y dice por qué y cuándo vuelve a poder', () => {
  const r = cortacircuitos({ ejecuciones: ejecuciones(6), idActual: 999, ahora: AHORA });
  assert.equal(r.despertar, false, `con ${TOPE_POR_VENTANA} despertares ya dados, el siguiente no va`);
  assert.equal(r.codigo, 'TOPE-POR-VENTANA');
  assert.equal(r.previos, 6);
  // El hueco se abre cuando el MÁS VIEJO de la ventana sale de ella: 50 min atrás + 60 = dentro de 10.
  assert.equal(r.cuando, new Date(AHORA - 50 * MINUTO + VENTANA_MINUTOS * MINUTO).toISOString());
  assert.match(r.motivo, /6/);
  assert.match(r.motivo, /12:10/, 'el motivo tiene que decir a qué hora vuelve a poder');
});

test('🔴 ① y lo dice a quien llamó, sin despertar a nadie con la respuesta', () => {
  const r = cortacircuitos({ ejecuciones: ejecuciones(6), idActual: 999, ahora: AHORA });
  const t = respuestaTopeAlcanzado({ numero: 1322, previos: r.previos, cuando: r.cuando });
  assert.match(t, /#1322/);
  assert.match(t, /6/);
  assert.match(t, /12:10/);
  assert.equal(P.cuerpoNoDebeDespertar(t), true, 'la respuesta no puede despertar a Claude otra vez');
});

// ── ② EL 6.º SÍ DESPIERTA ──────────────────────────────────────────────────────────────────────

test('🔴 ② el 6.º SÍ despierta: el tope no puede quedarse corto por contar desde cero', () => {
  const r = cortacircuitos({ ejecuciones: ejecuciones(5), idActual: 999, ahora: AHORA });
  assert.equal(r.despertar, true, 'con 5 dados, el 6.º entra: el tope son 6, no 5');
  assert.equal(r.codigo, 'BAJO-TOPE');
  assert.equal(r.previos, 5);
});

// ── ③ SI NO SE PUEDE CONTAR, NO SE DESPIERTA ───────────────────────────────────────────────────

test('🔴 ③ si la cuenta de despertares no se puede leer, NO se despierta', () => {
  for (const ejs of [null, undefined, 'x', 42, { workflow_runs: [] }]) {
    const r = cortacircuitos({ ejecuciones: ejs, idActual: 999, ahora: AHORA });
    assert.equal(r.despertar, false, JSON.stringify(ejs));
    assert.equal(r.codigo, 'SIN-CUENTA-DE-DESPERTARES');
  }
});

test('🔴 ③ y una fecha que no se puede leer tampoco se cuenta como «no hay»', () => {
  // Es el caso del cuerpo del error colándose donde iba una fecha: no saber CUÁNDO fue un despertar
  // no es saber que fue hace mucho.
  const rotas = [...ejecuciones(2), { id: 2001, createdAt: '{"message":"Not Found"}', conclusion: 'success' }];
  const r = cortacircuitos({ ejecuciones: rotas, idActual: 999, ahora: AHORA });
  assert.equal(r.despertar, false);
  assert.equal(r.codigo, 'SIN-CUENTA-DE-DESPERTARES');
});

// ── ④ CONTROL: CON LA VENTANA VACÍA SE DESPIERTA COMO HOY ──────────────────────────────────────

test('🔴 ④ CONTROL · con la ventana vacía, un rojo obligatorio despierta como hasta ahora', () => {
  const r = cortacircuitos({ ejecuciones: [], idActual: 999, ahora: AHORA });
  assert.equal(r.despertar, true);
  assert.equal(r.codigo, 'BAJO-TOPE');
  assert.equal(r.previos, 0);
});

// ── LOS BORDES QUE DECIDEN SI LA CUENTA ES HONRADA ─────────────────────────────────────────────

test('la ejecución ACTUAL no se cuenta a sí misma', () => {
  // La lista viene de la API con esta misma ejecución dentro, en marcha y sin conclusión.
  const conmigo = [...ejecuciones(5), { id: 999, createdAt: new Date(AHORA).toISOString(), conclusion: null }];
  const r = cortacircuitos({ ejecuciones: conmigo, idActual: 999, ahora: AHORA });
  assert.equal(r.previos, 5, 'si se cuenta a sí misma, el tope corta uno antes de tiempo');
  assert.equal(r.despertar, true);
});

test('una ejecución SALTADA no es un despertar (el `if` del job dio falso: no gastó nada)', () => {
  const r = cortacircuitos({ ejecuciones: ejecuciones(6, { conclusion: 'skipped' }), idActual: 999, ahora: AHORA });
  assert.equal(r.previos, 0);
  assert.equal(r.despertar, true);
});

test('una ejecución EN MARCHA sí cuenta: ya está gastando', () => {
  const r = cortacircuitos({ ejecuciones: ejecuciones(6, { conclusion: null }), idActual: 999, ahora: AHORA });
  assert.equal(r.previos, 6);
  assert.equal(r.despertar, false);
});

test('lo que ya salió de la ventana no cuenta, y el borde se mira al minuto', () => {
  const justoFuera = ejecuciones(6, { desdeMin: VENTANA_MINUTOS }); // la más vieja, a 60 min exactos
  assert.equal(cortacircuitos({ ejecuciones: justoFuera, idActual: 999, ahora: AHORA }).previos, 5,
    'a los 60 minutos exactos ya está FUERA: la ventana es abierta por ese lado');
  const justoDentro = ejecuciones(6, { desdeMin: VENTANA_MINUTOS - 1 });
  assert.equal(cortacircuitos({ ejecuciones: justoDentro, idActual: 999, ahora: AHORA }).previos, 6);
});

test('el tope y la ventana son los DECIDIDOS, y se leen del módulo', () => {
  assert.equal(TOPE_POR_VENTANA, 6);
  assert.equal(VENTANA_MINUTOS, 60);
});

// ── EL LABORATORIO: el paso REAL de claude.yml con un gh falso ─────────────────────────────────

const barras = (p) => p.split(path.sep).join('/');
const clavePath = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';

/** El `run:` del paso `puerta` de claude.yml, tal cual está en el YAML. */
function pasoPuerta() {
  const lineas = fs.readFileSync(CLAUDE_YML, 'utf8').split('\n');
  const i = lineas.findIndex((l) => /^ {6}- id: puerta\s*$/.test(l));
  if (i < 0) return null;
  let j = i + 1;
  while (j < lineas.length && !/^ {8}run: \|\s*$/.test(lineas[j])) {
    if (/^ {6}- /.test(lineas[j])) return null;
    j++;
  }
  const cuerpo = [];
  for (let k = j + 1; k < lineas.length; k++) {
    const l = lineas[k];
    if (l.trim() === '') { cuerpo.push(''); continue; }
    if (!l.startsWith(' '.repeat(10))) break;
    cuerpo.push(l.slice(10));
  }
  return cuerpo.join('\n');
}

/** Los scripts se toman de `origin/main` en el workflow; en el laboratorio, del árbol. */
const DESDE_MAIN = /git show origin\/main:scripts\/([a-z-]+\.mjs) > "\$RUNNER_TEMP\/puerta\/\1"/g;

const GH_FALSO = [
  '#!/usr/bin/env bash',
  '# gh FALSO: `gh api` deja el CUERPO del error por stdout al fallar; los subcomandos del CLI, no.',
  'ruta="$2"',
  'falla() {',
  `  printf '%s' '{"message":"Not Found","documentation_url":"https://docs.github.com/rest","status":"404"}'`,
  "  echo 'gh: Not Found (HTTP 404)' >&2",
  '  exit 1',
  '}',
  'cae() { case " $FALLA " in *" $1 "*) return 0 ;; esac; return 1; }',
  'case "$ruta" in',
  '  */pulls/[0-9]*) cae PR && falla; printf \'%s\' \'{"merged":false,"state":"open","ramaCabeza":"scrum-x","cabezaPR":"abc"}\' ;;',
  '  */actions/workflows/claude.yml/runs*) cae EJECUCIONES && falla; printf \'%s\' "$EJECUCIONES_JSON" ;;',
  '  */git/matching-refs/*) printf \'%s\' \'[]\' ;;',
  '  *) falla ;;',
  'esac',
  '',
].join('\n');

function correrPaso(escenario = {}) {
  const guion = pasoPuerta();
  assert.ok(guion, '🔴 no encuentro el paso `puerta` en claude.yml');
  const desdeMain = (guion.match(DESDE_MAIN) || []).length;
  // El temporal se crea aquí y a la vista: el censo de SCRUM-824 no atraviesa lo que devuelve una función.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-853d-${process.pid}-`));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), GH_FALSO);
  fs.chmodSync(path.join(bin, 'gh'), 0o755);
  const salida = path.join(tmp, 'output');
  const resumen = path.join(tmp, 'summary');
  fs.writeFileSync(salida, '');
  fs.writeFileSync(resumen, '');
  fs.writeFileSync(path.join(tmp, 'paso.sh'),
    guion.replace(DESDE_MAIN, `cp "${barras(path.join(RAIZ, 'scripts'))}/$1" "$RUNNER_TEMP/puerta/$1"`));
  const env = {
    ...process.env,
    [clavePath]: bin + path.delimiter + process.env[clavePath],
    RUNNER_TEMP: barras(tmp),
    GITHUB_OUTPUT: barras(salida),
    GITHUB_STEP_SUMMARY: barras(resumen),
    GITHUB_RUN_ID: '999',
    REPO: 'lwislg99/cobroflash-backend',
    ES_PR: 'true',
    NUM: '1322',
    // Ya «pasado por -q»: el `gh api` real aplica el filtro y devuelve la LISTA, no el objeto crudo.
    EJECUCIONES_JSON: JSON.stringify([]),
    FALLA: '',
    ...escenario,
  };
  const r = spawnSync('bash', ['-e', barras(path.join(tmp, 'paso.sh'))], { cwd: RAIZ, env, encoding: 'utf8', timeout: 120000 });
  const outputs = {};
  for (const l of fs.readFileSync(salida, 'utf8').split('\n')) {
    const k = l.indexOf('=');
    if (k > 0) outputs[l.slice(0, k)] = l.slice(k + 1);
  }
  const leer = (f) => { try { return fs.readFileSync(path.join(tmp, f), 'utf8'); } catch { return null; } };
  return { status: r.status, stderr: r.stderr, error: r.error, desdeMain, outputs, resumen: fs.readFileSync(resumen, 'utf8'), leer };
}

/** Lo que devuelve `gh api … -q '[.workflow_runs[] | {id, createdAt: .created_at, conclusion}]'`. */
const runsJSON = (n, conclusion = 'success') => JSON.stringify(
  Array.from({ length: n }, (_, i) => ({
    id: 5000 + i, createdAt: new Date(Date.now() - (30 - i) * MINUTO).toISOString(), conclusion,
  })),
);

test('🔴 SUELO · el paso REAL con la ventana vacía despierta, y toma sus scripts de main', () => {
  const r = correrPaso();
  assert.ok(!r.error, `🔴 CIEGO: no hay bash que ejecutar (${r.error && r.error.message})`);
  assert.equal(r.desdeMain, 3, '🔴 el paso tiene que traerse los TRES scripts de origin/main');
  assert.equal(r.outputs.despertar, 'si', `status ${r.status} · ${r.stderr}`);
});

test('🔴 LABORATORIO · con 6 despertares en la ventana, el paso real NO arranca y deja respuesta', () => {
  const r = correrPaso({ EJECUCIONES_JSON: runsJSON(6) });
  assert.equal(r.outputs.despertar, 'no', `status ${r.status} · ${r.stderr}`);
  assert.match(r.resumen, /TOPE-POR-VENTANA/);
  assert.match(r.leer('respuesta.md') || '', /#1322/);
});

test('🔴 LABORATORIO · con 5, arranca', () => {
  assert.equal(correrPaso({ EJECUCIONES_JSON: runsJSON(5) }).outputs.despertar, 'si');
});

test('🔴 LABORATORIO · si la lista de ejecuciones no se puede leer, el paso real NO arranca', () => {
  // Y aquí es donde muerde el cuerpo del error por stdout: sin capturar solo en éxito, la lista
  // «leída» sería el JSON del error y la cuenta saldría 0.
  const r = correrPaso({ FALLA: 'EJECUCIONES' });
  assert.equal(r.outputs.despertar, 'no', `status ${r.status} · ${r.stderr}`);
  assert.match(r.resumen, /SIN-CUENTA-DE-DESPERTARES/);
});

test('el paso captura la lista SOLO si la orden sale bien', () => {
  const codigo = fs.readFileSync(CLAUDE_YML, 'utf8').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(codigo, /if ! EJECUCIONES="\$\(gh api/);
  assert.ok(!/EJECUCIONES="\$\(gh api.*\|\| *(true|echo)/.test(codigo), 'no vale quedarse con el cuerpo del error');
  assert.match(codigo, /GITHUB_RUN_ID/, 'la ejecución actual tiene que poder excluirse de la cuenta');
});
