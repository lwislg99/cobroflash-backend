// SCRUM-1868d · aplica las MUTACIONES_QUE_ME_TUMBAN del test con el `aplicarUna` de la casa.
// Uso (desde la raíz del worktree, con el árbol quieto): node docs/master/evidencias/SCRUM-1868/mutar-1868d.mjs [desde] [hasta]
// Sin argumentos, las 12; con ellos, el tramo [desde, hasta) del catálogo (cada mutación recompila).
import { aplicarUna, correr } from '../../../../scripts/meta-guard-mutaciones.mjs';
import { MUTACIONES_QUE_ME_TUMBAN } from '../../../../tests/scrum1868a-borrar-cliente-rutas.test.mjs';

const guard = 'scrum1868a-borrar-cliente-rutas.test.mjs';
const [desde = 0, hasta = MUTACIONES_QUE_ME_TUMBAN.length] = process.argv.slice(2).map(Number);
const limpia = await correr(guard);
console.log(JSON.stringify({ catalogo: MUTACIONES_QUE_ME_TUMBAN.length, tramo: [desde, hasta] }));
for (const mut of MUTACIONES_QUE_ME_TUMBAN.slice(desde, hasta)) {
  const r = await aplicarUna(mut, guard, limpia);
  console.log(JSON.stringify({ cae: mut.cae, ok: r.ok, ciego: r.ciego ?? null, muda: r.muda ?? null, colaterales: r.colaterales ?? null }));
}
