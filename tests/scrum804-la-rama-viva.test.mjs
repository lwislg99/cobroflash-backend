// tests/scrum804-la-rama-viva.test.mjs — SCRUM-804
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO DEL TABLERO TENÍA UNA MITAD, Y LA OTRA COSTÓ CUATRO SESIONES EN UN DÍA.
//
// `censo-tablero-vs-arbol.mjs` compara el tablero contra `main` y cuenta la EXISTENCIA de una rama
// como evidencia. Existir no es estar mergeada: un ticket cuya única evidencia es una rama SIN
// MERGEAR salía `ENTERO` —el veredicto más fuerte— bajo el titular «tienen trabajo suyo en `main`».
//
// El 8-sep-2026 se repartieron 819, 816, 821 y 820 a cuatro sesiones y **las cuatro pararon**: los
// cuatro tickets estaban construidos enteros en ramas sin mergear, y ninguna constaba en el
// tablero. La otra mitad del desfase que ese censo vino a cerrar.
//
// ── LO QUE ESTE GUARD VIGILA, Y LO QUE NO ────────────────────────────────────────────────────
//
// Vigila que el instrumento **sepa distinguir** las tres situaciones sobre el árbol vivo. NO
// vigila una cifra: la cifra cambia cada vez que alguien mergea, y un guard atado a un número se
// desactiva a la semana. Lo que no puede cambiar es que el instrumento sepa contestar.
//
// 🔴 BARATO A PROPÓSITO. La clasificación va a granel (`--merged`/`--no-merged`, 0,30 s medidos en
// SCRUM-753) y NO trae refs (`traer: false`): la tanda no puede depender de la red, y se declara
// que mide contra el último `fetch`. El censo caro —el que llama al motor ticket a ticket, ~10
// min— se queda en el CLI, igual que hizo SCRUM-738 con su población.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { RASTRO, rastroDeLosTickets, rastroDe, motivosParaNoFiarse, esCiego } from '../scripts/_rastro-del-ticket.mjs';
// SCRUM-829 · la MISMA regla rama→ticket que usa el censo. Deriva la población de este guard sin
// preguntarle al instrumento a quién mirar.
import { numeroDeRama } from '../scripts/_numero-de-rama.mjs';

const RAIZ = path.join(import.meta.dirname, '..');
const censo = rastroDeLosTickets({ raiz: RAIZ, traer: false });

/**
 * Los cuatro que originaron el ticket. **Ya no son la población: son la historia.**
 *
 * ── 🔴 SCRUM-829 (8-sep-2026) · POR QUÉ DEJAN DE MANDAR ─────────────────────────────────────
 * Esta lista enumeraba números de ticket a mano, y su justificación era buena: un control sacado
 * del PROPIO instrumento no puede cazar que el instrumento deje de ver una familia de ramas.
 *
 * Pero la lista envejeció exactamente como avisa la cabecera de este fichero: **`scrum-821-…` y
 * `scrum-716-…` ya no existen en `origin`** —se mergearon y se borraron—, así que este guard pedía
 * rastro de ramas que no están. Aguantaba en verde **sólo porque las refs de seguimiento rancias
 * las mantenían visibles**; el día que SCRUM-829 le puso `--prune` al `fetch` del censo, cayó.
 *
 * 🔒 Es decir: este control estaba pasando GRACIAS a la caducidad que aquel ticket vino a quitar.
 * Un control que depende de que nadie pode no vigila el árbol: vigila la higiene del clon.
 *
 * ── LO QUE LO SUSTITUYE, Y POR QUÉ SIGUE CAZANDO LA CEGUERA DE FAMILIA ──────────────────────
 * La población se DERIVA de `git for-each-ref`, que es una fuente INDEPENDIENTE del instrumento
 * —no le pregunta a `rastroDeLosTickets` a quién mirar—, con la regla única de SCRUM-829. Así que
 * conserva la propiedad que motivaba la lista, y además la amplía: se interrogan los ~100 números
 * con rama, no cuatro. Y no puede envejecer, porque los dos lados se leen en el mismo instante.
 */
const LOS_CUATRO = [819, 816, 820, 821];

/**
 * LA POBLACIÓN QUE SE INTERROGA, derivada de git y no de una lista. Números de ticket que HOY
 * tienen al menos una rama en `refs/remotes/origin/`, de mayor a menor (los más recientes primero).
 */
