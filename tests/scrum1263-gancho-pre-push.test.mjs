// tests/scrum1263-gancho-pre-push.test.mjs — SCRUM-1263
//
// EL GANCHO QUE PARA EL PUSH DE CLAUDE, EJECUTADO CON GIT DE VERDAD.
//
// `claude-code-action@v1` solo deja a Claude empujar por su envoltorio `scripts/git-push.sh`, que
// acepta `origin <ref>` SIN FLAGS y hace `exec git push origin "$REF"` (leído en la acción, v1).
// Sin flags no hay `--no-verify`, así que un `pre-push` enganchado por `core.hooksPath` GLOBAL
// —fuera del árbol que Claude puede editar— lo para siempre. Y el push que hace después el
// workflow, con el guard ya verificado, lo salta con `-c core.hooksPath=` explícito.
//
// Este test no lee el YAML y confía: monta un remoto, clona, instala el gancho con la MISMA
// función que usa `claude.yml`, y empuja como empujaría Claude y como empuja el workflow.
//
// ⚠️ LÍMITE DECLARADO: no ejecuta la acción de Anthropic. Mide que `git push origin <ref>` —lo que
// su envoltorio ejecuta— se para; que la acción no cambie de envoltorio no se puede medir aquí.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escribirGancho } from '../scripts/puerta-claude-empuje.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const barras = (p) => p.split(path.sep).join('/');

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`. Las tres, probadas a mano el 29-sep-2026.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El paso real deja de enganchar el gancho: Claude vuelve a empujar a ciegas.
    fichero: '.github/workflows/claude.yml',
    de: 'git config --global core.hooksPath "$RUNNER_TEMP/ganchos-1263"',
    a: 'true',
    cae: 'SCRUM-1263 · 🔴 LABORATORIO · despierta el AVISADOR → el paso real instala el gancho y el push de Claude no sale',
  },
  {
    // El gancho existe pero deja pasar.
    fichero: 'scripts/puerta-claude-empuje.mjs',
    de: "  'exit 1',\n  '',\n].join",
    a: "  'exit 0',\n  '',\n].join",
    cae: 'SCRUM-1263 · 🔴 con el gancho GLOBAL, el push de Claude se PARA, lo dice, y el remoto no se mueve',
  },
];

function git(cwd, args, env = {}) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
}

function montar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1263-'));
  const remoto = path.join(dir, 'remoto.git');
  const clon = path.join(dir, 'clon');
  const ganchos = path.join(dir, 'ganchos');
  const globalCfg = path.join(dir, 'gitconfig-global');
  fs.writeFileSync(globalCfg, '');
  const env = { GIT_CONFIG_GLOBAL: globalCfg, GIT_CONFIG_NOSYSTEM: '1' };
  assert.equal(git(dir, ['init', '-q', '--bare', remoto], env).status, 0);
  assert.equal(git(dir, ['clone', '-q', remoto, clon], env).status, 0);
  for (const [k, v] of [['user.name', 'prueba'], ['user.email', 'prueba@example.invalid'], ['commit.gpgsign', 'false']]) {
    git(clon, ['config', k, v], env);
  }
  fs.writeFileSync(path.join(clon, 'a.txt'), 'uno\n');
  git(clon, ['add', 'a.txt'], env);
  git(clon, ['commit', '-q', '-m', 'base'], env);
  git(clon, ['branch', '-M', 'rama-del-pr'], env);
  assert.equal(git(clon, ['push', '-q', 'origin', 'HEAD:refs/heads/rama-del-pr'], env).status, 0);
  // El commit que haría Claude.
  fs.writeFileSync(path.join(clon, 'a.txt'), 'dos\n');
  git(clon, ['commit', '-q', '-am', 'arreglo de claude'], env);
  const cabezaRemota = () => git(dir, ['--git-dir', remoto, 'rev-parse', 'refs/heads/rama-del-pr'], env).stdout.trim();
  const local = git(clon, ['rev-parse', 'HEAD'], env).stdout.trim();
  return { dir, clon, ganchos, globalCfg, env, cabezaRemota, local };
}

test('SCRUM-1263 · CONTROL: sin el gancho, `git push origin <ref>` (lo que ejecuta la acción) SÍ empuja', () => {
  const m = montar();
  try {
    const r = git(m.clon, ['push', 'origin', 'rama-del-pr'], m.env);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(m.cabezaRemota(), m.local, 'sin gancho el remoto avanza: si no, el test de abajo no mide nada');
  } finally { fs.rmSync(m.dir, { recursive: true, force: true }); }
});

test('SCRUM-1263 · 🔴 con el gancho GLOBAL, el push de Claude se PARA, lo dice, y el remoto no se mueve', () => {
  const m = montar();
  try {
    escribirGancho(m.ganchos);
    assert.equal(git(m.clon, ['config', '--global', 'core.hooksPath', m.ganchos], m.env).status, 0);
    const antes = m.cabezaRemota();
    const r = git(m.clon, ['push', 'origin', 'rama-del-pr'], m.env);
    assert.notEqual(r.status, 0, 'el push de Claude tenía que fallar');
    assert.match(r.stderr, /SCRUM-1263/, 'y decir POR QUÉ, para que Claude lo cuente en su respuesta');
    assert.equal(m.cabezaRemota(), antes, 'el remoto no se ha movido');

    // El push del WORKFLOW, con el guard ya verificado: salta el gancho de forma explícita.
    const w = git(m.clon, ['-c', 'core.hooksPath=', 'push', 'origin', 'HEAD:refs/heads/rama-del-pr'], m.env);
    assert.equal(w.status, 0, w.stderr);
    assert.equal(m.cabezaRemota(), m.local, 'el push verificado sí llega');
  } finally { fs.rmSync(m.dir, { recursive: true, force: true }); }
});

// ── EL LABORATORIO: el paso `origen` REAL de claude.yml, con el comentario REAL del avisador ─────
// Mismo patrón que `scrum853d`: se saca el `run:` del YAML tal cual y se ejecuta con bash. El cuerpo
// del comentario se renderiza desde la plantilla de `avisador-rojo.yml`, no se escribe a mano.

/** El `run:` del paso `id: <id>` de claude.yml. */
function pasoOrigen(id = 'origen') {
  const lineas = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'claude.yml'), 'utf8').split('\n');
  const i = lineas.findIndex((l) => new RegExp(`^ {6}- id: ${id}\\s*$`).test(l));
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

function cuerpoDelAvisador(runId) {
  const yml = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'avisador-rojo.yml'), 'utf8');
  const m = yml.match(/CUERPO="\$\(printf '([^']+)' "\$MOTIVO" "\$URL_RUN" "\$MARCA"\)"/);
  assert.ok(m, 'no encuentro la plantilla del aviso en avisador-rojo.yml');
  const v = ['build + tests (con banco desechable)', `https://github.com/lwislg99/cobroflash-backend/actions/runs/${runId}`, 'c80b2f84aaaa:build + tests (con banco desechable)'];
  let i = 0;
  return m[1].replace(/%s/g, () => v[i++]).replace(/\\n/g, '\n');
}

