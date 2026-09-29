// tests/scrum1298-mesa-por-puesto.test.mjs — SCRUM-1298
//
// CADA PUESTO ARRANCA EN SU MESA, AL DÍA CON origin/main.
//
// ── EL DEFECTO (medido el 29-sep-2026) ───────────────────────────────────────────────────────
// `CLAUDE.md`, los hooks y `.claude/rules` se cargan del directorio de ARRANQUE, y `claude --bg`
// toma como tal el cwd de quien lo lanza (control `983223e8`). Todas las sesiones arrancaban en el
// checkout compartido, 1.026 commits por detrás de main: el guard que corría era caduco.
//
// ── LO QUE SE PRUEBA AQUÍ, CON GIT DE VERDAD ─────────────────────────────────────────────────
// Un `origin` desnudo, un clon que hace de repo y una carpeta de mesas HERMANA, todo en un temporal
// fuera del árbol. El generador de identidad del fixture es un `scripts/carriles.mjs` mínimo que
// escribe los dos ficheros que declara S0 (SCRUM-1295): así se comprueba que la identidad NO
// ensucia la mesa en el lanzamiento siguiente.
//
// Cada rechazo tiene su caso: una mesa que no sabe decir «no» no protege de nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const s = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'sesion.mjs')).href);

// El rojo de cada pieza, declarado: lo ejecuta `npm run meta:mutaciones`.
// ⚠️ Pocas a propósito (SCRUM-935): cada mutación nueva se paga en el CI de todo el mundo.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "    if (sucio.length) return no('MESA-SUCIA',",
    a: "    if (false) return no('MESA-SUCIA',",
    cae: '🔴 una mesa con trabajo sin guardar NO se actualiza',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: '  if (m === r || m.startsWith(r + \'/\') || r.startsWith(m + \'/\')) {',
    a: '  if (false) {',
    cae: '🔴 una mesa DENTRO del repo se rechaza',
  },
];

const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: GIT_ENV }).trim();

const GENERADOR = [
  "import fs from 'node:fs'; import path from 'node:path';",
  'const [, , accion, puesto, mesa] = process.argv;',
  "if (accion !== 'mesa' || !/^(S[0-5]|ORQ)$/.test(puesto)) { console.log('NO-PUDE-MIRAR: puesto ' + puesto); process.exit(2); }",
  "fs.writeFileSync(path.join(mesa, 'CLAUDE.local.md'), 'Eres ' + puesto + '\\n');",
  "fs.writeFileSync(path.join(mesa, '.yaqu-puesto.json'), JSON.stringify({ puesto }));",
].join('\n');

/** origin desnudo + repo clonado + carpeta de mesas hermana. `conGenerador:false` = main sin identidad. */
function banco({ conGenerador = true } = {}) {
  const base = temporal('yaqu-1298-');
  const origen = path.join(base, 'origen.git');
  const semilla = path.join(base, 'semilla');
  const repo = path.join(base, 'repo');
  const mesas = path.join(base, 'mesas');
  fs.mkdirSync(mesas);
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origen]);
  execFileSync('git', ['init', '-q', '-b', 'main', semilla]);
  fs.writeFileSync(path.join(semilla, 'CLAUDE.md'), 'v1\n');
  if (conGenerador) {
    fs.mkdirSync(path.join(semilla, 'scripts'));
    fs.writeFileSync(path.join(semilla, 'scripts', 'carriles.mjs'), GENERADOR);
  }
  git(semilla, 'add', '-A');
  git(semilla, 'commit', '-q', '-m', 'v1');
  git(semilla, 'remote', 'add', 'origin', origen);
  git(semilla, 'push', '-q', 'origin', 'main');
  execFileSync('git', ['clone', '-q', origen, repo]);
  const avanzar = (texto) => {
    fs.writeFileSync(path.join(semilla, 'CLAUDE.md'), texto);
    git(semilla, 'commit', '-q', '-am', texto.trim());
    git(semilla, 'push', '-q', 'origin', 'main');
    return git(semilla, 'rev-parse', 'HEAD');
  };
  return { base, origen, repo, mesas, avanzar, config: { repo, mesas } };
}

