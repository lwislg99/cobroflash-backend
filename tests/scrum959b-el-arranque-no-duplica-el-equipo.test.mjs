// tests/scrum959b-el-arranque-no-duplica-el-equipo.test.mjs — SCRUM-959b
//
// LA TANDA DE LAS 13:05 LANZABA UN SEGUNDO ORQUESTADOR ENCIMA DEL VIVO.
//
// ── EL DEFECTO, MEDIDO EL 21-SEP-2026 LEYENDO (no ejecutando) LA INSTALACIÓN ─────────────────
// `decidirLanzar` daba una sesión por «viva» sólo si una entrada de `claude agents --json` se llamaba
// EXACTAMENTE `orquestador`. Ese día el equipo estaba levantado a mano con otros nombres —seis
// sesiones de fondo `s<n>-21` y el orquestador interactivo `cobroflash-backend-90`—, así que
// `lanzar orquestador` contestaba NUEVA y `orquestador-arranque.mjs` arrancaba otro encima. Y ése,
// al leer «si falta una sesión, ábrela con el lanzador», podía abrir puestos duplicados.
//
// `CAPTURA` es la salida LITERAL de `claude agents --json` de ese día (copia sin tocar en
// `docs/master/evidencias/scrum959/agents-21sep.json`), no un banco inventado.
//
// ── EL CRITERIO NUEVO, Y LO QUE NO SEPARA ───────────────────────────────────────────────────
// Para el ORQUESTADOR (y sólo él; los puestos sí se lanzan cuando faltan) se mira si hay algo vivo
// en el repo, por lo que `agents --json` da y sin fiarse del nombre:
//   · una sesión de FONDO con proceso vivo cuenta, trabaje o espere;
//   · un chat INTERACTIVO sólo cuenta si está TRABAJANDO — los que el fundador deja abiertos días
//     (`cobroflash-backend-73` lleva 18 h parado) no pueden impedir que la tanda arranque nunca.
// 🔴 LO QUE NO SEPARA: un orquestador interactivo PARADO y sin ninguna sesión de fondo viva. La
// lista no da última actividad. Se declara aquí y en el código; no se inventa un umbral.
//
// ⚠️ NO HAY MUESTRA REAL de un chat interactivo parado: cuando se midió no quedaba ninguno en la
// lista. Los casos «parado» de abajo lo CONSTRUYEN con `status: 'idle'`, que es un valor observado
// en las sesiones de fondo (SCRUM-954) pero NO en interactivas. Lo que sí es real es la parte de
// arriba: `-90` interactivo trabajando (`status: 'busy'`) y las seis de fondo con `pid`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'equipo', 'sesion.mjs');
const s = await import(pathToFileURL(SCRIPT).href);

// El rojo de cada pieza, declarado: lo ejecuta `npm run meta:mutaciones`.
// ⚠️ Pocas a propósito (SCRUM-935): cada mutación nueva se paga en el CI de todo el mundo.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: '  if (nombre === orquestador.prefijo + orquestador.orquestador) {',
    a: '  if (false) {',
    cae: '🔴 ROJO: con el equipo de hoy vivo bajo OTROS nombres, `lanzar orquestador` dice YA-VIVA',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "    if (a.kind === 'interactive' && a.status !== 'busy' && a.state !== 'working') continue;",
    a: '',
    cae: '🔴 un chat interactivo PARADO no cuenta como equipo',
  },
];

const REPO = 'D:\\MILLONARIO\\cobroFlash\\cobroflash-backend';
const CAPTURA = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs/master/evidencias/scrum959/agents-21sep.json'), 'utf8'));
const ahora = Date.parse('2026-09-21T08:00:00.000Z');
// Lo que dice el `state.json` de cada uno: sólo el resto muerto (`sesion-5`, df2fa38f) está terminado.
const job = (id) => (id === 'df2fa38f'
  ? { leido: true, terminal: true, cuando: '2026-09-18T13:50:15.562Z', estado: 'done' }
  : { leido: false, motivo: 'no hay state.json en el banco' });
