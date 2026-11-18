// SCRUM-1731 · Réplica LOCAL del meta-guard, sólo para `tests/scrum1294-a9-leccion-en-a10.test.mjs`.
// SIN LISTA PROPIA (SCRUM-1387): las mutaciones son las MUTACIONES_QUE_ME_TUMBAN de ese test. Por cada una
// la aplica, corre el test, exige que caiga SU prueba (`cae`), restaura y compara bytes. Base sin mutar
// primero: si no está verde (o es ciega), no se juzga nada. El oficial es `npm run meta:mutaciones`.
//   node docs/master/evidencias/SCRUM-1731/mutar.mjs [raiz del worktree]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2] || '.');
const TEST = path.join(RAIZ, 'tests', 'scrum1294-a9-leccion-en-a10.test.mjs');
const env = { ...process.env }; delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const { MUTACIONES_QUE_ME_TUMBAN: M } = await import(pathToFileURL(TEST).href + '?' + Date.now());

function correr() {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = r.stdout || '';
  const n = (k) => Number((out.match(new RegExp('^# ' + k + ' (\\d+)', 'm')) || [])[1]);
  const caidos = out.split('\n').filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, '').trim());
  return { status: r.status, tests: n('tests'), pass: n('pass'), fail: n('fail'), skip: n('skipped'), caidos };
}
// Un recuento que no suma es un instrumento que no llegó a mirar (CIEGO), no un verde ni un rojo.
const ciego = (r) => !(r.tests > 0) || r.pass + r.fail + r.skip !== r.tests;

const original = fs.readFileSync(TEST);
let malas = 0;
try {
  console.log(`POBLACION · ${M.length} mutaciones declaradas · node ${process.version}`);
  const base = correr();
  console.log(`BASE sin mutar · exit ${base.status} · ${base.tests} = ${base.pass} pass + ${base.fail} fail + ${base.skip} skip`);
  if (ciego(base) || base.fail) { console.log('🔴 la BASE no está verde (o es CIEGA): no se muta nada'); process.exitCode = 2; }
  else for (const m of M) {
    const fuente = original.toString('utf8');
    const veces = fuente.split(m.de).length - 1;
    // La declaración cita el ancla (1) y el código la tiene (1): son DOS, y la que muta `replace` es la primera,
    // que tiene que ser la del código (la que empieza línea).
    if (veces !== 2 || !(fuente.startsWith(m.de) || fuente.includes('\n' + m.de))) {
      console.log(`🔴 NO APLICA (${veces} apariciones) · ${m.de.trim().slice(0, 60)}`); malas++; continue;
    }
    fs.writeFileSync(TEST, fuente.replace(m.de, m.a));
    const r = correr();
    fs.writeFileSync(TEST, original);
    const suya = r.caidos.some((c) => c.includes(m.cae));
    const v = ciego(r) ? 'CIEGO' : (suya ? 'MUERE' : (r.fail ? 'MUERE POR OTRA' : 'VIVE'));
    if (v !== 'MUERE') malas++;
    console.log(`${v} · cae «${m.cae}» · caídas ${r.fail} de ${r.tests} · ${m.de.trim().slice(0, 60)}`);
  }
} finally {
  fs.writeFileSync(TEST, original);
  const igual = fs.readFileSync(TEST).equals(original);
  console.log(`restaurado por bytes: ${igual ? 'sí' : 'NO'}`);
  if (!igual) process.exitCode = 3;
}
console.log(malas ? `🔴 ${malas} sin matar` : 'todas MUEREN por su caso');
if (malas && !process.exitCode) process.exitCode = 1;
