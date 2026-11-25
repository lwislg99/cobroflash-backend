// SCRUM-1532d/e · las mutaciones de la ficha, con las MISMAS funciones del meta-guard
// (`mutacionesDeclaradas`, `correr`, `aplicarUna`, que restaura cada fichero), en dos tandas:
//   ① el catálogo `MUTACIONES_QUE_ME_TUMBAN` de tests/scrum1532d-cancelar-cobro-ficha-y-reenvio.test.mjs;
//   ② UNA VEZ contra tests/scrum707-estado-no-contemplado.test.mjs: «un estado distinto de `pending`
//      ofrece `btnCancelarCobro`» (el registro de acciones lo pasa a `overflow` en `paid`).
//   node docs/master/evidencias/scrum1532/mutar-1532e.mjs        (desde la raíz; sale 0 si todas tumban)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.cwd();
const M = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')).href);

const tandas = [];
const PROPIO = 'scrum1532d-cancelar-cobro-ficha-y-reenvio.test.mjs';
tandas.push([PROPIO, M.mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, 'tests', PROPIO), 'utf8'), PROPIO)]);
tandas.push(['scrum707-estado-no-contemplado.test.mjs', [{
  fichero: 'public/dashboard/js/invoiceActionsRegistry.js',
  de: "{ id: 'btnCancelarCobro', destinos: { pending: 'overflow',    paid: 'oculta',",
  a: "{ id: 'btnCancelarCobro', destinos: { pending: 'overflow',    paid: 'overflow',",
  cae: 'SCRUM-707 · ✅ CONTROL POSITIVO: los estados conocidos ofrecen lo mismo que antes',
}]]);

let total = 0;
let vivas = 0;
for (const [guard, muts] of tandas) {
  const limpia = await M.correr(guard);
  console.log(`${guard} · limpia: ${limpia.pasados.length} pasan · ${limpia.caidos.length} caen · ${muts.length} mutaciones`);
  for (const m of muts) {
    total += 1;
    const r = await M.aplicarUna(m, guard, limpia);
    if (r.ok) vivas += 1;
    console.log(`  ${r.ok ? '✔ TUMBA' : r.mudo ? '✖ MUDA' : r.muerto ? '☠ MUERTO' : '? CIEGA'} · ${m.cae}${r.ok ? '' : ` · ${r.mudo || r.muerto || r.ciego}`}`);
  }
}
// Población declarada: si no hay ninguna mutación, esto no ha medido nada.
console.log(`tumban ${vivas} de ${total}`);
process.exit(total > 0 && vivas === total ? 0 : 1);
