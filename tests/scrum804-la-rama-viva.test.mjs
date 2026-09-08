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
import { RASTRO, rastroDeLosTickets, rastroDe, motivosParaNoFiarse, esCiego } from '../scripts/_rastro-del-ticket.mjs';

const RAIZ = path.join(import.meta.dirname, '..');
const censo = rastroDeLosTickets({ raiz: RAIZ, traer: false });

/**
 * Los cuatro que originaron el ticket. Es una lista ENUMERADA a propósito: un control derivado del
 * propio instrumento («coge cualquier rama viva») no puede cazar el caso en el que el instrumento
 * deja de ver una familia entera de ramas.
 */
const LOS_CUATRO = [819, 816, 820, 821];

/**
 * 🔴 Y EL REPARTO DE LOS CUATRO CAMBIÓ MIENTRAS SE ESCRIBÍA ESTE GUARD, que es la mejor prueba de
 * que el instrumento sirve — y de que un control positivo atado a un estado del árbol tiene que
 * poder envejecer A MANO, nunca solo.
 *
 * Medido el 8-sep-2026: los cuatro salían EN RAMA VIVA. Horas después, con el guard ya escrito,
 * **SCRUM-819 y SCRUM-820 entraron en `main`** por los PR #1161 y #1162, y el guard cayó
 * nombrándolos. No se relajó: se actualizó esta lista y se dijo cuál entró y cuándo, que es lo que
 * su propio mensaje de rojo ordena hacer.
 *
 * Los dos cubos siguen siendo el control: el instrumento tiene que saber decir VIVA de unos y
 * EN MAIN de otros, sobre la misma población y en la misma pasada.
 */
const VIVOS_HOY = [816, 821];
const ENTRARON_EN_MAIN = [819, 820];

/** Su rama está mergeada desde antes. Distingue «existe el nombre» de «hay trabajo pendiente». */
const MERGEADO = 716;

test('SCRUM-804 · 🔴 SUELO: el instrumento ve ramas, y ve ramas VIVAS', () => {
  assert.deepEqual(censo.suelo, [],
    '🔴 la dimensión se declara NO FIABLE en esta pasada:\n   · ' + censo.suelo.join('\n   · '));

  assert.ok(censo.resumen.total > 100,
    `🔴 CIEGO: sólo ${censo.resumen.total} ramas remotas. Había 558 al escribir esto; con una `
    + 'población así de corta, un «nadie tiene trabajo vivo» no dice nada.');

  assert.ok(censo.resumen.vivas > 0,
    '🔴 CERO ramas VIVAS. No se lee como «está todo mergeado»: se lee igual que un clasificador '
    + 'que contesta «dentro» a todo, y eso haría desaparecer la lista entera sin que nada avise.');

  assert.ok(censo.resumen.enMain > 0,
    '🔴 CERO ramas en `main`. El instrumento tiene que saber decir las DOS cosas: si sólo sabe '
    + 'decir «viva», no ha clasificado nada — ha contestado que sí a todo por el otro lado.');
});

test('SCRUM-804 · 🔴 CONTROL POSITIVO ENUMERADO: ve a los cuatro que pararon, y los reparte', () => {
  const vistos = LOS_CUATRO.map((n) => [n, rastroDe(censo.porTicket, n)]);

  // ① Lo que NUNCA puede pasar, pase lo que pase con esas ramas: que el instrumento no los vea.
  const ciegos = vistos.filter(([, r]) => r === RASTRO.SIN_RASTRO).map(([n]) => `SCRUM-${n}`);
  assert.deepEqual(ciegos, [],
    '🔴 EL INSTRUMENTO NO VE: ' + ciegos.join(', ') + '. Estos cuatro tienen rama en el remoto con '
    + 'su número. Un `SIN RASTRO` aquí no dice «no hay trabajo»: dice que el barrido no llega a '
    + 'sus ramas, y entonces la lista entera de este censo está incompleta y no se sabe cuánto.');

  // ② El reparto medido, en sus dos cubos. Que los dos tengan gente es el control de verdad: un
  // clasificador que contestara siempre lo mismo pasaría cualquiera de los dos por separado.
  assert.deepEqual(VIVOS_HOY.map((n) => rastroDe(censo.porTicket, n)),
    VIVOS_HOY.map(() => RASTRO.EN_RAMA_VIVA),
    '🔴 alguno de ' + JSON.stringify(VIVOS_HOY) + ' ha dejado de salir EN RAMA VIVA. Reparto '
    + 'visto: ' + JSON.stringify(vistos) + '.\n\n'
    + '  ⚠️ SI CAE PORQUE SE MERGEÓ, el guard NO se relaja: se mueve ese número de `VIVOS_HOY` a\n'
    + '  `ENTRARON_EN_MAIN` a mano y se dice en el commit cuál entró y cuándo. Un control positivo\n'
    + '  que se autoajusta al árbol deja de controlar el día que el árbol se rompe.');

  assert.deepEqual(ENTRARON_EN_MAIN.map((n) => rastroDe(censo.porTicket, n)),
    ENTRARON_EN_MAIN.map(() => RASTRO.EN_MAIN),
    '🔴 alguno de ' + JSON.stringify(ENTRARON_EN_MAIN) + ' ya no sale EN MAIN. Estos dos entraron '
    + 'por los PR #1161 y #1162 el 8-sep-2026; su trabajo no puede salirse de `main`.');

  // ③ Con sha, tamaño y fecha — que es lo que convierte la lista en accionable.
  for (const n of VIVOS_HOY) {
    for (const r of censo.porTicket.get(n).ramas.filter((x) => x.clase === 'viva')) {
      assert.match(r.sha || '', /^[0-9a-f]{40}$/, `🔴 SCRUM-${n}: la rama ${r.nombre} sale sin sha`);
      assert.ok(r.adelanto > 0,
        `🔴 SCRUM-${n}: la rama ${r.nombre} sale VIVA con adelanto ${r.adelanto}. Una rama viva `
        + 'tiene por definición commits fuera de `main`; un 0 aquí es el clasificador y el contador '
        + 'diciendo cosas distintas sobre la misma rama.');
      assert.match(r.fecha || '', /^\d{4}-\d{2}-\d{2}$/, `🔴 SCRUM-${n}: ${r.nombre} sale sin fecha`);
    }
  }
});

test('SCRUM-804 · ✅ CONTROL NEGATIVO: una rama MERGEADA sale EN MAIN, no EN RAMA VIVA', () => {
  // Es el caso que separa «existe el nombre» de «hay trabajo pendiente». Sin él, un clasificador
  // que dijera «viva» a todo pasaría el control positivo entero.
  assert.equal(rastroDe(censo.porTicket, MERGEADO), RASTRO.EN_MAIN,
    `🔴 SCRUM-${MERGEADO} tiene rama (\`scrum-716-el-verde-ciego\`) y está MERGEADA. Si sale `
    + 'EN RAMA VIVA, el instrumento está llamando «pendiente» a trabajo que ya entró, y la lista '
    + 'se llena de tickets que no hay que mirar — que es como se desactiva una lista.');

  const ramas = censo.porTicket.get(MERGEADO).ramas;
  assert.ok(ramas.every((r) => r.clase === 'en-main'), 'sus ramas deben salir todas como en-main');
  assert.ok(ramas.every((r) => r.adelanto === 0), 'una rama en `main` no puede tener adelanto');
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
