// SCRUM-853c — el vigía de PR atascados no se cree un error, y un «no lo sé» no cuenta como «no hay».
//
// VIENE DE SCRUM-853: cuando `gh api -q` falla, sale con código 1 pero escribe el cuerpo JSON del
// error por la salida normal, así que `V="$(gh api … || echo X)"` se queda con él. Medido el
// 16-sep-2026 contra la API real, lectura por lectura del vigía:
//
//   lectura  orden                      en un error                      ¿fallaba abierta?
//   ───────  ─────────────────────────  ───────────────────────────────  ─────────────────────────
//   EST      `gh pr view`               stdout VACÍO → UNKNOWN            no: el CLI usa stderr
//   SHA      `gh pr view`               stdout VACÍO → vacío              no, por lo mismo
//   FECHA    `gh api`                   el CUERPO del error               sí → `MINUTOS=NaN`
//   NUM      `gh issue list`            vacío → «no hay issue»            sí → crearía OTRO issue
//   ANTES    `gh issue view` + `sed`    vacío → «memoria vacía»           sí → todo sale «nuevo»
//
// Las dos últimas no son el mecanismo del cuerpo del error, pero son su misma familia y peor
// consecuencia: un fallo pasajero de la API haría que el vigía abriera un segundo issue, o que
// comentara la lista entera como si acabara de aparecer. La regla del aviso —solo cuando EMPEORA—
// descansa sobre una memoria que hasta hoy podía llegar vacía sin que nadie lo dijera.
//
// CÓMO SE PRUEBA: ejecutando los pasos REALES del workflow —el `run:` tal cual está en el YAML— con
// un `gh` falso que distingue las DOS formas de fallar que se han medido: `gh api` escribe el cuerpo
// del error por stdout, y los subcomandos del CLI (`pr`, `issue`) no escriben nada. Cada paso corre
// en un temporal propio, nunca dentro del árbol (SCRUM-824).
//
// SIN GATE: sin red y sin BD. Necesita `bash` y `node`; si no hay bash usable, el SUELO lo dice.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VIGIA = path.join(RAIZ, '.github', 'workflows', 'vigia-atascados.yml');
const OBLIGATORIO = 'build + tests (con banco desechable)';
const SHA_PR = 'faebb1e6a1c0d4e5f60718293a4b5c6d7e8f9012';
const MEMORIA = '[{"numero":1212,"causa":"SIN-CHECKS","umbral":72}]';

// Cada lectura arreglada, con el defecto EXACTO que la anula.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: '.github/workflows/vigia-atascados.yml',
    de: `              if ! FECHA="$(gh api "repos/$REPO/commits/$SHA" -q .commit.committer.date 2>/dev/null)"; then FECHA=''; fi`,
    a: `              FECHA="$(gh api "repos/$REPO/commits/$SHA" -q .commit.committer.date 2>/dev/null || echo '')"`,
    cae: 'FECHA · si no se puede leer cuándo se empujó, no se inventa un NaN',
  },
  {
    fichero: '.github/workflows/vigia-atascados.yml',
    de: '                      -q "[.[] | select(.title==\\"$TITULO\\")] | .[0].number" 2>/dev/null)"; then',
    a: '                      -q "[.[] | select(.title==\\"$TITULO\\")] | .[0].number" 2>/dev/null || true)"; then',
    cae: 'NUM · si no se puede buscar el issue, la pasada PARA',
  },
  {
    fichero: '.github/workflows/vigia-atascados.yml',
    de: '            if ! CUERPO_ISSUE="$(gh issue view "$NUM" --json body -q .body 2>/dev/null)"; then',
    a: '            if ! CUERPO_ISSUE="$(gh issue view "$NUM" --json body -q .body 2>/dev/null || true)"; then',
    cae: 'ANTES · una memoria que no se puede leer NO es una memoria vacía',
  },
];