const RAMAS_DE_GIT = execFileSync('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/'],
  { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').map((s) => s.replace(/^origin\//, '').trim()).filter(Boolean)
  // `origin/HEAD` sale abreviado como `origin` (no como `origin/HEAD`), y `main` no es trabajo de
  // nadie: `agruparRamas` la salta, así que aquí también.
  .filter((n) => n !== 'origin' && n !== 'HEAD' && n !== 'main');

const CON_RAMA = [...new Set(RAMAS_DE_GIT.map(numeroDeRama).filter((n) => n !== null))]
  .sort((a, b) => b - a);

/**
 * El quinto interrogado. Entró como control NEGATIVO nombrado («su rama está mergeada») y hoy ya
 * no lo es: le nació `scrum-716c-el-cache-del-vigia`. Se queda en la población del árbitro —que no
 * le exige un estado, sino coherencia con git— porque un ticket con una rama dentro y otra fuera
 * es justo el caso mixto que más vale la pena interrogar.
 */
const MERGEADO = 716;

test('SCRUM-804 · 🔴 SUELO: el instrumento ve ramas, y ve ramas VIVAS', () => {
  assert.deepEqual(censo.suelo, [],
    '🔴 la dimensión se declara NO FIABLE en esta pasada:\n   · ' + censo.suelo.join('\n   · '));

  // 🔴 SCRUM-829 · ESTE SUELO ERA `> 100`, ESCRITO CUANDO HABÍA 558 RAMAS. El 8-sep-2026 el
  // remoto bajó a 98 en una limpieza —y siguió bajando mientras se escribía esto—, así que el
  // umbral se puso rojo sin que el instrumento hubiera perdido nada. Aguantaba en verde sólo
  // mientras el clon arrastrara refs de ramas ya borradas, o sea GRACIAS a la caducidad que este
  // mismo ticket quita con `--prune`.
  //
  // 🔒 Lo que no envejece no es cuántas hay: es que el censo las vea TODAS. Se compara contra
  // `git for-each-ref`, leído aquí mismo y aparte del instrumento, así que el suelo se pone al día
  // solo por muchas ramas que se borren o se creen.
  assert.equal(censo.resumen.total, RAMAS_DE_GIT.length,
    `🔴 el censo cuenta ${censo.resumen.total} ramas y git tiene ${RAMAS_DE_GIT.length}. No es que `
    + 'haya pocas: es que el barrido pierde ramas por el camino, y entonces cualquier «nadie tiene '
    + 'trabajo vivo» está incompleto y no se sabe cuánto.');

  // Y el suelo de CEGUERA, que es otra pregunta: un clon capado no se lee como «no hay ramas».
  assert.ok(RAMAS_DE_GIT.length >= 10,
    `🔴 CIEGO: git sólo devuelve ${RAMAS_DE_GIT.length} ramas remotas. Con una población así de `
    + 'corta este censo no mide nada. ¿Clon superficial, o falta un fetch?');

  assert.ok(censo.resumen.vivas > 0,
    '🔴 CERO ramas VIVAS. No se lee como «está todo mergeado»: se lee igual que un clasificador '
    + 'que contesta «dentro» a todo, y eso haría desaparecer la lista entera sin que nada avise.');

  assert.ok(censo.resumen.enMain > 0,
    '🔴 CERO ramas en `main`. El instrumento tiene que saber decir las DOS cosas: si sólo sabe '
    + 'decir «viva», no ha clasificado nada — ha contestado que sí a todo por el otro lado.');
});

test('SCRUM-804 · 🔴 CONTROL POSITIVO DERIVADO: ve a TODOS los que tienen rama, y los reparte', () => {
  // 🔴 SUELO de la población derivada: si git apenas devuelve números, el «ninguno ciego» de
  // abajo sería un vacío, no una medición.
  assert.ok(CON_RAMA.length >= 20,
    `🔴 CIEGO: sólo ${CON_RAMA.length} números de ticket con rama en refs/remotes/origin/. Con una `
    + 'población así de corta este control no interroga nada. ¿Clon capado, o falta un fetch?');

  const vistos = CON_RAMA.map((n) => [n, rastroDe(censo.porTicket, n)]);

  // ① Lo que NUNCA puede pasar: que git diga que ese número TIENE rama y el instrumento no la vea.
  // Los dos lados se leen en el mismo instante y de fuentes distintas, así que esto no caduca.
  const ciegos = vistos.filter(([, r]) => r === RASTRO.SIN_RASTRO).map(([n]) => `SCRUM-${n}`);
  assert.deepEqual(ciegos, [],
    '🔴 EL INSTRUMENTO NO VE: ' + ciegos.join(', ') + '. `git for-each-ref` dice que esos números '
    + 'TIENEN rama en el remoto y el censo contesta `SIN RASTRO`. Eso no dice «no hay trabajo»: '
    + 'dice que el barrido no llega a sus ramas, y entonces la lista entera de este censo está '
    + 'incompleta y no se sabe cuánto.');

  // ② Y los cuatro del origen quedan IMPRESOS, no asserteados: dos de sus ramas ya se mergearon y
  // se borraron, así que exigirles rastro era exigir que nadie podara (SCRUM-829).
  console.log(`    · los cuatro del origen: ${JSON.stringify(LOS_CUATRO.map((n) => [n, rastroDe(censo.porTicket, n)]))}`);

  // ② El reparto de hoy se DIAGNOSTICA, no se assertea: cambió tres veces en una sola sesión y
  // ninguna por un defecto. Quien lo vigila es el árbitro de abajo. Aquí queda impreso para que
  // una tanda sirva de foto fechada del estado, sin convertir esa foto en una condición.
  console.log(`    · reparto medido ahora: ${JSON.stringify(vistos)}`);

  // ③ Con sha, tamaño y fecha — sobre las que estén vivas EN ESTA PASADA, sean cuales sean. Es lo
  // que convierte la lista en accionable, y no depende de QUIÉN esté vivo.
  const vivas = CON_RAMA.flatMap((n) => (censo.porTicket.get(n) || { ramas: [] }).ramas
    .filter((x) => x.clase === 'viva').map((r) => [n, r]));
  for (const [n, r] of vivas) {
    assert.match(r.sha || '', /^[0-9a-f]{40}$/, `🔴 SCRUM-${n}: la rama ${r.nombre} sale sin sha`);
    assert.ok(r.adelanto > 0,
      `🔴 SCRUM-${n}: la rama ${r.nombre} sale VIVA con adelanto ${r.adelanto}. Una rama viva `
      + 'tiene por definición commits fuera de `main`; un 0 aquí es el clasificador y el contador '
      + 'diciendo cosas distintas sobre la misma rama.');
    assert.match(r.fecha || '', /^\d{4}-\d{2}-\d{2}$/, `🔴 SCRUM-${n}: ${r.nombre} sale sin fecha`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ÁRBITRO — el control que NO caduca, y por qué reemplazó al que sí caducaba
//
// La primera versión de este fichero asserteaba el ESTADO de cinco tickets nombrados: «819, 816,
// 820 y 821 salen EN RAMA VIVA; 716 sale EN MAIN». Cayó **tres veces en una sola sesión**, y
// ninguna por un defecto:
//
//   · 819 y 820 entraron en `main` (PR #1161 y #1162) mientras se escribía el guard;
//   · 821 entró unas horas después;
//   · y SCRUM-716 —el control NEGATIVO— pasó a EN RAMA VIVA porque le nació una rama de fase,
//     `scrum-716c-el-cache-del-vigia` (+1), y la regla «basta UNA viva» hizo lo que debe.
//
// Las tres veces el instrumento acertó y el control mintió. Un control positivo atado al estado
// de un árbol que nueve sesiones mueven a diario **no vigila: envejece**, y lo que se acaba
// tocando para que pase en verde es el control.
//
// Lo que NO caduca es la RELACIÓN: diga lo que diga el árbol, la clase de cada rama tiene que
// coincidir con lo que contesta `git merge-base --is-ancestor` sobre esa misma rama. Es el mismo
// árbitro que SCRUM-753 usa para reconciliar su clasificador a granel con la pregunta rama a rama,
// aplicado aquí a la dimensión nueva. Los cinco tickets siguen ENUMERADOS —la lista es la
// población que se interroga— pero lo que se les exige ya no es un estado: es coherencia.
// ═════════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-804 · 🔴 EL ÁRBITRO: cada clase coincide con `git merge-base --is-ancestor`', () => {
  const sha = censo.inst.sha;
  const esAncestro = (objeto) => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', objeto, sha],
        { cwd: RAIZ, stdio: ['ignore', 'ignore', 'ignore'] });
      return true;
    } catch { return false; }
  };

  // 🔴 SCRUM-829 · LA POBLACIÓN TAMBIÉN SE DERIVA AQUÍ. Antes eran los cinco números escritos a
  // mano, y dos de sus ramas ya no existen: el suelo «>= 5 ramas que interrogar» sólo se cumplía
  // mientras el clon arrastrara refs rancias. Ahora se cogen los tickets con rama MÁS RECIENTES —
  // que son los que más se mueven, o sea donde más vale la pena exigir coherencia.
  //
  // ⚠️ ACOTADO A PROPÓSITO: el árbitro pregunta rama a rama con `merge-base --is-ancestor`, y eso
  // cuesta un subproceso por rama (SCRUM-753 lo midió: 52,6 s sobre 491 refs). Interrogarlas todas
  // metería ~11 s en cada tanda para responder la misma pregunta muchas veces.
  const TOPE_INTERROGADAS = 12;
  const interrogadas = CON_RAMA.slice(0, TOPE_INTERROGADAS)
    .flatMap((n) => (censo.porTicket.get(n) || { ramas: [] }).ramas.map((r) => [n, r]));

  // SUELO del propio árbitro: sin ramas que interrogar, este test pasaría vacío.
  assert.ok(interrogadas.length >= 5,
    `🔴 sólo ${interrogadas.length} ramas que interrogar entre los ${TOPE_INTERROGADAS} tickets con `
    + `rama más recientes (${CON_RAMA.slice(0, TOPE_INTERROGADAS).join(', ')}). Un árbitro sin `
    + 'sujetos no arbitra nada.');

  const discrepan = [];
  for (const [n, r] of interrogadas) {
    if (r.clase === 'indeterminada') continue; // no contesta: no se le puede exigir coherencia
    const dentro = esAncestro(r.sha);
    const dice = r.clase === 'en-main';
    if (dentro !== dice) discrepan.push(`SCRUM-${n} · ${r.nombre}: el censo dice «${r.clase}» y `
      + `\`merge-base --is-ancestor\` dice ${dentro ? 'DENTRO' : 'FUERA'}`);
  }
  assert.deepEqual(discrepan, [],
    '🔴 EL CLASIFICADOR A GRANEL Y GIT NO DICEN LO MISMO:\n   · ' + discrepan.join('\n   · ')
    + '\n\n  `--merged`/`--no-merged` y `merge-base --is-ancestor` son la MISMA relación contestada '
    + 'por el mismo motor. Si difieren, la cifra entera de este censo está mal y no se sabe hacia '
    + 'qué lado.');

  // Y el árbitro tiene que saber decir las dos cosas, o no está midiendo.
  const dentro = interrogadas.filter(([, r]) => r.clase === 'en-main').length;
  const fuera = interrogadas.filter(([, r]) => r.clase === 'viva').length;
  assert.ok(dentro > 0 && fuera > 0,
    `🔴 entre las ramas interrogadas hay ${dentro} en main y ${fuera} vivas. Con un cubo vacío, `
    + 'la coincidencia con git no prueba que el clasificador distinga: prueba que contesta siempre '
    + 'lo mismo y que git le da la razón por casualidad.');
});

