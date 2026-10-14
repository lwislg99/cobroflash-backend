// scripts/verificacion-s5/ramas-borrables.mjs — SCRUM-637 · carril de VERIFICACIÓN
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS RAMAS REMOTAS QUE YA ESTÁN DENTRO DE `origin/main` Y SE PUEDEN BORRAR.
//
// EN SECO POR DEFECTO. No borra nada sin `--ejecutar`, y ese flag lo pone una persona.
//
// ── QUÉ ES «BORRABLE» AQUÍ, Y POR QUÉ SE DERIVA ASÍ ──────────────────────────────────────────
// Una rama es borrable si su punta VIVA —la que tiene el remoto AHORA, leída con
// `git ls-remote --heads origin`— es ANCESTRO de `origin/main`: entonces sus commits ya están en main
// y borrar la referencia no pierde nada.
//
// 🔴 SCRUM-1540 (14-oct-2026). Hasta entonces «dentro de main» salía de `git branch -r --merged`, que
//    lee las refs LOCALES `refs/remotes/origin/*`. Si alguien empuja un commit nuevo a una rama ya
//    mergeada y este clon no ha hecho `fetch`, la ref local sigue en la punta vieja, dice «mergeada»,
//    y el guion proponía borrar el commit nuevo. Visto en rojo en un remoto de juguete con el guion
//    sin tocar, con sus tres controles en verde. Ahora se pregunta por el sha VIVO, y la respuesta
//    tiene TRES valores, no dos (`veredictoDeAncestro`): dentro (0), fuera (1) y NO SE PUEDE SABER
//    (128: ese sha no está en este clon, o cualquier otro código). El tercero NUNCA es borrable: un
//    acto irreversible pide certeza positiva, no ausencia de prueba en contra.
//
// ── LO QUE ESTE SCRIPT NO PUEDE SABER, Y SE DICE EN VEZ DE CALLARLO ──────────────────────────
// ⚠️ Si alguna de estas ramas tiene un PR ABIERTO, borrarla lo CIERRA. Aquí no hay `gh` instalado
//    a propósito, así que este script NO puede comprobarlo. Antes de `--ejecutar`, mirar la lista
//    de PRs abiertos. Es la única comprobación que queda fuera y por eso va en mayúsculas.
// ⚠️ Borrar la rama no borra el trabajo (está en main), pero sí el NOMBRE — y el nombre es la
//    mitad del enlace ticket↔rama. Lo que lo salva es que el mensaje del commit de merge lo
//    conserva; `enlace-ticket-rama.mjs` lo recupera de ahí. Si algún día se aplastan los merges
//    (squash), esa red desaparece y esto habría que repensarlo.
// ⚠️ Entre la lista y el borrado pasa tiempo: un commit empujado a una rama DESPUÉS de listarla se
//    borra con ella. `--ejecutar` vuelve a leer el remoto justo antes y no borra la que se movió.
//
// ── SUELO Y CONTROLES, dentro ────────────────────────────────────────────────────────────────
// · si `ls-remote` viene vacío, o NINGUNA rama se puede juzgar, → CIEGO y no propone nada;
// · `main` NUNCA puede salir en la lista;
// · ninguna rama SIN mergear puede colarse: cada borrable se vuelve a medir con OTRA sonda
//   (`rev-list --count <main>..<punta viva>` tiene que dar 0), no con la misma pregunta otra vez;
// · y antes de creer nada, las sondas se prueban sobre casos SEMBRADOS cuyo resultado se sabe por
//   construcción, sin escribir nada en el almacén: el padre de main está DENTRO, main no está
//   dentro de su padre (FUERA) y un sha que no existe NO SE PUEDE SABER. Si una falla, CIEGO.
//
// USO:
//   node scripts/verificacion-s5/ramas-borrables.mjs              lista + comandos (NO borra)
//   node scripts/verificacion-s5/ramas-borrables.mjs --ejecutar   borra de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const codigoDe = (...a) => spawnSync('git', a, { encoding: 'utf8' }).status;
const lineas = (s) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

