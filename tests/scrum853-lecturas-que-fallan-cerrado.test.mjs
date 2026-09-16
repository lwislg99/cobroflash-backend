// SCRUM-853 (segunda parte) — las lecturas del avisador fallan CERRADAS.
//
// EL DEFECTO, medido el 15-sep-2026 contra la API real: cuando `gh api -q` falla, sale con código 1
// PERO escribe el cuerpo JSON del error por la salida normal. Así que `V="$(gh api … || echo X)"` se
// queda con el error Y con el respaldo. El laboratorio de la primera parte lo cazó en `claude.yml`; el
// paso `puerta` del avisador tenía el mismo patrón en CINCO lecturas, y dos de ellas fallaban ABIERTAS
// justo sobre las dos protecciones del avisador:
//
//   lectura    medido con la API real                          qué hacía con eso
//   ─────────  ──────────────────────────────────────────────  ─────────────────────────────────────
//   PR         422 · el cuerpo del error como «número de PR»   el paso reventaba más abajo, sin veredicto
//   PERMISO    404 · el cuerpo del error como «permiso»        cerrado por casualidad (no es «write»)
//   CHECK      422 · `{…}ci` como nombre del check             la marca llevaba el error y un salto de línea
//   FICHEROS   404 · el cuerpo del error como «un fichero»     🔴 la PUERTA FISCAL no escalaba: lista no vacía y
//                                                              sin rutas fiscales. Por diseño, sin lista escala.
//   PREVIAS    error · la tubería con grep lo dejaba VACÍO     🔴 el TOPE contaba cero avisos previos
//
// CÓMO SE PRUEBA: no con un texto que busque el patrón, sino EJECUTANDO el paso `puerta` real —el
// `run:` tal cual está en el YAML— con un `gh` falso que responde por ruta y que, cuando se le pide,
// falla COMO EL DE VERDAD. Cada lectura tiene su escenario y su control. Lo único que se añade al paso
// es un grifo (`tee`) para ver la entrada que recibe la puerta, y se comprueba que se puso UNA vez.
//
// SIN GATE: sin red y sin BD. Necesita `bash` y `node`, que están en el CI y en Git Bash; si no hay un
// bash usable, el SUELO lo dice en vez de dar verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const AVISADOR = path.join(RAIZ, '.github', 'workflows', 'avisador-rojo.yml');
const OBLIGATORIO = 'build + tests (con banco desechable)';
const SHA = '08621119ccdde5a23f24e4ba36407e0ae976a6da'; // head real del #1255
const MARCA_BASE = SHA.slice(0, 12);

// Cada lectura con el defecto EXACTO que la anula: devolverle el `|| …` que se quedaba con el error.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: '.github/workflows/avisador-rojo.yml',
    de: `          if ! PR="$(gh api "repos/$REPO/commits/$SHA/pulls" -q '.[0].number' 2>/dev/null)"; then`,
    a: `          if ! PR="$(gh api "repos/$REPO/commits/$SHA/pulls" -q '.[0].number' 2>/dev/null || true)"; then`,
    cae: 'PR · si no se puede leer a qué PR pertenece el rojo → PR-ILEGIBLE',
  },
  {
    fichero: '.github/workflows/avisador-rojo.yml',
    de: `          if ! PERMISO="$(gh api "repos/$REPO/collaborators/$AUTOR/permission" -q .permission 2>/dev/null)"; then PERMISO=''; fi`,
    a: `          PERMISO="$(gh api "repos/$REPO/collaborators/$AUTOR/permission" -q .permission 2>/dev/null || echo '')"`,
    cae: 'PERMISO · un 404 no llega a la puerta como «permiso»',
  },
  {
    fichero: '.github/workflows/avisador-rojo.yml',
    de: `                        -q '[.check_runs[] | select(.conclusion=="failure")] | .[0].name' 2>/dev/null)"; then CHECK='ci'; fi`,
    a: `                        -q '[.check_runs[] | select(.conclusion=="failure")] | .[0].name' 2>/dev/null || echo 'ci')"; then CHECK='ci'; fi`,
    cae: 'CHECK · si no se puede leer qué check cayó, la marca es',
  },
  {
    fichero: '.github/workflows/avisador-rojo.yml',
    de: `          if ! FICHEROS="$(gh api "repos/$REPO/pulls/$PR/files" --paginate -q '.[].filename' 2>/dev/null)"; then FICHEROS=''; fi`,
    a: `          FICHEROS="$(gh api "repos/$REPO/pulls/$PR/files" --paginate -q '.[].filename' 2>/dev/null || true)"`,
    cae: 'FICHEROS · si no se puede leer qué toca el PR, la puerta fiscal ESCALA',
  },
  {
    fichero: '.github/workflows/avisador-rojo.yml',
    de: `          if ! COMENTARIOS="$(gh api "repos/$REPO/issues/$PR/comments" --paginate -q '.[].body' 2>/dev/null)"; then`,
    a: `          if ! COMENTARIOS="$(gh api "repos/$REPO/issues/$PR/comments" --paginate -q '.[].body' 2>/dev/null || true)"; then`,
    cae: 'PREVIAS · si no se pueden leer los avisos previos, no se avisa',
  },
];