const lanzar = (agentes, extra = {}) =>
  s.decidirLanzar({ nombre: 'orquestador', agentes, registro: {}, ahora, job, repo: REPO, ...extra });

test('la captura trae lo que este fichero dice que trae (SUELO: si no, los casos de abajo no miden nada)', () => {
  const vivos = CAPTURA.filter((a) => typeof a.pid === 'number');
  const fondo = vivos.filter((a) => a.kind === 'background');
  assert.ok(fondo.length >= 5, `🔴 CIEGO: la captura trae ${fondo.length} sesiones de fondo vivas`);
  const interactivo = CAPTURA.find((a) => a.kind === 'interactive' && a.status === 'busy');
  assert.ok(interactivo, '🔴 CIEGO: la captura no trae el orquestador interactivo trabajando');
  assert.equal(CAPTURA.filter((a) => a.name === 'orquestador').length, 0,
    '🔴 la captura ya trae una sesión llamada «orquestador»: dejó de reproducir el defecto');
  const resto = CAPTURA.find((a) => a.id === 'df2fa38f');
  assert.equal(resto.pid, undefined, 'el resto muerto trae pid: el banco ya no lo es');
});

test('🔴 ROJO: con el equipo de hoy vivo bajo OTROS nombres, `lanzar orquestador` dice YA-VIVA', () => {
  // EL MECANISMO VIEJO, tal cual: sólo el nombre. Con la captura de hoy no ve a nadie, y por eso
  // NUEVA — el defecto. Se comprueba aquí para que el caso no sea verde por una captura que ya no lo reproduce.
  const { cuentan } = s.repartirPorNombre({ nombre: 'orquestador', agentes: CAPTURA, job });
  assert.equal(cuentan.length, 0, 'el criterio por nombre ya ve al equipo: la captura no reproduce el defecto');

  const d = lanzar(CAPTURA);
  assert.equal(d.veredicto, 'YA-VIVA',
    '🔴 la tanda lanzaría OTRO orquestador encima de un equipo que está trabajando');
  const nombres = d.equipo.map((v) => v.nombre).sort();
  assert.ok(nombres.includes('cobroflash-backend-90'), 'no ve al orquestador interactivo que trabaja');
  assert.ok(nombres.includes('s5-21') && nombres.includes('s1-21'), 'no ve a las sesiones de fondo');
  assert.ok(!nombres.includes('sesion-5'), '🔴 cuenta como equipo un resto MUERTO (sin pid, con state.json terminado)');
});

test('el criterio NO depende de cómo se llamen: con otros nombres cualquiera, sigue siendo YA-VIVA', () => {
  const otros = CAPTURA.map((a, i) => ({ ...a, name: `puesto-${i}-que-mañana-sera-otro` }));
  assert.equal(lanzar(otros).veredicto, 'YA-VIVA');
  const sinNombre = CAPTURA.map(({ name, ...a }) => a);
  assert.equal(lanzar(sinNombre).veredicto, 'YA-VIVA', 'las sesiones sin nombre también son equipo');
});

test('🔴 un chat interactivo PARADO no cuenta como equipo (el `-73` que lleva 18 h abierto)', () => {
  const interactivo = CAPTURA.find((a) => a.kind === 'interactive');
  const parado = { ...interactivo, name: 'cobroflash-backend-73', status: 'idle' };
  const d = lanzar([parado]);
  assert.equal(d.veredicto, 'NUEVA', '🔴 un chat abierto y parado bloquearía la tanda para siempre');
  // Y el mismo chat TRABAJANDO sí cuenta: lo único que cambia es `status`, así que es lo que decide.
  assert.equal(lanzar([{ ...parado, status: 'busy' }]).veredicto, 'YA-VIVA');
  assert.equal(lanzar([{ ...parado, status: undefined, state: 'working' }]).veredicto, 'YA-VIVA',
    '`state: working` también es trabajar');
});

