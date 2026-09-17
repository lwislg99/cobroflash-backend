// tests/scrum899b-arranque-de-la-tanda.test.mjs — SCRUM-899 (hito 2) · la tanda programada
//
// Se ejecuta la tanda ENTERA sobre copias instaladas desde un `origin/main` de banco, como hará
// `arranque.cmd`: `orquestador-arranque.mjs` → `sesion.mjs` → un `claude` falso con estado, que
// responde a `--bg` con «backgrounded · <id> · <nombre>» y después lista esa sesión en
// `agents --json`. Veredicto por EFECTO: qué llamadas recibió `claude` y qué quedó en el registro.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const instalar = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'instalar.mjs')).href);

// El rojo de cada pieza, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/orquestador-arranque.mjs',
    de: 'if (!Buffer.from(main.stdout).equals(local)) {',
    a: 'if (false) {',
    cae: '🔴 ROJO: un orquestador-arranque ALTERADO no lanza nada',
  },
  {
    fichero: 'scripts/equipo/orquestador-arranque.mjs',
    de: "  ['sesion.mjs', 'scripts/equipo/sesion.mjs'],\n",
    a: '',
    cae: '🔴 ROJO: con sesion.mjs ALTERADO, la tanda no lanza nada',
  },
  {
    // Sin entrar en el repo, la tarea arranca en System32 y el orquestador nace fuera del proyecto.
    fichero: 'scripts/equipo/instalar.mjs',
    de: '    `cd /d "${r}"`,\n',
    a: '',
    cae: '🔴 arranque.cmd copia desde origin/main los scripts y el prompt, y lanza el arranque',
  },
  {
    fichero: 'scripts/equipo/instalar.mjs',
    de: 'show origin/main:${enRepo}',
    a: 'show HEAD:${enRepo}',
    cae: '🔴 arranque.cmd copia desde origin/main los scripts y el prompt, y lanza el arranque',
  },
];

const PROMPT = 'Prompt de tanda del banco de SCRUM-899b.';
const UUID = '1234abcd-0000-4000-8000-00000000abcd';

