// tests/scrum1874-version-declarada.test.mjs — SCRUM-1874 · cada registro NUEVO dice a qué versión pertenece
//
// D: `scripts/equipo/version-declarada.mjs` + `docs/equipo/version-en-curso`. C: `scripts/equipo/sin-version.mjs`.
//
// 🔴 EL GUARD ES INFORMATIVO hasta el 4-dic-2026 (decisión del orquestador): sobre el árbol REAL este
// fichero sólo CUENTA (lo imprime como diagnóstico) y no cae por un registro sin línea. Lo que SÍ cae
// es el instrumento: si deja de nombrar un registro nuevo sin línea, si da por nuevo uno viejo, o si
// sin base dice «0» en vez de NO PUDE MIRAR. Los casos de repositorio corren en `os.tmpdir()`, fuera
// del árbol (SCRUM-824), con un `main` propio para que `baseDeLaRama` tenga contra qué medir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  juzgarRegistro, lineasDeVersion, parsearVersion, leerVersionEnCurso, medirRama, OBLIGATORIO, FICHERO_EN_CURSO,
} from '../scripts/equipo/version-declarada.mjs';
import { leerLista, cotejar, lineaSinVersion, edadLegible } from '../scripts/equipo/sin-version.mjs';
import { baseDeLaRama } from './_base-de-la-rama.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(RAIZ, 'scripts', 'equipo', 'version-declarada.mjs');
const EN_CURSO = { nombre: '1.1', ticket: 'SCRUM-1835' };

// 🔴 MUTACIONES_QUE_ME_TUMBAN · SCRUM-745. Cada una imita el defecto que este test promete cazar.
// Se ejecutan con `npm run meta:mutaciones`: aplica, exige el ROJO, restaura y compara bytes.
export const MUTACIONES_QUE_ME_TUMBAN = [
  // ① «NUEVO» DEJA DE SER «AÑADIDO»: también cuentan los modificados, y un registro viejo tocado se acusa.
  {
    fichero: 'scripts/equipo/version-declarada.mjs',
    de: "'--diff-filter=A', base.sha",
    a: "'--diff-filter=AM', base.sha",
    cae: 'SCRUM-1874 · 🔴 un registro NUEVO sin línea se NOMBRA; uno viejo tocado, no',
  },
  // ② LOS SIN RASTREAR SE PIERDEN: el registro que aún no se ha commiteado (el de guards:entrada antes del push).
  {
    fichero: 'scripts/equipo/version-declarada.mjs',
    de: "'ls-files', '--others', '--exclude-standard', '--', 'docs/master/'",
    a: "'ls-files', '--', 'docs/master/NADA'",
    cae: 'SCRUM-1874 · 🔴 un registro NUEVO sin línea se NOMBRA; uno viejo tocado, no',
  },
  // ③ UNA VERSIÓN CERRADA PASA: se compara sólo que haya línea, no cuál.
  {
    fichero: 'scripts/equipo/version-declarada.mjs',
    de: '  if (v.nombre !== enCurso.nombre) return',
    a: '  if (false) return',
    cae: 'SCRUM-1874 · 🔴 juzgarRegistro: sin línea, otra versión, dos líneas y mal formada NO pasan',
  },
  // ④ SIN BASE SE DICE «0 NUEVOS»: el «no pude mirar» se lee como «todos declaran».
  {
    fichero: 'scripts/equipo/version-declarada.mjs',
    de: "  if (!nuevos.base) return { ciego: nuevos.motivo };",
    a: "  if (!nuevos.base) return { enCurso: enCurso.texto, base: { sha: '0000000000000', ref: '?' }, filas: [], sinDeclarar: [] };",
    cae: 'SCRUM-1874 · 🔴 sin base de la rama: NO PUDE MIRAR (salida 2), nunca «0 nuevos»',
  },
  // ⑤ EL COTEJO DE RONDA PIERDE EL PR: la rama pisa la fila del PR abierto y sale como «rama».
  {
    fichero: 'scripts/equipo/sin-version.mjs',
    de: '  for (const r of ramas) if (!porRama.has(r.rama)) porRama.set(',
    a: '  for (const r of ramas) porRama.set(',
    cae: 'SCRUM-1874 · 🔴 cotejar: PR y rama se cuentan UNA vez; sin número aparte; la línea tiene la forma pedida',
  },
];

