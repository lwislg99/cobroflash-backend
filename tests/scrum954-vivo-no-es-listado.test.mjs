// tests/scrum954-vivo-no-es-listado.test.mjs — SCRUM-954
//
// EL DEFECTO, EN UNA LÍNEA: `claude agents --json` sigue listando trabajos que ya terminaron, y los
// lista como `working`. Con eso, el nombre de un puesto queda QUEMADO: `lanzar` contesta YA-VIVA y
// `relevar` contesta OCUPADA sobre una sesión que lleva días muerta, y el relevo de la A19 —que es
// «parar y volver a lanzar el MISMO nombre»— deja de poder hacerse. No es el caso raro: es la
// operación normal del equipo.
//
// ── LA POBLACIÓN DE ESTE FICHERO ES REAL ─────────────────────────────────────────────────────
// `CAPTURA` de abajo no es un fixture inventado: es la salida LITERAL de `claude agents --json` de
// la máquina de Luis el 20-sep-2026 a las ~13:19Z (CLI 2.1.278), con los seis puestos de la tanda
// vivos y el resto de `sesion-5` (`df2fa38f`) todavía ocupando su nombre. La copia sin tocar está en
// `docs/master/evidencias/scrum954/agents-20sep.json`. Un banco de laboratorio no habría tenido el
// caso: la entrada muerta no tiene NADA que la distinga salvo que le falta el `pid`.
//
// ── EL TELL, Y DE DÓNDE SALE ─────────────────────────────────────────────────────────────────
// De un CONTROL, no de una teoría. Se lanzó una sesión de prueba de verdad y se miró:
//
//     viva  (proceso vivo)  → { pid: 8756, status: 'idle', state: 'done', … }
//     resto (proceso muerto)→ { state: 'working' }            ← sin pid y sin status
//
// O sea que cuando el proceso ya no está, el `state` de la lista no describe nada: se quedó con el
// último que tuvo en vida. Por eso el criterio mira el `pid`, y usa el `state.json` del trabajo sólo
// para PODER VETAR un veredicto de muerte, nunca para dictarlo.
//
// ── LO QUE ESTE FICHERO NO AFIRMA ────────────────────────────────────────────────────────────
// El ticket nació diciendo que al reanudar se perdía el `-n`. MEDIDO el 20-sep sobre 2.1.278, eso NO
// reproduce: `claude --bg --resume <sid>` sin `-n` contesta «woke session … with its saved options
// (-n, --permission-mode)» y la sesión conserva su nombre. La versión donde se midió (2.1.276) ya no
// está instalada y no se puede probar: se declara y no se afirma. Lo que sí se arregla es la regex
// del `backgrounded`, cuyo fallo era del otro lado —una sesión que SÍ arrancó leída como fallo—, y
// que aquí se prueba con las DOS salidas.
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
// ⚠️ Son POCAS a propósito (SCRUM-935): el trabajo del meta-guard tarda ~10 min contra un
// presupuesto de 10 min, así que cada mutación nueva se paga en el CI de todo el mundo.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "  if (typeof agente.pid === 'number' && agente.pid > 0) return { estado: 'VIVA',",
    a: "  if (false) return { estado: 'VIVA',",
    cae: '🔴 el `pid` es lo que dice que una sesión está viva; sin él, una viva se daría por muerta',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: '  if (!job || job.leido !== true) {',
    a: '  if (false) {',
    cae: '🔴 SUELO: sin poder leer el state.json NO se declara muerta a nadie',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "    (c.estado === 'MUERTA' ? restos : cuentan).push",
    a: "    (c.estado !== 'VIVA' ? restos : cuentan).push",
    cae: '🔴 sólo cuenta como resto la que las DOS sondas dan por muerta, no la dudosa',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════════
// La captura real
// ═════════════════════════════════════════════════════════════════════════════════════════════