/** El `run:` de un paso del vigía, tal cual está en el YAML (el repo no trae parser de YAML). */
function pasoDelVigia(cabecera) {
  const lineas = fs.readFileSync(VIGIA, 'utf8').split('\n');
  const i = lineas.findIndex((l) => l === cabecera);
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

/**
 * Las DOS sustituciones del laboratorio, declaradas y comprobadas: la segunda sonda usa `git` contra
 * el remoto —aquí se apaga, que es lo que hace el propio paso cuando su control no pasa— y la pasada
 * se invoca por ruta absoluta porque el laboratorio corre en un temporal, no en el árbol.
 */
const SONDA = '"${{ steps.sonda.outputs.valida }}"';
const PASADA = 'node scripts/vigia-pasada.mjs';

const GH_FALSO = [
  '#!/usr/bin/env bash',
  '# gh FALSO del laboratorio del vigía. Imita las DOS formas de fallar, medidas el 16-sep-2026:',
  '#   · `gh api`  escribe el CUERPO del error por stdout y sale con 1;',
  '#   · `gh pr` / `gh issue` (subcomandos del CLI) no escriben NADA por stdout y salen con 1.',
  'sub="$1"; ruta="$2"; todo="$*"',
  'fallaApi() {',
  `  printf '%s' '{"message":"No commit found for SHA","documentation_url":"https://docs.github.com/rest","status":"422"}'`,
  "  echo 'gh: No commit found (HTTP 422)' >&2",
  '  exit 1',
  '}',
  "fallaCli() { echo 'gh: could not find what you are looking for' >&2; exit 1; }",
  'cae() { case " $FALLA " in *" $1 "*) return 0 ;; esac; return 1; }',
  'if [ "$sub" = "api" ]; then',
  '  case "$ruta" in',
  '    */rules/branches/main) printf \'%s\' "$REGLAS_JSON" ;;',
  '    */check-runs*) cae CHECKS && fallaApi; printf \'%s\' "$CHECKS_JSON" ;;',
  '    */commits/*) cae FECHA && fallaApi; printf \'%s\\n\' "$FECHA_OK" ;;',
  '    *) fallaApi ;;',
  '  esac',
  '  exit 0',
  'fi',
  'case "$sub $2" in',
  '  "pr list")  cae PRLIST && fallaCli; printf \'%s\' "$PRS_JSON" ;;',
  '  "pr view"*)',
  '    case "$todo" in',
  '      *mergeStateStatus*) cae EST && fallaCli; printf \'%s\\n\' "$EST_OK" ;;',
  '      *headRefOid*) cae SHA && fallaCli; printf \'%s\\n\' "$SHA_OK" ;;',
  '      *) fallaCli ;;',
  '    esac ;;',
  '  "issue list") cae NUM && fallaCli; printf \'%s\\n\' "$NUM_OK" ;;',
  '  "issue view"*) cae ANTES && fallaCli; printf \'%s\\n\' "$CUERPO_OK" ;;',
  '  *) fallaCli ;;',
  'esac',
  '',
].join('\n');

const barras = (p) => p.split(path.sep).join('/');
const clavePath = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';

/** Ejecuta un paso REAL del vigía en un temporal propio, con el gh falso delante en el PATH. */
function correrPaso({ cabecera, escenario = {}, previos = {} }) {
  const guion = pasoDelVigia(cabecera);
  assert.ok(guion, `🔴 no encuentro el paso «${cabecera}» en vigia-atascados.yml: el laboratorio no mide nada`);
  const sondas = guion.split(SONDA).length - 1;
  const pasadas = guion.split(PASADA).length - 1;
  // El temporal se crea aquí y a la vista: el censo de SCRUM-824 no atraviesa lo que devuelve una función.
  const tmp = temporal(`yaqu-853c-${process.pid}-`);
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), GH_FALSO);
  fs.chmodSync(path.join(bin, 'gh'), 0o755);
  const salida = path.join(tmp, 'output');
  const resumen = path.join(tmp, 'summary');
  fs.writeFileSync(salida, '');
  fs.writeFileSync(resumen, '');
  for (const [nombre, contenido] of Object.entries(previos)) {
    const destino = path.join(tmp, nombre);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido);
  }
  const guionLab = guion.split(SONDA).join('"false"').split(PASADA).join('node "$RUTA_PASADA"');
  fs.writeFileSync(path.join(tmp, 'paso.sh'), guionLab);
  const env = {
    ...process.env,
    [clavePath]: bin + path.delimiter + process.env[clavePath],
    REPO: 'lwislg99/cobroflash-backend',
    TITULO: '[vigía] PR atascados',
    DUENO: 'lwislg99',
    RUTA_PASADA: barras(path.join(RAIZ, 'scripts', 'vigia-pasada.mjs')),
    GITHUB_OUTPUT: barras(salida),
    GITHUB_STEP_SUMMARY: barras(resumen),
    PRS_JSON: JSON.stringify([{
      number: 1212, title: 'un PR del bot', author: { login: 'app/yaqu-bot' }, isDraft: false,
      labels: [], autoMergeRequest: { enabledAt: '2026-09-09T07:51:08Z' },
      createdAt: '2026-09-09T07:51:08Z', updatedAt: '2026-09-09T07:51:08Z', headRefOid: SHA_PR,
    }]),
    EST_OK: 'DIRTY',
    SHA_OK: SHA_PR,
    FECHA_OK: '2026-09-16T06:00:00Z',
    CHECKS_JSON: JSON.stringify({ total_count: 1, check_runs: [{ id: 1, name: OBLIGATORIO, status: 'completed', conclusion: 'success' }] }),
    REGLAS_JSON: JSON.stringify([{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: OBLIGATORIO }] } }]),
    NUM_OK: '1241',
    CUERPO_OK: `cuerpo del issue\n<!-- vigia-atascados:estado ${MEMORIA} -->`,
    FALLA: '',
    ...escenario,
  };
  // 🔴 SCRUM-928c · EL PASO FABRICADO NO HEREDA EL ENTORNO DEL CHAT.
  // En GitHub Actions estas tres no existen; aquí venían de quien lanza la tanda, y el paso no
  // corría en el entorno que dice medir. Medido el 17-sep-2026: con `FORCE_COLOR=3` en el chat,
  // el `node` del paso pinta los NÚMEROS de amarillo y la línea de estado salía
  // `1212|DIRTY|\x1B[33m1\x1B[39m||null` en vez de `1212|DIRTY|1||null`. Dos casos en rojo con el
  // vigía sano: 9 tests · 7 pass · 2 fail, frente a 9/9/0 sin la variable.
  //   · `FORCE_COLOR` es la MEDIDA aquí.
  //   · `NODE_OPTIONS` y `NODE_TEST_CONTEXT` van por el mismo motivo y con precedente MEDIDO en
  //     SCRUM-858b (CI del #1441: un reporter heredado le regalaba un recuento a una tanda
  //     fabricada). NO se han vuelto a medir sobre ESTE fichero, y se dice: ponerle un
  //     `NODE_OPTIONS` con reporter a la tanda de fuera mata al propio `node --test` que la corre
  //     (`ERR_INVALID_ARG_VALUE`), así que con este método no se puede mirar.
  // El escenario sigue mandando: si un caso quisiera color a propósito, lo pone en `escenario` y
  // se aplica después de esto.

  for (const v of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) {
    if (!(v in escenario)) delete env[v];
  }
  const r = spawnSync('bash', ['-e', barras(path.join(tmp, 'paso.sh'))], { cwd: tmp, env, encoding: 'utf8', timeout: 120000 });
  const outputs = {};
  for (const l of fs.readFileSync(salida, 'utf8').split('\n')) {
    const k = l.indexOf('=');
    if (k > 0) outputs[l.slice(0, k)] = l.slice(k + 1);
  }
  const leer = (f) => { try { return fs.readFileSync(path.join(tmp, f), 'utf8'); } catch { return null; } };
  return {
    status: r.status, stdout: r.stdout, stderr: r.stderr, error: r.error, sondas, pasadas, outputs,
    resumen: fs.readFileSync(resumen, 'utf8'), leer,
    estados: leer('estados.txt'),
  };
}