// ── repositorios de usar y tirar ──────────────────────────────────────────────────────────────
const g = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
function escribir(dir, rel, texto) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), texto, 'utf8');
}
/** Repo con `main` (version-en-curso + un registro VIEJO sin línea) y una rama encima. */
function repo({ conMain = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1874-'));
  g(dir, 'init', '-q', '-b', conMain ? 'main' : 'otra');
  g(dir, 'config', 'user.email', 'banco@example.invalid');
  g(dir, 'config', 'user.name', 'banco');
  g(dir, 'config', 'core.autocrlf', 'false');
  escribir(dir, FICHERO_EN_CURSO, '1.1 (SCRUM-1835)\n');
  escribir(dir, 'docs/master/SCRUM-1.md', '# SCRUM-1 · viejo, de antes de la regla\n');
  g(dir, 'add', '-A');
  g(dir, 'commit', '-q', '-m', 'base');
  if (conMain) g(dir, 'checkout', '-q', '-b', 'scrum-9-rama');
  return dir;
}
const tirar = (dir) => fs.rmSync(dir, { recursive: true, force: true });
const correr = (dir, env = {}) => spawnSync(process.execPath, [CLI, '--raiz', dir], { encoding: 'utf8', timeout: 30_000, env: { ...process.env, GITHUB_ACTIONS: '', ...env } });

// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1874 · 🔴 juzgarRegistro: sin línea, otra versión, dos líneas y mal formada NO pasan', () => {
  assert.deepEqual(juzgarRegistro('# SCRUM-9\n\ncuerpo', EN_CURSO), { ok: false, motivo: 'sin línea «Versión:»' });
  const otra = juzgarRegistro('Versión: 1.0 (SCRUM-1700)\n', EN_CURSO);
  assert.equal(otra.ok, false, 'una pieza atribuida a una versión CERRADA pasó como declarada');
  assert.match(otra.motivo, /nombra la 1\.0; la en curso es la 1\.1/);
  assert.equal(juzgarRegistro('Versión: 1.1 (SCRUM-1)\n', EN_CURSO).ok, false, 'la 1.1 con otro ticket pasó');
  assert.equal(juzgarRegistro('Versión: 1.1\nVersión: mantenimiento\n', EN_CURSO).ok, false, 'dos líneas pasaron');
  assert.equal(juzgarRegistro('Versión: la que toque, ya veremos\n', EN_CURSO).ok, false, 'texto libre pasó');
  assert.equal(juzgarRegistro('Versión: mantenimiento (SCRUM-1835)\n', EN_CURSO).ok, false, 'mantenimiento con otro ticket pasó');
  assert.equal(juzgarRegistro('Versión:\n', EN_CURSO).ok, false, 'una línea vacía pasó');
  // La línea va AL PRINCIPIO de la línea: citada en prosa no cuenta.
  assert.equal(juzgarRegistro('se escribe «Versión: 1.1 (SCRUM-1835)» al principio\n', EN_CURSO).ok, false);
});

test('SCRUM-1874 · CONTROL juzgarRegistro: las formas buenas pasan (también en CRLF y en negrita)', () => {
  assert.deepEqual(juzgarRegistro('# SCRUM-9\r\n\r\nVersión: 1.1 (SCRUM-1835)\r\n', EN_CURSO), { ok: true, como: 'en-curso' });
  assert.deepEqual(juzgarRegistro('Versión: 1.1\n', EN_CURSO), { ok: true, como: 'en-curso' });
  assert.deepEqual(juzgarRegistro('**Versión:** 1.1 (SCRUM-1835)\n', EN_CURSO), { ok: true, como: 'en-curso' });
  assert.deepEqual(juzgarRegistro('Versión: mantenimiento (SCRUM-1859)\n', EN_CURSO), { ok: true, como: 'mantenimiento' });
  assert.deepEqual(juzgarRegistro('Versión: mantenimiento\n', EN_CURSO), { ok: true, como: 'mantenimiento' });
  assert.deepEqual(lineasDeVersion('a\nVersión: x\nb'), ['x']);
  assert.deepEqual(parsearVersion('1.1 (SCRUM-1835)'), { nombre: '1.1', ticket: 'SCRUM-1835' });
});

