// scripts/verificacion-s5/ramas-borrables.mjs — SCRUM-637 · carril de VERIFICACIÓN
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS RAMAS REMOTAS QUE YA ESTÁN DENTRO DE `origin/main` Y SE PUEDEN BORRAR.
//
// EN SECO POR DEFECTO. No borra nada sin `--ejecutar`, y ese flag lo pone una persona.
//
// ── QUÉ ES «BORRABLE» AQUÍ, Y POR QUÉ SE DERIVA ASÍ ──────────────────────────────────────────
// Una rama es borrable si su punta es ANCESTRO de `origin/main`: entonces sus commits ya están en
// main y borrar la referencia no pierde nada. Se cruzan DOS fuentes y hacen falta las dos:
//
//   · `git ls-remote --heads origin` → qué ramas existen DE VERDAD en el remoto. Es la autoridad.
//   · `git branch -r --merged origin/main` → cuáles están dentro de main.
//
// 🔴 NO basta con la segunda. `refs/remotes/origin/*` de un clon incluye ramas YA BORRADAS por
//    otro (aquí 10 de más) mientras nadie haga `fetch --prune`: pedir su borrado da error y hace
//    ruido en una lista que hay que poder leer entera. Y no basta con la primera, obviamente,
//    porque no dice nada de si está mergeada.
//
// ── LO QUE ESTE SCRIPT NO PUEDE SABER, Y SE DICE EN VEZ DE CALLARLO ──────────────────────────
// ⚠️ Si alguna de estas ramas tiene un PR ABIERTO, borrarla lo CIERRA. Aquí no hay `gh` instalado
//    a propósito, así que este script NO puede comprobarlo. Antes de `--ejecutar`, mirar la lista
//    de PRs abiertos. Es la única comprobación que queda fuera y por eso va en mayúsculas.
// ⚠️ Borrar la rama no borra el trabajo (está en main), pero sí el NOMBRE — y el nombre es la
//    mitad del enlace ticket↔rama. Lo que lo salva es que el mensaje del commit de merge lo
//    conserva; `enlace-ticket-rama.mjs` lo recupera de ahí. Si algún día se aplastan los merges
//    (squash), esa red desaparece y esto habría que repensarlo.
//
// ── SUELO Y CONTROLES, dentro ────────────────────────────────────────────────────────────────
// · si `ls-remote` o el listado de mergeadas vienen vacíos → se declara CIEGO y no propone nada;
// · `main` NUNCA puede salir en la lista;
// · ninguna rama SIN mergear puede colarse: se comprueba contra `--no-merged`, que es la otra
//   mitad de la partición, no una negación de la primera.
//
// USO:
//   node scripts/verificacion-s5/ramas-borrables.mjs              lista + comandos (NO borra)
//   node scripts/verificacion-s5/ramas-borrables.mjs --ejecutar   borra de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const lineas = (s) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

/** Ramas que este script se niega a proponer para borrado, pase lo que pase. */
const INTOCABLES = new Set(['main', 'master', 'HEAD']);

