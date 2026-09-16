// tests/scrum839e-solo-pr-armados.test.mjs — SCRUM-839e · arreglo de la pieza A
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN PR QUE NADIE PROMETIÓ MERGEAR NO SE TOCA. NI SE EMPUJA, NI SE ARMA.
//
// ── EL DAÑO, MEDIDO ────────────────────────────────────────────────────────────────────────
// 16-sep-2026, 14:37Z: primera pasada real de `conflicto-de-registro.yml` (run 35109786942).
// Empujó a #880 (abierto 1-sep) y #399 (4-ago), dos PR de Javier SIN auto-merge, porque su
// conflicto era solo de `docs/master/`. El push de la App disparó `pr-automatico.yml` (runs
// 35109859845 y 35109865025, actor `yaqu-bot[bot]`, tipo `Bot`), que ARMÓ el auto-merge en los
// dos. Entraron en `main` a las 14:44Z y 14:45Z, y se desplegaron.
//
// ── DOS AGUJEROS, Y CADA MITAD CIERRA EL SUYO ─────────────────────────────────────────────
//   ① EL JOB empujaba a cualquier PR `scrum-*`. Ahora solo a los que YA tenían el auto-merge
//     armado ANTES de su pasada —el criterio del vigía: sin auto-merge, nadie prometió
//     mergearlo—. Y si no puede leer ese dato, «no pude mirar» y no empuja.
//   ② `pr-automatico.yml` abría y armaba ante CUALQUIER push, fuera de quien fuera. Censo de sus
//     270 runs hasta el 16-sep: 156 `Javierpf28` y 112 `lwislg99` (tipo `User`), y 2
//     `yaqu-bot[bot]` (tipo `Bot`) — justo los del daño. Ahora solo abre y arma si quien empuja
//     es una PERSONA (`github.event.sender.type == 'User'`); cualquier otra cosa, o no poder
//     leerlo, no abre ni arma.
//
// ── CÓMO SE MIRA ───────────────────────────────────────────────────────────────────────────
// Se ejecutan LOS PASOS DE VERDAD del YAML, con repositorios git de verdad y un `gh` de mentira
// que, como el real, solo devuelve los campos que se le piden en `--json`. El veredicto es por
// EFECTO: si la rama del PR se movió en el remoto, o si se llamó a `gh pr merge`.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Por espacio de nombres y no por nombre: contra el código de antes del arreglo, cada test cae
// por su aserción, no el fichero entero por un import que no existe.
import * as registro from '../scripts/conflicto-de-registro.mjs';

