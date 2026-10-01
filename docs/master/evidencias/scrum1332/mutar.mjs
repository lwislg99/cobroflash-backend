// mutar.mjs <fichero de test> — aplica A MANO cada MUTACIONES_QUE_ME_TUMBAN del test, lo corre y
// dice si cae el caso declarado. Restaura con git y comprueba los bytes. Uso desde la raiz del arbol.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';

const guard = process.argv[2];
const fuente = fs.readFileSync(guard, 'utf8');
const bloque = /export const MUTACIONES_QUE_ME_TUMBAN = (\[[\s\S]*?\n\]);/.exec(fuente);
const mutaciones = new Function(`return ${bloque[1]}`)();
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS; delete env.FORCE_COLOR;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);

const corre = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', guard], { env, encoding: 'utf8', timeout: 300_000 });
  const caidos = [...r.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]);
  const total = Number((/^# tests (\d+)$/m.exec(r.stdout) || [])[1] ?? NaN);
  return { status: r.status, caidos, total };
};

console.log(`POBLACION: ${mutaciones.length} mutaciones declaradas en ${guard}`);
const base = corre();
console.log(`BASE sin mutar: exit=${base.status} · tests=${base.total} · caidos=${base.caidos.length}`);
if (base.status !== 0) { console.log('CIEGO: la base no esta verde'); process.exit(2); }

let vivas = 0;
for (const [i, m] of mutaciones.entries()) {
  const abs = path.resolve(m.fichero);
  const antes = fs.readFileSync(abs);
  const texto = antes.toString('utf8');
  const veces = texto.split(m.de).length - 1;
  if (veces !== 1) { console.log(`#${i} CIEGA: el ancla aparece ${veces} veces en ${m.fichero}`); continue; }
  fs.writeFileSync(abs, texto.replace(m.de, m.a));
  const numstat = execFileSync('git', ['diff', '--numstat', '--', m.fichero], { encoding: 'utf8' }).trim();
  let r;
  try { r = corre(); } finally { fs.writeFileSync(abs, antes); }
  const igual = sha(fs.readFileSync(abs)) === sha(antes);
  const cae = r.caidos.filter((n) => n.includes(m.cae));
  const veredicto = cae.length ? 'VIVA' : 'MUDA';
  if (cae.length) vivas += 1;
  console.log(`#${i} ${veredicto} · ${m.fichero} · numstat «${numstat}» · exit=${r.status} · caidos=${r.caidos.length}/${r.total} · restaurado=${igual}`);
  for (const n of r.caidos) console.log(`     cae: ${n.slice(0, 110)}`);
}
console.log(`RESULTADO: ${vivas} vivas de ${mutaciones.length}`);
console.log(`git status: «${execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim()}»`);
console.log('EXIT=0');