/** El `run:` del paso `puerta` del avisador, tal cual está en el YAML (el repo no trae parser de YAML). */
function pasoPuerta() {
  const lineas = fs.readFileSync(AVISADOR, 'utf8').split('\n');
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

/** Dónde se pone el grifo: la entrada que el paso le pasa a la puerta. */
const TUBERIA = `printf '%s' "$ENTRADA" | node scripts/puerta-avisador-rojo.mjs`;
const TUBERIA_CON_GRIFO = `printf '%s' "$ENTRADA" | tee "$ENTRADA_CAPTURADA" | node scripts/puerta-avisador-rojo.mjs`;

/**
 * El `gh` falso. Responde por RUTA y, si su nombre está en `$FALLA`, falla como el de verdad: cuerpo
 * JSON del error por stdout y código 1. Las respuestas buenas ya vienen «pasadas por -q».
 */
const GH_FALSO = [
  '#!/usr/bin/env bash',
  'ruta="$2"; q=""; prev=""',
  'for a in "$@"; do',
  '  if [ "$prev" = "-q" ]; then q="$a"; fi',
  '  prev="$a"',
  'done',
  'falla() {',
  `  printf '%s' '{"message":"Not Found","documentation_url":"https://docs.github.com/rest","status":"404"}'`,
  "  echo 'gh: Not Found (HTTP 404)' >&2",
  '  exit 1',
  '}',
  'cae() { case " $FALLA " in *" $1 "*) falla ;; esac; }',
  'case "$ruta" in',
  "  repos/*/commits/*/pulls) cae PR; printf '%s\\n' \"$PR_NUM\" ;;",
  "  repos/*/pulls/[0-9]*/files) cae FICHEROS; printf '%s\\n' \"$FICHEROS_OK\" ;;",
  '  repos/*/pulls/[0-9]*)',
  '    case "$q" in',
  "      *user.login*) printf '%s\\n' \"$AUTOR_OK\" ;;",
  `      *) printf '%s' '{"merged":false,"state":"open"}' ;;`,
  '    esac ;;',
  "  repos/*/rules/branches/main) printf '%s' \"$REGLAS_JSON\" ;;",
  "  repos/*/commits/*/check-runs?per_page=100) printf '%s' \"$CHECK_RUNS_JSON\" ;;",
  "  repos/*/commits/*/check-runs) cae CHECK; printf '%s\\n' \"$CHECK_OK\" ;;",
  "  repos/*/collaborators/*/permission) cae PERMISO; printf '%s\\n' \"$PERMISO_OK\" ;;",
  "  repos/*/issues/[0-9]*/comments) cae PREVIAS; printf '%s\\n' \"$COMENTARIOS\" ;;",
  '  *) falla ;;',
  'esac',
  '',
].join('\n');

const barras = (p) => p.split(path.sep).join('/');
const clavePath = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';

function binDelGhFalso() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avisador-853-'));
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), GH_FALSO);
  fs.chmodSync(path.join(bin, 'gh'), 0o755);
  return { tmp, bin };
}

