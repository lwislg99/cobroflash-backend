// Corre el meta-guard de UN guard, con las mismas funciones que la pasada entera (correr + aplicarUna),
// e imprime cada veredicto con su mensaje completo y su tiempo.
//   node uno-guard.mjs <raiz del árbol> <guard.test.mjs>
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [raiz, guard] = process.argv.slice(2);
const m = await import(pathToFileURL(path.join(raiz, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const entrada = m.censoDeDeclaraciones().find((c) => c.guard === guard);
if (!entrada) { console.log(`CIEGO: ${guard} no está en el censo`); process.exit(2); }
console.log(`${guard}: ${entrada.mutaciones.length} mutaciones declaradas`);
let t = Date.now();
const limpia = await m.correr(guard);
console.log(`limpia: ${limpia.pasados.length} pasados · ${limpia.caidos.length} caídos · ${limpia.saltados.length} saltados · ${Date.now() - t} ms`);
const cuenta = { viva: 0, muda: 0, ciega: 0, muerto: 0 };
for (const [i, mut] of entrada.mutaciones.entries()) {
  t = Date.now();
  const r = await m.aplicarUna(mut, guard, limpia);
  const v = r.ok ? 'viva' : r.muerto ? 'muerto' : r.mudo ? 'muda' : 'ciega';
  cuenta[v] += 1;
  console.log(`  #${i + 1} ${v.toUpperCase()} · ${mut.cae} · ${Date.now() - t} ms`);
  if (!r.ok) console.log(`     ${String(r.muerto || r.mudo || r.ciego).split('\n').join('\n     ')}`);
}
console.log(`RESUMEN ${guard}: vivas ${cuenta.viva} · mudas ${cuenta.muda} · ciegas ${cuenta.ciega} · muertos ${cuenta.muerto}`);
