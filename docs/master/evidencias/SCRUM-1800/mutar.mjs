// SCRUM-1800 · la mutación declarada en MUTACIONES_QUE_ME_TUMBAN de
// `tests/scrum1800-cancelar-cobro-con-documento-pagado.test.mjs`, pasada UNA vez con `aplicarUna`
// de la casa (`scripts/meta-guard-mutaciones.mjs`). Molde: `docs/master/evidencias/scrum908b/banco-mut2.mjs`.
// Uso: node docs/master/evidencias/SCRUM-1800/mutar.mjs <raíz del árbol>   (con `dist/` compilado)
// La línea base se repite al final: si cambia, el veredicto no vale y lo dice.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.argv[2] || process.cwd();
const mod = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const { censoDeDeclaraciones, correr, aplicarUna } = mod;
const GUARD = 'scrum1800-cancelar-cobro-con-documento-pagado.test.mjs';

const decl = censoDeDeclaraciones().find((c) => c.guard === GUARD);
if (!decl) { console.log(`🔴 CIEGO: el censo no ve la declaración de ${GUARD}`); process.exit(2); }
console.log(`declaraciones de ${GUARD}: ${decl.mutaciones.length}`);

const firma = (r) => `pass=${r.pasados.length} fail=${r.caidos.length} skip=${r.saltados.length} movidos=${r.movidos.length}`;
const limpia = await correr(GUARD);
console.log(`LINEA BASE: ${firma(limpia)}`);

let vivas = 0;
for (const [i, mut] of decl.mutaciones.entries()) {
  const r = await aplicarUna(mut, GUARD, limpia);
  const v = r.ok ? 'VIVA' : (r.muerto ? 'MUERTA' : (r.mudo ? 'MUDA' : 'CIEGA'));
  if (v === 'VIVA') vivas += 1;
  console.log(`  [${i + 1}] ${v} · ${mut.fichero} · cae: ${mut.cae}`);
  if (v !== 'VIVA') console.log('      ' + String(r.mudo || r.ciego || r.muerto).replace(/\n/g, '\n      '));
}

const limpia2 = await correr(GUARD);
const igual = firma(limpia) === firma(limpia2);
console.log(`LINEA BASE AL FINAL: ${firma(limpia2)} ${igual ? '(IGUAL: el veredicto vale)' : '🔴 (CAMBIO: el veredicto NO vale)'}`);
console.log(`RESULTADO · vivas ${vivas} de ${decl.mutaciones.length}`);
process.exit(igual && vivas === decl.mutaciones.length ? 0 : 1);