const CAPTURA = [
  { id: 'df2fa38f', cwd: 'D:\\MILLONARIO\\cobroFlash\\cobroflash-backend', kind: 'background', startedAt: 1789738788767, sessionId: 'df2fa38f-f8b8-482e-a040-22b56ab065e9', name: 'sesion-5', state: 'working' },
  { pid: 5268, id: 'ac89ffa1', cwd: 'D:\\MILLONARIO\\cobroFlash\\cobroflash-backend', kind: 'background', startedAt: 1789909835229, sessionId: 'ac89ffa1-a706-4d36-ab41-87b466dc6fcb', name: 's2b-20', status: 'busy', state: 'working' },
  { pid: 3384, cwd: 'd:\\MILLONARIO\\cobroFlash\\cobroflash-backend', kind: 'interactive', startedAt: 1789909409760, sessionId: '9e884936-8f25-4f3d-ae60-93423c13a5d1', name: 'cobroflash-backend-73', status: 'busy' },
  // La sesión de prueba del PASO 0, tal y como se midió: proceso VIVO y, a la vez, su `state.json`
  // TERMINAL. Una sesión de fondo escribe `done` y `firstTerminalAt` cada vez que acaba un turno,
  // así que el `state.json` por sí solo daría por muerta a media plantilla. Por eso manda el `pid`.
  { pid: 8756, id: '07e54b18', cwd: 'D:\\MILLONARIO\\cobroFlash\\cobroflash-backend', kind: 'background', sessionId: '07e54b18-3eab-4c07-95cd-2400e1cb9818', name: 'prueba-954-20s', status: 'idle', state: 'done' },
];
// Lo que dice el `state.json` de cada uno. Los tres son literales de lo medido el 20-sep.
const JOBS = {
  df2fa38f: { leido: true, terminal: true, cuando: '2026-09-18T13:50:15.562Z', estado: 'done' },
  ac89ffa1: { leido: true, terminal: false, cuando: null, estado: 'working' },
  '07e54b18': { leido: true, terminal: true, cuando: '2026-09-20T13:23:20.652Z', estado: 'done' },
};
const job = (id) => JOBS[id] || { leido: false, motivo: 'no hay state.json en el banco' };
// 🔴 La lista blanca es la de ESE DÍA, con sus nombres mezclados: `sesion-5` del 18-sep y `s2b-20`
// del 20-sep. No es un banco mal montado — es el síntoma del ticket. El orquestador tuvo que
// inventar nombres nuevos para los seis puestos porque los de siempre estaban ocupados.
const EQUIPO = { prefijo: '', puestos: ['orquestador', 'sesion-0', 'sesion-1', 'sesion-2', 'sesion-3', 'sesion-4', 'sesion-5', 's2b-20'], orquestador: 'orquestador' };
const ahora = Date.parse('2026-09-20T13:19:00.000Z');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// El rojo, y su control al lado
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('🔴 ROJO: un trabajo TERMINADO que la lista da por `working` quemaba el nombre del puesto', () => {
  const resto = CAPTURA.find((a) => a.id === 'df2fa38f');
  assert.equal(resto.state, 'working', 'el banco ya no reproduce el defecto: la captura no trae la entrada viva-falsa');
  assert.equal(resto.pid, undefined, 'el banco ya no reproduce el defecto: la entrada muerta trae pid');
  assert.equal(JOBS.df2fa38f.terminal, true);

  // EL MECANISMO VIEJO, escrito aquí tal cual era: «toda entrada con ese nombre está viva».
  const comoAntes = CAPTURA.filter((a) => a && a.name === 'sesion-5');
  assert.equal(comoAntes.length, 1, '🔴 con el criterio viejo, el resto CUENTA como sesión viva');

  // EL NUEVO, con las dos sondas: el resto deja de contar.
  const { cuentan, restos } = s.repartirPorNombre({ nombre: 'sesion-5', agentes: CAPTURA, job });
  assert.equal(cuentan.length, 0, '🔴 el resto sigue contando como viva: el nombre queda quemado');
  assert.equal(restos.length, 1);
  assert.match(restos[0].motivo, /termin/, 'el motivo tiene que decir POR QUÉ se le da por muerta');

  // Y lo que importa de verdad: las tres decisiones dejan de bloquear el puesto.
  assert.equal(s.decidirLanzar({ nombre: 'sesion-5', agentes: CAPTURA, registro: {}, ahora, equipo: EQUIPO, job }).veredicto,
    'NUEVA', '🔴 `lanzar` sigue diciendo YA-VIVA sobre un trabajo terminado hace dos días');
  assert.equal(s.decidirRelevar({ nombre: 'sesion-5', agentes: CAPTURA, traspasoMtime: ahora, ultimoTurno: ahora - 60_000, ahora, equipo: EQUIPO, job }).veredicto,
    'LANZAR', '🔴 `relevar` sigue diciendo OCUPADA: el relevo de la A19 no se puede ejecutar');
  assert.equal(s.decidirParar({ nombre: 'sesion-5', agentes: CAPTURA, equipo: EQUIPO, job }).veredicto,
    'NADA', '🔴 `parar` cree que para algo que ya terminó');
});

