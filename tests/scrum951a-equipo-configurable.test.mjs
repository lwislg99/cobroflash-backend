// tests/scrum951a-equipo-configurable.test.mjs — SCRUM-951a · el equipo sale del config, no del código
//
// El lanzador de sesiones (SCRUM-899) nació atado a UNA máquina y UN equipo: los nombres
// `orquestador|sesion-[0-5]` escritos en una regex, las horas de las tandas en una constante y la
// carpeta de los traspasos sin escribir. Para que Javier monte el mismo sistema en su máquina, todo
// eso pasa a `config.json`, que escribe el instalador y valida la puerta de `sesion.mjs`.
//
// Lo que este fichero fija, y cómo:
//   · A2 — el instalador GRABA la carpeta de los traspasos, y una config sin ella NO actúa. Antes,
//     sin `traspasos`, la ruta salía relativa y `relevar` decía SIN-TRASPASO para siempre: un
//     «no» seguro, pero que se lee exactamente igual que «la sesión no ha escrito su traspaso».
//   · El PREFIJO del equipo: se declara siempre (vacío para el equipo de Luis), y la lista blanca
//     es prefijo + puesto. Se prueba EJECUTANDO la copia instalada con un `claude` falso.
//   · Los veredictos se miden por EFECTO: qué llamadas recibió `claude`, no qué dice un log.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SESION = path.join(RAIZ, 'scripts', 'equipo', 'sesion.mjs');
const ARRANQUE = path.join(RAIZ, 'scripts', 'equipo', 'orquestador-arranque.mjs');
const INSTALAR = path.join(RAIZ, 'scripts', 'equipo', 'instalar.mjs');
const s = await import(pathToFileURL(SESION).href);
const instalar = await import(pathToFileURL(INSTALAR).href);

// El rojo de cada pieza, declarado: lo ejecuta `npm run meta:mutaciones`. El `cae` es un trozo
// LITERAL del nombre del test que tiene que caer: una paráfrasis dejaría la mutación ciega.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "  if (typeof config.traspasos !== 'string' || !config.traspasos) {",
    a: '  if (false) {',
    cae: '🔴 A2 · sin `traspasos` en config.json, sesion.mjs dice NO-PUDE-MIRAR',
  },
  {
    fichero: 'scripts/equipo/instalar.mjs',
    de: '  const config = { repo, claude, prefijo, puestos, orquestador, tandas, prompt, traspasos };',
    a: '  const config = { repo, claude, prefijo, puestos, orquestador, tandas, prompt };',
    cae: '🔴 A2 · el instalador graba en config.json la carpeta de los traspasos',
  },
  {
    fichero: 'scripts/equipo/instalar.mjs',
    de: '  if (!fs.existsSync(traspasos)) {',
    a: '  if (false) {',
    cae: '🔴 el instalador se NIEGA si la carpeta de los traspasos no existe',
  },
  {
    fichero: 'scripts/equipo/instalar.mjs',
    de: '  if (conPrefijo === sinPrefijo) fallar(',
    a: '  if (false) fallar(',
    cae: '🔴 el prefijo se DECLARA',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "  if (typeof prefijo !== 'string') return no(",
    a: '  if (false) return no(',
    cae: '🔴 una config de equipo inválida no actúa',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: 'sesiones: agentes.filter((a) => validarNombre(a.name, equipo) === null)',
    a: 'sesiones: agentes.filter((a) => validarNombre(a.name) === null)',
    cae: '🔴 con prefijo, `estado` solo lista las sesiones de SU equipo',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    // SCRUM-954: la linea gano el argumento `job` (el state.json de cada trabajo). El ancla se
    // re-ancla; lo que la mutacion quita sigue siendo `equipo`, y sigue teniendo que matar.
    de: 'const d = decidirLanzar({ nombre, agentes: leerAgentes(config), registro, ahora: Date.now(), equipo, job: (id) => estadoDeJob(config, id) });',
    a: 'const d = decidirLanzar({ nombre, agentes: leerAgentes(config), registro, ahora: Date.now(), job: (id) => estadoDeJob(config, id) });',
    cae: '🔴 con prefijo, `lanzar` rechaza un nombre del OTRO equipo',
  },
  {
    fichero: 'scripts/equipo/orquestador-arranque.mjs',
    de: 'return { ok: true, nombre: `${config.prefijo}${config.orquestador}` };',
    a: "return { ok: true, nombre: 'orquestador' };",
    cae: '🔴 la tanda lanza al orquestador DEL CONFIG, con su prefijo',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: 'const fichero = n ? `project_s${n[1]}_traspaso.md` : `project_${puesto}_traspaso.md`;',
    a: "const fichero = n ? `project_s${n[1]}_traspaso.md` : 'project_traspaso.md';",
    cae: '🔴 rutaDelTraspaso: sesion-N → project_sN, cualquier otro puesto → project_<puesto>',
  },
  {
    fichero: 'scripts/equipo/comprobar-instalacion.mjs',
    de: "  if (comprobaciones.some((c) => c.veredicto === 'NO-PUDE-MIRAR')) return { codigo: 2, veredicto: 'NO-PUDE-MIRAR' };\n",
    a: '',
    cae: 'veredicto global: NO-PUDE-MIRAR gana a FALLA',
  },
  {
    fichero: 'scripts/equipo/comprobar-instalacion.mjs',
    de: "if (estado.status === 0 && ve?.veredicto === 'ESTADO') poner(",
    a: 'if (true) poner(',
    cae: '🔴 ROJO: con la copia instalada de sesion.mjs TOCADA, la lista da FALLA',
  },
];

