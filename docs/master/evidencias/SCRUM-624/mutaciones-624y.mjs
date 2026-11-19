// docs/master/evidencias/SCRUM-624/mutaciones-624y.mjs — SCRUM-624y
// Corre las mutaciones declaradas en MUTACIONES_QUE_ME_TUMBAN de los dos tests que toca 624y con
// el `aplicarUna` del catálogo de la casa (scripts/meta-guard-mutaciones.mjs). Uso, desde la raíz:
//   node docs/master/evidencias/SCRUM-624/mutaciones-624y.mjs
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = process.cwd();
const { correr, aplicarUna } = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const GUARDS = ['scrum624y-pdf-r1-total-del-desglose.test.mjs', 'scrum624e-a-solo-en-f1.test.mjs'];
let vivas = 0; let total = 0;
for (const guard of GUARDS) {
  const { MUTACIONES_QUE_ME_TUMBAN: muts } = await import(pathToFileURL(path.join(RAIZ, 'tests', guard)).href);
  const limpia = await correr(guard);
  for (const mut of muts) {
    total += 1;
    const r = await aplicarUna(mut, guard, limpia);
    if (r.ok) vivas += 1;
    console.log(`${r.ok ? 'VIVA' : 'NO-VIVA'} · ${guard} · ${mut.cae} · ${JSON.stringify({ ...r, ok: undefined }).slice(0, 300)}`);
  }
}
console.log(`mutaciones=${total} vivas=${vivas}`);
process.exit(total > 0 && vivas === total ? 0 : 1);