const EQUIPO = s.EQUIPO_DE_LUIS;

test('SUELO: el banco tiene un origin al que la mesa puede llegar (si no, ningún caso de abajo mide)', () => {
  const b = banco();
  assert.match(git(b.repo, 'ls-remote', 'origin', 'main'), /^[0-9a-f]{40}\s+refs\/heads\/main$/);
});

test('la ruta de la mesa: sN para sesion-N, el puesto para el resto, y siempre HERMANA del repo', () => {
  const repo = path.resolve('/x/cobroFlash/cobroflash-backend');
  const mesas = path.resolve('/x/cobroFlash');
  assert.equal(s.rutaDeMesa({ mesas, repo, nombre: 'sesion-3', equipo: EQUIPO }).mesa, path.join(mesas, 'mesa-s3'));
  assert.equal(s.rutaDeMesa({ mesas, repo, nombre: 'orquestador', equipo: EQUIPO }).mesa, path.join(mesas, 'mesa-orquestador'));
  const dentro = s.rutaDeMesa({ mesas: path.join(repo, '.claude', 'worktrees'), repo, nombre: 'sesion-1', equipo: EQUIPO });
  assert.equal(dentro.veredicto, 'MESA-DENTRO-DEL-REPO', '🔴 una mesa DENTRO del repo se rechaza');
  assert.equal(s.rutaDeMesa({ mesas: 'relativa', repo, nombre: 'sesion-1', equipo: EQUIPO }).veredicto, 'MESA-NO-VALIDA');
  assert.equal(s.rutaDeMesa({ mesas, repo, nombre: 's5-29e', equipo: EQUIPO }).veredicto, 'NOMBRE-NO-PERMITIDO');
});

test('la identidad: sesion-N → SN, orquestador → ORQ; un equipo con prefijo sin traducción declarada NO tiene', () => {
  assert.equal(s.puestoDeIdentidad('sesion-4', EQUIPO), 'S4');
  assert.equal(s.puestoDeIdentidad('orquestador', EQUIPO), 'ORQ');
  const javier = { prefijo: 'j-', puestos: ['orquestador', 'sesion-1'], orquestador: 'orquestador' };
  assert.equal(s.puestoDeIdentidad('j-sesion-1', javier), null);
  assert.equal(s.puestoDeIdentidad('j-sesion-1', javier, { 'sesion-1': 'J1' }), 'J1');
});

test('una mesa que no existe nace en origin/main, con su identidad escrita', () => {
  const b = banco();
  const p = s.prepararMesa({ config: b.config, nombre: 'sesion-2', equipo: EQUIPO });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(p.mesa, path.join(b.mesas, 'mesa-s2'));
  assert.equal(git(p.mesa, 'rev-parse', 'HEAD'), git(b.repo, 'rev-parse', 'origin/main'));
  assert.equal(fs.readFileSync(path.join(p.mesa, 'CLAUDE.local.md'), 'utf8'), 'Eres S2\n');
});

test('antes de cada lanzamiento la mesa se pone al día con lo que se mergeó mientras (el defecto entero)', () => {
  const b = banco();
  const p1 = s.prepararMesa({ config: b.config, nombre: 'sesion-2', equipo: EQUIPO });
  assert.equal(p1.ok, true, JSON.stringify(p1));
  const nuevo = b.avanzar('v2\n');
  const p2 = s.prepararMesa({ config: b.config, nombre: 'sesion-2', equipo: EQUIPO });
  assert.equal(p2.ok, true, `🔴 la identidad del lanzamiento anterior NO ensucia la mesa: ${JSON.stringify(p2)}`);
  assert.equal(p2.head, nuevo);
  // Sin los CR: con `core.autocrlf=true` (Windows) el checkout los añade, y eso no es lo que se mide.
  assert.equal(fs.readFileSync(path.join(p2.mesa, 'CLAUDE.md'), 'utf8').replace(/\r/g, ''), 'v2\n', '🔴 la sesión carga el CLAUDE.md de HOY');
});