const REUNIR = '      - name: Reunir el estado de los PR abiertos';
const CLASIFICAR = '      - id: pasada';

// ── SCRUM-928c · EL LABORATORIO NO LE PASA SU ENTORNO AL SUJETO ────────────────────────────────

test('SCRUM-928c · 🔴 el paso fabricado NO hereda el color del chat: su línea de estado sale sin ANSI', () => {
  const antes = process.env.FORCE_COLOR;
  process.env.FORCE_COLOR = '3';
  try {
    // ✅ CONTROL que impide que este caso sea una tautología: con el color puesto, un hijo que SÍ
    // hereda el entorno tiene que colorear. Si no colorea, el caso de abajo pasaría sin medir nada.
    const testigo = spawnSync(process.execPath, ['-e', 'console.log(1)'],
      { env: { ...process.env }, encoding: 'utf8', timeout: 30000 });
    assert.ok(testigo.stdout.includes(''),
      '🔴 NO PUDE MIRAR: con FORCE_COLOR=3 un hijo que hereda el entorno ya no colorea, así que este'
      + ` caso no distingue un laboratorio limpio de uno sucio. stdout: ${JSON.stringify(testigo.stdout)}`);

    const r = correrPaso({ cabecera: REUNIR });
    assert.equal(r.status, 0, `el paso no terminó bien: ${r.stderr}`);
    // 🔴 EL CONTROL QUE DECIDE: ni un byte de escape en lo que el paso escribe para el siguiente.
    assert.ok(r.estados && !r.estados.includes(''),
      '🔴 la línea de estado trae códigos de color: el laboratorio le ha pasado su FORCE_COLOR al paso,'
      + ` y el vigía no corre en el entorno que este fichero dice medir. estados: ${JSON.stringify(r.estados)}`);
    // Y el valor, que es lo que el siguiente paso parsea por posición.
    const [numero, estado, checks] = r.estados.trim().split('|');
    assert.deepEqual([numero, estado, checks], ['1212', 'DIRTY', '1'],
      '🔴 con color en el chat, el campo de checks llegaba como «\\x1B[33m1\\x1B[39m» en vez de «1»');
  } finally {
    if (antes === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = antes;
  }
});

// ── SUELOS ─────────────────────────────────────────────────────────────────────────────────────

test('🔴 SUELO · el gh falso imita las DOS formas de fallar que se midieron', () => {
  const tmp = temporal(`yaqu-853c-suelo-${process.pid}-`);
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), GH_FALSO);
  fs.chmodSync(path.join(bin, 'gh'), 0o755);
  const correr = (orden) => spawnSync('bash', ['-c', orden], {
    env: { ...process.env, [clavePath]: bin + path.delimiter + process.env[clavePath], FALLA: 'FECHA EST' },
    encoding: 'utf8', timeout: 30000,
  });
  const api = correr('gh api repos/o/r/commits/x -q .commit.committer.date 2>/dev/null; echo "exit=$?"');
  assert.ok(!api.error, `🔴 CIEGO: no hay bash que ejecutar (${api.error && api.error.message})`);
  assert.match(api.stdout, /\{"message":"No commit found for SHA"/, '`gh api` tiene que dejar el cuerpo del error en stdout');
  assert.match(api.stdout, /exit=1/);
  const cli = correr('gh pr view 1 --json mergeStateStatus -q .mergeStateStatus 2>/dev/null; echo "exit=$?"');
  assert.equal(cli.stdout.trim(), 'exit=1', `🔴 un subcomando del CLI no escribe nada por stdout al fallar, y el falso escribió: ${JSON.stringify(cli.stdout)}`);
});

