// Réplica LOCAL y acotada del meta-guard, sólo para `tests/scrum813-trinquete-de-zona.test.mjs`:
// por cada mutación declarada — aplica, corre el fichero, exige que caiga SU caso, restaura y compara bytes.
// El oficial es `npm run meta:mutaciones` (job del CI). Esto es el «rojo primero» antes de empujar.
//   node mutar-813.mjs <raiz del worktree>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2]);
const TEST = path.join(RAIZ, 'tests', 'scrum813-trinquete-de-zona.test.mjs');
const env = { ...process.env }; delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const { MUTACIONES_QUE_ME_TUMBAN: M } = await import(pathToFileURL(TEST).href + '?' + Date.now());

const correr = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const lineas = (r.stdout || '').split('\n');
  const caidos = lineas.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, '').trim());
  const total = Number((lineas.find((l) => /^# tests /.test(l)) || '').replace(/\D/g, '')) || 0;
  return { status: r.status, caidos, total };
};

const base = correr();
console.log(`POBLACION · ${M.length} mutaciones declaradas · node ${process.version}`);
console.log(`BASE sin mutar · exit ${base.status} · ${base.total} pruebas · caídas ${base.caidos.length}`);
if (base.status !== 0 || !base.total) { console.log('🔴 la BASE no está verde: no se muta nada'); console.log('EXIT=2'); process.exit(2); }

let mal = 0;
for (const [i, m] of M.entries()) {
  const f = path.join(RAIZ, m.fichero);
  const original = fs.readFileSync(f);
  const texto = original.toString('utf8');
  const veces = texto.split(m.de).length - 1;
  let fila;
  if (veces !== 1) { fila = `🔴 ANCLA: «de» casa ${veces} veces (tiene que ser 1)`; mal++; }
  else {
    try {
      fs.writeFileSync(f, texto.replace(m.de, m.a));
      const aplicada = !fs.readFileSync(f).equals(original);
      const r = correr();
      const suyo = r.caidos.some((c) => c.includes(m.cae));
      fila = `${aplicada ? 'aplicada' : '🔴 NO APLICADA'} · exit ${r.status} · ${r.total} pruebas · cae lo suyo: ${suyo ? 'SÍ' : '🔴 NO'} · caídas ${r.caidos.length}`
        + (r.caidos.length > 1 ? `\n        además: ${r.caidos.filter((c) => !c.includes(m.cae)).map((c) => c.slice(0, 90)).join(' | ')}` : '');
      if (!aplicada || !suyo || !r.total) mal++;
    } finally {
      fs.writeFileSync(f, original);
    }
    if (!fs.readFileSync(f).equals(original)) { fila += ' · 🔴 NO RESTAURADA'; mal++; }
  }
  console.log(`  ${String(i + 1).padStart(2)} · ${m.cae.slice(0, 78)}\n        ${fila}`);
}
const fin = correr();
console.log(`FINAL restaurado · exit ${fin.status} · ${fin.total} pruebas · caídas ${fin.caidos.length}`);
console.log(`RESUMEN · ${M.length - mal} de ${M.length} mutaciones tumban su caso`);
console.log(`EXIT=${mal || fin.status ? 1 : 0}`);
process.exit(mal || fin.status ? 1 : 0);