test('una mesa con trabajo sin guardar NO se actualiza: se dice y no se lanza', () => {
  const b = banco();
  const p1 = s.prepararMesa({ config: b.config, nombre: 'sesion-1', equipo: EQUIPO });
  fs.writeFileSync(path.join(p1.mesa, 'medicion.txt'), 'trabajo de alguien\n');
  b.avanzar('v2\n');
  const p2 = s.prepararMesa({ config: b.config, nombre: 'sesion-1', equipo: EQUIPO });
  assert.equal(p2.veredicto, 'MESA-SUCIA', '🔴 una mesa con trabajo sin guardar NO se actualiza');
  assert.equal(p2.ok, false);
  assert.match(p2.motivo, /medicion\.txt/);
  assert.equal(fs.readFileSync(path.join(p1.mesa, 'medicion.txt'), 'utf8'), 'trabajo de alguien\n');
});

test('una carpeta con el nombre de la mesa que NO es un worktree del repo no se toca', () => {
  const b = banco();
  const ajena = path.join(b.mesas, 'mesa-s4');
  execFileSync('git', ['init', '-q', ajena]);
  const p = s.prepararMesa({ config: b.config, nombre: 'sesion-4', equipo: EQUIPO });
  assert.equal(p.veredicto, 'MESA-AJENA', JSON.stringify(p));
});

test('sin poder traer origin, NO se lanza con una mesa que «parece» al día', () => {
  const b = banco();
  git(b.repo, 'remote', 'set-url', 'origin', path.join(b.base, 'no-existe.git'));
  const p = s.prepararMesa({ config: b.config, nombre: 'sesion-3', equipo: EQUIPO });
  assert.equal(p.ok, false);
  assert.equal(p.veredicto, 'NO-PUDE-MIRAR');
});

test('sin generador de identidad en main, no se lanza (la cerradura de S0 pararía la sesión igual)', () => {
  const b = banco({ conGenerador: false });
  const p = s.prepararMesa({ config: b.config, nombre: 'sesion-3', equipo: EQUIPO });
  assert.equal(p.veredicto, 'SIN-IDENTIDAD', JSON.stringify(p));
});

test('un generador que sale ≠ 0 corta el lanzamiento, y su motivo llega', () => {
  const b = banco();
  const p = s.prepararMesa({ config: { ...b.config, identidades: { 'sesion-3': 'ZZ' } }, nombre: 'sesion-3', equipo: EQUIPO });
  assert.equal(p.veredicto, 'SIN-IDENTIDAD');
  assert.match(p.motivo, /NO-PUDE-MIRAR: puesto ZZ/);
});

test('sin `mesas` en la instalación todo sigue como antes, pero el veredicto lo DICE', () => {
  const m = s.mesaDelLanzamiento({ config: { repo: '/r' }, nombre: 'sesion-1', equipo: EQUIPO });
  assert.equal(m.ok, true);
  assert.equal(m.cwd, undefined);
  assert.equal(m.mesa.veredicto, 'SIN-MESA');
});

test('el guard del segundo orquestador ve al equipo que arrancó en las mesas', () => {
  const repo = path.resolve('/x/cobroFlash/cobroflash-backend');
  const mesas = path.resolve('/x/cobroFlash');
  const agentes = [{ id: 'aaaaaaaa', name: 'sesion-1', kind: 'background', pid: 7, state: 'working', cwd: path.join(mesas, 'mesa-s1') }];
  const job = () => ({ leido: false });
  assert.equal(s.equipoVivo({ agentes, repo, job }).length, 0, 'CONTROL: sin `mesas`, la mesa no cuenta (era el hueco)');
  assert.equal(s.equipoVivo({ agentes, repo, job, mesas }).length, 1);
  const otra = [{ ...agentes[0], cwd: path.join(mesas, 'wt-s1-algo') }];
  assert.equal(s.equipoVivo({ agentes: otra, repo, job, mesas }).length, 0, 'solo las mesas, no cualquier hermana');
});