/** Ramas que este script se niega a proponer para borrado, pase lo que pase. */
export const INTOCABLES = new Set(['main', 'master', 'HEAD']);

export const DENTRO = 'dentro';
export const FUERA = 'fuera';
export const NO_SE_SABE = 'no-se-sabe';

/**
 * Pura. El código de `git merge-base --is-ancestor` → una de TRES respuestas. 0 es «dentro», 1 es
 * «fuera», y TODO lo demás —128 cuando el sha no está en este clon, `null` si git no arrancó— es
 * «no se puede saber». No se reparte entre los dos primeros: ese reparto era el defecto (SCRUM-1540).
 */
export function veredictoDeAncestro(codigo) {
  if (codigo === 0) return DENTRO;
  if (codigo === 1) return FUERA;
  return NO_SE_SABE;
}

/** Las ramas vivas del remoto con su punta, de la salida de `git ls-remote --heads`. */
export function leerVivas(texto) {
  const vivas = new Map();
  for (const l of lineas(texto)) {
    const m = l.match(/^([0-9a-f]{40})\s+refs\/heads\/(.+)$/);
    if (m) vivas.set(m[2], m[1]);
  }
  return vivas;
}

/**
 * Pura. Reparte las ramas vivas por su punta VIVA.
 * @param {{vivas: Map<string,string>, estaEnElAlmacen:(sha:string)=>boolean, codigoAncestro:(sha:string)=>number|null,
 *          nombradasPorUnMerge: Set<string>}} e
 */
export function clasificar({ vivas, estaEnElAlmacen, codigoAncestro, nombradasPorUnMerge }) {
  const mergeadas = new Set();
  const sinMergear = new Set();
  const noSeSabe = new Map();
  for (const [r, sha] of vivas) {
    if (INTOCABLES.has(r)) continue;
    if (!estaEnElAlmacen(sha)) { noSeSabe.set(r, `su punta viva ${sha.slice(0, 9)} no está en este clon (haz \`git fetch origin\` y vuelve a correrlo)`); continue; }
    const c = codigoAncestro(sha);
    const v = veredictoDeAncestro(c);
    if (v === DENTRO) mergeadas.add(r);
    else if (v === FUERA) sinMergear.add(r);
    else noSeSabe.set(r, `\`merge-base --is-ancestor\` salió con ${c} sobre ${sha.slice(0, 9)}`);
  }
  const dentroDeMain = [...vivas.keys()].filter((r) => mergeadas.has(r) && !INTOCABLES.has(r)).sort();
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
   */
  const apartadas = dentroDeMain.filter((r) => !nombradasPorUnMerge.has(r));
  const borrables = dentroDeMain.filter((r) => nombradasPorUnMerge.has(r));
  return { mergeadas, sinMergear, noSeSabe, dentroDeMain, apartadas, borrables };
}

/**
 * Las sondas, probadas sobre casos cuyo resultado se sabe por construcción. No escribe nada.
 * @returns {string[]} lo que falló; vacío si las tres sondas ven lo que tienen que ver
 */
export function sondasSembradas({ main, padre, ausente, estaEnElAlmacen, codigoAncestroDe, commitsFueraDe }) {
  const fallos = [];
  if (veredictoDeAncestro(codigoAncestroDe(padre, main)) !== DENTRO) fallos.push('el padre de main no sale DENTRO de main');
  if (veredictoDeAncestro(codigoAncestroDe(main, padre)) !== FUERA) fallos.push('main sale dentro de su propio padre: la sonda no ve un FUERA');
  if (!(commitsFueraDe(padre, main) >= 1)) fallos.push('`rev-list --count` no cuenta el commit de main que su padre no tiene');
  if (estaEnElAlmacen(ausente)) fallos.push(`un sha que no existe (${ausente.slice(0, 9)}) sale como presente`);
  if (veredictoDeAncestro(codigoAncestroDe(ausente, main)) !== NO_SE_SABE) fallos.push('un sha que no existe no sale NO SE PUEDE SABER');
  return fallos;
}