test('SCRUM-804 · ✅ CONTROL NEGATIVO: una rama mergeada NO se cuenta como trabajo pendiente', () => {
  // Separa «existe el nombre» de «hay trabajo pendiente». Sin esto, un clasificador que dijera
  // «viva» a todo pasaría el control positivo entero.
  //
  // 🔴 SE DERIVA DEL ÁRBOL, y ya no nombra un ticket. El que estaba nombrado aquí —SCRUM-716—
  // pasó a EN RAMA VIVA en cuanto le nació `scrum-716c-el-cache-del-vigia` (+1), y el control cayó
  // sobre un instrumento que había acertado: «basta UNA viva» es la regla, y la aplicó. La
  // población se coge del propio censo, así que siempre hay sujeto y nunca hay que retocar una
  // lista para que el guard siga pasando.
  const soloMergeadas = [...censo.porTicket.entries()]
    .filter(([, v]) => v.ramas.length > 0 && v.ramas.every((r) => r.clase === 'en-main'));

  assert.ok(soloMergeadas.length > 10,
    `🔴 sólo ${soloMergeadas.length} tickets con TODAS sus ramas mergeadas. Había 464 ramas dentro `
    + 'de `main` al escribir esto: con una población así de corta este control no distingue nada.');

  const malos = soloMergeadas.filter(([, v]) => v.rastro !== RASTRO.EN_MAIN).map(([n]) => `SCRUM-${n}`);
  assert.deepEqual(malos, [],
    '🔴 hay tickets con TODAS sus ramas dentro de `main` que NO salen EN MAIN: ' + malos.join(', ')
    + '. El instrumento estaría llamando «pendiente» a trabajo que ya entró, y una lista llena de '
    + 'tickets que no hay que mirar es una lista que se deja de mirar.');

  for (const [n, v] of soloMergeadas) {
    assert.ok(v.ramas.every((r) => r.adelanto === 0),
      `🔴 SCRUM-${n}: una rama dentro de \`main\` no puede tener adelanto. El clasificador y el `
      + 'contador estarían diciendo cosas distintas de la misma rama.');
  }
});

