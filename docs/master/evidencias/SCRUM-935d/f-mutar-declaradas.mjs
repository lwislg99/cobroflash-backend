// Aplica UNA a UNA las mutaciones declaradas de un test, corre ESE test, dice qué cae, y restaura.
//   node mutar-declaradas.mjs <raiz> <tests/x.test.mjs>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const [raiz, rel] = process.argv.slice(2);
const { MUTACIONES_QUE_ME_TUMBAN: muts } = await import(pathToFileURL(path.join(raiz, rel)).href);
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_TEST_CONTEXT;
const correr = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--import=./scripts/tuberia-bloqueante.mjs', rel], { cwd: raiz, env, encoding: 'utf8' });
  return { status: r.status, caidos: [...new Set([...r.stdout.matchAll(/^✖ (.+?) \(\d/gm)].map((m) => m[1]))] };
};
const base = correr();
console.log(`BASE sin mutar: status ${base.status} · caídos ${base.caidos.length}`);
if (base.status !== 0) process.exit(2);
for (const [i, m] of muts.entries()) {
  const abs = path.join(raiz, m.fichero);
  const original = fs.readFileSync(abs);
  const t = original.toString('utf8');
  if (t.split(m.de).length !== 2) { console.log(`#${i + 1} CIEGO: ancla no única`); continue; }
  fs.writeFileSync(abs, t.replace(m.de, m.a));
  try {
    const numstat = execFileSync('git', ['diff', '--numstat', '--', m.fichero], { cwd: raiz, encoding: 'utf8' }).trim();
    const r = correr();
    const cayo = r.caidos.some((n) => n.includes(m.cae));
    console.log(`#${i + 1} ${cayo ? 'CAE' : 'NO CAE'} · numstat «${numstat}» · status ${r.status} · caídos: ${r.caidos.join(' | ')}`);
  } finally {
    fs.writeFileSync(abs, original);
  }
}
console.log(`restaurado: «${execFileSync('git', ['status', '--porcelain', '--', 'scripts', 'tests'], { cwd: raiz, encoding: 'utf8' }).trim()}»`);