test('una sesión de FONDO viva cuenta aunque esté esperando (un equipo entero esperando al CI sigue siendo equipo)', () => {
  const espera = CAPTURA.filter((a) => a.kind === 'background' && a.pid).map((a) => ({ ...a, status: 'idle', state: 'done' }));
  assert.ok(espera.length >= 5);
  assert.equal(lanzar(espera).veredicto, 'YA-VIVA');
});

test('✅ CONTROLES POSITIVOS: sin nadie vivo en el repo, el veredicto sigue siendo NUEVA', () => {
  assert.equal(lanzar([]).veredicto, 'NUEVA', 'sin nadie');
  assert.equal(lanzar(CAPTURA.filter((a) => a.id === 'df2fa38f')).veredicto, 'NUEVA', 'sólo un resto muerto');
  const enOtroRepo = CAPTURA.map((a) => ({ ...a, cwd: 'D:\\otro\\proyecto' }));
  assert.equal(lanzar(enOtroRepo).veredicto, 'NUEVA', 'sesiones de OTRO proyecto no son el equipo de éste');
  const nuevaRegistrada = lanzar([], { registro: { orquestador: { sessionId: 'x', ultimaTanda: 1 } } });
  assert.equal(nuevaRegistrada.veredicto, 'NUEVA', 'el registro no cambia el veredicto: nunca se reanuda');
});

test('un worktree del repo, con la unidad en minúscula, cuenta como el repo', () => {
  const wt = { pid: 1234, id: 'abcdef01', cwd: 'd:/millonario/cobroflash/cobroflash-backend/.claude/worktrees/s4-21', kind: 'background', name: 'x', status: 'busy', state: 'working' };
  assert.equal(lanzar([wt]).veredicto, 'YA-VIVA');
  const vecino = { ...wt, cwd: 'D:\\MILLONARIO\\cobroFlash\\cobroflash-backend-otro' };
  assert.equal(lanzar([vecino]).veredicto, 'NUEVA', '🔴 «cobroflash-backend-otro» NO es una subcarpeta de «cobroflash-backend»: un prefijo no es una ruta');
});

test('los PUESTOS siguen lanzándose cuando faltan, aunque haya equipo vivo', () => {
  const d = s.decidirLanzar({ nombre: 'sesion-3', agentes: CAPTURA, registro: {}, ahora, job, repo: REPO });
  assert.equal(d.veredicto, 'NUEVA', '🔴 el criterio del equipo vivo se ha colado en los puestos y ya no se puede cubrir un hueco');
});