test('🔴 CONTROL POSITIVO: una sesión con proceso VIVO sigue bloqueando su puesto', () => {
  // Sin esto, el arreglo de arriba se cumpliría igual declarando a TODO el mundo muerto.
  const l = s.decidirLanzar({ nombre: 's2b-20', agentes: CAPTURA, registro: {}, ahora, equipo: EQUIPO, job });
  assert.equal(l.veredicto, 'YA-VIVA', '🔴 se lanzaría una segunda sesión encima de una que está trabajando');
  assert.equal(l.id, 'ac89ffa1');
  const r = s.decidirRelevar({ nombre: 's2b-20', agentes: CAPTURA, traspasoMtime: ahora, ultimoTurno: ahora - 60_000, ahora, equipo: EQUIPO, job });
  assert.equal(r.veredicto, 'OCUPADA', '🔴 se pararía a una sesión a mitad de su entrega');
  assert.equal(s.decidirParar({ nombre: 's2b-20', agentes: CAPTURA, equipo: EQUIPO, job }).veredicto, 'PARAR');
});

test('🔴 EL CASO PELIGROSO: proceso VIVO con el `state.json` ya TERMINAL manda el `pid`', () => {
  // Es el caso medido, no uno inventado: entre turno y turno, una sesión de fondo VIVA escribe
  // `state: "done"` y `firstTerminalAt` en su `state.json`. Si el criterio fuera el `state.json`,
  // media plantilla saldría «muerta» y `olvidar` borraría conversaciones de gente trabajando.
  const viva = CAPTURA.find((a) => a.id === '07e54b18');
  assert.equal(viva.pid > 0, true);
  assert.equal(JOBS['07e54b18'].terminal, true, 'el banco ya no reproduce el caso: su state.json no es terminal');
  const c = s.clasificarAgente(viva, job('07e54b18'));
  assert.equal(c.estado, 'VIVA', '🔴 una sesión con su proceso vivo se está dando por muerta');
  assert.match(c.motivo, /pid 8756/, 'el motivo tiene que decir POR QUÉ se la da por viva');

  const equipo = { ...EQUIPO, puestos: [...EQUIPO.puestos, 'prueba-954-20s'] };
  assert.equal(s.decidirOlvidar({ nombre: 'prueba-954-20s', agentes: CAPTURA, equipo, job }).veredicto,
    'ESTA-VIVA', '🔴 `olvidar` borraría la conversación de una sesión con el proceso vivo');
  assert.equal(s.decidirLanzar({ nombre: 'prueba-954-20s', agentes: CAPTURA, registro: {}, ahora, equipo, job }).veredicto,
    'YA-VIVA', '🔴 se lanzaría una segunda sesión encima de ella');
});