function banco({ alterarArranque = false, alterarSesion = false, sinPrompt = false } = {}) {
  // SCRUM-864c · `temporal()` y no `fs.mkdtempSync`: el `finally` de cada test llama a
  // `b.limpiar()`, pero `banco()` crea el directorio ANTES de que su llamador entre en el `try`
  // —y entre medias hace `git init`, copia ficheros y lanza procesos—. Si algo de eso revienta,
  // el `finally` no existe todavía y el directorio se queda. El registro del helper sí cubre ese
  // hueco, y `b.limpiar()` se mantiene para no esperar al final del proceso.
  const dir = temporal('scrum899b-');
  const git = (cwd, ...a) => execFileSync('git', ['-c', 'core.autocrlf=false', '-C', cwd, ...a], { encoding: 'utf8' });

  const repo = path.join(dir, 'repo');
  execFileSync('git', ['init', '-q', repo]);
  for (const [enRepo] of instalar.FICHEROS) fs.mkdirSync(path.join(repo, path.dirname(enRepo)), { recursive: true });
  fs.copyFileSync(path.join(RAIZ, 'scripts/equipo/sesion.mjs'), path.join(repo, 'scripts/equipo/sesion.mjs'));
  fs.copyFileSync(path.join(RAIZ, 'scripts/equipo/orquestador-arranque.mjs'), path.join(repo, 'scripts/equipo/orquestador-arranque.mjs'));
  if (!sinPrompt) fs.writeFileSync(path.join(repo, 'docs/equipo/prompt-tanda-orquestador.md'), PROMPT);
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=banco', '-c', 'user.email=banco@x', 'commit', '-q', '-m', 'banco');
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');

  // La instalación, como la hace `arranque.cmd`: `git show origin/main:<fichero>` a la carpeta.
  const inst = path.join(dir, 'instalacion');
  fs.mkdirSync(inst);
  for (const [enRepo, instalado] of instalar.FICHEROS) {
    const r = spawnSync('git', ['-C', repo, 'show', `origin/main:${enRepo}`]);
    if (r.status === 0) fs.writeFileSync(path.join(inst, instalado), r.stdout);
  }
  if (alterarArranque) fs.appendFileSync(path.join(inst, 'orquestador-arranque.mjs'), '\n// tocado\n');
  if (alterarSesion) fs.appendFileSync(path.join(inst, 'sesion.mjs'), '\n// tocado\n');

  // `claude` falso con estado: cada llamada queda en llamadas.txt; `--bg` registra una sesión viva.
  const llamadas = path.join(dir, 'llamadas.txt');
  const vivas = path.join(dir, 'vivas.json');
  const falso = path.join(dir, 'claude-falso.mjs');
  fs.writeFileSync(falso, [
    "import fs from 'node:fs';",
    `const LL = ${JSON.stringify(llamadas)}, V = ${JSON.stringify(vivas)};`,
    'const args = process.argv.slice(2);',
    "fs.appendFileSync(LL, JSON.stringify(args) + '\\n');",
    "const vivas = fs.existsSync(V) ? JSON.parse(fs.readFileSync(V, 'utf8')) : [];",
    "if (args[0] === 'agents') { process.stdout.write(JSON.stringify(vivas)); process.exit(0); }",
    "if (args[0] === '--bg') {",
    "  const nombre = args[args.indexOf('-n') + 1];",
    `  vivas.push({ id: '1234abcd', name: nombre, kind: 'background', state: 'working', sessionId: ${JSON.stringify(UUID)} });`,
    '  fs.writeFileSync(V, JSON.stringify(vivas));',
    "  process.stdout.write('Starting background service…\\nbackgrounded · 1234abcd · ' + nombre + '\\n');",
    '  process.exit(0);',
    '}',
    'process.exit(1);',
  ].join('\n'));
  fs.writeFileSync(path.join(inst, 'config.json'), JSON.stringify({ repo, claude: [process.execPath, falso] }));

  const leerLlamadas = () => (fs.existsSync(llamadas) ? fs.readFileSync(llamadas, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const tanda = () => {
    const r = spawnSync(process.execPath, [path.join(inst, 'orquestador-arranque.mjs')], { encoding: 'utf8' });
    let v = null;
    try { v = JSON.parse((r.stdout || '').trim().split('\n').at(-1)); } catch { /* sin veredicto */ }
    return { status: r.status, v };
  };
  return { dir, inst, tanda, leerLlamadas, limpiar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const lanzamientos = (llamadas) => llamadas.filter((a) => a[0] === '--bg');

test('🔴 POSITIVO: la tanda lanza al orquestador en modo auto con el prompt de origin/main, y lo registra', () => {
  const b = banco();
  try {
    const r = b.tanda();
    assert.equal(r.v?.tanda?.veredicto, 'LANZADA', `🔴 la tanda no lanzó al orquestador: ${JSON.stringify(r.v)}`);
    const [bg] = lanzamientos(b.leerLlamadas());
    assert.deepEqual(bg, ['--bg', '-n', 'orquestador', '--permission-mode', 'auto', PROMPT],
      '🔴 el orquestador no arranca con el nombre fijo, en modo auto y con el prompt de origin/main');
    const registro = JSON.parse(fs.readFileSync(path.join(b.inst, 'sesiones.json'), 'utf8'));
    assert.equal(registro.orquestador?.sessionId, UUID, '🔴 el sessionId COMPLETO no queda en el registro: no se podría reanudar');
  } finally { b.limpiar(); }
});

test('una segunda tanda con el orquestador vivo NO lanza otro', () => {
  const b = banco();
  try {
    b.tanda();
    const r = b.tanda();
    assert.equal(r.v?.tanda?.veredicto, 'YA-VIVA', `🔴 ${JSON.stringify(r.v)}`);
    assert.equal(lanzamientos(b.leerLlamadas()).length, 1, '🔴 dos orquestadores de fondo con el mismo nombre');
  } finally { b.limpiar(); }
});

test('🔴 ROJO: un orquestador-arranque ALTERADO no lanza nada', () => {
  const b = banco({ alterarArranque: true });
  try {
    const r = b.tanda();
    assert.equal(r.v?.veredicto, 'ALTERADO', `🔴 ${JSON.stringify(r.v)}`);
    assert.deepEqual(b.leerLlamadas(), [], '🔴 la copia alterada llegó a llamar a claude');
  } finally { b.limpiar(); }
});

test('🔴 ROJO: con sesion.mjs ALTERADO, la tanda no lanza nada', () => {
  const b = banco({ alterarSesion: true });
  try {
    const r = b.tanda();
    assert.equal(r.v?.veredicto, 'ALTERADO', `🔴 el arranque no comprobó sesion.mjs antes de lanzarlo: ${JSON.stringify(r.v)}`);
    assert.deepEqual(b.leerLlamadas(), []);
  } finally { b.limpiar(); }
});

test('SUELO: sin el prompt del orquestador en origin/main, «no pude mirar» y no lanza', () => {
  const b = banco({ sinPrompt: true });
  try {
    const r = b.tanda();
    assert.equal(r.v?.veredicto, 'NO-PUDE-MIRAR', `🔴 ${JSON.stringify(r.v)}`);
    assert.deepEqual(b.leerLlamadas(), [], '🔴 lanza un orquestador sin prompt: este script no se inventa uno');
  } finally { b.limpiar(); }
});

test('🔴 arranque.cmd copia desde origin/main los scripts y el prompt, y lanza el arranque', () => {
  const cmd = instalar.arranqueCmd({ destino: 'C:/Users/X/AppData/Local/yaqu-equipo', repo: 'D:/repo' });
  const lineas = cmd.split('\r\n');
  const cd = lineas.indexOf('cd /d "D:\\repo"');
  assert.ok(cd >= 0 && cd < lineas.findIndex((l) => l.startsWith('node ')),
    '🔴 arranque.cmd no entra en el repositorio antes de lanzar: la tarea programada arranca en System32 y el\n'
    + '  orquestador nacería fuera del proyecto (sin settings ni CLAUDE.md, con el diálogo de confianza de carpeta)');
  assert.ok(lineas.some((l) => l === 'git -C "D:\\repo" fetch --quiet origin main'), '🔴 no trae main antes de copiar');
  for (const [enRepo, instalado] of instalar.FICHEROS) {
    assert.ok(lineas.includes(`git -C "D:\\repo" show origin/main:${enRepo} > "C:\\Users\\X\\AppData\\Local\\yaqu-equipo\\${instalado}"`),
      `🔴 ${instalado} no se copia desde origin/main: la tanda actuaría con una copia que nadie ha revisado`);
  }
  assert.equal(lineas.filter((l) => l.startsWith('node ')).at(-1),
    'node "C:\\Users\\X\\AppData\\Local\\yaqu-equipo\\orquestador-arranque.mjs" >> "C:\\Users\\X\\AppData\\Local\\yaqu-equipo\\arranque.log" 2>&1');
  assert.doesNotMatch(cmd, /dangerously|bypass/i);
  // Hermano del patrón (SCRUM-237): con la cadena puesta, el mismo patrón la ve.
  assert.match(cmd + ' --dangerously-skip-permissions', /dangerously|bypass/i, '🔴 CIEGO: el patrón no detecta la cadena');
});

test('las órdenes de schtasks: tres tareas diarias, a las horas decididas, sobre arranque.cmd', () => {
  const ordenes = instalar.ordenesSchtasks({ destino: 'C:/Users/X/AppData/Local/yaqu-equipo' });
  assert.deepEqual(instalar.TANDAS, ['08:00', '13:05', '18:10']);
  assert.deepEqual(ordenes, [
    'MSYS_NO_PATHCONV=1 schtasks /create /sc daily /tn yaqu-equipo-0800 /st 08:00 /tr "C:\\Users\\X\\AppData\\Local\\yaqu-equipo\\arranque.cmd"',
    'MSYS_NO_PATHCONV=1 schtasks /create /sc daily /tn yaqu-equipo-1305 /st 13:05 /tr "C:\\Users\\X\\AppData\\Local\\yaqu-equipo\\arranque.cmd"',
    'MSYS_NO_PATHCONV=1 schtasks /create /sc daily /tn yaqu-equipo-1810 /st 18:10 /tr "C:\\Users\\X\\AppData\\Local\\yaqu-equipo\\arranque.cmd"',
  ]);
});