test('SCRUM-804 · ✅ SIN RASTRO es un veredicto, no un hueco', () => {
  // Un número que no existe no puede confundirse con uno cuyo trabajo está en main.
  assert.equal(rastroDe(censo.porTicket, 999999), RASTRO.SIN_RASTRO);
  assert.equal(censo.porTicket.has(999999), false);
});

test('SCRUM-804 · ⛔ POR IDENTIDAD: el número no casa dentro de otro ni con un sufijo de reintento', () => {
  // El encargo lo dice medido: un `grep <numero>` suelto le devolvió a S6 CINCO ramas falsas,
  // porque el número casa dentro de los SHAs y de los sufijos. Aquí se comprueba sobre el árbol
  // vivo que la agrupación NO recoge esa basura.
  const delDos = (censo.porTicket.get(2) || { ramas: [] }).ramas.map((r) => r.nombre);
  const falsas = delDos.filter((n) => !/^scrum-2[a-z]?(-|$)/i.test(n));
  assert.deepEqual(falsas, [],
    '🔴 SCRUM-2 ha recogido ramas que no son suyas: ' + falsas.join(', ') + '. El `2` de '
    + '`…-rebasada-2` o de `codeowners-zona-roja-v2` es un sufijo de reintento o de versión, no un '
    + 'número de ticket. Un instrumento que fabrica paradas falsas es peor que ninguno.');

  // Y el suelo del propio control: si la clasificación de un número tan corto no ve NADA, este
  // control pasaría vacío. Se comprueba que el detector distingue, sobre un caso conocido.
  assert.equal(/^scrum-2[a-z]?(-|$)/i.test('scrum-240-sobre-duplicado-rebasada-2'), false);
  assert.equal(/^scrum-2[a-z]?(-|$)/i.test('scrum-2-lo-que-sea'), true);
  assert.equal(/^scrum-2[a-z]?(-|$)/i.test('scrum-2b-fase-b'), true);
});