test('🔴 SUELO: la duda NO mata — sin `state.json` legible, la entrada cuenta como viva', () => {
  const huerfana = [{ id: 'eeeeeeee', name: 'sesion-3', kind: 'background', state: 'working' }];
  // `job` no sabe nada de ella: es justo el caso de un `~/.claude/jobs/<id>` borrado.
  assert.equal(s.clasificarAgente(huerfana[0], job('eeeeeeee')).estado, 'NO-PUDE-MIRAR');
  assert.equal(s.decidirLanzar({ nombre: 'sesion-3', agentes: huerfana, registro: {}, ahora, equipo: EQUIPO, job }).veredicto,
    'YA-VIVA', '🔴 una entrada que no se puede juzgar se estaría dando por muerta');

  // Y el otro suelo: el state.json se lee, pero NO dice que haya terminado.
  const viva = { leido: true, terminal: false, cuando: null, estado: 'working' };
  assert.equal(s.clasificarAgente(huerfana[0], viva).estado, 'NO-PUDE-MIRAR');

  // Sin `job` NINGUNO —una llamada que no pasa la sonda— el comportamiento es el de antes de 954.
  assert.equal(s.decidirLanzar({ nombre: 'sesion-5', agentes: CAPTURA, registro: {}, ahora, equipo: EQUIPO }).veredicto,
    'YA-VIVA', '🔴 sin la sonda, el criterio tiene que ser el CONSERVADOR, no el nuevo');
});

