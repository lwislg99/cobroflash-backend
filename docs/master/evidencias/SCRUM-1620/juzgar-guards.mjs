// Juzga sólo los guards nombrados con la maquinaria del meta-guard (limpia + cada mutación declarada).
// Uso (desde la raíz del worktree): node <este> guard1.test.mjs guard2.test.mjs …
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const raiz = process.cwd();
const m = await import(pathToFileURL(path.join(raiz, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const censo = m.censoDeDeclaraciones();
let malas = 0;
for (const guard of process.argv.slice(2)) {
  const e = censo.find((c) => c.guard === guard);
  if (!e) { console.log(`? ${guard} · NO ESTÁ EN EL CENSO`); malas++; continue; }
  const limpia = await m.correr(guard);
  for (const mut of e.mutaciones) {
    const r = await m.aplicarUna(mut, guard, limpia);
    const v = r.ok ? 'VIVA' : r.mudo ? 'MUDA' : r.muerto ? 'MUERTO' : 'CIEGA';
    if (!r.ok) malas++;
    console.log(`${v.padEnd(6)} ${guard} · ${mut.cae}${r.ok ? '' : ` · ${r.mudo || r.ciego || r.muerto}`}`);
  }
}
console.log(`\n${malas ? `🔴 ${malas} no vivas` : 'todas VIVAS'}`);
process.exit(malas ? 1 : 0);