/** Ejecuta el paso `puerta` REAL con un escenario. Devuelve sus outputs, su resumen y la entrada de la puerta. */
function correrPaso(escenario = {}) {
  const guion = pasoPuerta();
  assert.ok(guion, '🔴 no encuentro el paso `puerta` en avisador-rojo.yml: el laboratorio no mide nada');
  const grifos = guion.split(TUBERIA).length - 1;
  // El temporal se crea AQUÍ y a la vista (`os.tmpdir()`), no se recibe de un ayudante: el censo de
  // SCRUM-824 no atraviesa el valor que devuelve una función, y un temporal del que no puede probar de
  // dónde cuelga cuenta como «no lo sé». Lo cazó el CI del #1287 sobre 32cc4969.
  const tmp = temporal(`yaqu-853-${process.pid}-`);
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), GH_FALSO);
  fs.chmodSync(path.join(bin, 'gh'), 0o755);
  const salida = path.join(tmp, 'output');
  const resumen = path.join(tmp, 'summary');
  const entrada = path.join(tmp, 'entrada.json');
  fs.writeFileSync(salida, '');
  fs.writeFileSync(resumen, '');
  fs.writeFileSync(path.join(tmp, 'paso.sh'), guion.replace(TUBERIA, TUBERIA_CON_GRIFO));
  const env = {
    ...process.env,
    [clavePath]: bin + path.delimiter + process.env[clavePath],
    REPO: 'lwislg99/cobroflash-backend', SHA, CONCLUSION: 'failure',
    REPO_ORIGEN: 'lwislg99/cobroflash-backend', HAY_LLAVE: 'true', TOPE: '3',
    GITHUB_OUTPUT: barras(salida), GITHUB_STEP_SUMMARY: barras(resumen), ENTRADA_CAPTURADA: barras(entrada),
    PR_NUM: '1255', AUTOR_OK: 'yaqu-bot[bot]', PERMISO_OK: 'none',
    FICHEROS_OK: 'tests/scrum716-ritmo-de-despliegue.test.mjs', CHECK_OK: OBLIGATORIO, COMENTARIOS: '',
    REGLAS_JSON: JSON.stringify([{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: OBLIGATORIO }] } }]),
    CHECK_RUNS_JSON: JSON.stringify([{ id: 1, name: OBLIGATORIO, status: 'completed', conclusion: 'failure' }]),
    FALLA: '',
    ...escenario,
  };
  const r = spawnSync('bash', ['-e', barras(path.join(tmp, 'paso.sh'))], { cwd: RAIZ, env, encoding: 'utf8', timeout: 60000 });
  const outputs = {};
  for (const l of fs.readFileSync(salida, 'utf8').split('\n')) {
    const k = l.indexOf('=');
    if (k > 0) outputs[l.slice(0, k)] = l.slice(k + 1);
  }
  let capturada = null;
  try { capturada = JSON.parse(fs.readFileSync(entrada, 'utf8')); } catch { /* no llegó a la puerta */ }
  return { status: r.status, stderr: r.stderr, error: r.error, grifos, outputs, entrada: capturada, resumen: fs.readFileSync(resumen, 'utf8') };
}

// ── LOS SUELOS: sin ellos, un rojo de abajo no se distinguiría de un laboratorio roto ──────────

