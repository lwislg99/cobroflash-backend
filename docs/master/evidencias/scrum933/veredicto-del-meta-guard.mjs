// docs/master/evidencias/scrum933/veredicto-del-meta-guard.mjs — SCRUM-933
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL VEREDICTO DEL META-GUARD SOBRE UN SOLO GUARD, con sus propias piezas.
//
// `npm run meta:mutaciones` no deja elegir guard: ejecuta todas las declaraciones del árbol, y en
// CI tardó 7m47s. Esto usa las MISMAS funciones exportadas —`lecturaDeDeclaraciones` (el AST que
// lee las declaraciones, sin copiarlas), `correr` (la línea base) y `aplicarUna` (las puertas, la
// mutación, la restauración byte a byte)— sobre `scrum864c` solo. Así el veredicto no lo emite un
// banco de esta tanda: lo emite el instrumento de la casa, y además comprueba lo que la sonda
// independiente no puede ver, que el `cae` declarado CASE con el título del test.
//
//     node docs/master/evidencias/scrum933/veredicto-del-meta-guard.mjs
//
// Salidas, las del meta-guard: 0 vivas todas · 1 alguna muda · 2 alguna ciega · 3 no restaurado.
// Importar el módulo no arranca su bloque principal: lo impide su puerta (SCRUM-765).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const GUARD = 'scrum864c-el-temporal-no-vuelve.test.mjs';
const mg = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ, f))).digest('hex');

const lectura = mg.lecturaDeDeclaraciones(fs.readFileSync(path.join(RAIZ, 'tests', GUARD), 'utf8'), GUARD);
const incompletas = lectura.incompletas || [];
console.log(`declaraciones legibles ${lectura.buenas.length} · incompletas ${incompletas.length}`);
if (!lectura.buenas.length || incompletas.length) {
  console.error('🔴 CIEGO: no hay declaraciones legibles, o hay alguna que no se puede evaluar.');
  process.exit(2);
}
const piezas = [...new Set(lectura.buenas.map((m) => m.fichero))];
const antes = new Map(piezas.map((f) => [f, sha(f)]));

const limpia = await mg.correr(GUARD);
console.log(`LÍNEA BASE · pasados ${limpia.pasados.length} · caídos ${limpia.caidos.length} `
  + `· saltados ${limpia.saltados.length} · movidos ${(limpia.movidos || []).length}`);
let vivas = 0; let mudas = 0; let ciegas = 0;
for (const [i, mut] of lectura.buenas.entries()) {
  console.log(`\n· mutación ${i + 1} · cae: «${mut.cae}»`);
  const r = await mg.aplicarUna(mut, GUARD, limpia);
  if (r.ok) {
    vivas += 1;
    console.log(`  ✔ VIVA · colaterales ${r.colaterales}`);
    for (const c of r.colateralesNombres) console.log(`      + ${c}`);
  } else if (r.mudo) { mudas += 1; console.log(`  ✖ MUDA · ${r.mudo}`); }
  else { ciegas += 1; console.log(`  ? CIEGA · ${r.ciego || r.muerto}`); }
}
const sinRestaurar = piezas.filter((f) => sha(f) !== antes.get(f));
console.log(`\nvivas ${vivas} · mudas ${mudas} · ciegas ${ciegas}  `
  + `(sobre ${lectura.buenas.length} declaradas en ${GUARD})`);
console.log(`piezas restauradas por sha256: ${piezas.length - sinRestaurar.length} de ${piezas.length}`
  + (sinRestaurar.length ? `  🔴 SIN RESTAURAR: ${sinRestaurar.join(', ')}` : ' ✔'));
process.exitCode = sinRestaurar.length ? 3 : mudas ? 1 : ciegas ? 2 : 0;