const DESDE_MAIN = /git show origin\/main:scripts\/([a-z-]+\.mjs) > "\$RUNNER_TEMP\/puerta\/\1"/g;

function correrOrigen(m, { autor, cuerpo }, mientras) {
  const guion = pasoOrigen();
  assert.ok(guion, '🔴 no encuentro el paso `origen` en claude.yml');
  assert.equal((guion.match(DESDE_MAIN) || []).length, 1, 'el paso trae su script de la rama principal, no del checkout');
  // Su propio temporal, a la vista del censo de SCRUM-824 (no atraviesa lo que devuelve `montar`).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1263-runner-'));
  try {
    fs.mkdirSync(path.join(tmp, 'puerta'), { recursive: true });
    // Lo que el paso `puerta` ya dejó en el directorio —y de lo que importa el script—, DERIVADO de
    // ese paso en el YAML: si la puerta deja de traer una dependencia, este laboratorio cae.
    const dePuerta = [...(pasoOrigen('puerta') || '').matchAll(DESDE_MAIN)].map((x) => x[1]);
    assert.ok(dePuerta.includes('puerta-avisador-rojo.mjs'), 'no leo qué scripts trae el paso `puerta`');
    for (const f of dePuerta) fs.copyFileSync(path.join(RAIZ, 'scripts', f), path.join(tmp, 'puerta', f));
    fs.writeFileSync(path.join(tmp, 'paso.sh'),
      guion.replace(DESDE_MAIN, `cp "${barras(path.join(RAIZ, 'scripts'))}/$1" "$RUNNER_TEMP/puerta/$1"`));
    // `GITHUB_OUTPUT` y el resumen los crea el propio paso con `>>`, como en el runner.
    const salida = path.join(tmp, 'output');
    const r = spawnSync('bash', ['-e', barras(path.join(tmp, 'paso.sh'))], {
      cwd: m.clon, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, ...m.env, RUNNER_TEMP: barras(tmp), GITHUB_OUTPUT: barras(salida), GITHUB_STEP_SUMMARY: barras(path.join(tmp, 'summary')), AUTOR: autor, CUERPO_COMENTARIO: cuerpo },
    });
    const outputs = {};
    for (const l of (fs.existsSync(salida) ? fs.readFileSync(salida, 'utf8') : '').split('\n')) {
      const k = l.indexOf('=');
      if (k > 0) outputs[l.slice(0, k)] = l.slice(k + 1);
    }
    // Lo que haya que medir con el gancho aún en su sitio (vive en RUNNER_TEMP).
    return mientras({ r, outputs });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

test('SCRUM-1263 · 🔴 LABORATORIO · despierta el AVISADOR → el paso real instala el gancho y el push de Claude no sale', () => {
  const m = montar();
  try {
    correrOrigen(m, { autor: 'yaqu-bot[bot]', cuerpo: cuerpoDelAvisador('36494645539') }, ({ r, outputs }) => {
      assert.ok(!r.error, `🔴 CIEGO: no hay bash (${r.error && r.error.message})`);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(outputs.avisador, 'si');
      assert.equal(outputs.run, '36494645539', 'el run rojo se lee del aviso, para saber qué log mirar');
      const antes = m.cabezaRemota();
      const p = git(m.clon, ['push', 'origin', 'rama-del-pr'], m.env);
      assert.notEqual(p.status, 0, 'con el gancho del paso real, el push de Claude no sale');
      assert.equal(m.cabezaRemota(), antes);
    });
  } finally { fs.rmSync(m.dir, { recursive: true, force: true }); }
});

test('SCRUM-1263 · CONTROL · despierta una PERSONA → no hay gancho y el push sale como hoy', () => {
  const m = montar();
  try {
    correrOrigen(m, { autor: 'una-persona', cuerpo: '@claude mira esto, por favor' }, ({ r, outputs }) => {
      assert.equal(r.status, 0, r.stderr);
      assert.equal(outputs.avisador, 'no');
      const p = git(m.clon, ['push', 'origin', 'rama-del-pr'], m.env);
      assert.equal(p.status, 0, p.stderr);
      assert.equal(m.cabezaRemota(), m.local);
    });
  } finally { fs.rmSync(m.dir, { recursive: true, force: true }); }
});