test('🔴 SUELO · hay un bash usable y el gh falso falla COMO EL DE VERDAD (error por stdout y código 1)', () => {
  const { bin } = binDelGhFalso();
  const r = spawnSync('bash', ['-c', 'FALLA=PR gh api repos/o/r/commits/x/pulls -q .x; echo "exit=$?"; command -v node >/dev/null && echo node=si'], {
    env: { ...process.env, [clavePath]: bin + path.delimiter + process.env[clavePath] }, encoding: 'utf8', timeout: 30000,
  });
  assert.ok(!r.error, `🔴 CIEGO: no hay bash que ejecutar (${r.error && r.error.message})`);
  assert.match(r.stdout, /\{"message":"Not Found"/, 'el gh falso tiene que dejar el cuerpo del error en stdout, como el real');
  assert.match(r.stdout, /exit=1/, 'y salir con 1, como el real');
  assert.match(r.stdout, /node=si/, '🔴 CIEGO: el bash del laboratorio no ve node, y el paso lo necesita');
});

test('🔴 SUELO · el paso REAL, con todo bien, AVISA — y la puerta recibe lo que se le reúne', () => {
  const r = correrPaso();
  assert.equal(r.grifos, 1, '🔴 el grifo no se puso exactamente una vez: la entrada capturada no sería la de la puerta');
  assert.equal(r.outputs.codigo, 'AVISAR', `el laboratorio no reproduce un aviso normal (status ${r.status}): ${r.stderr}`);
  assert.equal(r.outputs.avisar, 'si');
  assert.equal(r.entrada.marcaActual, `${MARCA_BASE}:${OBLIGATORIO}`);
  assert.deepEqual(r.entrada.ficheros, ['tests/scrum716-ritmo-de-despliegue.test.mjs']);
});

// ── PR ─────────────────────────────────────────────────────────────────────────────────────────

test('🔴 PR · si no se puede leer a qué PR pertenece el rojo → PR-ILEGIBLE, dicho y sin avisar', () => {
  const r = correrPaso({ FALLA: 'PR' });
  assert.equal(r.outputs.codigo, 'PR-ILEGIBLE', `con el cuerpo del error como número de PR el paso revienta sin veredicto (status ${r.status})`);
  assert.notEqual(r.outputs.avisar, 'si');
  assert.match(r.resumen, /PR-ILEGIBLE/);
});

test('CONTROL · un commit que NO pertenece a ningún PR sigue siendo SIN-PR, no PR-ILEGIBLE', () => {
  assert.equal(correrPaso({ PR_NUM: '' }).outputs.codigo, 'SIN-PR');
});

// ── PERMISO ────────────────────────────────────────────────────────────────────────────────────

test('🔴 PERMISO · un 404 no llega a la puerta como «permiso»: llega vacío', () => {
  const r = correrPaso({ AUTOR_OK: 'usuario-que-no-existe-yaqu-853', FALLA: 'PERMISO' });
  assert.ok(r.entrada, `la puerta no llegó a recibir entrada (status ${r.status}): ${r.stderr}`);
  assert.equal(r.entrada.permisoAutor, '', `la puerta recibió como permiso: ${JSON.stringify(r.entrada.permisoAutor)}`);
  assert.equal(r.outputs.codigo, 'AUTOR-SIN-ESCRITURA');
});

test('CONTROL · el permiso que SÍ se lee llega a la puerta (una persona con escritura avisa)', () => {
  const r = correrPaso({ AUTOR_OK: 'lwislg99', PERMISO_OK: 'write' });
  assert.equal(r.entrada.permisoAutor, 'write');
  assert.equal(r.outputs.codigo, 'AVISAR');
});

// ── CHECK (la marca) ───────────────────────────────────────────────────────────────────────────

test('🔴 CHECK · si no se puede leer qué check cayó, la marca es `<sha>:ci`, sin el cuerpo del error', () => {
  const r = correrPaso({ FALLA: 'CHECK' });
  assert.ok(r.entrada, `la puerta no llegó a recibir entrada (status ${r.status}): ${r.stderr}`);
  assert.equal(r.entrada.marcaActual, `${MARCA_BASE}:ci`, `marca: ${JSON.stringify(r.entrada.marcaActual)}`);
  assert.equal(r.outputs.marca, `${MARCA_BASE}:ci`);
});

// ── FICHEROS (la puerta fiscal) ────────────────────────────────────────────────────────────────

test('🔴 FICHEROS · si no se puede leer qué toca el PR, la puerta fiscal ESCALA (su diseño), no deja pasar', () => {
  const r = correrPaso({ FALLA: 'FICHEROS' });
  assert.equal(r.outputs.codigo, 'ESCALADO-FISCAL',
    `salió ${r.outputs.codigo}: el cuerpo del error llegó como un fichero no fiscal y la puerta abrió`);
  assert.notEqual(r.outputs.avisar, 'si');
});

test('CONTROL · un fichero fiscal leído de verdad escala, y uno inocuo avisa', () => {
  assert.equal(correrPaso({ FICHEROS_OK: 'src/modules/fiscal/verifactu/productor.ts' }).outputs.codigo, 'ESCALADO-FISCAL');
  assert.equal(correrPaso({ FICHEROS_OK: 'public/dashboard/js/homeView.js' }).outputs.codigo, 'AVISAR');
});

// ── PREVIAS (el tope) ──────────────────────────────────────────────────────────────────────────

test('🔴 PREVIAS · si no se pueden leer los avisos previos, no se avisa: sin ellos el tope no cuenta', () => {
  const r = correrPaso({ FALLA: 'PREVIAS' });
  assert.equal(r.outputs.codigo, 'AVISOS-PREVIOS-ILEGIBLES',
    `salió ${r.outputs.codigo}: con los avisos previos a cero, el tope no para nada`);
  assert.notEqual(r.outputs.avisar, 'si');
});

test('CONTROL · los avisos previos que SÍ se leen cuentan: tres marcas → TOPE-ALCANZADO', () => {
  const COMENTARIOS = ['a:x', 'b:y', 'c:z'].map((m) => `texto\n<!-- avisador-rojo:${m} -->`).join('\n');
  const r = correrPaso({ COMENTARIOS });
  assert.deepEqual(r.entrada.marcasPrevias, ['a:x', 'b:y', 'c:z']);
  assert.equal(r.outputs.codigo, 'TOPE-ALCANZADO');
});
