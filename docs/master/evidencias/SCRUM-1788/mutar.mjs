// SCRUM-1788a · aplica las MUTACIONES_QUE_ME_TUMBAN del test con el `aplicarUna` de la casa.
// Uso (desde la raíz del worktree): node docs/master/evidencias/SCRUM-1788/mutar.mjs
import { aplicarUna, correr } from '../../../../scripts/meta-guard-mutaciones.mjs';
import { MUTACIONES_QUE_ME_TUMBAN } from '../../../../tests/scrum1788a-emisor-no-pisa-la-tabla.test.mjs';

const guard = 'scrum1788a-emisor-no-pisa-la-tabla.test.mjs';
const limpia = await correr(guard);
for (const mut of MUTACIONES_QUE_ME_TUMBAN) {
  const r = await aplicarUna(mut, guard, limpia);
  console.log(JSON.stringify({ cae: mut.cae, ok: r.ok, ciego: r.ciego ?? null, muda: r.muda ?? null, colaterales: r.colaterales ?? null }));
}
