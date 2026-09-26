// tests/scrum1007-1011-1026-relevo-lanzar-bloqueo.test.mjs — tres defectos de `scripts/equipo/sesion.mjs`
// medidos el mismo día por el orquestador del equipo de Javier, los tres arreglados juntos por
// tocar el mismo fichero (afinidad, sesión de refuerzo s3-22a):
//
//   · SCRUM-1007: `relevar` no podía dar RELEVAR nunca por el camino que su propio protocolo manda
//     (escribir el traspaso y CONTESTAR «traspaso listo», que es un turno posterior al fichero).
//   · SCRUM-1011: `lanzar` decía LANZADA con exit 0 sobre una sesión sin proceso ni un solo turno.
//   · SCRUM-1026: una sesión BLOQUEADA (proceso vivo, esperando un permiso que nadie contesta) se
//     ve igual que una que trabaja en `estado`, salvo que alguien lea `waitingFor` fila a fila.
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

const EQUIPO = { prefijo: '', puestos: ['orquestador', 'sesion-0', 'sesion-1', 'sesion-2', 'sesion-3', 'sesion-4', 'sesion-5'], orquestador: 'orquestador' };

// El rojo de cada pieza, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: 'if (ultimoTurno - traspasoMtime >= esperaMs) {',
    a: 'if (traspasoMtime <= ultimoTurno) {',
    cae: 'SCRUM-1007 · 🔴 EL CASO MEDIDO: traspaso 14,4 s ANTES del turno de «traspaso listo» → RELEVAR',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "if (agente && typeof agente.pid === 'number' && agente.pid > 0) return { ok: true };",
    a: 'if (agente) return { ok: true };',
    cae: 'SCRUM-1011 · comprobarQueArranco: solo un pid > 0 cuenta como arrancada',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "if (a.state !== 'blocked' && !a.waitingFor) continue;",
    a: 'if (false) continue;',
    cae: 'SCRUM-1026 · sesionesBloqueadas: separa las bloqueadas, con motivo y el proxy de tiempo',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1007 · decidirRelevar: la ventana simétrica
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1007 · 🔴 EL CASO MEDIDO: traspaso 14,4 s ANTES del turno de «traspaso listo» → RELEVAR', () => {
  // Los números literales del ticket: comprobado=1790000203761.37 / 1790000218176.
  const traspasoMtime = 1790000203761.37;
  const ultimoTurno = 1790000218176;
  const ahora = ultimoTurno + 5_000;
  const viva = { id: 'aa047d23', name: 'sesion-1', kind: 'background', state: 'done' };
  const d = s.decidirRelevar({ nombre: 'sesion-1', agentes: [viva], traspasoMtime, ultimoTurno, ahora, equipo: EQUIPO });
  assert.equal(d.veredicto, 'RELEVAR', `🔴 con el criterio viejo esto daba ESPERANDO/SIN-TRASPASO: ${JSON.stringify(d)}`);
});

test('SCRUM-1007 · el camino de siempre no se rompe: traspaso claramente POSTERIOR sigue siendo RELEVAR', () => {
  const ultimoTurno = 1_000_000;
  const traspasoMtime = ultimoTurno + 60_000;
  const viva = { id: 'bbbbbbbb', name: 'sesion-2', kind: 'background', state: 'idle' };
  const d = s.decidirRelevar({ nombre: 'sesion-2', agentes: [viva], traspasoMtime, ultimoTurno, ahora: ultimoTurno + 61_000, equipo: EQUIPO });
  assert.equal(d.veredicto, 'RELEVAR');
});

