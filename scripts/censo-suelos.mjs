#!/usr/bin/env node
// scripts/censo-suelos.mjs — SCRUM-775
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿QUÉ SUELOS ESTÁN ESCRITOS Y NO CONECTADOS?
//
//   node scripts/censo-suelos.mjs            → el censo
//   node scripts/censo-suelos.mjs --ciegos   → además, los que NO ha sabido leer, uno a uno
//
// Un guard que lee una propiedad que su productor NUNCA fabrica es una decoración: se lee bien,
// parece una protección, y su condición no puede ser cierta jamás.
//
// EL CASO QUE LO ORIGINA: `censo-tablero-vs-arbol.mjs` preguntaba `suelo.ok === false` sobre el
// array que devuelve `comprobarSuelo`. Provocado con `docs/master/` encogido de 28 entradas a 3,
// el suelo devolvía 1 problema y el CLI salía con 0, informe completo y stderr vacío.
//
// ⛔ ESTO NO ARREGLA NADA Y NO DECIDE NADA. Imprime, y lo que dice hay que ir a comprobarlo.
//
// ⚠️ «CONECTADO» significa que la comparación PUEDE ser cierta, **no** que sea la comparación
// acertada. Un umbral mal puesto sale conectado y sigue estando mal: eso no lo ve este censo.
//
// SALIDAS: 0 sin hallazgos · 1 hay suelos no conectados · 2 no supe medir.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import path from 'node:path';
import { fileURLToPath } from 'node:url';   // SCRUM-730: `pathname` no decodifica el espacio
import { censar, ficherosDe, motivosParaNoFiarse, POBLACION } from './_censo-suelos.mjs';

const AQUI = fileURLToPath(import.meta.url);
const RAIZ = path.join(path.dirname(AQUI), '..');

export const SALIDA_HALLAZGOS = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

if (process.argv[1] && path.resolve(process.argv[1]) === AQUI) {
  const censo = censar(ficherosDe(RAIZ));

  console.log(`\n${'═'.repeat(88)}`);
  console.log('CENSO DE SUELOS · ¿qué protecciones están escritas y NO conectadas?');
  console.log(`${'═'.repeat(88)}`);
  console.log(`  árbol ....... ${RAIZ}`);
  console.log(`  población ... ${censo.ficheros} ficheros .mjs de ${POBLACION.map((d) => d + '/').join(' y ')}`);
  console.log(`  unidad ...... GUARDS (un \`if\` que corta) que leen una propiedad de un valor producido`);
  console.log(`  vistos ...... ${censo.guards}`);

  // 🔴 EL SUELO DE ESTE CENSO, antes de enseñar ningún hallazgo. Un cero sobre población vacía no
  // es un cero: si no ha reconocido ni un guard, su «no hay suelos rotos» no significa nada.
  const motivos = motivosParaNoFiarse(censo);
  if (motivos.length) {
    console.error('\n🔴 NO SE HA PODIDO MEDIR — no se informa de nada:\n');
    for (const m of motivos) console.error(`   · ${m}`);
    console.error('');
    process.exit(SALIDA_NO_SUPE_MEDIR);
  }

  console.log(`\n\n🔴 NO CONECTADOS · la condición NO puede ser cierta nunca  (${censo.noConectados.length})\n`);
  if (!censo.noConectados.length) console.log('   (ninguno)');
  for (const x of censo.noConectados) {
    console.log(`   ${x.donde}`);
    console.log(`      \`${x.variable}.${x.prop}\` — \`${x.fn}\` devuelve ${x.devuelve}: nunca hay \`.${x.prop}\``);
  }

  console.log(`\n\n✔ CONECTADOS · la propiedad existe, así que el guard PUEDE saltar  (${censo.conectados.length})`);
  console.log('   Es el CONTROL POSITIVO del censo: si esta lista sale vacía, el detector no está');
  console.log('   reconociendo suelos buenos y su lista de arriba no significa nada.\n');
  for (const x of censo.conectados.slice(0, 8)) console.log(`   ${x.donde.padEnd(52)} ${x.variable}.${x.prop} ← ${x.fn}`);
  if (censo.conectados.length > 8) console.log(`   … y ${censo.conectados.length - 8} más (\`--ciegos\` los lista todos)`);

  console.log(`\n\n? NO SÉ LEER · declarados aparte, NUNCA contados como «conectados»  (${censo.ciegos.length})`);
  console.log('   Un veredicto sobre lo que no se ha podido leer sería el defecto mismo.\n');
  if (process.argv.includes('--ciegos')) {
    for (const x of censo.ciegos) console.log(`   ${x.donde.padEnd(52)} ${x.variable}.${x.prop} — ${x.porque}`);
  } else {
    console.log(`   (${censo.ciegos.length}; con \`--ciegos\` se listan uno a uno)`);
  }

  console.log(`\n${'═'.repeat(88)}`);
  console.log('⚠️ «CONECTADO» dice que la comparación PUEDE ser cierta, no que sea la acertada.');
  console.log(`${'═'.repeat(88)}\n`);

  if (censo.noConectados.length) process.exit(SALIDA_HALLAZGOS);
}
