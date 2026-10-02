// mutar.mjs — ver CAER los casos nuevos de scrum976 (SCRUM-1345). Base sin mutar primero.
// Se lanza desde la raíz del árbol, con todo commiteado. Restaura con `git restore --source=HEAD`
// y comprueba el árbol después de CADA pasada.
import fs from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';

const TEST = 'tests/scrum976-guards-entrada-con-techo.test.mjs';
const SCRIPT = 'scripts/guards-entrada.mjs';

const MUTACIONES = [
  { id: 'M1 · el plazo agotado olvida los caídos ya vistos', fichero: SCRIPT,
    de: 'return { hallazgos: vistos.length, ciegos: 1, vistos };',
    a: 'return { hallazgos: 0, ciegos: 1, vistos: [] };',
    cae: 'SCRUM-1345 ⑤' },
  { id: 'M2 · el plazo agotado deja de contar como ciego (saldría 0)', fichero: SCRIPT,
    de: 'return { hallazgos: vistos.length, ciegos: 1, vistos };',
    a: 'return { hallazgos: vistos.length, ciegos: 0, vistos };',
    cae: 'SCRUM-976 ③' },
  { id: 'M3 · la señal CI se lee por verdad y no por presencia', fichero: TEST,
    de: 'return valorDeCI !== undefined;',
    a: 'return Boolean(valorDeCI);',
    cae: 'SCRUM-1345 ④bis' },
  { id: 'M4 · en CI el plazo agotado deja de ser rojo', fichero: TEST,
    de: 'if (enCI) return { rojo: `PRESUPUESTO: ${informe} En CI esto',
    a: 'if (false) return { rojo: `PRESUPUESTO: ${informe} En CI esto',
    cae: 'SCRUM-1345 ④ter' },
  { id: 'M5 · un rojo dentro de plazo sale 0', fichero: SCRIPT,
    de: 'if (status !== 0) return { hallazgos: Math.max(1, fallosDelResumen(salida)), ciegos: 0, vistos: [] };',
    a: 'if (status !== 0) return { hallazgos: 0, ciegos: 0, vistos: [] };',
    cae: 'SCRUM-1345 ⑤' },
  { id: 'M6 · la línea de la pasada deja de salir en verde', fichero: SCRIPT,
    de: 'La entrada puede empujarse.`);\nconsole.log(linea);',
    a: 'La entrada puede empujarse.`);',
    cae: 'SCRUM-976 ④' },
];

function estadoDelArbol() {
  return execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
}

function correr() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS; delete env.FORCE_COLOR;
  delete env.CI;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { encoding: 'utf8', env });
  const out = r.stdout || '';
  const n = (clave) => Number((new RegExp('^# ' + clave + ' (\\d+)', 'm').exec(out) || [])[1]);
  const caidos = out.split('\n').filter((l) => /^not ok /.test(l)).map((l) => l.replace(/^not ok \d+ - /, ''));
  return { status: r.status, tests: n('tests'), pass: n('pass'), fail: n('fail'), caidos };
}

if (estadoDelArbol() !== '') { console.error('🔴 el árbol no está limpio: no muto nada.'); process.exit(2); }

const base = correr();
console.log(`BASE · estado ${base.status} · tests ${base.tests} · pass ${base.pass} · fail ${base.fail}`);
if (base.status !== 0 || !(base.tests > 0) || base.fail !== 0) { console.error('🔴 CIEGO: la base no está verde; no se muta.'); process.exit(2); }

let mudas = 0;
for (const m of MUTACIONES) {
  const original = fs.readFileSync(m.fichero, 'utf8');
  const veces = original.split(m.de).length - 1;
  if (veces !== 1) { console.log(`CIEGA · ${m.id} · el ancla aparece ${veces} veces en ${m.fichero}`); mudas += 1; continue; }
  fs.writeFileSync(m.fichero, original.replace(m.de, m.a));
  const numstat = execFileSync('git', ['diff', '--numstat'], { encoding: 'utf8' }).trim();
  let r;
  try { r = correr(); } finally {
    execFileSync('git', ['restore', '--source=HEAD', '--', m.fichero]);
  }
  const limpio = estadoDelArbol() === '';
  const cayoElSuyo = r.caidos.some((c) => c.includes(m.cae));
  const veredicto = !Number.isFinite(r.tests) || !(r.tests > 0) ? 'CIEGA (sin recuento)' : (cayoElSuyo ? 'VIVA' : 'MUDA');
  if (veredicto !== 'VIVA') mudas += 1;
  console.log(`${veredicto} · ${m.id}\n   diff: ${numstat} · tests ${r.tests} · fail ${r.fail} · esperaba caer «${m.cae}» · cayeron: ${r.caidos.map((c) => c.slice(0, 40)).join(' | ') || '(ninguno)'} · árbol restaurado: ${limpio}`);
  if (!limpio) { console.error('🔴 el árbol no quedó limpio tras restaurar: paro.'); process.exit(3); }
}
console.log(`FIN · ${MUTACIONES.length} mutaciones · ${MUTACIONES.length - mudas} vivas · ${mudas} no vivas · EXIT=${mudas ? 1 : 0}`);
process.exit(mudas ? 1 : 0);