const { decidir, gitReal } = registro;
const armadoAntesDeLaPasada = (pr) => registro.armadoAntesDeLaPasada(pr);

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// El rojo de cada pieza, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El defecto del 16-sep: un PR sin armar pasa como si lo estuviera.
    fichero: 'scripts/conflicto-de-registro.mjs',
    de: "if (armado.estado === 'SIN-ARMAR') return { accion: 'NO-EMPUJA', causa: 'SIN-AUTO-MERGE' };",
    a: "if (false) return { accion: 'NO-EMPUJA', causa: 'SIN-AUTO-MERGE' };",
    cae: '🔴 ROJO/NEGATIVO: el #880 fabricado — PR viejo SIN auto-merge y choque solo de registro → no se empuja',
  },
  {
    // El suelo apagado: no saber si estaba armado se toma por «adelante».
    fichero: 'scripts/conflicto-de-registro.mjs',
    de: "if (armado.estado === 'NO-PUDE-MIRAR') return { accion: 'NO-PUDE-MIRAR', motivo: armado.motivo };",
    a: "if (false) return { accion: 'NO-PUDE-MIRAR', motivo: armado.motivo };",
    cae: '🔴 SUELO: si no se puede leer si estaba armado, «no pude mirar» — nunca EMPUJAR',
  },
  {
    // El armado de OTRO PR de la lista vale para este.
    fichero: 'scripts/conflicto-de-registro.mjs',
    de: 'prs.find((p) => p && p.number === Number(pr))',
    a: 'prs.find((p) => p)',
    cae: '🔴 CLI: lee el armado de la lista de PR que le pasa el workflow, con suelo',
  },
  {
    // El workflow deja de pedir el dato: el suelo lo para todo, también los PR armados.
    fichero: '.github/workflows/conflicto-de-registro.yml',
    de: 'isCrossRepository,autoMergeRequest > prs.json',
    a: 'isCrossRepository > prs.json',
    cae: '🔴 POSITIVO del job: PR armado con choque solo de registro → se sigue resolviendo solo',
  },
  {
    // El paso de armar vuelve a armar ante cualquier push.
    fichero: '.github/workflows/pr-automatico.yml',
    de: 'if [ "$QUIEN_EMPUJA" != "User" ]; then\n            echo "No se arma',
    a: 'if false; then\n            echo "No se arma',
    cae: '🔴 ROJO/NEGATIVO: un push de la App (Bot) a un PR existente NO arma el auto-merge',
  },
  {
    // Lista negra en vez de lista blanca: un tipo vacío arma.
    fichero: '.github/workflows/pr-automatico.yml',
    de: 'if [ "$QUIEN_EMPUJA" != "User" ]; then\n            echo "No se arma',
    a: 'if [ "$QUIEN_EMPUJA" = "Bot" ]; then\n            echo "No se arma',
    cae: '🔴 SUELO: si no se sabe quién empujó, no se arma',
  },
  {
    fichero: '.github/workflows/pr-automatico.yml',
    de: 'if [ "$QUIEN_EMPUJA" != "User" ]; then\n            echo "No se abre PR',
    a: 'if false; then\n            echo "No se abre PR',
    cae: '🔴 ROJO/NEGATIVO: un push de la App a una rama sin PR NO abre PR (p. ej. una rama recreada tras el merge)',
  },
  {
    // Cableado a «persona»: los bancos seguirían verdes porque ponen el tipo a mano.
    fichero: '.github/workflows/pr-automatico.yml',
    de: "QUIEN_EMPUJA: ${{ github.event.sender.type }}\n        run: |\n          # 🔴 SOLO UN PUSH",
    a: "QUIEN_EMPUJA: User\n        run: |\n          # 🔴 SOLO UN PUSH",
    cae: '🔴 el YAML le pasa a los dos pasos QUIÉN empuja de verdad (`github.event.sender.type`)',
  },
];

const SCRIPT = path.join(RAIZ, 'scripts', 'conflicto-de-registro.mjs');

const ARMADO = {
  enabledAt: '2026-09-16T18:04:48Z', mergeMethod: 'MERGE',
  enabledBy: { is_bot: true, login: 'app/yaqu-bot' },
};

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① LA DECISIÓN
// ═════════════════════════════════════════════════════════════════════════════════════════

/** `main` con la regla, y una rama `pr` que choca con ella SOLO en el registro. */
function repoDeRegistro() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum839e-'));
  const g = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim();
  const escribir = (f, txt) => {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), txt);
  };
  g('init', '-q', '-b', 'main');
  g('config', 'core.autocrlf', 'false');
  g('config', 'user.email', 'scrum839e@test');
  g('config', 'user.name', 'scrum839e');
  escribir('docs/master/SCRUM-284.md', '# SCRUM-284\n\nentrada común\n');
  escribir('src/a.ts', 'export const a = 1;\n');
  g('add', '-A');
  g('commit', '-qm', 'base');
  g('checkout', '-qb', 'pr');
  escribir('docs/master/SCRUM-284.md', '# SCRUM-284\n\nentrada común\n\n## la del PR viejo\n');
  g('commit', '-qam', 'pr');
  g('checkout', '-q', 'main');
  escribir('docs/master/SCRUM-284.md', '# SCRUM-284\n\nentrada común\n\n## la de main\n');
  escribir('.gitattributes', 'docs/master/*.md merge=union\n');
  g('add', '-A');
  g('commit', '-qm', 'main');
  return { dir, g, cabeza: g('rev-parse', 'pr'), main: g('rev-parse', 'main') };
}

function conRepo(fn) {
  const r = repoDeRegistro();
  try { return fn(r); } finally { fs.rmSync(r.dir, { recursive: true, force: true }); }
}

const decide = (r, pr) => decidir(gitReal(r.dir), { pr, cabeza: r.cabeza, main: r.main, mensaje: 'm' });

