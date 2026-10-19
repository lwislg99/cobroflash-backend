// SCRUM-1546c · S0 · Los rojos de la firma del fundador sin comprobar.
// uso: node rojos-1546c.mjs <raíz de un árbol LIMPIO y con todo comiteado>
// Mismo patrón que `docs/master/evidencias/SCRUM-997/rojos-997d.mjs`: muta tests/_microcopy-aprobada.mjs,
// corre los dos tests que lo atan, y RESTAURA desde HEAD. Imprime el `git diff --numstat` de cada
// mutación al lado de su resultado: un rojo que no se inyectó y un verde no se distinguen de otra forma.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

if (!process.argv[2]) { console.error('falta la raíz'); process.exit(2); }
const RAIZ = path.resolve(process.argv[2]);
const ORACULO = path.join(RAIZ, 'tests', '_microcopy-aprobada.mjs');
const TESTS = ['tests/scrum1546c-la-firma-del-fundador-sin-comprobar.test.mjs', 'tests/scrum997d-el-oraculo-declara-lo-que-no-comprueba.test.mjs'];
const git = (...a) => spawnSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8' });

if (git('status', '--porcelain').stdout.trim() !== '') { console.log('CIEGO: el árbol no está limpio; no muto encima de trabajo sin comitear.'); process.exit(2); }
console.log(`ARBOL · HEAD ${git('rev-parse', 'HEAD').stdout.trim()}`);

const env = {};
for (const k of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ComSpec', 'PATHEXT']) if (process.env[k]) env[k] = process.env[k];
const corre = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', ...TESTS], { cwd: RAIZ, env, encoding: 'utf8' });
  const n = (c) => { const m = new RegExp('^# ' + c + ' (\\d+)$', 'm').exec(r.stdout || ''); return m ? Number(m[1]) : null; };
  const caidos = [...(r.stdout || '').matchAll(/^not ok \d+ - SCRUM-(1546c|997d) · (\d)\)/gm)].map((m) => `${m[1]}·${m[2]}`);
  return { exit: r.status, tests: n('tests'), pass: n('pass'), fail: n('fail'), caidos };
};

const original = fs.readFileSync(ORACULO, 'utf8');
const una = (texto, de, a) => { if (texto.split(de).length !== 2) throw new Error('CIEGO: el ancla no aparece exactamente UNA vez: ' + de); return texto.replace(de, a); };
const ESTADO = '(porElFundador || porDelegacion) ? ESTADO_SIN_COMPROBAR : ESTADO_NO_APROBADA';
const DECLARA = 'porElFundador ? [...NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR] : ';
const FUNDADOR = "const porElFundador = firmante === 'fundador';";

const MUTANTES = {
  'BASE (sin mutar)': null,
  'M · vuelta al caso M5: la firma del fundador sale `aprobada` a secas y no declara nada': () => una(una(original,
    ESTADO, 'porElFundador ? ESTADO_APROBADA : (porDelegacion ? ESTADO_SIN_COMPROBAR : ESTADO_NO_APROBADA)'),
    DECLARA, ''),
  'N · la firma del fundador sale sin comprobar pero CALLA qué no se ha comprobado': () => una(original, DECLARA, 'porElFundador ? [] : '),
  'O · el oráculo rechaza un ticket imposible en la firma del fundador (la declaración 1 dejaría de ser cierta)': () => una(original,
    FUNDADOR, "const porElFundador = firmante === 'fundador' && !/SCRUM-\\d{6,}/.test(texto);"),
  'P · el oráculo pide que la ficha esté en git (la declaración 2 dejaría de ser cierta)': () => una(original,
    FUNDADOR, "const porElFundador = firmante === 'fundador' && fs.existsSync(path.join(DIR_APROBACIONES, '..', '..', '.git'));"),
  'Q · el registro congelado también sale sin comprobar (ninguno quedaría `aprobada` a secas)': () => una(original,
    '      estado: ESTADO_APROBADA,\n      noComprobado: [],', '      estado: ESTADO_SIN_COMPROBAR,\n      noComprobado: [],'),
};

let mal = 0;
try {
  for (const [nombre, mutar] of Object.entries(MUTANTES)) {
    if (mutar) fs.writeFileSync(ORACULO, mutar());
    const numstat = git('diff', '--numstat').stdout.trim() || '(sin diferencias)';
    const r = corre();
    const ciego = r.tests === null || r.tests === 0;
    console.log(`\n${nombre}\n   numstat: ${numstat}\n   exit ${r.exit} · tests ${r.tests} · pass ${r.pass} · fail ${r.fail} · caen: ${r.caidos.join(', ') || 'ninguno'}${ciego ? ' · CIEGO' : ''}`);
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
