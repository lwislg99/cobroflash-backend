#!/usr/bin/env node
// docs/master/evidencias/scrum1343/banco.mjs — SCRUM-1343
//
// EL BANCO: la PUERTA DE VERDAD (`scripts/guards-visuales.mjs`, la del árbol desde el que se lanza)
// corriendo sobre guards DE MENTIRA, en un directorio temporal FUERA del árbol.
//
// Por qué así y no cargando la máquina: lo que se vio el 1-oct fue el sistema matando procesos por
// memoria. Repetirlo es encontrarse el defecto en vez de medirlo. Aquí no se abre ni un navegador:
// son procesos de node de milisegundos.
//
// QUÉ HACE: copia `scripts/` entero a un temporal, le pone un `package.json` con los guards del
// escenario, y lanza la puerta copiada. Imprime su salida LITERAL y su código.
//
// LOS ESCENARIOS:
//   nativo ....... un hijo sale con 3221225794 (0xC0000142) y sin imprimir nada: lo que la puerta
//                  VIO el 1-oct. ⚠️ Es una IMITACIÓN de la señal: el hijo arranca y sale con ese
//                  número. La puerta no puede distinguirlo de un proceso que no se inició — y ése es
//                  también el límite del arreglo, dicho en el registro.
//   enoent ....... el BINARIO deja de existir a mitad de la fila: la puerta corre con una COPIA de
//                  node, el primer guard la renombra, y los `spawn` siguientes fallan de verdad
//                  (ENOENT). Aquí no se imita nada: el hijo no llega a crearse.
//   positivo ..... guards que SÍ miden: uno con hallazgo y su marca, uno que revienta en la primera
//                  línea (traza en stderr, salida 1), uno que sale con 1 SIN imprimir nada, y uno
//                  con un código que nadie conoce (77). Los cuatro tienen que seguir en rojo.
//   limpio ....... sólo verdes: tiene que salir 0.
//   mezcla ....... un hallazgo real Y un hijo que no arranca en la misma fila.
//
// USO:  node docs/master/evidencias/scrum1343/banco.mjs [escenario …]     (sin argumentos: todos)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

const GUARDS = {
  limpio: "console.log('guard limpio: 3 casos medidos, 0 hallazgos');\n",
  'otro-limpio': "console.log('otro guard limpio: 1 caso medido, 0 hallazgos');\n",
  // Sale con el código que el sistema dio el 1-oct, sin una sola letra.
  'sale-nativo': 'process.exit(3221225794);\n',
  'otro-sale-nativo': 'process.exit(3221225794);\n',
  // Renombra el binario con el que corre la puerta: los `spawn` de después no encuentran nada.
  'renombra-el-binario': "import fs from 'node:fs';\n"
    + "fs.renameSync(process.env.BANCO_NODE_COPIA, process.env.BANCO_NODE_COPIA + '.ya-no');\n"
    + "console.log('binario renombrado: los siguientes no pueden arrancar');\n",
  'con-hallazgo': "import { veredictoDe } from './_hallazgos-y-ciegos.mjs';\n"
    + "const v = veredictoDe({ hallazgos: ['390 px: la nota no cabe'], ciegos: [] });\n"
    + "console.error('🔴 HALLAZGOS 1: 390 px: la nota no cabe');\n"
    + 'console.log(v.linea);\n'
    + 'process.exit(v.codigo);\n',
  'revienta-en-la-primera-linea': "throw new Error('reventé en la primera línea');\n",
  'sale-1-mudo': 'process.exit(1);\n',
  'codigo-desconocido': "console.log('salgo con un código que la puerta no conoce');\nprocess.exit(77);\n",
};

const ESCENARIOS = {
  nativo: ['limpio', 'sale-nativo', 'otro-sale-nativo'],
  enoent: ['renombra-el-binario', 'limpio', 'otro-limpio'],
  positivo: ['limpio', 'con-hallazgo', 'revienta-en-la-primera-linea', 'sale-1-mudo', 'codigo-desconocido'],
  limpio: ['limpio', 'otro-limpio'],
  mezcla: ['limpio', 'con-hallazgo', 'sale-nativo'],
};