test('🔴 SUELO · el paso de REUNIR, con todo bien, deja una línea completa por PR', () => {
  const r = correrPaso({ cabecera: REUNIR });
  assert.equal(r.sondas, 1, '🔴 la sustitución de la sonda no es única: el laboratorio no mide el paso real');
  assert.equal(r.status, 0, `el paso no terminó bien: ${r.stderr}`);
  const [numero, estado, checks, minutos, sonda] = r.estados.trim().split('|');
  assert.deepEqual([numero, estado, checks, sonda], ['1212', 'DIRTY', '1', 'null']);
  // Los minutos se comparan con holgura: el paso los calcula cuando corre, no cuando se comprueba.
  const esperados = (Date.now() - Date.parse('2026-09-16T06:00:00Z')) / 60000;
  assert.ok(Number.isFinite(Number(minutos)) && Math.abs(Number(minutos) - esperados) <= 2,
    `🔴 minutos desde el push = ${JSON.stringify(minutos)}, esperaba ~${Math.round(esperados)}`);
});

test('🔴 SUELO · el paso de CLASIFICAR, con todo bien, lee la memoria y produce veredicto', () => {
  const r = correrPaso({
    cabecera: CLASIFICAR,
    previos: {
      'prs.json': JSON.stringify([{ number: 1212, title: 'un PR del bot', author: { login: 'app/yaqu-bot' }, isDraft: false, labels: [], autoMergeRequest: {}, createdAt: '2026-09-09T07:51:08Z', headRefOid: SHA_PR }]),
      'estados.txt': '1212|DIRTY|0|9000|true\n',
      'reglas.json': 'null',
    },
  });
  assert.equal(r.pasadas, 1, '🔴 la sustitución de la pasada no es única');
  assert.equal(r.status, 0, `el paso no terminó bien: ${r.stderr}`);
  assert.equal(r.outputs.issue, '1241');
  assert.ok(r.leer('veredicto.json'), '🔴 la pasada no llegó a producir veredicto');
  assert.match(r.leer('cuerpo.md'), /1212/);
});

// ── FECHA ──────────────────────────────────────────────────────────────────────────────────────

