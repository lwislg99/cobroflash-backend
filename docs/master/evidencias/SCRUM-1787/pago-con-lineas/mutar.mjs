// SCRUM-1787h · aplica las MUTACIONES_QUE_ME_TUMBAN del test con el `aplicarUna` de la casa.
// Uso (desde la raíz del worktree): node docs/master/evidencias/SCRUM-1787/pago-con-lineas/mutar.mjs
import { aplicarUna, correr } from '../../../../../scripts/meta-guard-mutaciones.mjs';
import { MUTACIONES_QUE_ME_TUMBAN } from '../../../../../tests/scrum1787h-pago-con-lineas.test.mjs';

const guard = 'scrum1787h-pago-con-lineas.test.mjs';
const limpia = await correr(guard);
for (const mut of MUTACIONES_QUE_ME_TUMBAN) {
  const r = await aplicarUna(mut, guard, limpia);
  console.log(JSON.stringify({ cae: mut.cae, ok: r.ok, ciego: r.ciego ?? null, muda: r.muda ?? null, colaterales: r.colaterales ?? null }));
}