const UUID = '1234abcd-0000-4000-8000-00000000abcd';
const PROMPT = 'Prompt de tanda del banco de SCRUM-951a.';
const PUESTOS_DE_LUIS = ['orquestador', 'sesion-0', 'sesion-1', 'sesion-2', 'sesion-3', 'sesion-4', 'sesion-5'];
const EQUIPO_JV = { prefijo: 'jv-', puestos: ['jefe', 's1'], orquestador: 'jefe' };

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Banco: repositorio con origin/main, copia instalada y un `claude` falso con estado
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * @param {object} o
 * @param {object|null} o.equipo  campos del equipo que van al config (`null` = config sin ellos)
 * @param {boolean} o.conTraspasos si el config lleva la carpeta de los traspasos
 * @param {object[]} o.vivas       lo que contesta `claude agents --json` al empezar
 */
function banco({ equipo = { prefijo: '', puestos: PUESTOS_DE_LUIS, orquestador: 'orquestador' }, conTraspasos = true, vivas = [] } = {}) {
  const dir = temporal('scrum951a-');
  const git = (cwd, ...a) => execFileSync('git', ['-c', 'core.autocrlf=false', '-C', cwd, ...a], { encoding: 'utf8' });

  const repo = path.join(dir, 'repo');
  execFileSync('git', ['init', '-q', repo]);
  fs.mkdirSync(path.join(repo, 'scripts', 'equipo'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs', 'equipo'), { recursive: true });
  fs.copyFileSync(SESION, path.join(repo, 'scripts', 'equipo', 'sesion.mjs'));
  fs.copyFileSync(ARRANQUE, path.join(repo, 'scripts', 'equipo', 'orquestador-arranque.mjs'));
  fs.copyFileSync(path.join(RAIZ, 'scripts', 'equipo', 'uso.mjs'), path.join(repo, 'scripts', 'equipo', 'uso.mjs'));
  fs.copyFileSync(path.join(RAIZ, 'scripts', 'equipo', 'huerfanos.mjs'), path.join(repo, 'scripts', 'equipo', 'huerfanos.mjs'));
  fs.writeFileSync(path.join(repo, 'docs', 'equipo', 'prompt-tanda-orquestador.md'), PROMPT);
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=banco', '-c', 'user.email=banco@x', 'commit', '-q', '-m', 'banco');
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');

  // La instalación, como la hace `arranque.cmd`: `git show origin/main:<fichero>`, fuera del árbol.
  const inst = path.join(dir, 'instalacion');
  fs.mkdirSync(inst);
  for (const [enRepo, instalado] of [
    ['scripts/equipo/sesion.mjs', 'sesion.mjs'],
    ['scripts/equipo/orquestador-arranque.mjs', 'orquestador-arranque.mjs'],
    ['docs/equipo/prompt-tanda-orquestador.md', 'prompt-tanda.md'],
  ]) {
    fs.writeFileSync(path.join(inst, instalado), execFileSync('git', ['-C', repo, 'show', `origin/main:${enRepo}`]));
  }

  const memoria = path.join(dir, 'memoria');
  fs.mkdirSync(memoria);

  // `claude` falso con estado: cada llamada queda en llamadas.txt; `--bg` registra una sesión viva.
  const llamadas = path.join(dir, 'llamadas.txt');
  const fVivas = path.join(dir, 'vivas.json');
  fs.writeFileSync(fVivas, JSON.stringify(vivas));
  const falso = path.join(dir, 'claude-falso.mjs');
  fs.writeFileSync(falso, [
    "import fs from 'node:fs';",
    `const LL = ${JSON.stringify(llamadas)}, V = ${JSON.stringify(fVivas)};`,
    'const args = process.argv.slice(2);',
    "fs.appendFileSync(LL, JSON.stringify(args) + '\\n');",
    "const vivas = JSON.parse(fs.readFileSync(V, 'utf8'));",
    "if (args[0] === 'agents') { process.stdout.write(JSON.stringify(vivas)); process.exit(0); }",
    "if (args[0] === '--version') { process.stdout.write('2.1.276 (Claude Code, falso del banco)\\n'); process.exit(0); }",
    "if (args[0] === '--bg') {",
    "  const nombre = args[args.indexOf('-n') + 1];",
    `  vivas.push({ id: '1234abcd', name: nombre, kind: 'background', state: 'working', sessionId: ${JSON.stringify(UUID)} });`,
    '  fs.writeFileSync(V, JSON.stringify(vivas));',
    "  process.stdout.write('Starting background service…\\nbackgrounded · 1234abcd · ' + nombre + '\\n');",
    '  process.exit(0);',
    '}',
    'process.exit(1);',
  ].join('\n'));

  // SCRUM-954: `jobs` propio — sin él, la CLI leería los trabajos REALES de la máquina.
  const config = { repo, claude: [process.execPath, falso], jobs: path.join(dir, 'jobs'), ...(equipo || {}) };
  if (conTraspasos) config.traspasos = memoria;
  fs.writeFileSync(path.join(inst, 'config.json'), JSON.stringify(config));

  const leerLlamadas = () => (fs.existsSync(llamadas)
    ? fs.readFileSync(llamadas, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : []);
  const correr = (script, ...args) => {
    const r = spawnSync(process.execPath, [path.join(inst, script), ...args], { encoding: 'utf8' });
    let v = null;
    try { v = JSON.parse((r.stdout || '').trim().split('\n').at(-1)); } catch { /* sin veredicto */ }
    return { status: r.status, v };
  };
  // Toda escritura de los tests pasa por aquí, colgando de `dir` (que es `temporal()`): así el censo de
  // SCRUM-824 ve de dónde sale cada fichero, en vez de un `b.dir` que no puede seguir.
  const escribir = (rel, contenido) => { const f = path.join(dir, rel); fs.writeFileSync(f, contenido); return f; };
  const anadir = (rel, contenido) => fs.appendFileSync(path.join(dir, rel), contenido);
  return { dir, repo, inst, memoria, leerLlamadas, correr, escribir, anadir, limpiar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const lanzamientos = (llamadas) => llamadas.filter((a) => a[0] === '--bg');

function correrInstalar(args) {
  const r = spawnSync(process.execPath, [INSTALAR, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// A2 · la carpeta de los traspasos
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('🔴 A2 · el instalador graba en config.json la carpeta de los traspasos y el equipo entero', () => {
  const b = banco();
  try {
    const destino = path.join(b.dir, 'inst-nueva');
    const memoria = b.memoria;
    const r = correrInstalar([
      '--destino', destino, '--repo', b.repo, '--claude', 'C:/claude.exe',
      '--sin-prefijo', '--puestos', PUESTOS_DE_LUIS.join(','), '--orquestador', 'orquestador',
      '--tandas', '08:00,13:05,18:10', '--prompt', 'docs/equipo/prompt-tanda-orquestador.md',
      '--traspasos', memoria,
    ]);
    assert.equal(r.status, 0, `🔴 el instalador falló: ${r.stderr}${r.stdout}`);
    const config = JSON.parse(fs.readFileSync(path.join(destino, 'config.json'), 'utf8'));
    assert.equal(config.traspasos, memoria,
      '🔴 config.json sin la carpeta de los traspasos: `relevar` diría SIN-TRASPASO para siempre');
    assert.equal(config.prefijo, '', '🔴 el prefijo no se declara: «vacío» y «olvidado» se leerían igual');
    assert.deepEqual(config.puestos, PUESTOS_DE_LUIS);
    assert.equal(config.orquestador, 'orquestador');
    assert.deepEqual(config.tandas, ['08:00', '13:05', '18:10']);
    assert.equal(config.prompt, 'docs/equipo/prompt-tanda-orquestador.md');

    // Y la instalación queda LISTA desde el primer minuto: las copias son las de origin/main.
    for (const [enRepo, instalado] of instalar.copias(config.prompt)) {
      assert.ok(execFileSync('git', ['-C', b.repo, 'show', `origin/main:${enRepo}`]).equals(fs.readFileSync(path.join(destino, instalado))),
        `🔴 ${instalado} no es la copia de origin/main:${enRepo}`);
    }
    const salida = JSON.parse(r.stdout);
    assert.equal(salida.settings.statusLine.command, `node ${destino.replace(/\\/g, '/')}/uso.mjs escribir`,
      '🔴 la línea del statusLine no apunta al uso.mjs de ESTA instalación');
  } finally { b.limpiar(); }
});

test('🔴 A2 · sin `traspasos` en config.json, sesion.mjs dice NO-PUDE-MIRAR y no llama a claude', () => {
  const b = banco({ conTraspasos: false });
  try {
    const r = b.correr('sesion.mjs', 'estado');
    assert.equal(r.v?.veredicto, 'NO-PUDE-MIRAR',
      `🔴 actúa con una config sin traspasos: su «SIN-TRASPASO» sería un instrumento ciego (${JSON.stringify(r.v)})`);
    assert.deepEqual(b.leerLlamadas(), [], '🔴 con la config incompleta llegó a llamar a claude');
  } finally { b.limpiar(); }
});

test('CONTROL del banco: la misma instalación CON traspasos sí actúa', () => {
  // Sin esto, el NO-PUDE-MIRAR de arriba podría venir de un banco roto y no de la puerta.
  const b = banco();
  try {
    const r = b.correr('sesion.mjs', 'estado');
    assert.equal(r.v?.veredicto, 'ESTADO', `🔴 NO PUDE MIRAR: el banco bueno no actúa (${JSON.stringify(r.v)})`);
    assert.ok(b.leerLlamadas().length > 0, '🔴 NO PUDE MIRAR: el banco bueno no llamó a claude');
  } finally { b.limpiar(); }
});

test('la carpeta de memoria se CALCULA desde el repo como la nombra Claude Code', () => {
  // Medido el 18-sep-2026 en ~/.claude/projects: cada carácter que no es letra ni número pasa a `-`.
  const p = path.join('/proyectos');
  assert.equal(instalar.carpetaDeMemoria('D:\\MILLONARIO\\cobroFlash\\cobroflash-backend', p),
    path.join(p, 'D--MILLONARIO-cobroFlash-cobroflash-backend', 'memory'));
  assert.equal(instalar.carpetaDeMemoria('D:/MILLONARIO/cobroFlash/cobroflash-backend/.claude/worktrees/x_y', p),
    path.join(p, 'D--MILLONARIO-cobroFlash-cobroflash-backend--claude-worktrees-x-y', 'memory'));
});

test('🔴 el instalador se NIEGA si la carpeta de los traspasos no existe, y no escribe nada', () => {
  const b = banco();
  try {
    const destino = path.join(b.dir, 'inst-nueva');
    const r = correrInstalar([
      '--destino', destino, '--repo', b.repo, '--claude', 'C:/claude.exe',
      '--sin-prefijo', '--puestos', 'orquestador', '--orquestador', 'orquestador',
      '--tandas', '08:00', '--prompt', 'docs/equipo/prompt-tanda-orquestador.md',
      '--traspasos', path.join(b.dir, 'no-existe'),
    ]);
    assert.notEqual(r.status, 0, '🔴 instala apuntando a una carpeta de traspasos que no existe');
    assert.equal(fs.existsSync(destino), false, '🔴 dejó una instalación a medias');
  } finally { b.limpiar(); }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// El prefijo y los puestos
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('🔴 el prefijo se DECLARA: el instalador exige --prefijo o --sin-prefijo, y no los dos', () => {
  const b = banco();
  const dir = b.dir;
  try {
    const base = ['--repo', b.repo, '--claude', 'C:/claude.exe', '--puestos', 'orquestador', '--orquestador', 'orquestador',
      '--tandas', '08:00', '--prompt', 'docs/equipo/prompt-tanda-orquestador.md', '--traspasos', b.memoria];
    const ninguno = correrInstalar(['--destino', path.join(dir, 'a'), ...base]);
    assert.notEqual(ninguno.status, 0, '🔴 instala sin declarar el prefijo');
    assert.equal(fs.existsSync(path.join(dir, 'a', 'config.json')), false);
    const ambos = correrInstalar(['--destino', path.join(dir, 'b'), ...base, '--prefijo', 'jv-', '--sin-prefijo']);
    assert.notEqual(ambos.status, 0, '🔴 acepta --prefijo y --sin-prefijo a la vez');
    const bueno = correrInstalar(['--destino', path.join(dir, 'c'), ...base, '--prefijo', 'jv-']);
    assert.equal(bueno.status, 0, `CONTROL: con el prefijo declarado sí instala (${bueno.stderr})`);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'c', 'config.json'), 'utf8')).prefijo, 'jv-');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('🔴 una config de equipo inválida no actúa: NO-PUDE-MIRAR y ninguna llamada a claude', () => {
  const malos = {
    'sin prefijo': { puestos: ['jefe'], orquestador: 'jefe' },
    'prefijo con mayúsculas': { prefijo: 'JV-', puestos: ['jefe'], orquestador: 'jefe' },
    'sin puestos': { prefijo: 'jv-', puestos: [], orquestador: 'jefe' },
    'puesto con espacio': { prefijo: 'jv-', puestos: ['jefe', 'sesion 1'], orquestador: 'jefe' },
    'puestos repetidos': { prefijo: 'jv-', puestos: ['jefe', 'jefe'], orquestador: 'jefe' },
    'orquestador fuera de los puestos': { prefijo: 'jv-', puestos: ['s1'], orquestador: 'jefe' },
  };
  for (const [caso, equipo] of Object.entries(malos)) {
    const b = banco({ equipo });
    try {
      const r = b.correr('sesion.mjs', 'estado');
      assert.equal(r.v?.veredicto, 'NO-PUDE-MIRAR', `🔴 ${caso}: actúa igual (${JSON.stringify(r.v)})`);
      assert.deepEqual(b.leerLlamadas(), [], `🔴 ${caso}: llegó a llamar a claude`);
    } finally { b.limpiar(); }
  }
});

test('🔴 con prefijo, `estado` solo lista las sesiones de SU equipo', () => {
  const vivas = ['jv-jefe', 'orquestador', 'jv-s1', 'sesion-2b', 'jv-otro'].map((name, i) => (
    { id: `0000000${i}`, name, kind: 'background', state: 'idle' }));
  const b = banco({ equipo: EQUIPO_JV, vivas });
  try {
    const r = b.correr('sesion.mjs', 'estado');
    assert.equal(r.v?.veredicto, 'ESTADO', `🔴 ${JSON.stringify(r.v)}`);
    assert.deepEqual(r.v.sesiones.map((a) => a.name), ['jv-jefe', 'jv-s1'],
      '🔴 `estado` mezcla sesiones de otro equipo, o pierde las del suyo');
  } finally { b.limpiar(); }
});

test('🔴 con prefijo, `lanzar` rechaza un nombre del OTRO equipo y lanza el suyo con el nombre completo', () => {
  const b = banco({ equipo: EQUIPO_JV });
  try {
    const promptF = b.escribir('encargo.md', 'encargo');
    const ajeno = b.correr('sesion.mjs', 'lanzar', 'orquestador', promptF);
    assert.equal(ajeno.v?.veredicto, 'NOMBRE-NO-PERMITIDO', `🔴 lanza una sesión con el nombre del otro equipo: ${JSON.stringify(ajeno.v)}`);
    assert.deepEqual(lanzamientos(b.leerLlamadas()), [], '🔴 llegó a lanzar con un nombre ajeno');
    const suyo = b.correr('sesion.mjs', 'lanzar', 'jv-s1', promptF);
    assert.equal(suyo.v?.veredicto, 'LANZADA', `🔴 no lanza una sesión de su propio equipo: ${JSON.stringify(suyo.v)}`);
    assert.deepEqual(lanzamientos(b.leerLlamadas())[0], ['--bg', '-n', 'jv-s1', '--permission-mode', 'auto', 'encargo']);
  } finally { b.limpiar(); }
});

test('el equipo de Luis, sin prefijo, conserva los nombres de hoy; un puesto no declarado no entra', () => {
  const luis = { prefijo: '', puestos: PUESTOS_DE_LUIS, orquestador: 'orquestador' };
  for (const bueno of PUESTOS_DE_LUIS) assert.equal(s.validarNombre(bueno, luis), null, `🔴 rechaza «${bueno}»`);
  // `sesion-2b` corría el 18-sep-2026 y la regex de antes la habría rechazado: se declara o no entra.
  assert.equal(s.validarNombre('sesion-2b', luis)?.veredicto, 'NOMBRE-NO-PERMITIDO');
  assert.equal(s.validarNombre('sesion-2b', { ...luis, puestos: [...PUESTOS_DE_LUIS, 'sesion-2b'] }), null,
    'CONTROL: declarado en los puestos, entra');
  assert.equal(s.validarNombre('jefe', EQUIPO_JV)?.veredicto, 'NOMBRE-NO-PERMITIDO', '🔴 acepta el puesto sin su prefijo');
});

test('🔴 la tanda lanza al orquestador DEL CONFIG, con su prefijo', () => {
  const b = banco({ equipo: EQUIPO_JV });
  try {
    const r = b.correr('orquestador-arranque.mjs');
    assert.equal(r.v?.tanda?.veredicto, 'LANZADA', `🔴 la tanda no lanzó: ${JSON.stringify(r.v)}`);
    assert.deepEqual(lanzamientos(b.leerLlamadas())[0], ['--bg', '-n', 'jv-jefe', '--permission-mode', 'auto', PROMPT],
      '🔴 la tanda lanza un nombre fijo en el código en vez del orquestador de su equipo');
  } finally { b.limpiar(); }
});

test('🔴 rutaDelTraspaso: sesion-N → project_sN, cualquier otro puesto → project_<puesto>, sin el prefijo', () => {
  const config = { traspasos: path.join('/memoria'), prefijo: 'jv-' };
  assert.equal(s.rutaDelTraspaso(config, 'jv-jefe'), path.join('/memoria', 'project_jefe_traspaso.md'));
  assert.equal(s.rutaDelTraspaso(config, 'jv-sesion-3'), path.join('/memoria', 'project_s3_traspaso.md'));
  assert.equal(s.rutaDelTraspaso({ traspasos: path.join('/memoria'), prefijo: '' }, 'orquestador'),
    path.join('/memoria', 'project_orquestador_traspaso.md'));
});

test('las órdenes de schtasks salen de las tandas del config, con el prefijo en el nombre de la tarea', () => {
  const destino = 'C:/Users/X/AppData/Local/yaqu-equipo';
  assert.deepEqual(instalar.ordenesSchtasks({ destino, tandas: ['07:30'], prefijo: 'jv-' }), [
    'MSYS_NO_PATHCONV=1 schtasks /create /sc daily /tn yaqu-equipo-jv-0730 /st 07:30 /tr "C:\\Users\\X\\AppData\\Local\\yaqu-equipo\\arranque.cmd"',
  ]);
  assert.deepEqual(instalar.ordenesSchtasks({ destino, tandas: ['08:00'], prefijo: '' }), [
    'MSYS_NO_PATHCONV=1 schtasks /create /sc daily /tn yaqu-equipo-0800 /st 08:00 /tr "C:\\Users\\X\\AppData\\Local\\yaqu-equipo\\arranque.cmd"',
  ], 'el equipo de Luis conserva los nombres de tarea de la guía');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// La lista de verificación ejecutable (`comprobar-instalacion.mjs`)
// ═════════════════════════════════════════════════════════════════════════════════════════════

const comprobarMod = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'comprobar-instalacion.mjs')).href);

/** Una instalación de verdad, hecha por el instalador sobre el repo del banco; `claude` = el falso. */
function instalarEnBanco(b, extra = []) {
  const destino = path.join(b.dir, 'inst-nueva');
  const r = correrInstalar([
    '--destino', destino, '--repo', b.repo, '--claude', 'C:/claude.exe', '--prefijo', 'jv-',
    '--puestos', 'jefe,s1', '--orquestador', 'jefe', '--tandas', '07:30',
    '--prompt', 'docs/equipo/prompt-tanda-orquestador.md', '--traspasos', b.memoria, ...extra,
  ]);
  assert.equal(r.status, 0, `🔴 NO PUDE MIRAR: el instalador no instaló en el banco (${r.stdout})`);
  // El `claude` del config pasa a ser el falso del banco (por la CLI solo viaja una ruta).
  const config = JSON.parse(fs.readFileSync(path.join(destino, 'config.json'), 'utf8'));
  config.claude = JSON.parse(fs.readFileSync(path.join(b.inst, 'config.json'), 'utf8')).claude;
  b.escribir(path.join('inst-nueva', 'config.json'), JSON.stringify(config, null, 2));
  return destino;
}

test('veredicto global: NO-PUDE-MIRAR gana a FALLA, FALLA a AVISO, y una lista vacía no es un OK', () => {
  const g = comprobarMod.veredictoGlobal;
  assert.equal(g([]).codigo, 2, '🔴 una lista vacía sale OK: un instrumento que no miró nada daría verde');
  assert.equal(g([{ veredicto: 'OK' }, { veredicto: 'FALLA' }, { veredicto: 'NO-PUDE-MIRAR' }]).codigo, 2);
  assert.equal(g([{ veredicto: 'OK' }, { veredicto: 'FALLA' }, { veredicto: 'AVISO' }]).codigo, 1);
  assert.equal(g([{ veredicto: 'OK' }, { veredicto: 'AVISO' }]).codigo, 0);
});

test('POSITIVO: sobre una instalación recién hecha por el instalador, la lista sale sin FALLA y declara su población', () => {
  const b = banco({ equipo: EQUIPO_JV });
  try {
    const destino = instalarEnBanco(b);
    const lista = comprobarMod.comprobar({ destino, plataforma: 'linux' });
    const malas = lista.filter((c) => c.veredicto === 'FALLA' || c.veredicto === 'NO-PUDE-MIRAR');
    assert.deepEqual(malas, [], `🔴 una instalación buena no pasa su propia lista: ${JSON.stringify(malas)}`);
    const ids = lista.map((c) => c.id);
    for (const id of ['config', 'claude', 'repo', 'copia:sesion.mjs', 'copia:uso.mjs', 'copia:prompt-tanda.md', 'arranque.cmd',
      'traspasos', 'sesion.mjs estado', 'aviso de uso', 'huérfanos', 'tareas programadas', 'gh']) {
      assert.ok(ids.includes(id), `🔴 la lista no comprueba «${id}»`);
    }
    assert.equal(lista.find((c) => c.id === 'sesion.mjs estado').veredicto, 'OK',
      '🔴 la copia instalada no ACTÚA: la lista no ha ejecutado la puerta');
    assert.equal(comprobarMod.veredictoGlobal(lista).codigo, 0);
  } finally { b.limpiar(); }
});

test('🔴 ROJO: con la copia instalada de sesion.mjs TOCADA, la lista da FALLA (ejecuta la puerta, no la describe)', () => {
  const b = banco({ equipo: EQUIPO_JV });
  try {
    const destino = instalarEnBanco(b);
    b.anadir(path.join('inst-nueva', 'sesion.mjs'), '\n// tocado\n');
    const lista = comprobarMod.comprobar({ destino, plataforma: 'linux' });
    const estado = lista.find((c) => c.id === 'sesion.mjs estado');
    assert.equal(estado?.veredicto, 'FALLA', `🔴 una copia alterada pasa la lista: ${JSON.stringify(estado)}`);
    assert.match(estado.detalle, /ALTERADO/, '🔴 la FALLA no viene de la puerta de integridad');
    assert.equal(comprobarMod.veredictoGlobal(lista).codigo, 1);
  } finally { b.limpiar(); }
});

test('SUELO: sin config.json, la lista dice NO-PUDE-MIRAR y sale con 2', () => {
  const b = banco();
  try {
    const lista = comprobarMod.comprobar({ destino: path.join(b.dir, 'no-instalado'), plataforma: 'linux' });
    assert.equal(lista[0]?.veredicto, 'NO-PUDE-MIRAR');
    assert.equal(comprobarMod.veredictoGlobal(lista).codigo, 2);
  } finally { b.limpiar(); }
});