function principal(argv) {
  const vivas = leerVivas(git('ls-remote', '--heads', 'origin'));
  if (!vivas.size) {
    console.log('🔴 CIEGO: ls-remote devolvió 0 ramas. Con un cero, cualquier lista de aquí sería inventada.');
    return 2;
  }
  // La punta de main se resuelve UNA vez y se mide contra ese sha congelado.
  const main = git('rev-parse', '--verify', 'origin/main^{commit}').trim();
  const mainVivo = vivas.get('main');
  const estaEnElAlmacen = (sha) => codigoDe('cat-file', '-e', `${sha}^{commit}`) === 0;
  const codigoAncestroDe = (sha, base) => codigoDe('merge-base', '--is-ancestor', sha, base);
  const commitsFueraDe = (base, sha) => Number(git('rev-list', '--count', `${base}..${sha}`).trim());

  const fallos = sondasSembradas({
    main, padre: git('rev-parse', '--verify', `${main}^1`).trim(), ausente: 'f'.repeat(40),
    estaEnElAlmacen, codigoAncestroDe, commitsFueraDe,
  });
  if (fallos.length) {
    console.log('🔴 CIEGO: las sondas fallan sobre casos sembrados, así que lo que dirían de las ramas no vale:');
    for (const f of fallos) console.log('   · ' + f);
    return 2;
  }

  const nombradasPorUnMerge = new Set();
  for (const asunto of lineas(git('log', '--merges', '--format=%s', main))) {
    for (const re of [/from\s+[\w.-]+\/([A-Za-z0-9._/-]+)/g, /\binto\s+([A-Za-z0-9._/-]+)/g]) {
      for (const m of asunto.matchAll(re)) nombradasPorUnMerge.add(m[1].replace(/^origin\//, ''));
    }
  }
  const { mergeadas, sinMergear, noSeSabe, dentroDeMain, apartadas, borrables } = clasificar({
    vivas, estaEnElAlmacen, codigoAncestro: (sha) => codigoAncestroDe(sha, main), nombradasPorUnMerge,
  });
  const juzgables = [...vivas.keys()].filter((r) => !INTOCABLES.has(r)).length;
  // Las refs locales `origin/*` con su punta, en UNA llamada: sólo para decir cuánto miente el clon.
  const locales = new Map(lineas(git('for-each-ref', '--format=%(refname:strip=3) %(objectname)', 'refs/remotes/origin'))
    .map((l) => l.split(' ')).filter(([r]) => r !== 'HEAD'));

  // ── CONTROLES, antes de enseñar nada ──────────────────────────────────────────────────────
  // La SEGUNDA sonda: otra pregunta a git, no la misma repetida. Una borrable con algún commit fuera de main se ha colado.
  const coladas = borrables.filter((r) => !(commitsFueraDe(main, vivas.get(r)) === 0) || sinMergear.has(r) || noSeSabe.has(r));
  const conMain = borrables.filter((r) => INTOCABLES.has(r));
  console.log(`ramas vivas en el remoto: ${vivas.size} · dentro de main por su punta VIVA: ${mergeadas.size} · fuera: ${sinMergear.size} · NO SE PUEDE SABER: ${noSeSabe.size}`);
  console.log(`main medido: ${main.slice(0, 9)} (tu origin/main) · el remoto dice ${mainVivo ? mainVivo.slice(0, 9) : '¿?'}${mainVivo && mainVivo !== main ? ' — tu origin/main va DETRÁS: alguna «fuera» puede estar ya dentro; ninguna sale borrable por eso' : ''}`);
  const deMas = [...locales.keys()].filter((r) => !vivas.has(r)).length;
  const atrasadas = [...locales].filter(([r, sha]) => vivas.has(r) && sha !== vivas.get(r)).length;
  console.log(`refs locales de más (ramas ya borradas por otro): ${deMas} · refs locales en una punta que ya NO es la viva: ${atrasadas}`);
  console.log('CONTROL · las sondas ven lo sembrado (dentro, fuera y no se puede saber): ✅');
  console.log(`CONTROL · ninguna sin mergear en la lista (rev-list --count sobre la punta viva): ${coladas.length === 0 ? '✅' : '🔴 ' + coladas.join(', ')}`);
  console.log(`CONTROL · main fuera de la lista: ${conMain.length === 0 ? '✅' : '🔴'}`);
  // SUELO del apartado: si NINGUNA rama queda apartada, o quedan casi todas, el emparejador de
  // nombres del histórico se ha roto y este reparto no describe nada.
  const proporcion = dentroDeMain.length ? apartadas.length / dentroDeMain.length : 1;
  console.log(`CONTROL · el reparto separa de verdad: ${apartadas.length} apartadas de ${dentroDeMain.length}`
    + ` (${(proporcion * 100).toFixed(1)} %) ${proporcion > 0 && proporcion < 0.25 ? '✅' : '🔴 sospechoso: el emparejador de nombres puede estar roto'}`);
  if (coladas.length || conMain.length) return 2;
  if (juzgables > 0 && noSeSabe.size === juzgables) {
    console.log(`🔴 CIEGO: de ${juzgables} ramas no se pudo juzgar NINGUNA. Haz \`git fetch origin\` y vuelve a correrlo.`);
    return 2;
  }

  if (noSeSabe.size) {
    console.log(`\n🔴 NO SE PUEDE SABER — ${noSeSabe.size}. Ninguna entra en los comandos de abajo: borrar exige saber que su punta está en main.`);
    for (const [r, motivo] of noSeSabe) console.log(`     ${r} · ${motivo}`);
  }
  console.log(`\n⚠️  APARTADAS DEL BARRIDO — ${apartadas.length}. Están DENTRO de main pero ningún commit`);
  console.log('   de merge las nombra: su contenido llegó por otra vía, así que su PR puede seguir');
  console.log('   ABIERTO y borrarlas lo cerraría. Se miran A MANO; no entran en los comandos de abajo.');
  for (const r of apartadas) console.log('     ' + r);

  const conNum = borrables.filter((r) => /^scrum-\d+/i.test(r));
  console.log(`\nBORRABLES: ${borrables.length}  (${conNum.length} con número de ticket · ${borrables.length - conNum.length} sin número)`);
  console.log(`  — todas entraron por su PROPIO commit de merge, así que su PR se cerró al mergear.\n`);
  for (const r of borrables) console.log('  ' + r);

  // ── LOS COMANDOS ──────────────────────────────────────────────────────────────────────────
  // En tandas: una línea con 463 nombres se pasa del límite de la consola en Windows.
  const TANDA = 40;
  if (argv.includes('--ejecutar')) {
    // El remoto se vuelve a leer justo antes de borrar: la que se movió desde la lista NO se borra.
    const ahora = leerVivas(git('ls-remote', '--heads', 'origin'));
    const movidas = borrables.filter((r) => ahora.get(r) !== vivas.get(r));
    const quedan = borrables.filter((r) => !movidas.includes(r));
    for (const r of movidas) console.log(`  🔴 NO se borra ${r}: su punta cambió desde la lista (${vivas.get(r).slice(0, 9)} → ${ahora.get(r) ? ahora.get(r).slice(0, 9) : 'ya no existe'})`);
    const tandas = [];
    for (let i = 0; i < quedan.length; i += TANDA) tandas.push(quedan.slice(i, i + TANDA));
    console.log(`\n⚠️  BORRANDO DE VERDAD — ${quedan.length} ramas en ${tandas.length} tandas\n`);
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
    const tandas = [];
    for (let i = 0; i < borrables.length; i += TANDA) tandas.push(borrables.slice(i, i + TANDA));
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
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal(process.argv.slice(2));
}
