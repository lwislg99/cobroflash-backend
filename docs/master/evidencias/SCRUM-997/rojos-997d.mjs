// SCRUM-997d · S0 · Los rojos de tests/scrum997d-el-oraculo-declara-lo-que-no-comprueba.test.mjs
// uso: node rojos-997d.mjs <raíz de un árbol LIMPIO y con todo comiteado>
// Muta tests/_microcopy-aprobada.mjs, corre el test, y RESTAURA desde HEAD. Imprime el
// `git diff --numstat` de cada mutación al lado de su resultado: un rojo que no se inyectó y un
// verde no se distinguen de otra forma.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

if (!process.argv[2]) { console.error('falta la raíz'); process.exit(2); }
const RAIZ = path.resolve(process.argv[2]);
const ORACULO = path.join(RAIZ, 'tests', '_microcopy-aprobada.mjs');
const TEST = 'tests/scrum997d-el-oraculo-declara-lo-que-no-comprueba.test.mjs';
const git = (...a) => spawnSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8' });

if (git('status', '--porcelain').stdout.trim() !== '') { console.log('CIEGO: el árbol no está limpio; no muto encima de trabajo sin comitear.'); process.exit(2); }
console.log(`ARBOL · HEAD ${git('rev-parse', 'HEAD').stdout.trim()}`);

const env = {};
for (const k of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ComSpec', 'PATHEXT']) if (process.env[k]) env[k] = process.env[k];
const corre = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, env, encoding: 'utf8' });
  const n = (c) => { const m = new RegExp('^# ' + c + ' (\\d+)$', 'm').exec(r.stdout || ''); return m ? Number(m[1]) : null; };
  const caidos = [...(r.stdout || '').matchAll(/^not ok \d+ - SCRUM-997d · (\d)\)/gm)].map((m) => Number(m[1]));
  return { exit: r.status, tests: n('tests'), pass: n('pass'), fail: n('fail'), caidos };
};

const original = fs.readFileSync(ORACULO, 'utf8');
const una = (de, a) => { if (original.split(de).length !== 2) throw new Error('CIEGO: el ancla no aparece exactamente UNA vez: ' + de); return original.replace(de, a); };

const MUTANTES = {
  'BASE (sin mutar)': null,
  'A · el tercer estado se pliega sobre «aprobada» (vuelta a dos estados)': () => una(
    'porElFundador ? ESTADO_APROBADA : (porDelegacion ? ESTADO_DELEGADA_SIN_COMPROBAR : ESTADO_NO_APROBADA)',
    'porElFundador ? ESTADO_APROBADA : (porDelegacion ? ESTADO_APROBADA : ESTADO_NO_APROBADA)'),
  'B · el criterio CAMBIA: lo delegado deja de contar': () => una(
    'aprobada: porElFundador || porDelegacion,',
    'aprobada: porElFundador,'),
  'C · una delegada calla lo que no se ha comprobado': () => una(
    'noComprobado: porDelegacion ? [...NO_COMPROBADO_EN_UNA_DELEGADA] : [],',
    'noComprobado: [],'),
  'D · el oráculo aprende a leer las líneas de Javier (la declaración 1 dejaría de ser cierta)': () => una(
    "  if (!fs.existsSync(ruta)) return false;\n  let dentro = false;",
    "  if (!fs.existsSync(ruta)) return false;\n  if (!/Javier/.test(fs.readFileSync(ruta, 'utf8'))) return false;\n  let dentro = false;"),
  'E · el oráculo rechaza un texto legal o fiscal (la declaración 2 dejaría de ser cierta)': () => una(
    'const porDelegacion = !porElFundador && firmante',
    "const porDelegacion = !porElFundador && !/legal|fiscal/i.test(texto.split(/\\r?\\n/).filter((l) => /^\\s*>/.test(l)).join(' ')) && firmante"),
  'F · el oráculo rechaza una referencia de ticket imposible (la declaración 3 dejaría de ser cierta)': () => una(
    'if (r) return { referencia: `SCRUM-${r[1]} comentario ${r[2]}` };',
    'if (r && r[1].length <= 5) return { referencia: `SCRUM-${r[1]} comentario ${r[2]}` };'),
};

let mal = 0;
try {
  for (const [nombre, mutar] of Object.entries(MUTANTES)) {
    if (mutar) fs.writeFileSync(ORACULO, mutar());
    const numstat = git('diff', '--numstat').stdout.trim() || '(sin diferencias)';
    const r = corre();
    const ciego = r.tests === null || r.tests === 0;
    console.log(`\n${nombre}\n   numstat: ${numstat}\n   exit ${r.exit} · tests ${r.tests} · pass ${r.pass} · fail ${r.fail} · caen los tests nº: ${r.caidos.join(', ') || 'ninguno'}${ciego ? ' · CIEGO' : ''}`);
    if (ciego) mal++;
    if (!mutar && r.exit !== 0) mal++;                                   // la base tiene que estar verde
    if (mutar && (numstat === '(sin diferencias)' || r.exit === 0)) mal++; // un mutante tiene que entrar y morir
    git('restore', '--source=HEAD', '--worktree', '--', 'tests/_microcopy-aprobada.mjs');
  }
} finally {
  git('restore', '--source=HEAD', '--worktree', '--', 'tests/_microcopy-aprobada.mjs');
}
const despues = git('status', '--porcelain').stdout.trim();
console.log(`\nRESTAURADO · git status --porcelain: ${despues === '' ? '(limpio)' : despues}`);
const exit = mal === 0 && despues === '' ? 0 : 1;
console.log(`MUTANTES ${Object.keys(MUTANTES).length - 1} · fuera de lo esperado ${mal}`);
console.log(`EXIT=${exit}`);
process.exit(exit);
