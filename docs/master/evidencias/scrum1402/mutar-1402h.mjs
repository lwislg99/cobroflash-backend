// Corre a mano las MUTACIONES_QUE_ME_TUMBAN de los tests dados (sobre src/ + tsc --noCheck), y
// exige que caiga un caso cuyo nombre contenga `cae`. Restaura y verifica por bytes. Uso:
//   node mutar.mjs <tsc> <test1> [<test2> ...]    (desde la raíz del árbol)
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const [tsc, ...tests] = process.argv.slice(2);
const build = () => execFileSync(process.execPath, [tsc.replace(/\.bin\/tsc$/, 'typescript/bin/tsc'), '--noCheck'], { stdio: 'pipe' });
const entorno = { ...process.env };
delete entorno.NODE_TEST_CONTEXT; delete entorno.NODE_OPTIONS;
const correr = (t) => {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', t], { encoding: 'utf8', env: entorno, maxBuffer: 64e6 });
  const caen = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  const pasan = [...r.stdout.matchAll(/^ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { caen, pasan, status: r.status };
};

let filas = 0;
for (const t of tests) {
  const txt = fs.readFileSync(t, 'utf8');
  const i = txt.indexOf('export const MUTACIONES_QUE_ME_TUMBAN = [');
  const lista = new Function('return ' + txt.slice(txt.indexOf('[', i), txt.lastIndexOf('];') + 1))();
  const base = correr(t);
  console.log(`\n${t} · BASE sin mutar: ${base.pasan.length} pasan, ${base.caen.length} caen (exit ${base.status})`);
  if (base.caen.length || !base.pasan.length) { console.log('  CIEGO: la base no está verde'); continue; }
  for (const m of lista) {
    const orig = fs.readFileSync(m.fichero);
    const s = orig.toString('utf8');
    const veces = s.split(m.de).length - 1;
    if (veces !== 1) { console.log(`  CIEGA: «${m.de.slice(0, 50)}» aparece ${veces} veces`); continue; }
    fs.writeFileSync(m.fichero, s.replace(m.de, m.a));
    let r;
    try { build(); r = correr(t); } finally {
      fs.writeFileSync(m.fichero, orig);
      if (!fs.readFileSync(m.fichero).equals(orig)) { console.log('NO RESTAURADO'); process.exit(3); }
    }
    filas += 1;
    const casa = r.caen.filter((n) => n.includes(m.cae));
    console.log(`  ${casa.length ? 'VIVA (cae)' : 'MUDA'} · cae «${m.cae}» · caen ${r.caen.length}: ${r.caen.map((n) => n.slice(0, 60)).join(' | ')}`);
  }
}
build();
console.log(`\nmutaciones ejecutadas: ${filas} · dist reconstruido limpio`);
