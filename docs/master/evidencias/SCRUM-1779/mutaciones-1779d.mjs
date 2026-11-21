import fs from "node:fs";
import path from "node:path";
// Driver de un solo uso (SCRUM-1779d): aplica las mutaciones declaradas de un test con `aplicarUna`.
import { pathToFileURL } from 'node:url';
const RAIZ = process.argv[2];
const guard = path.basename(process.argv[3]);
const mg = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const muts = mg.mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, "tests", guard), "utf8"), path.basename(guard));
console.log(`=== ${guard} · declaradas: ${muts.length}`);
const limpia = await mg.correr(guard);
console.log(`BASE: pasan ${limpia.pasados.length} · caen ${limpia.caidos.length} · saltados ${limpia.saltados?.length ?? 0}`);
let vivas = 0;
for (const [i, m] of muts.entries()) {
  const r = await mg.aplicarUna(m, guard, limpia);
  if (r.ok) vivas++;
  console.log(`${i + 1}. ${m.fichero} · «${m.a.slice(0, 60)}» → ${r.ok ? 'TUMBA' : 'NO TUMBA'} ${JSON.stringify({ ok: r.ok, mudo: r.mudo, ciego: r.ciego, muerto: r.muerto, colaterales: r.colaterales }).slice(0, 300)}`);
}
// Control positivo sembrado: una mutación cuyo `cae` no existe tiene que salir CIEGA, no viva.
const ctl = await mg.aplicarUna({ ...muts[0], cae: 'CONTROL-cae-que-no-existe-1779d' }, guard, limpia);
console.log(`CONTROL-ciego → ${ctl.ok ? 'TUMBA (instrumento roto)' : (ctl.ciego ? 'CIEGO (bien)' : JSON.stringify(ctl).slice(0, 200))}`);
console.log(`RESUMEN: ${vivas}/${muts.length} tumban`);