test('SCRUM-804 · el suelo se puede EJERCITAR sin árbol: dice que no se fía cuando toca', () => {
  // Sin esto, «suelo vacío» sobre el árbol bueno no prueba que el suelo sepa saltar.
  assert.deepEqual(motivosParaNoFiarse({ total: 0, enMain: 0, vivas: 0, indeterminadas: 0 }).length, 1);
  assert.match(motivosParaNoFiarse({ total: 500, enMain: 500, vivas: 0, indeterminadas: 0 })[0],
    /CERO ramas VIVAS/);
  assert.match(motivosParaNoFiarse({ total: 500, enMain: 400, vivas: 97, indeterminadas: 3 })[0],
    /objeto ausente en local/);
  assert.deepEqual(motivosParaNoFiarse({ total: 500, enMain: 400, vivas: 100, indeterminadas: 0 }), []);
});

test('SCRUM-804 · 🔴 CIEGO ≠ «no hay nada vivo» — la distinción que me cazó SCRUM-775', () => {
  // Un repo SANO con todas sus ramas mergeadas (la fixture de SCRUM-775: 4 ramas, 0 vivas) NO es
  // un instrumento ciego. Tratarlo como tal sacaba el CLI con 2 sobre un árbol correcto, que es
  // «un suelo que salta siempre» — y ésos se desactivan.
  assert.equal(esCiego({ total: 4, enMain: 4, vivas: 0, indeterminadas: 0 }), false,
    '🔴 un repo con ramas, todas mergeadas, NO es ciego: ha mirado y ha encontrado cero vivas.');
  assert.equal(esCiego({ total: 0, enMain: 0, vivas: 0, indeterminadas: 0 }), true,
    '🔴 CERO ramas remotas SÍ es ciego: no hay población que clasificar.');
  assert.equal(esCiego(null), true, 'sin resumen no se ha medido nada');

  // Y aun no siendo ciego, el caso se DICE: se avisa, no se calla.
  assert.match(motivosParaNoFiarse({ total: 4, enMain: 4, vivas: 0, indeterminadas: 0 })[0],
    /CERO ramas VIVAS/, '🔴 el caso legítimo pero sospechoso tiene que seguir avisando');
});