test('`lanzar` no reanuda NUNCA, tenga la caché caliente o fría (A19)', () => {
  const reciente = { 'sesion-4': { sessionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', ultimaTanda: ahora - 5 * 60 * 1000 } };
  const d = s.decidirLanzar({ nombre: 'sesion-4', agentes: CAPTURA, registro: reciente, ahora, equipo: EQUIPO, job });
  assert.equal(d.veredicto, 'NUEVA');
  assert.equal(d.sessionId, undefined, '🔴 vuelve a haber un camino que reanuda y arrastra el contexto entero');
  assert.match(d.motivo, /A19/);
});

test('la regex del `backgrounded` casa con las DOS salidas reales de `claude --bg`', () => {
  // Las dos están medidas el 20-sep-2026 sobre la sesión de prueba `prueba-954-20s` (id 07e54b18).
  const conNombre = 'backgrounded · 07e54b18 · prueba-954-20s\n  claude agents             list sessions\n';
  const sinNombre = 'backgrounded · 1e9519e3\n  claude attach 1e9519e3\n';
  const RE = /backgrounded · ([0-9a-f]{8})(?: · |\s|$)/;
  assert.equal(RE.exec(conNombre)?.[1], '07e54b18');
  assert.equal(RE.exec(sinNombre)?.[1], '1e9519e3', '🔴 una sesión que SÍ arrancó se leería como «claude no confirmó»');
  // CONTROL: la regex vieja es la que no casaba. Si esto deja de ser cierto, el caso ya no mide nada.
  assert.equal(/backgrounded · ([0-9a-f]{8}) · /.test(sinNombre), false,
    '🔴 CIEGO: la regex vieja casa, así que este caso no demuestra que la nueva arregle nada');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// `olvidar`: el acto irreversible, y todo lo que hace para no serlo
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('🔴 `olvidar` NO borra: ni una viva, ni una dudosa, ni cuando no hay nada', () => {
  assert.equal(s.decidirOlvidar({ nombre: 's2b-20', agentes: CAPTURA, equipo: EQUIPO, job }).veredicto,
    'ESTA-VIVA', '🔴 borraría la conversación de una sesión que está trabajando');
  assert.equal(s.decidirOlvidar({ nombre: 'sesion-3', agentes: CAPTURA, equipo: EQUIPO, job }).veredicto, 'NADA');
  // Dudosa: sin state.json no se puede jurar que esté muerta, así que no se toca.
  const dudosa = [{ id: 'eeeeeeee', name: 'sesion-3', kind: 'background', state: 'working' }];
  assert.equal(s.decidirOlvidar({ nombre: 'sesion-3', agentes: dudosa, equipo: EQUIPO, job }).veredicto, 'ESTA-VIVA');
  // Y un resto sin id legible tampoco: no se borra «lo que sea que fuera eso».
  const sinId = [{ name: 'sesion-5', kind: 'background', state: 'working' }];
  assert.equal(s.decidirOlvidar({ nombre: 'sesion-5', agentes: sinId, equipo: EQUIPO, job: () => ({ leido: true, terminal: true }) }).veredicto,
    'NO-PUDE-MIRAR');
  assert.equal(s.decidirOlvidar({ nombre: 'control-954', agentes: CAPTURA, equipo: EQUIPO, job }).veredicto, 'NOMBRE-NO-PERMITIDO');
});

test('🔴 POSITIVO: `olvidar` sí borra el resto, y sólo ese', () => {
  const d = s.decidirOlvidar({ nombre: 'sesion-5', agentes: CAPTURA, equipo: EQUIPO, job });
  assert.equal(d.veredicto, 'OLVIDAR');
  assert.deepEqual(d.ids, ['df2fa38f']);
  assert.equal(d.restos.length, 1);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// La CLI, por EFECTO: qué llamadas recibe `claude` y qué imprime `estado`
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Una instalación de verdad (la puerta exige que sea idéntica a `origin/main` y fuera de un árbol). */
function banco(agentes) {
  const dir = temporal('scrum954-');
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

  // 🔴 El banco trae SU PROPIA carpeta de trabajos: un laboratorio que le presta su entorno al
  // sujeto mide la suma de los dos, y aquí el sujeto leería los jobs REALES de esta máquina.
  const jobs = path.join(dir, 'jobs');
  for (const a of agentes) {
    if (!a.id || !a._state) continue;
    fs.mkdirSync(path.join(jobs, a.id), { recursive: true });
    fs.writeFileSync(path.join(jobs, a.id, 'state.json'), JSON.stringify(a._state));
  }

  const llamadas = path.join(dir, 'llamadas.txt');
  const falso = path.join(dir, 'claude-falso.mjs');
  const limpios = agentes.map(({ _state, ...a }) => a);
  fs.writeFileSync(falso, [
    "import fs from 'node:fs';",
    `const LL = ${JSON.stringify(llamadas)};`,
    'const args = process.argv.slice(2);',
    "fs.appendFileSync(LL, JSON.stringify(args) + '\\n');",
    `if (args[0] === 'agents') { process.stdout.write(${JSON.stringify(JSON.stringify(limpios))}); process.exit(0); }`,
    'process.exit(0);',
  ].join('\n'));

  const memoria = path.join(dir, 'memoria');
  fs.mkdirSync(memoria);
  fs.writeFileSync(path.join(inst, 'config.json'), JSON.stringify({
    repo, claude: [process.execPath, falso], jobs,
    prefijo: '', puestos: EQUIPO.puestos, orquestador: 'orquestador', traspasos: memoria,
  }));

  const correr = (...a) => {
    const p = spawnSync(process.execPath, [path.join(inst, 'sesion.mjs'), ...a], { encoding: 'utf8' });
    let v = null;
    try { v = JSON.parse((p.stdout || '').trim().split('\n').at(-1)); } catch { /* sin veredicto */ }
    return { status: p.status, v };
  };
  const leerLlamadas = () => (fs.existsSync(llamadas) ? fs.readFileSync(llamadas, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { dir, correr, leerLlamadas, limpiar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const CON_ESTADO = [
  { ...CAPTURA[0], _state: { state: 'done', firstTerminalAt: '2026-09-18T13:50:15.562Z' } },
  { ...CAPTURA[1], _state: { state: 'working' } },
  { pid: 8756, id: '07e54b18', cwd: 'D:\\x', kind: 'background', sessionId: '07e54b18-3eab-4c07-95cd-2400e1cb9818', name: 'prueba-954-20s', status: 'idle', state: 'done', _state: { state: 'done', firstTerminalAt: '2026-09-20T13:23:20.652Z' } },
  { id: 'dddddddd', cwd: 'D:\\y', kind: 'background', sessionId: 'dddddddd-0000-4000-8000-000000000000', state: 'working' },
];

test('🔴 `estado` enseña los RESTOS y las sesiones de fondo que no son del equipo (puntos 2 y 3 del ticket)', () => {
  const b = banco(CON_ESTADO);
  try {
    const { status, v } = b.correr('estado');
    assert.equal(status, 0, `🔴 la puerta rechazó la instalación del banco: ${JSON.stringify(v)}`);
    assert.equal(v.veredicto, 'ESTADO');
    assert.deepEqual(v.sesiones.map((a) => a.name).sort(), ['s2b-20', 'sesion-5'], 'la lista de siempre no cambia');
    assert.deepEqual(v.restos.map((a) => a.id), ['df2fa38f'], '🔴 el trabajo terminado que ocupa un nombre del equipo no sale por ningún lado');
    const otras = v.otras.map((a) => a.id).sort();
    assert.deepEqual(otras, ['07e54b18', 'dddddddd'],
      '🔴 una sesión de fondo SIN nombre desaparece del radar del orquestador: es el punto 2 del ticket');
    const sinNombre = v.otras.find((a) => a.id === 'dddddddd');
    assert.equal(sinNombre.nombre, null);
    assert.equal(sinNombre.clasificacion, 'NO-PUDE-MIRAR', 'sin state.json en el banco, la duda NO la mata');
    // Por CLASIFICACIÓN, no por una subcadena del motivo: «sin pid» también casa con /pid/, y una
    // aserción así habría pasado con el criterio invertido. (Pasó: el mutante 1 sobrevivió a ella.)
    const pruebaViva = v.otras.find((a) => a.id === '07e54b18');
    assert.equal(pruebaViva.clasificacion, 'VIVA', '🔴 una sesión con proceso vivo sale como resto');
    assert.equal(pruebaViva.pid, 8756);
  } finally { b.limpiar(); }
});

test('🔴 `olvidar` por EFECTO: llama a `claude rm` con el resto y con NADIE más', () => {
  const b = banco(CON_ESTADO);
  try {
    const { status, v } = b.correr('olvidar', 'sesion-5');
    assert.equal(status, 0, `🔴 ${JSON.stringify(v)}`);
    assert.equal(v.veredicto, 'OLVIDADOS');
    const rm = b.leerLlamadas().filter((a) => a[0] === 'rm');
    assert.deepEqual(rm, [['rm', 'df2fa38f']], '🔴 `olvidar` borra algo que no es el resto, o no borra nada');
  } finally { b.limpiar(); }
});

test('🔴 `olvidar` sobre un puesto VIVO no llama a `rm` ni una vez', () => {
  const b = banco(CON_ESTADO);
  try {
    const { status, v } = b.correr('olvidar', 's2b-20');
    assert.equal(v.veredicto, 'ESTA-VIVA');
    assert.equal(status, 1, 'un «no se ha hecho nada» que sale 0 se lee como un éxito');
    assert.deepEqual(b.leerLlamadas().filter((a) => a[0] === 'rm'), [],
      '🔴 se borró la conversación de una sesión que estaba trabajando');
  } finally { b.limpiar(); }
});

test('la ayuda dice cómo se limpia un nombre ocupado (punto 3 del ticket)', () => {
  const b = banco(CON_ESTADO);
  try {
    const { status, v } = b.correr('lo-que-sea');
    assert.equal(status, 1);
    assert.equal(v.veredicto, 'ACCION-DESCONOCIDA');
    assert.match(v.motivo, /olvidar nombre/, '🔴 `olvidar` no sale en el uso: nadie va a descubrirlo');
    assert.match(v.ayuda, /restos/);
  } finally { b.limpiar(); }
});