test('SCRUM-1007 · un traspaso REALMENTE viejo (fuera de la ventana) sigue dando ESPERANDO y luego SIN-TRASPASO', () => {
  const ultimoTurno = 10_000_000;
  const traspasoMtime = ultimoTurno - 20 * 60 * 1000; // 20 min antes: fuera de los 10 min de ventana
  const viva = { id: 'cccccccc', name: 'sesion-3', kind: 'background', state: 'idle' };
  const esperando = s.decidirRelevar({ nombre: 'sesion-3', agentes: [viva], traspasoMtime, ultimoTurno, ahora: ultimoTurno + 60_000, equipo: EQUIPO });
  assert.equal(esperando.veredicto, 'ESPERANDO', '🔴 CONTROL: sin esto, la ventana se habría abierto para cualquier traspaso viejo');
  const sinTraspaso = s.decidirRelevar({ nombre: 'sesion-3', agentes: [viva], traspasoMtime, ultimoTurno, ahora: ultimoTurno + 11 * 60 * 1000, equipo: EQUIPO });
  assert.equal(sinTraspaso.veredicto, 'SIN-TRASPASO');
});

test('SCRUM-1007 · con el traspaso fresco, sigue mandando el estado: OCUPADA y BLOQUEADA no cambian', () => {
  const ultimoTurno = 5_000_000;
  const traspasoMtime = ultimoTurno - 5_000;
  const trabajando = { id: 'dddddddd', name: 'sesion-4', kind: 'background', state: 'working' };
  assert.equal(s.decidirRelevar({ nombre: 'sesion-4', agentes: [trabajando], traspasoMtime, ultimoTurno, ahora: ultimoTurno, equipo: EQUIPO }).veredicto, 'OCUPADA');
  const bloqueada = { id: 'eeeeeeee', name: 'sesion-4', kind: 'background', state: 'blocked', waitingFor: 'permission prompt' };
  assert.equal(s.decidirRelevar({ nombre: 'sesion-4', agentes: [bloqueada], traspasoMtime, ultimoTurno, ahora: ultimoTurno, equipo: EQUIPO }).veredicto, 'BLOQUEADA');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1011 · comprobarQueArranco (pura)
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1011 · comprobarQueArranco: solo un pid > 0 cuenta como arrancada', () => {
  assert.deepEqual(s.comprobarQueArranco({ id: 'x', pid: 23808 }), { ok: true });
  assert.equal(s.comprobarQueArranco({ id: 'x' }).ok, false, '🔴 registrada sin pid se da por arrancada');
  assert.equal(s.comprobarQueArranco({ id: 'x', pid: 0 }).ok, false);
  assert.equal(s.comprobarQueArranco(undefined).ok, false);
  assert.match(s.comprobarQueArranco(undefined).motivo, /no aparece/);
  assert.match(s.comprobarQueArranco({ id: 'x' }).motivo, /sin.*pid/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1026 · sesionesBloqueadas (pura)
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1026 · sesionesBloqueadas: separa las bloqueadas, con motivo y el proxy de tiempo', () => {
  const agentes = [
    { id: '2c1cce9d', name: 'jv-j6', kind: 'background', state: 'blocked', waitingFor: 'input needed' },
    { id: '52c71c48', name: 'jv-j2', kind: 'background', waitingFor: 'permission prompt' }, // sin `state`
    { id: 'trabaja1', name: 'jv-j1', kind: 'background', state: 'working' },
    { id: 'interact1', name: 'x', kind: 'interactive', state: 'blocked', waitingFor: 'input needed' }, // no es de fondo
  ];
  const sinActividadMs = (a) => (a.id === '2c1cce9d' ? 31 * 60 * 1000 : null);
  const b = s.sesionesBloqueadas({ agentes, sinActividadMs });
  assert.deepEqual(b.map((x) => x.id).sort(), ['2c1cce9d', '52c71c48'], '🔴 se cuela una que trabaja, o se pierde una bloqueada, o entra una interactiva');
  const j6 = b.find((x) => x.id === '2c1cce9d');
  assert.equal(j6.waitingFor, 'input needed');
  assert.equal(j6.avisar, true, '🔴 31 min por encima del umbral (10 min) y no avisa');
  const j2 = b.find((x) => x.id === '52c71c48');
  assert.equal(j2.sinActividadMs, null, 'sin jsonl encontrado, no se inventa un número');
  assert.equal(j2.avisar, false, '🔴 sin dato, avisar no puede ser true');
});

test('SCRUM-1026 · sin `sinActividadMs`, no revienta: sale con el número en null', () => {
  const b = s.sesionesBloqueadas({ agentes: [{ id: 'x', kind: 'background', state: 'blocked' }] });
  assert.equal(b[0].sinActividadMs, null);
  assert.equal(b[0].avisar, false);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// La CLI, por EFECTO — banco con `claude` falso y ESTADO propio entre llamadas
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Una instalación de verdad. El `claude` falso lee un fichero JSON de ESTADO que el propio banco
 * puede reescribir entre llamadas, para simular «al principio sin pid, luego con pid» sin dormir
 * los 8 s enteros de `ESPERA_ARRANQUE_MS` en el caso feliz.
 */
function banco({ backgroundedId = 'ab000001', secuenciaAgents } = {}) {
  const dir = temporal('scrum1011-1026-');
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
  const r = spawnSync('git', ['-C', repo, 'show', 'origin/main:scripts/equipo/sesion.mjs']);
  fs.writeFileSync(path.join(inst, 'sesion.mjs'), r.stdout);

  // `secuenciaAgents`: array de "listados" (uno por cada llamada a `agents --json`). El último se
  // repite si se piden más llamadas de las que hay en la lista.
  const secuencia = path.join(dir, 'secuencia.json');
  fs.writeFileSync(secuencia, JSON.stringify(secuenciaAgents ?? [[]]));
  const contador = path.join(dir, 'contador.txt');
  fs.writeFileSync(contador, '0');

  const llamadas = path.join(dir, 'llamadas.txt');
  const falso = path.join(dir, 'claude-falso.mjs');
  fs.writeFileSync(falso, [
    "import fs from 'node:fs';",
    `const LL = ${JSON.stringify(llamadas)};`,
    `const SEC = ${JSON.stringify(secuencia)};`,
    `const CONT = ${JSON.stringify(contador)};`,
    'const args = process.argv.slice(2);',
    "fs.appendFileSync(LL, JSON.stringify(args) + '\\n');",
    "if (args[0] === 'agents' && args[1] === '--json') {",
    '  const lista = JSON.parse(fs.readFileSync(SEC, "utf8"));',
    '  let n = Number(fs.readFileSync(CONT, "utf8"));',
    '  const salida = lista[Math.min(n, lista.length - 1)];',
    '  fs.writeFileSync(CONT, String(n + 1));',
    '  process.stdout.write(JSON.stringify(salida));',
    '  process.exit(0);',
    '}',
    "if (args[0] === '--bg') {",
    `  process.stdout.write('backgrounded \\u00b7 ${backgroundedId} \\u00b7 ' + args[2] + '\\n');`,
    '  process.exit(0);',
    '}',
    'process.exit(0);',
  ].join('\n'));

  const memoria = path.join(dir, 'memoria');
  fs.mkdirSync(memoria);
  fs.writeFileSync(path.join(inst, 'config.json'), JSON.stringify({
    repo, claude: [process.execPath, falso], jobs: path.join(dir, 'jobs'),
    prefijo: '', puestos: EQUIPO.puestos, orquestador: 'orquestador', traspasos: memoria,
  }));

  const correr = (...a) => {
    // SCRUM-1153 · el `env` se construye a mano: sin esto, el hijo hereda `NODE_TEST_CONTEXT`,
    // `FORCE_COLOR` o `NODE_OPTIONS` de la máquina y se mide la CASA, no la copia instalada.
    const entornoHijo = { ...process.env };
    delete entornoHijo.FORCE_COLOR;
    delete entornoHijo.NODE_OPTIONS;
    delete entornoHijo.NODE_TEST_CONTEXT;
    const p = spawnSync(process.execPath, [path.join(inst, 'sesion.mjs'), ...a], { encoding: 'utf8', env: entornoHijo });
    let v = null;
    try { v = JSON.parse((p.stdout || '').trim().split('\n').at(-1)); } catch { /* sin veredicto */ }
    return { status: p.status, v };
  };
  const contarLlamadasAgents = () => (fs.existsSync(llamadas)
    ? fs.readFileSync(llamadas, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((a) => a[0] === 'agents').length
    : 0);
  return { dir, inst, correr, contarLlamadasAgents, limpiar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('SCRUM-1011 · 🔴 ROJO: la sesión NUNCA tiene pid → NO-ARRANCO (con el defecto viejo, esto era LANZADA)', () => {
  const b = banco({ backgroundedId: 'ab000001', secuenciaAgents: [[]] }); // «agents» nunca trae la entrada
  try {
    const { status, v } = b.correr('lanzar', 'sesion-1', (() => {
      const f = path.join(b.dir, 'prompt.txt'); fs.writeFileSync(f, 'encargo de prueba'); return f;
    })());
    assert.equal(status, 2, `🔴 lanzar dio LANZADA sobre una sesión sin proceso: ${JSON.stringify(v)}`);
    assert.equal(v.veredicto, 'NO-ARRANCO');
    assert.equal(v.id, 'ab000001');
    assert.match(v.motivo, /no aparece/);
    assert.ok(b.contarLlamadasAgents() >= 2, '🔴 CIEGO: no llegó a sondear más de una vez (¿de verdad esperó?)');
  } finally { b.limpiar(); }
}, { timeout: 20_000 });

test('SCRUM-1011 · 🟢 CONTROL POSITIVO: la sesión aparece con pid en el SEGUNDO sondeo de confirmarArranque → LANZADA, sin agotar la espera', () => {
  // Índice 0 lo consume `decidirLanzar` (comprueba que «sesion-1» no esté ya viva). Índice 1 es el
  // PRIMER sondeo de `confirmarArranque` (sin pid todavía: obliga a dormir y reintentar de verdad).
  // Índice 2 en adelante trae el pid: si el bucle no re-sondeara, esto daría NO-ARRANCO.
  const CON_PID = [{ id: 'ab000001', name: 'sesion-1', kind: 'background', pid: 9999, sessionId: '11111111-1111-4111-8111-111111111111' }];
  const b = banco({ backgroundedId: 'ab000001', secuenciaAgents: [[], [], CON_PID] });
  try {
    const f = path.join(b.dir, 'prompt.txt'); fs.writeFileSync(f, 'encargo de prueba');
    const inicio = Date.now();
    const { status, v } = b.correr('lanzar', 'sesion-1', f);
    const ms = Date.now() - inicio;
    assert.equal(status, 0, `🔴 ${JSON.stringify(v)}`);
    assert.equal(v.veredicto, 'LANZADA');
    assert.equal(v.sessionId, '11111111-1111-4111-8111-111111111111');
    assert.ok(ms < 8_000, `🔴 tardó ${ms} ms: se quedó esperando los 8 s enteros en vez de re-sondear`);
  } finally { b.limpiar(); }
}, { timeout: 20_000 });

test('SCRUM-1026 · `estado` por EFECTO: una bloqueada sale en `bloqueadas`, aparte de las que trabajan', () => {
  const LISTA = [
    { id: 'bloq0001', name: 'sesion-1', kind: 'background', pid: 111, state: 'blocked', waitingFor: 'permission prompt' },
    { id: 'trab0001', name: 'sesion-2', kind: 'background', pid: 222, status: 'busy', state: 'working' },
  ];
  const b = banco({ secuenciaAgents: [LISTA] });
  try {
    const { status, v } = b.correr('estado');
    assert.equal(status, 0, `🔴 ${JSON.stringify(v)}`);
    assert.equal(v.veredicto, 'ESTADO');
    assert.ok(Array.isArray(v.bloqueadas), '🔴 `estado` no trae `bloqueadas`: sigue habiendo que leer waitingFor fila a fila');
    assert.deepEqual(v.bloqueadas.map((x) => x.id), ['bloq0001']);
    assert.equal(v.bloqueadas[0].waitingFor, 'permission prompt');
    // La que trabaja no sale, y sigue en `sesiones` como siempre (no se ha tocado ese contrato).
    assert.ok(!v.bloqueadas.some((x) => x.id === 'trab0001'));
    assert.deepEqual(v.sesiones.map((a) => a.id).sort(), ['bloq0001', 'trab0001']);
  } finally { b.limpiar(); }
});