test('sin la ruta del repo, el orquestador NO se lanza a ciegas', () => {
  const d = s.decidirLanzar({ nombre: 'orquestador', agentes: [], registro: {}, ahora, job });
  assert.equal(d.veredicto, 'NO-PUDE-MIRAR');
  assert.match(d.motivo, /repo/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// La CLI, por EFECTO: qué llamadas recibe `claude`
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Una instalación de verdad (la puerta exige que sea idéntica a `origin/main` y fuera de un árbol). */
function banco(agentes) {
  const dir = temporal('scrum959b-');
  const git = (cwd, ...a) => execFileSync('git', ['-c', 'core.autocrlf=false', '-C', cwd, ...a], { encoding: 'utf8' });
  const repo = path.join(dir, 'repo');
  execFileSync('git', ['init', '-q', repo]);
  fs.mkdirSync(path.join(repo, 'scripts/equipo'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(repo, 'scripts/equipo/sesion.mjs'));
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=banco', '-c', 'user.email=banco@x', 'commit', '-q', '-m', 'banco');
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');

  const inst = path.join(dir, 'instalacion');
  fs.mkdirSync(inst);
  fs.writeFileSync(path.join(inst, 'sesion.mjs'), spawnSync('git', ['-C', repo, 'show', 'origin/main:scripts/equipo/sesion.mjs']).stdout);
  fs.writeFileSync(path.join(inst, 'prompt.md'), 'encargo de la tanda de prueba\n');

  // 🔴 SU PROPIA carpeta de trabajos: si no, el sujeto leería los jobs REALES de esta máquina.
  const jobs = path.join(dir, 'jobs');
  fs.mkdirSync(path.join(jobs, 'df2fa38f'), { recursive: true });
  fs.writeFileSync(path.join(jobs, 'df2fa38f', 'state.json'), JSON.stringify({ state: 'done', firstTerminalAt: '2026-09-18T13:50:15.562Z' }));

  // Las sesiones de la captura, arrancadas EN EL REPO DEL BANCO (el criterio mira `cwd`).
  const enElBanco = agentes.map((a) => ({ ...a, cwd: String(a.cwd).replace(REPO, repo) }));
  const llamadas = path.join(dir, 'llamadas.txt');
  const falso = path.join(dir, 'claude-falso.mjs');
  fs.writeFileSync(falso, [
    "import fs from 'node:fs';",
    `const LL = ${JSON.stringify(llamadas)};`,
    'const args = process.argv.slice(2);',
    "fs.appendFileSync(LL, JSON.stringify(args) + '\\n');",
    `if (args[0] === 'agents') { process.stdout.write(${JSON.stringify(JSON.stringify(enElBanco))}); process.exit(0); }`,
    "if (args[0] === '--bg') { process.stdout.write('backgrounded · 0badcafe · orquestador\\n'); process.exit(0); }",
    'process.exit(0);',
  ].join('\n'));

  const memoria = path.join(dir, 'memoria');
  fs.mkdirSync(memoria);
  fs.writeFileSync(path.join(inst, 'config.json'), JSON.stringify({
    repo, claude: [process.execPath, falso], jobs,
    prefijo: '', puestos: ['orquestador', 'sesion-0', 'sesion-1', 'sesion-2', 'sesion-3', 'sesion-4', 'sesion-5'],
    orquestador: 'orquestador', traspasos: memoria,
  }));

  const correr = (...a) => {
    const p = spawnSync(process.execPath, [path.join(inst, 'sesion.mjs'), ...a], { encoding: 'utf8' });
    let v = null;
    try { v = JSON.parse((p.stdout || '').trim().split('\n').at(-1)); } catch { /* sin veredicto */ }
    return { status: p.status, v, salida: p.stdout, error: p.stderr };
  };
  const leerLlamadas = () => (fs.existsSync(llamadas) ? fs.readFileSync(llamadas, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { dir, prompt: path.join(inst, 'prompt.md'), correr, leerLlamadas, limpiar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('🔴 POR EFECTO: con el equipo de hoy vivo, `lanzar orquestador` sale 0, dice YA-VIVA y NO llama a `claude --bg`', () => {
  const b = banco(CAPTURA);
  try {
    const r = b.correr('lanzar', 'orquestador', b.prompt);
    assert.ok(r.v, `🔴 la CLI no devolvió veredicto: ${r.salida} ${r.error}`);
    assert.equal(r.v.veredicto, 'YA-VIVA', `🔴 ${JSON.stringify(r.v)}`);
    assert.equal(r.status, 0);
    const lanzamientos = b.leerLlamadas().filter((a) => a[0] === '--bg');
    assert.deepEqual(lanzamientos, [], '🔴 se lanzó una sesión de fondo encima del equipo vivo');
  } finally { b.limpiar(); }
});

test('✅ POR EFECTO, el control positivo: sin nadie vivo, `lanzar orquestador` SÍ lanza', () => {
  const b = banco([]);
  try {
    const r = b.correr('lanzar', 'orquestador', b.prompt);
    const lanzamientos = b.leerLlamadas().filter((a) => a[0] === '--bg');
    assert.equal(lanzamientos.length, 1, `🔴 con el repo vacío no se lanzó nada: ${JSON.stringify(r.v)} ${r.error}`);
    assert.deepEqual(lanzamientos[0].slice(0, 3), ['--bg', '-n', 'orquestador']);
  } finally { b.limpiar(); }
});