const vivas = new Set();
for (const l of lineas(git('ls-remote', '--heads', 'origin'))) {
  const m = l.match(/^[0-9a-f]{40}\s+refs\/heads\/(.+)$/);
  if (m) vivas.add(m[1]);
}
const mergeadas = new Set(lineas(git('branch', '-r', '--merged', 'origin/main'))
  .map((x) => x.replace(/^origin\//, '')).filter((x) => !x.startsWith('HEAD')));
const sinMergear = new Set(lineas(git('branch', '-r', '--no-merged', 'origin/main'))
  .map((x) => x.replace(/^origin\//, '')));

if (!vivas.size || !mergeadas.size) {
  console.log('🔴 CIEGO: ls-remote devolvió ' + vivas.size + ' ramas y --merged ' + mergeadas.size + '.');
  console.log('   Con un cero por cualquiera de los dos lados, cualquier lista de aquí sería inventada.');
  process.exit(2);
}

/**
 * 🔴 LAS APARTADAS · dentro de `main`, pero SIN un commit de merge que las nombre.
 *
 * El riesgo de borrar una rama mergeada es que su PR siga ABIERTO — borrarla lo cierra. Aquí no
 * hay `gh`, así que ese dato no se puede consultar… pero SÍ se puede acotar, y esto lo acota:
 *
 * · Una rama que entró por su PROPIO commit de merge («Merge pull request #N from …/<rama>»)
 *   tiene su PR cerrado por definición: es el merge lo que lo cerró. Borrarla no cierra nada.
 * · Una rama cuyo contenido está dentro de `main` pero a la que NINGÚN merge nombra llegó por
 *   otra vía —la rebasaron, la absorbió otra, se aplicó a mano—. Su PR pudo quedarse abierto.
 *
 * Así que estas se APARTAN del barrido y se listan con su motivo, para mirarlas a mano. No es
 * una lista escrita: se DERIVA del histórico en cada ejecución, así que no envejece.
 *
 * ⚠️ Y el riesgo cambió: desde que los PR se abren SOLOS hay muchos más abiertos que antes, así
 * que este apartado pasó de ser prudencia a ser necesario.
 */
const nombradasPorUnMerge = new Set();
for (const asunto of lineas(git('log', '--merges', '--format=%s', 'origin/main'))) {
  for (const re of [/from\s+[\w.-]+\/([A-Za-z0-9._/-]+)/g, /\binto\s+([A-Za-z0-9._/-]+)/g]) {
    for (const m of asunto.matchAll(re)) nombradasPorUnMerge.add(m[1].replace(/^origin\//, ''));
  }
}
const dentroDeMain = [...vivas].filter((r) => mergeadas.has(r) && !INTOCABLES.has(r)).sort();
const apartadas = dentroDeMain.filter((r) => !nombradasPorUnMerge.has(r));
const borrables = dentroDeMain.filter((r) => nombradasPorUnMerge.has(r));

// ── CONTROLES, antes de enseñar nada ────────────────────────────────────────────────────────
const coladas = borrables.filter((r) => sinMergear.has(r));
const conMain = borrables.filter((r) => INTOCABLES.has(r));
console.log(`ramas vivas en el remoto: ${vivas.size} · mergeadas en main: ${mergeadas.size} · sin mergear: ${sinMergear.size}`);
console.log(`refs locales de más (ramas ya borradas por otro): ${[...mergeadas, ...sinMergear].filter((r) => !vivas.has(r)).length}`);
console.log(`CONTROL · ninguna sin mergear en la lista: ${coladas.length === 0 ? '✅' : '🔴 ' + coladas.join(', ')}`);
console.log(`CONTROL · main fuera de la lista: ${conMain.length === 0 ? '✅' : '🔴'}`);
// SUELO del apartado: si NINGUNA rama queda apartada, o quedan casi todas, el emparejador de
// nombres del histórico se ha roto y este reparto no describe nada.
const proporcion = dentroDeMain.length ? apartadas.length / dentroDeMain.length : 1;
console.log(`CONTROL · el reparto separa de verdad: ${apartadas.length} apartadas de ${dentroDeMain.length}`
  + ` (${(proporcion * 100).toFixed(1)} %) ${proporcion > 0 && proporcion < 0.25 ? '✅' : '🔴 sospechoso: el emparejador de nombres puede estar roto'}`);
if (coladas.length || conMain.length) process.exit(2);

console.log(`\n⚠️  APARTADAS DEL BARRIDO — ${apartadas.length}. Están DENTRO de main pero ningún commit`);
console.log('   de merge las nombra: su contenido llegó por otra vía, así que su PR puede seguir');
console.log('   ABIERTO y borrarlas lo cerraría. Se miran A MANO; no entran en los comandos de abajo.');
for (const r of apartadas) console.log('     ' + r);

const conNum = borrables.filter((r) => /^scrum-\d+/i.test(r));
console.log(`\nBORRABLES: ${borrables.length}  (${conNum.length} con número de ticket · ${borrables.length - conNum.length} sin número)`);
console.log(`  — todas entraron por su PROPIO commit de merge, así que su PR se cerró al mergear.\n`);
for (const r of borrables) console.log('  ' + r);

// ── LOS COMANDOS ────────────────────────────────────────────────────────────────────────────
// En tandas: una línea con 463 nombres se pasa del límite de la consola en Windows.
const TANDA = 40;
const tandas = [];
for (let i = 0; i < borrables.length; i += TANDA) tandas.push(borrables.slice(i, i + TANDA));

if (process.argv.includes('--ejecutar')) {
  console.log(`\n⚠️  BORRANDO DE VERDAD — ${borrables.length} ramas en ${tandas.length} tandas\n`);
  let n = 0;
  for (const [i, t] of tandas.entries()) {
    process.stdout.write(`  tanda ${i + 1}/${tandas.length} (${t.length})… `);
    try { git('push', 'origin', '--delete', ...t); n += t.length; console.log('ok'); }
    catch (e) { console.log('🔴 falló: ' + String(e.message).split('\n')[0]); }
  }
  console.log(`\nborradas: ${n} de ${borrables.length}`);
  console.log('Y ahora, en CADA clon y worktree, para que las refs locales dejen de mentir:');
  console.log('  git fetch --prune origin');
} else {
  console.log(`\n══ EN SECO. No se ha borrado nada. ═══════════════════════════════════════════════`);
  console.log('⚠️  ANTES DE LANZARLO: si alguna de estas ramas tiene un PR ABIERTO, borrarla lo CIERRA.');
  console.log('   Aquí no hay `gh` instalado, así que esto NO lo puede comprobar el script.\n');
  console.log('Para borrarlas, lo más cómodo:');
  console.log('   node scripts/verificacion-s5/ramas-borrables.mjs --ejecutar\n');
  console.log(`O a mano, ${tandas.length} tandas de ${TANDA} (la lista se deriva en el momento, no está congelada):\n`);
  for (const t of tandas.slice(0, 2)) console.log('git push origin --delete ' + t.join(' ') + '\n');
  if (tandas.length > 2) console.log(`… y ${tandas.length - 2} tandas más. Para volcarlas todas a un fichero:`);
  console.log("   node scripts/verificacion-s5/ramas-borrables.mjs | grep '^git push' > borrar-ramas.sh");
}
