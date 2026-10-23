// Réplica LOCAL y acotada del meta-guard, sólo para `tests/scrum1145-pestana-sitios.test.mjs`: por cada
// mutación de su `MUTACIONES_QUE_ME_TUMBAN` (el catálogo, SCRUM-1387) aplica, corre el test, exige que caiga
// SU prueba (`cae`), restaura y compara bytes. El oficial es `npm run meta:mutaciones` (job del CI).
// Además, fuera del catálogo porque no se escribe como `de`/`a`: la BASE de `origin/main` (la ficha sin la
// pestaña) tiene que tumbar el test, y sin mutar tiene que estar verde.
//   node docs/master/evidencias/SCRUM-1145/mutar.mjs <raiz del worktree>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2] || '.');
const TEST = path.join(RAIZ, 'tests', 'scrum1145-pestana-sitios.test.mjs');
const VISTA = path.join(RAIZ, 'public/dashboard/js/customerDetailView.js');
const env = { ...process.env }; delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const { MUTACIONES_QUE_ME_TUMBAN: M } = await import(pathToFileURL(TEST).href + '?' + Date.now());

function correr() {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = r.stdout || '';
  const n = (k) => Number((out.match(new RegExp('^# ' + k + ' (\\d+)', 'm')) || [])[1]);
  const caidos = out.split('\n').filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, '').trim());
  return { status: r.status, tests: n('tests'), pass: n('pass'), fail: n('fail'), skip: n('skipped'), caidos };
}
function conRestauracion(f, nuevo, fn) {
  const original = fs.readFileSync(f);
  try { fs.writeFileSync(f, nuevo); return fn(); }
  finally {
    fs.writeFileSync(f, original);
    if (!fs.readFileSync(f).equals(original)) { console.log(`🔴 NO RESTAURADO: ${f}`); process.exit(3); }
  }
}
// Un recuento que no suma es un instrumento que no llegó a mirar (CIEGO), no un verde ni un rojo.
const ciego = (r) => !(r.tests > 0) || r.pass + r.fail + r.skip !== r.tests;

console.log(`POBLACION · ${M.length} mutaciones declaradas · node ${process.version}`);
const base = correr();
console.log(`BASE sin mutar · exit ${base.status} · ${base.tests} = ${base.pass} pass + ${base.fail} fail + ${base.skip} skip`);
if (ciego(base) || base.fail) { console.log('🔴 la BASE no está verde (o es CIEGA): no se muta nada'); process.exit(2); }

const main = execFileSync('git', ['-C', RAIZ, 'show', 'origin/main:public/dashboard/js/customerDetailView.js']);
const rMain = conRestauracion(VISTA, main, correr);
console.log(`origin/main (sin la pestaña) · ${ciego(rMain) ? 'CIEGO' : (rMain.fail ? 'MUERE' : 'VIVE')} · caen ${rMain.fail} de ${rMain.tests}`);

let malas = rMain.fail ? 0 : 1;
for (const m of M) {
  const f = path.join(RAIZ, m.fichero);
  const fuente = fs.readFileSync(f, 'utf8');
  const veces = fuente.split(m.de).length - 1;
  if (veces !== 1) { console.log(`🔴 NO APLICA (${veces} apariciones) · ${m.cae}`); malas++; continue; }
  const r = conRestauracion(f, fuente.replace(m.de, m.a), correr);
  const suya = r.caidos.some((c) => c.includes(m.cae));
  const veredicto = ciego(r) ? 'CIEGO' : (suya ? 'MUERE' : (r.fail ? 'MUERE POR OTRA' : 'VIVE'));
  if (veredicto !== 'MUERE') malas++;
  console.log(`${veredicto} · ${m.fichero} · cae «${m.cae}» · caídas ${r.fail} de ${r.tests}`);
}
console.log(malas ? `🔴 ${malas} sin matar` : 'todas MUEREN por su caso');
process.exit(malas ? 1 : 0);