test('🔴 ROJO/NEGATIVO: el #880 fabricado — PR viejo SIN auto-merge y choque solo de registro → no se empuja', () => {
  conRepo((r) => {
    // CONTROL: el mismo PR, armado, SÍ se empujaría. Si esto no sale EMPUJAR, el caso no prueba
    // nada: el «no» de abajo podría venir de cualquier otra cerradura.
    assert.equal(decide(r, { number: 880, autoMergeRequest: ARMADO }).accion, 'EMPUJAR');

    const v = decide(r, { number: 880, autoMergeRequest: null });
    assert.equal(v.accion, 'NO-EMPUJA',
      '🔴 un PR que nadie armó recibe un merge empujado: es lo que metió #880 y #399 en main.\n'
      + JSON.stringify(v));
    assert.equal(v.causa, 'SIN-AUTO-MERGE');
    assert.equal(v.commit, undefined);
  });
});

test('🔴 SUELO: si no se puede leer si estaba armado, «no pude mirar» — nunca EMPUJAR', () => {
  conRepo((r) => {
    const formas = [
      ['sin PR', undefined],
      ['PR sin el campo (la lista no lo pidió)', { number: 880 }],
      ['campo con forma rara: true', { number: 880, autoMergeRequest: true }],
      ['campo con forma rara: objeto sin enabledAt', { number: 880, autoMergeRequest: {} }],
      ['campo con forma rara: texto', { number: 880, autoMergeRequest: 'MERGE' }],
    ];
    for (const [caso, pr] of formas) {
      const v = decide(r, pr);
      assert.equal(v.accion, 'NO-PUDE-MIRAR', `🔴 ${caso}: ${JSON.stringify(v)}`);
    }
  });
});

test('la lectura del armado, sola', () => {
  assert.equal(armadoAntesDeLaPasada({ autoMergeRequest: ARMADO }).estado, 'ARMADO');
  assert.equal(armadoAntesDeLaPasada({ autoMergeRequest: null }).estado, 'SIN-ARMAR');
  assert.equal(armadoAntesDeLaPasada({}).estado, 'NO-PUDE-MIRAR');
  assert.equal(armadoAntesDeLaPasada(null).estado, 'NO-PUDE-MIRAR');
});