test('🔴 FECHA · si no se puede leer cuándo se empujó, no se inventa un NaN: se deja SIN DATO', () => {
  const r = correrPaso({ cabecera: REUNIR, escenario: { FALLA: 'FECHA' } });
  assert.equal(r.status, 0, `el paso no terminó bien: ${r.stderr}`);
  // La igualdad exacta de la línea ya dice todo lo que hay que decir: el campo de minutos está VACÍO,
  // no trae `NaN` ni el cuerpo del error. Una negación suelta sobre «NaN» encima de esto no añadiría
  // nada y sería de la clase que SCRUM-237 persigue: negar un token concreto sin nada que pruebe que
  // el sujeto es el que se cree.
  assert.equal(r.estados.trim(), '1212|DIRTY|1||null',
    'con el cuerpo del error como fecha, los minutos desde el push salían NaN y el vigía medía la edad desde otro sitio');
});

// ── EST y SHA · medidas y NO rotas: el control que lo deja escrito ──────────────────────────────

test('EST y SHA ya fallaban cerradas, y así siguen (los subcomandos del CLI no escriben el error)', () => {
  const sinEst = correrPaso({ cabecera: REUNIR, escenario: { FALLA: 'EST' } });
  assert.match(sinEst.estados, /^1212\|UNKNOWN\|/, `EST: ${JSON.stringify(sinEst.estados)}`);
  const sinSha = correrPaso({ cabecera: REUNIR, escenario: { FALLA: 'SHA' } });
  assert.equal(sinSha.estados.trim(), '1212|DIRTY|0||null', 'sin sha no hay checks, ni fecha, ni sonda: todo sin dato');
});

// ── NUM · el issue ─────────────────────────────────────────────────────────────────────────────

test('🔴 NUM · si no se puede buscar el issue, la pasada PARA en vez de dejarlo vacío', () => {
  // Con `|| true`, un fallo pasajero dejaba NUM vacío, y el paso de publicar lee eso como «no hay
  // issue» y CREA otro. El vigía acabaría con dos issues y la memoria partida entre los dos.
  const r = correrPaso({ cabecera: CLASIFICAR, escenario: { FALLA: 'NUM' }, previos: { 'prs.json': '[]', 'estados.txt': '', 'reglas.json': 'null' } });
  assert.notEqual(r.status, 0, 'la pasada siguió como si no hubiera issue: el publicador crearía uno nuevo');
  assert.match(r.resumen, /ISSUE-ILEGIBLE/);
  assert.ok(!r.outputs.issue, `🔴 dejó issue=${r.outputs.issue} en los outputs`);
});

test('CONTROL · si la búsqueda funciona y no hay issue todavía, la pasada sigue (es la primera vez)', () => {
  const r = correrPaso({
    cabecera: CLASIFICAR, escenario: { NUM_OK: '' },
    previos: { 'prs.json': '[]', 'estados.txt': '', 'reglas.json': 'null' },
  });
  assert.equal(r.status, 0, `el paso no terminó bien: ${r.stderr}`);
  assert.equal(r.outputs.issue, '');
  assert.ok(r.leer('cuerpo.md'), '🔴 sin issue previo el vigía tiene que componer igualmente su cuerpo');
});

// ── ANTES · la memoria ─────────────────────────────────────────────────────────────────────────

test('🔴 ANTES · una memoria que no se puede leer NO es una memoria vacía', () => {
  // Con la memoria vacía, TODO atasco cuenta como nuevo y el vigía comenta la lista entera. La regla
  // «solo cuando empeora» descansa sobre esa memoria.
  const r = correrPaso({
    cabecera: CLASIFICAR, escenario: { FALLA: 'ANTES' },
    previos: { 'prs.json': '[]', 'estados.txt': '', 'reglas.json': 'null' },
  });
  assert.notEqual(r.status, 0, 'la pasada siguió con la memoria en blanco: el próximo aviso listaría todo como nuevo');
  assert.match(r.resumen, /MEMORIA-ILEGIBLE/);
  assert.equal(r.leer('veredicto.json'), null, '🔴 no debe haber veredicto: la pasada no vale');
});

test('CONTROL · un issue SIN marca de memoria (el primer día) sí es memoria vacía, y sigue', () => {
  const r = correrPaso({
    cabecera: CLASIFICAR, escenario: { CUERPO_OK: 'un cuerpo sin marca todavía' },
    previos: { 'prs.json': '[]', 'estados.txt': '', 'reglas.json': 'null' },
  });
  assert.equal(r.status, 0, `el paso no terminó bien: ${r.stderr}`);
  assert.ok(r.leer('veredicto.json'), '🔴 la pasada tenía que correr: un cuerpo sin marca es memoria vacía de verdad');
});
