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

const RAIZ = path.join(import.meta.dirname, '..');
const censo = rastroDeLosTickets({ raiz: RAIZ, traer: false });

/**
 * Los cuatro que originaron el ticket. Es una lista ENUMERADA a propósito: un control derivado del
 * propio instrumento («coge cualquier rama viva») no puede cazar el caso en el que el instrumento
 * deja de ver una familia entera de ramas.
 */
const LOS_CUATRO = [819, 816, 820, 821];

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

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 SCRUM-830 · AQUÍ HABÍA UN NÚMERO, Y CADUCÓ: `total > 100`, con «había 558» al lado.
  //
  // El 8-sep-2026 se activó «Automatically delete head branches» y las refs vivas se desplomaron
  // a 98. Cuatro tests en rojo para todos, reportado por tres sesiones. El guard no se rompió:
  // **midió correctamente un mundo que dejó de existir.**
  //
  // Y NO se sube el suelo a 98, porque ese número caducaría igual: con borrado automático, las
  // refs vivas ya no miden el tamaño de la casa — miden cuántos PR hay abiertos ahora mismo, que
  // sube y baja cada día. **La magnitud dejó de tener sentido**, así que no se rebaja: se cambia
  // por la que sí lo tiene.
  //
  // LO QUE AQUEL SUELO CAZABA, dicho antes de sustituirlo: que el barrido no llegara a las ramas
  // —un `ls-remote` vacío, un fetch que no trajo nada— y se leyera como «nadie tiene trabajo
  // vivo». Eso sigue vigilado, y por dos sitios: `censo.suelo` de arriba (cero población) y el
  // `vivas > 0` / `enMain > 0` de abajo.
  //
  // LO QUE VIGILA AHORA, que es lo que la automatización puso en riesgo: **que el lector de los
  // asuntos de merge siga viendo**. La segunda fuente saca los nombres de rama del historial de
  // `main` (ver `ramasMergeadasYBorradas`), y si GitHub cambia el texto de sus merges, o alguien
  // pasa a squash, ese lector se queda mudo — y el censo volvería a llamar `SIN RASTRO` a trabajo
  // que está dentro. Se vigila con una PROPORCIÓN, no con un recuento: main sólo crece, así que
  // una razón no caduca ni hay que acordarse de subirla.
  //
  // Medido el 8-sep-2026: **1.009 ramas recuperadas de 1.660 merges = 60,8 %**. El suelo se pone
  // en 20 % —tres veces de holgura— porque lo que tiene que cazar es el desplome a cero, no una
  // oscilación: un merge en fast-forward o un asunto reescrito a mano no dejan nombre, y eso es
  // normal y está declarado.
  const merges = Number(execFileSync('git', ['rev-list', '--count', '--merges', censo.inst.sha],
    { cwd: RAIZ, encoding: 'utf8' }).trim());
  const razon = merges ? censo.resumen.mergeadasYBorradas / merges : 0;
  assert.ok(merges > 0,
    '🔴 CIEGO: `main` no tiene ni un commit de merge. Sin historial no hay segunda fuente, y con '
    + 'borrado automático la primera sola no distingue «mergeado» de «no lo veo».');
  assert.ok(razon >= 0.2,
    `🔴 EL LECTOR DE MERGES SE HA QUEDADO MUDO: ${censo.resumen.mergeadasYBorradas} ramas `
    + `recuperadas de ${merges} merges (${(razon * 100).toFixed(1)} %). Se midió 60,8 % el `
    + '8-sep-2026. Por debajo del 20 % lo más probable es que el asunto de los merges haya '
    + 'cambiado de forma —otro texto de GitHub, o squash en vez de merge—, y entonces un ticket '
    + 'entregado y con su rama borrada vuelve a salir `SIN RASTRO`, que es el veredicto de «no lo '
    + 'veo» y se lee como «no hay trabajo».');

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

  // ② El reparto de hoy se DIAGNOSTICA, no se assertea: cambió tres veces en una sola sesión y
  // ninguna por un defecto. Quien lo vigila es el árbitro de abajo. Aquí queda impreso para que
  // una tanda sirva de foto fechada del estado, sin convertir esa foto en una condición.
  console.log(`    · reparto medido ahora: ${JSON.stringify(vistos)}`);

  // ③ Con sha, tamaño y fecha — sobre las que estén vivas EN ESTA PASADA, sean cuales sean. Es lo
  // que convierte la lista en accionable, y no depende de QUIÉN esté vivo.
  const vivas = LOS_CUATRO.flatMap((n) => (censo.porTicket.get(n) || { ramas: [] }).ramas
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

  const interrogadas = [...LOS_CUATRO, MERGEADO]
    .flatMap((n) => (censo.porTicket.get(n) || { ramas: [] }).ramas.map((r) => [n, r]));

  // SUELO del propio árbitro: sin ramas que interrogar, este test pasaría vacío.
  assert.ok(interrogadas.length >= 5,
    `🔴 sólo ${interrogadas.length} ramas que interrogar entre ${[...LOS_CUATRO, MERGEADO].join(', ')}. `
    + 'Un árbitro sin sujetos no arbitra nada.');

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

  // 🔴 SCRUM-830 · aquí había otro número caducado —`> 10`, con «había 464» al lado— y cayó por
  // lo mismo: contaba tickets cuyas ramas siguieran EXISTIENDO y mergeadas, y al borrarlas GitHub
  // se quedó en 10. Ahora la población incluye las recuperadas del historial, y el suelo es una
  // PROPORCIÓN sobre los tickets que el censo ve, que no depende del tamaño del repo.
  //
  // Medido el 8-sep-2026: **622 de 691 tickets = 90,0 %**. El suelo se pone en 25 % porque lo que
  // tiene que cazar es el modo de fallo contrario —un clasificador que conteste «viva» a todo, y
  // que dejaría esto en ~0—, no la oscilación normal entre sprints.
  const razonMergeados = censo.porTicket.size ? soloMergeadas.length / censo.porTicket.size : 0;
  assert.ok(razonMergeados >= 0.25,
    `🔴 sólo ${soloMergeadas.length} de ${censo.porTicket.size} tickets tienen TODAS sus ramas `
    + `mergeadas (${(razonMergeados * 100).toFixed(1)} %). Se midió 90,0 % el 8-sep-2026. Con una `
    + 'proporción así de corta este control no distingue nada — y el modo de fallo que vigila es '
    + 'un clasificador que conteste «viva» a todo, que la dejaría en cero.');

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