test('🔴 CLI: lee el armado de la lista de PR que le pasa el workflow, con suelo', () => {
  // La lista va en su PROPIO temporal: así el censo de SCRUM-824 ve de dónde cuelga.
  const listas = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum839e-lista-'));
  const prsJson = path.join(listas, 'prs.json');
  try {
    conRepo((r) => {
      const correr = (lista) => {
        if (lista !== undefined) fs.writeFileSync(prsJson, JSON.stringify(lista));
        const salida = execFileSync(process.execPath, [SCRIPT, '880', r.cabeza, 'main', prsJson], { cwd: r.dir, encoding: 'utf8', stdio: 'pipe' });
        return JSON.parse(salida);
      };
      assert.equal(correr([{ number: 880, autoMergeRequest: ARMADO }]).accion, 'EMPUJAR');
      assert.equal(correr([{ number: 880, autoMergeRequest: null }]).accion, 'NO-EMPUJA');
      assert.equal(correr([{ number: 880 }]).accion, 'NO-PUDE-MIRAR');
      assert.equal(correr([{ number: 399, autoMergeRequest: ARMADO }]).accion, 'NO-PUDE-MIRAR',
        '🔴 el armado de OTRO PR no vale para este');
      fs.writeFileSync(prsJson, '{ no es json');
      assert.equal(correr(undefined).accion, 'NO-PUDE-MIRAR');
    });
  } finally {
    fs.rmSync(listas, { recursive: true, force: true });
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// Bancos: el guion de un paso del YAML, ejecutado tal cual
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * El `run:` de un paso, sin nombre ni comentarios del YAML. Mismo recorte por sangría que
 * `tests/pr-automatico-el-mensaje-del-automerge.test.mjs` (no se importa: importar un fichero
 * de tests registra sus tests aquí).
 */
function guionDelPaso(texto, nombre) {
  const lineas = texto.split('\n');
  // `- name: X` o, detrás de un `- id:`, `name: X`.
  const i = lineas.findIndex((l) => l.trim().replace(/^- /, '') === 'name: ' + nombre);
  if (i < 0) return null;
  const j = lineas.findIndex((l, k) => k > i && /^\s*run: \|/.test(l));
  if (j < 0) return null;
  const sangria = (lineas[j].match(/^\s*/) || [''])[0].length + 2;
  const fin = lineas.findIndex((l, k) => k > j && l.trim() !== ''
    && (l.match(/^\s*/) || [''])[0].length < sangria);
  return lineas.slice(j + 1, fin < 0 ? lineas.length : fin).join('\n');
}

/** El bloque entero de un paso (hasta el siguiente `- name:` o `- uses:`), para leer su `env:`. */
function bloqueDelPaso(texto, nombre) {
  const lineas = texto.split('\n');
  // `- name: X` o, detrás de un `- id:`, `name: X`.
  const i = lineas.findIndex((l) => l.trim().replace(/^- /, '') === 'name: ' + nombre);
  if (i < 0) return null;
  const fin = lineas.findIndex((l, k) => k > i && /^\s*- (name|uses|id):/.test(l));
  return lineas.slice(i, fin < 0 ? lineas.length : fin).join('\n');
}

const leer = (f) => fs.readFileSync(path.join(RAIZ, '.github', 'workflows', f), 'utf8');

/**
 * Un `gh` de mentira. Registra cada llamada en `llamadas.txt` y, como el real, en `pr list`
 * SOLO devuelve los campos pedidos en `--json`. `QUITAR` borra un campo aunque se pida (la
 * API que no lo da).
 */
const GH_FALSO = `
import fs from 'node:fs';
const args = process.argv.slice(2);
fs.appendFileSync(process.env.LLAMADAS, args.join(' ') + '\\n');
if (args[0] === 'api') { console.log('123'); process.exit(0); }
if (args[0] === 'pr' && args[1] === 'list') {
  const campos = (args[args.indexOf('--json') + 1] || '').split(',');
  const quitar = (process.env.QUITAR || '').split(',');
  const prs = JSON.parse(fs.readFileSync(process.env.LISTA, 'utf8'));
  console.log(JSON.stringify(prs.map((p) => Object.fromEntries(
    campos.filter((c) => c in p && !quitar.includes(c)).map((c) => [c, p[c]])))));
  process.exit(0);
}
if (args[0] === 'pr' && args[1] === 'create') { console.log('https://github.com/x/y/pull/999'); process.exit(0); }
if (args[0] === 'pr' && args[1] === 'view') { console.log('{}'); process.exit(0); }
process.exit(0);
`;

/**
 * Ejecuta `paso` (texto bash) en `cwd` con el `gh` falso delante en el PATH. Su banco es suyo
 * (`mkdtemp` aquí mismo, donde el censo de SCRUM-824 lo ve) y se borra al terminar.
 */
function correrPaso({ paso, cwd, env }) {
  const banco = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum839e-paso-'));
  try {
    fs.mkdirSync(path.join(banco, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(banco, 'bin', 'gh.mjs'), GH_FALSO);
    fs.writeFileSync(path.join(banco, 'bin', 'gh'), '#!/bin/bash\nexec node "$(dirname "$0")/gh.mjs" "$@"\n');
    fs.chmodSync(path.join(banco, 'bin', 'gh'), 0o755);
    fs.writeFileSync(path.join(banco, 'paso.sh'), paso);
    // El PATH se monta DENTRO de bash (en Windows, un PATH con `C:\…` desde Node no lo entiende).
    fs.writeFileSync(path.join(banco, 'correr.sh'),
      '#!/bin/bash\nD="$(cd "$(dirname "$0")" && pwd)"\nexport PATH="$D/bin:$PATH"\nexport RUNNER_TEMP="$D"\n'
      + 'exec bash "$D/paso.sh"\n');
    for (const f of ['llamadas.txt', 'resumen.md', 'salida.txt']) fs.writeFileSync(path.join(banco, f), '');
    let codigo = 0;
    let log = '';
    try {
      log = execFileSync('bash', [path.join(banco, 'correr.sh')], {
        cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          LLAMADAS: path.join(banco, 'llamadas.txt'),
          GITHUB_STEP_SUMMARY: path.join(banco, 'resumen.md'),
          GITHUB_OUTPUT: path.join(banco, 'salida.txt'),
          ...env,
        },
      });
    } catch (e) {
      codigo = e.status;
      log = String(e.stdout || '') + String(e.stderr || '');
    }
    const txt = (f) => fs.readFileSync(path.join(banco, f), 'utf8');
    return { codigo, log, llamadas: txt('llamadas.txt'), resumen: txt('resumen.md'), veredicto: fs.existsSync(path.join(banco, 'veredicto.txt')) ? txt('veredicto.txt') : '' };
  } finally {
    fs.rmSync(banco, { recursive: true, force: true });
  }
}

test('🔴 SUELO del banco: hay `bash` para correr los pasos de verdad', () => {
  let hay = false;
  try { execFileSync('bash', ['--version'], { stdio: 'ignore' }); hay = true; } catch { hay = false; }
  assert.ok(hay, '🔴 CIEGO: sin `bash` los bancos de abajo no ejecutan nada. No se saltan: se declara.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL JOB `conflicto-de-registro.yml`, POR EFECTO: ¿se movió la rama en el remoto?
// ═════════════════════════════════════════════════════════════════════════════════════════

const RAMA = 'scrum-284-censo-configuracion';

/** Un remoto con `main` y la rama del PR (y su `pull/880/head`), y un clon como el del runner. */
function bancoDelJob({ autoMergeRequest, quitar = '' }) {
  const banco = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum839e-job-'));
  const r = repoDeRegistro();
  try {
    const origen = path.join(banco, 'origen.git');
    execFileSync('git', ['init', '-q', '--bare', origen]);
    r.g('push', '-q', origen, 'main', `pr:refs/heads/${RAMA}`, 'pr:refs/pull/880/head');
    const clon = path.join(banco, 'clon');
    execFileSync('git', ['clone', '-q', origen, clon]);
    fs.mkdirSync(path.join(clon, 'scripts'));
    fs.copyFileSync(SCRIPT, path.join(clon, 'scripts', 'conflicto-de-registro.mjs'));

    const pr = { number: 880, headRefName: RAMA, headRefOid: r.cabeza, isCrossRepository: false, autoMergeRequest };
    fs.writeFileSync(path.join(banco, 'lista.json'), JSON.stringify([pr]));

    const paso = guionDelPaso(leer('conflicto-de-registro.yml'), 'Resolver los conflictos de solo registro');
    assert.ok(paso, '🔴 no encuentro el paso «Resolver los conflictos de solo registro»');
    const run = correrPaso({
      paso, cwd: clon,
      env: { LISTA: path.join(banco, 'lista.json'), QUITAR: quitar, GH_TOKEN: 'x', APP_TOKEN: 'x', SLUG: 'yaqu-bot' },
    });
    const ahora = execFileSync('git', ['--git-dir', origen, 'rev-parse', `refs/heads/${RAMA}`], { encoding: 'utf8' }).trim();
    return { ...run, empujado: ahora !== r.cabeza };
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
    fs.rmSync(banco, { recursive: true, force: true });
  }
}

test('🔴 ROJO/NEGATIVO del job: PR viejo sin auto-merge con choque solo de registro → la rama NO se mueve', () => {
  const j = bancoDelJob({ autoMergeRequest: null });
  assert.equal(j.empujado, false,
    '🔴 el job empujó a un PR sin auto-merge: es el camino de #880 y #399 a main.\n' + j.log + j.resumen);
  assert.equal(j.codigo, 0, '🔴 un PR sin armar no es una avería: no pinta rojo.\n' + j.log);
});

test('🔴 POSITIVO del job: PR armado con choque solo de registro → se sigue resolviendo solo', () => {
  const j = bancoDelJob({ autoMergeRequest: ARMADO });
  assert.equal(j.empujado, true, '🔴 un PR armado dejó de resolverse: el arreglo rompió la pieza A.\n' + j.log + j.resumen);
  assert.equal(j.codigo, 0, j.log);
  assert.match(j.resumen, /EMPUJADO/);
});

test('🔴 SUELO del job: si la lista no trae el armado, «no pude mirar», rojo y la rama NO se mueve', () => {
  const j = bancoDelJob({ autoMergeRequest: ARMADO, quitar: 'autoMergeRequest' });
  assert.equal(j.empujado, false, '🔴 empujó sin saber si el PR estaba armado.\n' + j.log + j.resumen);
  assert.equal(j.codigo, 1, '🔴 no poder mirar tiene que verse en rojo.\n' + j.log);
  assert.match(j.resumen, /NO PUDE MIRAR/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ `pr-automatico.yml`: un push que no es de una persona no abre ni arma
// ═════════════════════════════════════════════════════════════════════════════════════════

/** El paso «Armar el auto-merge», con un PR existente, empujado por `quien`. */
function bancoDelArmado(quien) {
  const paso = guionDelPaso(leer('pr-automatico.yml'), 'Armar el auto-merge');
  assert.ok(paso, '🔴 no encuentro el paso «Armar el auto-merge»');
  return correrPaso({ paso, cwd: RAIZ, env: { NUM: '880', MODO_COMPLETO: 'true', QUIEN_EMPUJA: quien } });
}

test('🔴 ROJO/NEGATIVO: un push de la App (Bot) a un PR existente NO arma el auto-merge', () => {
  const a = bancoDelArmado('Bot');
  assert.doesNotMatch(a.llamadas, /^pr merge/m,
    '🔴 un push de la App armó el auto-merge: así entraron #880 y #399 en main.\n' + a.llamadas + a.log);
  assert.equal(a.codigo, 0, a.log);
  assert.match(a.veredicto, /EMPUJE-SIN-PERSONA/, '🔴 no arma y no dice por qué: un verde mudo.\n' + a.log);
});

test('🔴 SUELO: si no se sabe quién empujó, no se arma', () => {
  const a = bancoDelArmado('');
  assert.doesNotMatch(a.llamadas, /^pr merge/m, a.llamadas + a.log);
  assert.match(a.veredicto, /EMPUJE-SIN-PERSONA/);
});

test('POSITIVO: un push de una persona (User) sigue armando', () => {
  const a = bancoDelArmado('User');
  assert.match(a.llamadas, /^pr merge 880 --auto --merge$/m,
    '🔴 una sesión empuja y ya no se arma: el arreglo rompió el flujo de los 268 runs.\n' + a.llamadas + a.log);
});

/** El paso «Abrir el PR», sin PR previo y con un commit por delante de `main`. */
function bancoDeAbrir(quien) {
  const banco = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum839e-abrir-'));
  try {
    const repo = path.join(banco, 'repo');
    fs.mkdirSync(repo);
    const g = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' }).trim();
    g('init', '-q', '-b', RAMA);
    g('config', 'user.email', 'scrum839e@test');
    g('config', 'user.name', 'scrum839e');
    g('commit', '-q', '--allow-empty', '-m', 'base');
    g('update-ref', 'refs/remotes/origin/main', 'HEAD');
    g('commit', '-q', '--allow-empty', '-m', 'SCRUM-880: trabajo');
    // El paso importa la puerta del avisador por ruta relativa al directorio de trabajo.
    fs.mkdirSync(path.join(repo, 'scripts'));
    for (const f of ['puerta-avisador-rojo.mjs', 'vigia-atascados.mjs']) {
      fs.copyFileSync(path.join(RAIZ, 'scripts', f), path.join(repo, 'scripts', f));
    }
    const paso = guionDelPaso(leer('pr-automatico.yml'), 'Abrir el PR');
    assert.ok(paso, '🔴 no encuentro el paso «Abrir el PR»');
    return correrPaso({ paso, cwd: repo, env: { RAMA, GH_TOKEN: 'x', QUIEN_EMPUJA: quien } });
  } finally {
    fs.rmSync(banco, { recursive: true, force: true });
  }
}

test('🔴 ROJO/NEGATIVO: un push de la App a una rama sin PR NO abre PR (p. ej. una rama recreada tras el merge)', () => {
  // CONTROL: el mismo banco, empujado por una persona, SÍ abre. Si no, el «no» de abajo no prueba nada.
  assert.match(bancoDeAbrir('User').llamadas, /^pr create/m, '🔴 el banco no llega a abrir ni con una persona');
  const b = bancoDeAbrir('Bot');
  assert.doesNotMatch(b.llamadas, /^pr create/m, '🔴 un push de la App abrió un PR.\n' + b.llamadas + b.log);
  assert.equal(b.codigo, 0, b.log);
});

test('🔴 el YAML le pasa a los dos pasos QUIÉN empuja de verdad (`github.event.sender.type`)', () => {
  // Los bancos ponen QUIEN_EMPUJA a mano; sin esto, un YAML que lo cableara a «User» pasaría.
  const wf = leer('pr-automatico.yml');
  for (const nombre of ['Abrir el PR', 'Armar el auto-merge']) {
    const bloque = bloqueDelPaso(wf, nombre);
    assert.ok(bloque, `🔴 no encuentro el paso «${nombre}»`);
    assert.match(bloque, /^\s*QUIEN_EMPUJA: \$\{\{ github\.event\.sender\.type \}\}\s*$/m,
      `🔴 el paso «${nombre}» no recibe el tipo de quien empuja desde el evento`);
  }
});