test('SCRUM-1874 · el fichero de la versión en curso es de UNA línea y se lee; los malos NO dan versión', () => {
  const real = leerVersionEnCurso(RAIZ);
  assert.ok(!real.error, `🔴 ${FICHERO_EN_CURSO} del árbol no se lee: ${real.error}`);
  assert.match(real.texto, /^\S+ \(SCRUM-\d+\)$/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1874-f-'));
  try {
    assert.match(leerVersionEnCurso(dir).error, /no existe/);
    for (const [contenido, dice] of [['', /UNA línea y tiene 0/], ['1.1 (SCRUM-1835)\n1.2 (SCRUM-2)\n', /tiene 2/],
      ['1.1\n', /no tiene la forma/], ['mantenimiento (SCRUM-1859)\n', /no puede ser «mantenimiento»/]]) {
      escribir(dir, FICHERO_EN_CURSO, contenido);
      assert.match(leerVersionEnCurso(dir).error || '(sin error)', dice, `«${contenido}» dio versión`);
    }
  } finally { tirar(dir); }
});

test('SCRUM-1874 · 🔴 un registro NUEVO sin línea se NOMBRA; uno viejo tocado, no', () => {
  const dir = repo();
  try {
    escribir(dir, 'docs/master/SCRUM-1.md', '# SCRUM-1 · viejo, con un tramo nuevo\n\nmás texto\n'); // viejo TOCADO
    escribir(dir, 'docs/master/SCRUM-9.md', '# SCRUM-9 · nuevo, commiteado, sin línea\n');
    escribir(dir, 'docs/master/SCRUM-10.md', '# SCRUM-10 · nuevo y bien\n\nVersión: 1.1 (SCRUM-1835)\n');
    g(dir, 'add', '-A');
    g(dir, 'commit', '-q', '-m', 'rama');
    escribir(dir, 'docs/master/SCRUM-11.md', '# SCRUM-11 · nuevo SIN RASTREAR, sin línea\n');
    escribir(dir, 'docs/otra/SCRUM-12.md', '# fuera de docs/master: no es un registro\n');

    const r = medirRama(dir);
    assert.ok(!r.ciego, `salió ciego en un repo con main: ${r.ciego}`);
    assert.deepEqual(r.filas.map((f) => f.fichero), ['docs/master/SCRUM-10.md', 'docs/master/SCRUM-11.md', 'docs/master/SCRUM-9.md'],
      'la población de «nuevos» no es la que git da como añadida + sin rastrear');
    assert.deepEqual(r.sinDeclarar.map((f) => f.fichero), ['docs/master/SCRUM-11.md', 'docs/master/SCRUM-9.md']);

    // La línea de órdenes: INFORMATIVO → sale 0, pero los NOMBRA; en el CI, como ::warning sobre el fichero.
    const cli = correr(dir, { GITHUB_ACTIONS: 'true' });
    assert.equal(cli.status, OBLIGATORIO ? 1 : 0, `salida ${cli.status}\n${cli.stdout}${cli.stderr}`);
    assert.match(cli.stdout, /registros NUEVOS \.\.\. 3 · declaran 1 · sin declarar 2/);
    assert.match(cli.stdout, /::warning file=docs\/master\/SCRUM-9\.md::SCRUM-1874 · sin línea «Versión:»/);
    assert.match(cli.stdout, /::warning file=docs\/master\/SCRUM-11\.md::/);
    assert.doesNotMatch(cli.stdout, /SCRUM-1\.md/, 'acusó al registro VIEJO que la rama sólo toca');
  } finally { tirar(dir); }
});

test('SCRUM-1874 · 🔴 sin base de la rama: NO PUDE MIRAR (salida 2), nunca «0 nuevos»', () => {
  const dir = repo({ conMain: false }); // sin main ni origin: merge-base no resuelve
  try {
    escribir(dir, 'docs/master/SCRUM-9.md', '# SCRUM-9 sin línea\n');
    assert.match(medirRama(dir).ciego || '(no salió ciego)', /sin base de la rama/);
    const cli = correr(dir);
    assert.equal(cli.status, 2, `sin base tenía que salir 2 y salió ${cli.status}\n${cli.stdout}`);
    assert.match(cli.stdout, /NO PUDE MIRAR/);
  } finally { tirar(dir); }
});

test('SCRUM-1874 · CONTROL: una rama que no crea registros da 0 nuevos y sale 0 (el cero bueno)', () => {
  const dir = repo();
  try {
    const cli = correr(dir);
    assert.equal(cli.status, 0, cli.stdout);
    assert.match(cli.stdout, /registros NUEVOS \.\.\. 0/);
  } finally { tirar(dir); }
});

test('SCRUM-1874 · el árbol REAL: se mide y se CUENTA (informativo: no cae por un registro sin línea)', (t) => {
  // La base se pregunta al motor canónico (SCRUM-723), no a la punta móvil de `origin/main`.
  if (!baseDeLaRama(RAIZ)) {
    t.skip('sin base de la rama en este checkout (baseDeLaRama da null): el CI la trae, ci.yml');
    return;
  }
  const r = medirRama(RAIZ);
  assert.ok(!r.ciego, `🔴 con base de la rama resuelta, el árbol real salió ciego: ${r.ciego}`);
  t.diagnostic(`versión en curso ${r.enCurso} · registros nuevos ${r.filas.length} · sin declarar ${r.sinDeclarar.length}`
    + (r.sinDeclarar.length ? ` (${r.sinDeclarar.map((f) => f.fichero).join(', ')})` : ''));
  // El registro de este ticket se estrena a sí mismo declarando «mantenimiento» (descripción de SCRUM-1874).
  const propio = fs.readFileSync(path.join(RAIZ, 'docs', 'master', 'SCRUM-1874.md'), 'utf8');
  assert.deepEqual(juzgarRegistro(propio, leerVersionEnCurso(RAIZ).version), { ok: true, como: 'mantenimiento' });
});

// ── C · el cotejo de ronda ─────────────────────────────────────────────────────────────────────
test('SCRUM-1874 · 🔴 leerLista: comentarios fuera, una línea sin clave es ERROR (no se salta)', () => {
  const { tickets, errores } = leerLista('# de Jira, 27-nov\n\nSCRUM-1835 1.1\nscrum-0042\nSCRUM-1870   1.1 (SCRUM-1835)\n');
  assert.deepEqual([...tickets.entries()], [[1835, '1.1'], [42, ''], [1870, '1.1 (SCRUM-1835)']]);
  assert.deepEqual(errores, []);
  const mala = leerLista('SCRUM-1\n1870 1.1\n');
  assert.equal(mala.errores.length, 1, 'una línea sin clave SCRUM-N se perdió en silencio');
  assert.match(mala.errores[0], /línea 2/);
});

test('SCRUM-1874 · 🔴 cotejar: PR y rama se cuentan UNA vez; sin número aparte; la línea tiene la forma pedida', () => {
  const ahora = new Date('2026-11-27T12:00:00Z');
  const r = cotejar({
    prs: [{ numero: 3471, rama: 'scrum-1870-generador-panel', creado: '2026-11-25T12:00:00Z' },
      { numero: 3500, rama: 'scrum-1835b-algo', creado: '2026-11-27T09:30:00Z' }],
    ramas: [{ rama: 'scrum-1870-generador-panel', fecha: '2026-11-26T10:00:00Z' },
      { rama: 'scrum-38-staging-expres', fecha: '2026-07-13T00:00:00Z' },
      { rama: 'espera/sin-numero', fecha: '2026-10-01T00:00:00Z' }],
    conVersion: new Map([[1835, '1.1']]),
  });
  assert.deepEqual(r.sinVersion.map((f) => f.rama), ['scrum-38-staging-expres', 'scrum-1870-generador-panel'],
    'la rama con PR abierto salió dos veces, o una con versión se coló');
  assert.deepEqual(r.conVersion.map((f) => f.pr), [3500]);
  assert.deepEqual(r.sinNumero.map((f) => f.rama), ['espera/sin-numero']);
  const conPr = r.sinVersion.find((f) => f.pr);
  assert.equal(lineaSinVersion(conPr, ahora), 'PR #3471 (scrum-1870) sin versión declarada, edad 2 d');
  assert.equal(lineaSinVersion(r.sinVersion[0], ahora), 'rama scrum-38-staging-expres (scrum-38) sin versión declarada, edad 137 d');
  assert.equal(edadLegible('2026-11-27T09:30:00Z', ahora), '2 h');
  assert.equal(edadLegible(null, ahora), '?', 'una fecha ilegible no puede leerse como «de hoy»');
});