function montar(escenario) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1343-' + escenario + '-'));
  fs.cpSync(path.join(RAIZ, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  const scripts = { test: 'echo la tanda del banco no corre ningun guard' };
  for (const g of ESCENARIOS[escenario]) {
    // `esDeNavegador` lee el //comentario; `ficheroDe`, el comando. Se declaran como los de verdad.
    scripts['//guard:' + g] = 'BANCO SCRUM-1343: guard de mentira, se declara de navegador para que la puerta lo recoja.';
    scripts['guard:' + g] = 'node scripts/guard-banco-' + g + '.mjs';
    fs.writeFileSync(path.join(dir, 'scripts', 'guard-banco-' + g + '.mjs'), GUARDS[g]);
  }
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'banco-scrum1343', type: 'module', scripts }, null, 2));
  return dir;
}

function correr(escenario) {
  const dir = montar(escenario);
  // El entorno del sujeto se construye a mano (A21): sin el color del chat ni el contexto de un
  // `node --test`, y sin GITHUB_ACTIONS para que la puerta no emita anotaciones.
  const env = {};
  for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE',
    'LOCALAPPDATA', 'APPDATA', 'ProgramFiles', 'ProgramFiles(x86)', 'PROGRAMFILES', 'EDGE_PATH', 'CHROME_PATH',
    'PUPPETEER_EXECUTABLE_PATH']) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  let ejecutable = process.execPath;
  if (escenario === 'enoent') {
    ejecutable = path.join(dir, path.basename(process.execPath).replace(/^node/, 'node-copia'));
    fs.copyFileSync(process.execPath, ejecutable);
    env.BANCO_NODE_COPIA = ejecutable;
  }
  const r = spawnSync(ejecutable, [path.join(dir, 'scripts', 'guards-visuales.mjs')], { cwd: dir, env, encoding: 'utf8', timeout: 120000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  // TESTIGO (A21): si la puerta no llegó a pintar su total, el banco no ha medido nada.
  const testigo = salida.includes('── TOTAL ');
  console.log('\n' + '█'.repeat(100));
  console.log('ESCENARIO ' + escenario + ' · guards: ' + ESCENARIOS[escenario].join(', '));
  console.log('█'.repeat(100));
  // La ruta temporal cambia en cada pasada: se quita para que antes y después se puedan comparar.
  console.log(salida.split(dir).join('<banco>').trimEnd());
  console.log('\nEXIT=' + r.status + (r.error ? ' · error del banco: ' + r.error.code : '') + ' · testigo «TOTAL»: ' + (testigo ? 'sí' : 'NO'));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* un temporal que no se deja borrar no cambia lo medido */ }
  return { escenario, exit: r.status, testigo };
}

const pedidos = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ESCENARIOS);
const desconocidos = pedidos.filter((e) => !ESCENARIOS[e]);
if (desconocidos.length) {
  console.error('escenario desconocido: ' + desconocidos.join(', ') + ' · los que hay: ' + Object.keys(ESCENARIOS).join(', '));
  process.exit(2);
}
console.log('BANCO SCRUM-1343 · POBLACIÓN: ' + pedidos.length + ' escenario(s) · puerta: ' + path.join(RAIZ, 'scripts', 'guards-visuales.mjs'));
console.log('plataforma: ' + process.platform + ' · node ' + process.version);
const resultados = pedidos.map(correr);
console.log('\n' + '═'.repeat(100));
console.log('RESUMEN · ' + resultados.map((r) => r.escenario + ' → EXIT=' + r.exit + (r.testigo ? '' : ' (SIN TESTIGO)')).join(' · '));
const sinTestigo = resultados.filter((r) => !r.testigo);
if (sinTestigo.length) {
  console.error('🔴 BANCO CIEGO: la puerta no llegó a su total en ' + sinTestigo.map((r) => r.escenario).join(', ') + '. Nada de lo de arriba es un resultado.');
  process.exit(2);
}
console.log('BANCO=0');
