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
// ── 🔴 LA REESCRITURA DEL 8-sep-2026 (tarde): LA PREMISA DEJÓ DE SER CIERTA ───────────────────
//
// Ese mismo día se activó el AUTO-BORRADO DE RAMAS AL MERGEAR. Las ramas mergeadas empezaron a
// desaparecer del remoto: `ls-remote` daba **491** el 6-sep y **105** el 8-sep. Tres controles de
// este fichero cayeron, y NINGUNO por un defecto del instrumento:
//
//   · el positivo exigía «SCRUM-821 tiene rama en el remoto» — se mergeó y la rama se borró;
//   · el árbitro exigía «al menos 5 ramas que interrogar entre 819, 816, 820, 821, 716» — quedaban 4;
//   · el negativo exigía «más de 10 tickets con todas sus ramas mergeadas», justificado con
//     «había 464 ramas dentro de `main` al escribir esto» — quedaban 9. Esa cifra se escribió esta
//     misma mañana: caducó en horas.
//
// `SCRUM-821 → SIN RASTRO` es hoy la respuesta CORRECTA, y este módulo YA LO SABÍA:
// `scripts/_rastro-del-ticket.mjs` lo dice literal en su cabecera de `rastroDe` —«una rama mergeada
// Y BORRADA deja el ticket sin rama y su trabajo dentro de `main`»—. El instrumento acertaba y el
// control mentía.
//
// 🔴 POR QUÉ ESTO NO VIOLA LA REGLA 41 («guard en rojo → se arregla el código, nunca el guard»):
// la regla presupone que lo que el guard EXIGE sigue siendo cierto. Aquí la premisa dejó de serlo.
// Un guard que exige que existan ramas ya borradas no protege nada: AFIRMA UN HECHO FALSO. Cambiar
// lo que exige NO es relajarlo cuando lo que exigía ha dejado de existir.
//
// ── LO QUE ESTE GUARD VIGILA, Y LO QUE NO ────────────────────────────────────────────────────
//
// Vigila que el instrumento **sepa distinguir** las tres situaciones sobre el árbol vivo. NO
// vigila una cifra: la cifra cambia cada vez que alguien mergea, y un guard atado a un número se
// desactiva a la semana. Lo que no puede cambiar es que el instrumento sepa contestar.
//
// Y desde la reescritura, NINGÚN umbral de este fichero se escribe a mano: todos se derivan del
// árbol. Lo vigila el último test, con AST sobre su propia fuente — la lección convertida en
// mecanismo en vez de en recordatorio.
//
// 🔴 BARATO A PROPÓSITO. La clasificación va a granel (`--merged`/`--no-merged`, 0,30 s medidos en
// SCRUM-753) y NO trae refs (`traer: false`): la tanda no puede depender de la red, y se declara
// que mide contra el último `fetch`. El censo caro —el que llama al motor ticket a ticket, ~10
// min— se queda en el CLI, igual que hizo SCRUM-738 con su población.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { RASTRO, rastroDeLosTickets, rastroDe, motivosParaNoFiarse, esCiego } from '../scripts/_rastro-del-ticket.mjs';

const RAIZ = path.join(import.meta.dirname, '..');
const YO = path.join(import.meta.dirname, 'scrum804-la-rama-viva.test.mjs');
const censo = rastroDeLosTickets({ raiz: RAIZ, traer: false });

const git = (...args) => execFileSync('git', args,
  { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * LA POBLACIÓN QUE EL AUTO-BORRADO NO PUEDE ENCOGER.
 *
 * Un `git log --merges` de `main` es PERMANENTE: el commit de merge y su segundo padre siguen
 * siendo alcanzables desde `main` aunque la rama se haya borrado del remoto el mismo día. Es la
 * única población de este fichero que sólo puede CRECER — y por eso reemplaza a la lista de cuatro
 * números que caducó cuatro veces (819 y 820 al mergearse, 821 al borrarse su rama, 716 al nacerle
 * una rama de fase).
 *
 * Devuelve `{ merge, p2, rama, numero }`. `p2` —el segundo padre— es la PUNTA que tenía la rama al
 * mergearse: la respuesta conocida del árbitro, porque por construcción está dentro de `main`.
 */
function ramasDeLaHistoriaDeMerges(sha) {
  const filas = [];
  for (const linea of git('log', '--merges', '--format=%H%x09%P%x09%s', sha).split('\n')) {
    // Sin comparar contra un número: el guard del final prohíbe los literales en comparaciones y
    // tiene razón hasta cuando el número es de parseo. `resto` vacío ya dice que la línea no trae
    // asunto, y eso es lo que hace falta saber.
    const [merge, padres, ...resto] = linea.split('\t');
    if (!merge || !padres || resto.length === 0) continue;
    // Sólo los merges de PR traen el NOMBRE de la rama en el asunto. Los `Merge remote-tracking
    // branch 'origin/main' into …` son la dirección contraria (main entrando en la rama) y no
    // dicen nada sobre qué se entregó: se descartan por no casar el patrón.
    const m = /^Merge pull request #\d+ from [^/\s]+\/(\S+)$/.exec(resto.join('\t').trim());
    if (!m) continue;
    const p2 = String(padres).trim().split(/\s+/)[1];
    if (!p2) continue;
    const num = /^scrum-(\d+)[a-z]?(?:-|$)/i.exec(m[1]);
    if (!num) continue;
    filas.push({ merge, p2, rama: m[1], numero: Number(num[1]) });
  }
  return filas;
}

/**
 * Las refs de `origin` leídas EN CRUDO aquí, para poder contrastar contra lo que el censo dice de
 * ellas sin preguntárselo al censo. `bandera` opcional (`--merged=<sha>` / `--no-merged=<sha>`).
 *
 * 🔴 EL PUNTERO SIMBÓLICO NO ES UNA RAMA. `refs/remotes/origin/HEAD` sale en `%(refname:short)`
 * como **`origin`** —no como `origin/HEAD`—, y colarlo daba el 492 donde el remoto tenía 491
 * (SCRUM-753). Y `main` tampoco cuenta: `agruparRamas` la excluye, porque el censo mide ramas
 * CONTRA `main`, no `main` contra sí misma.
 */
function refsCrudas(bandera = null) {
  const args = ['for-each-ref', '--format=%(refname:short)%09%(objectname)'];
  if (bandera) args.push(bandera);
  args.push('refs/remotes/origin/');
  const filas = [];
  for (const linea of git(...args).split('\n')) {
    const [corto, sha] = linea.trim().split('\t');
    if (!corto || !sha) continue;
    if (corto === 'origin') continue;
    const nombre = corto.replace(/^origin\//, '');
    if (nombre === 'main') continue;
    filas.push({ nombre, sha });
  }
  return filas;
}

test('SCRUM-804 · 🔴 SUELO: el censo cuadra rama a rama con lo que `git` lista, sin cifras escritas', () => {
  assert.deepEqual(censo.suelo, [],
    '🔴 la dimensión se declara NO FIABLE en esta pasada:\n   · ' + censo.suelo.join('\n   · '));

  // 🔴 EL UMBRAL DERIVADO QUE SUSTITUYE AL `> 100`. El anterior decía «había 558 al escribir esto»
  // y aguantó desde agosto hasta que el auto-borrado dejó el remoto en 105: le quedaban CUATRO
  // ramas de margen. Un recuento que se compara con el de `git` en la misma pasada no caduca nunca,
  // y además caza el modo de fallo que el `> 100` no cazaba: que el censo PIERDA ramas concretas
  // sin que el total baje de un umbral cómodo.
  const crudas = refsCrudas();
  assert.equal(censo.resumen.total, crudas.length,
    `🔴 el censo dice ${censo.resumen.total} ramas y \`for-each-ref\` lista ${crudas.length}. `
    + 'No es una cifra que envejece: es el censo y git contando la MISMA población en la MISMA '
    + 'pasada y no coincidiendo. Si difieren, la lista entera está incompleta y no se sabe cuánto.');

  // Y los dos cubos, cada uno contra la pregunta que git contesta por su cuenta. Sustituye a los
  // dos `> 0`: aquéllos sólo sabían decir «hay alguno», y con el auto-borrado activo el cubo de
  // mergeadas TIENDE A CERO por diseño — un `> 0` ahí es un rojo con fecha puesta.
  assert.equal(censo.resumen.enMain, refsCrudas(`--merged=${censo.inst.sha}`).length,
    '🔴 el censo y `for-each-ref --merged` no cuentan lo mismo dentro de `main`.');
  assert.equal(censo.resumen.vivas, refsCrudas(`--no-merged=${censo.inst.sha}`).length,
    '🔴 el censo y `for-each-ref --no-merged` no cuentan lo mismo fuera de `main`.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL POSITIVO YA NO ENUMERA TICKETS POR NÚMERO
//
// Era `LOS_CUATRO = [819, 816, 820, 821]`, y eso es REFERENCIAR POR POSICIÓN: nombra un estado del
// árbol de una tarde concreta. Nos mordió cinco veces. Lo que el control tenía que cazar no es
// «¿sigue 821 donde lo dejé?» sino **«¿ha dejado el barrido de ver una familia entera de ramas?»**,
// y eso se comprueba mejor sin nombrar a nadie: se re-deriva la agrupación aquí, con git en crudo,
// y se exige que el censo no haya perdido ni inventado ninguna.
// ═════════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-804 · 🔴 CONTROL POSITIVO DERIVADO: la agrupación no pierde ni inventa ramas', () => {
  const crudas = refsCrudas();
  assert.ok(crudas.length > 0,
    '🔴 CIEGO: `for-each-ref` no ha listado ni una rama de `origin`. Sin población no se puede '
    + 'afirmar que la agrupación no pierda nada: este control pasaría vacío.');

  // ① NINGUNA RAMA SE PIERDE. Toda rama con la forma canónica `scrum-<n>[letra]` tiene que estar
  // agrupada bajo ESE número. Es la mitad que caza «el barrido no llega a una familia de ramas».
  const perdidas = [];
  for (const { nombre } of crudas) {
    const m = /^scrum-(\d+)[a-z]?(?:-|$)/i.exec(nombre);
    if (!m) continue;
    const n = Number(m[1]);
    const v = censo.porTicket.get(n);
    if (!v || !v.ramas.some((r) => r.nombre === nombre)) perdidas.push(`${nombre} → SCRUM-${n}`);
  }
  assert.deepEqual(perdidas, [],
    '🔴 EL INSTRUMENTO NO VE ESTAS RAMAS, que `for-each-ref` sí lista:\n   · ' + perdidas.join('\n   · ')
    + '\n\n  Un `SIN RASTRO` sobre ellas no dice «no hay trabajo»: dice que el barrido no llega, y '
    + 'entonces la lista entera de este censo está incompleta y no se sabe cuánto.');

  // ② NINGUNA RAMA SE INVENTA. La otra mitad: un agrupador que metiera ramas ajenas en un ticket
  // fabricaría paradas falsas, que es peor que no avisar. Se pregunta por SUBCADENA —`scrum-<n>` en
  // cualquier parte del nombre—, que es MENOS estricto que la regla del instrumento: un guard que
  // exige más que el código que vigila acusa en falso.
  //
  // ⚠️ SCRUM-829 (8-sep-2026): esta nota decía «la MISMA regla que usa el instrumento
  // (`numeroDeClave`)», y ya no lo es. `agruparRamas` agrupaba con `numeroDeClave` —subcadena— y
  // por eso `revert-1192-scrum-824b-…` le salía como SCRUM-824; ahora agrupa con `numeroDeRama`,
  // anclada al principio del nombre (`scripts/_numero-de-rama.mjs`). La comprobación de aquí NO
  // cambia y sigue siendo la correcta, precisamente porque es la permisiva: todo lo que la regla
  // anclada agrupa cumple también la subcadena.
  const inventadas = [];
  for (const [n, v] of censo.porTicket) {
    for (const r of v.ramas) {
      if (!new RegExp(`scrum-${n}(?![0-9])`, 'i').test(r.nombre)) inventadas.push(`SCRUM-${n} ← ${r.nombre}`);
    }
  }
  assert.deepEqual(inventadas, [],
    '🔴 el censo ha metido en un ticket ramas que no llevan su número:\n   · ' + inventadas.join('\n   · '));

  // ③ Y cada rama viva sale ACCIONABLE —sha, tamaño y fecha—, que es lo que convierte la lista en
  // un reparto. Sobre las que estén vivas EN ESTA PASADA, sean cuales sean.
  for (const [n, v] of censo.porTicket) {
    for (const r of v.ramas.filter((x) => x.clase === 'viva')) {
      assert.match(r.sha || '', /^[0-9a-f]{40}$/, `🔴 SCRUM-${n}: la rama ${r.nombre} sale sin sha`);
      assert.ok(r.adelanto > 0,
        `🔴 SCRUM-${n}: la rama ${r.nombre} sale VIVA con adelanto ${r.adelanto}. Una rama viva `
        + 'tiene por definición commits fuera de `main`; un 0 aquí es el clasificador y el contador '
        + 'diciendo cosas distintas sobre la misma rama.');
      assert.match(r.fecha || '', /^\d{4}-\d{2}-\d{2}$/, `🔴 SCRUM-${n}: ${r.nombre} sale sin fecha`);
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ÁRBITRO — el control que NO caduca, ahora con población PERMANENTE
//
// La primera versión asserteaba el ESTADO de cinco tickets nombrados. Cayó tres veces en una sola
// sesión, ninguna por un defecto. La segunda dejó de exigirles un estado y les exigió COHERENCIA
// con `git merge-base --is-ancestor` — pero seguía enumerándolos, y el auto-borrado le quitó dos
// de los cinco sujetos: `interrogadas.length >= 5` cayó con 4.
//
// Ahora la población sale de `git log --merges`, que es permanente, y el árbitro se aplica a
// TODAS las ramas del censo en vez de a cinco. Dos mitades:
//
//   · RESPUESTA CONOCIDA — el segundo padre de un merge de PR está dentro de `main` POR
//     CONSTRUCCIÓN. Si el árbitro no lo dice, el árbitro está roto, y entonces «censo y árbitro
//     coinciden» no probaría nada: probaría que los dos callan igual.
//   · COHERENCIA — la clase de cada rama del censo contra la alcanzabilidad que contesta git.
//
// A granel con UN `git rev-list`: 1.660 merges interrogados sin 1.660 procesos. Y el conjunto se
// contrasta contra `merge-base --is-ancestor` en los dos sentidos, para que el atajo no se crea a
// sí mismo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-804 · 🔴 EL ÁRBITRO: población permanente y coherencia con la alcanzabilidad de git', () => {
  const sha = censo.inst.sha;
  const alcanzables = new Set(git('rev-list', sha).split('\n').map((l) => l.trim()).filter(Boolean));
  const esAncestro = (objeto) => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', objeto, sha],
        { cwd: RAIZ, stdio: ['ignore', 'ignore', 'ignore'] });
      return true;
    } catch { return false; }
  };

  const historia = ramasDeLaHistoriaDeMerges(sha);
  assert.ok(historia.length > 0,
    '🔴 CIEGO: `git log --merges` no ha devuelto ni un merge de PR con nombre de rama. Ésta es la '
    + 'población que el auto-borrado no puede tocar; sin ella el árbitro se queda sin sujetos.');

  // ① RESPUESTA CONOCIDA, sobre la población entera y permanente.
  const noAlcanzables = historia.filter((f) => !alcanzables.has(f.p2))
    .map((f) => `${f.rama} (merge ${f.merge.slice(0, 8)}, punta ${f.p2.slice(0, 8)})`);
  assert.deepEqual(noAlcanzables, [],
    '🔴 EL ÁRBITRO NO RECONOCE COMO DENTRO la punta de una rama que `main` mergeó:\n   · '
    + noAlcanzables.join('\n   · ') + '\n\n  Eso es imposible por construcción: el segundo padre de '
    + 'un commit de merge es alcanzable desde él. Si sale FUERA, quien está roto es la medida de '
    + 'alcanzabilidad, y todo lo que este fichero afirma se apoya en ella.');

  // ② EL ATAJO NO SE CREE A SÍ MISMO. `rev-list` a granel y `merge-base --is-ancestor` rama a rama
  // son la misma relación preguntada de dos formas: se contrastan en los DOS sentidos, con sujetos
  // derivados (el primero de cada cubo), no nombrados.
  const testigoDentro = historia[0].p2;
  assert.equal(esAncestro(testigoDentro), alcanzables.has(testigoDentro),
    `🔴 \`rev-list\` y \`merge-base --is-ancestor\` discrepan sobre ${testigoDentro.slice(0, 8)}.`);
  const primeraViva = [...censo.porTicket.values()].flatMap((v) => v.ramas).find((r) => r.clase === 'viva');
  if (primeraViva) {
    assert.equal(esAncestro(primeraViva.sha), alcanzables.has(primeraViva.sha),
      `🔴 \`rev-list\` y \`merge-base --is-ancestor\` discrepan sobre ${primeraViva.nombre}.`);
  }

  // ③ COHERENCIA sobre TODAS las ramas que el censo clasificó, no sobre cinco.
  const discrepan = [];
  for (const [n, v] of censo.porTicket) {
    for (const r of v.ramas) {
      if (r.clase === 'indeterminada') continue; // no contesta: no se le puede exigir coherencia
      const dentro = alcanzables.has(r.sha);
      if (dentro !== (r.clase === 'en-main')) {
        discrepan.push(`SCRUM-${n} · ${r.nombre}: el censo dice «${r.clase}» y la alcanzabilidad `
          + `dice ${dentro ? 'DENTRO' : 'FUERA'}`);
      }
    }
  }
  assert.deepEqual(discrepan, [],
    '🔴 EL CLASIFICADOR A GRANEL Y GIT NO DICEN LO MISMO:\n   · ' + discrepan.join('\n   · ')
    + '\n\n  `--merged`/`--no-merged` y la alcanzabilidad son la MISMA relación contestada por el '
    + 'mismo motor. Si difieren, la cifra entera de este censo está mal y no se sabe hacia qué lado.');
});

test('SCRUM-804 · ✅ CONTROL NEGATIVO: una rama mergeada NO se cuenta como trabajo pendiente', () => {
  // Separa «existe el nombre» de «hay trabajo pendiente». Sin esto, un clasificador que dijera
  // «viva» a todo pasaría el control positivo entero.
  //
  // 🔴 EL UMBRAL SE DERIVA. Aquí ponía `soloMergeadas.length > 10`, justificado con «había 464
  // ramas dentro de `main` al escribir esto». Esa cifra se escribió la mañana del 8-sep y caducó
  // esa misma tarde: el auto-borrado dejó 15 refs mergeadas y 9 tickets. Ahora la población de
  // referencia se calcula EN CRUDO en esta misma pasada, y el control exige que coincida con la
  // del censo — no que sea grande.
  const mergeadasCrudas = new Set(refsCrudas(`--merged=${censo.inst.sha}`).map((r) => r.nombre));
  const esperado = [...censo.porTicket.entries()]
    .filter(([, v]) => v.ramas.length > 0 && v.ramas.every((r) => mergeadasCrudas.has(r.nombre)))
    .map(([n]) => n).sort((a, b) => a - b);
  const soloMergeadas = [...censo.porTicket.entries()]
    .filter(([, v]) => v.ramas.length > 0 && v.ramas.every((r) => r.clase === 'en-main'));

  assert.deepEqual(soloMergeadas.map(([n]) => n).sort((a, b) => a - b), esperado,
    '🔴 los tickets con TODAS sus ramas dentro de `main` según el censo no son los que dice '
    + '`for-each-ref --merged`. Es el censo y git discrepando sobre la misma población.');

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

  // 🔴 Y EL SUJETO QUE EL AUTO-BORRADO NO PUEDE QUITAR. Si un día no quedara NINGUNA ref mergeada
  // —el destino al que tiende el remoto—, lo de arriba pasaría vacío. La historia de merges sigue
  // teniendo sujetos: una rama que se mergeó, si TODAVÍA existe como ref y no ha recibido commits
  // después, el censo tiene que llamarla `en-main`.
  const historia = ramasDeLaHistoriaDeMerges(censo.inst.sha);
  const vivenTodavia = historia.filter((f) => mergeadasCrudas.has(f.rama));
  const malClasificadas = vivenTodavia.filter((f) => {
    const v = censo.porTicket.get(f.numero);
    return v && !v.ramas.some((r) => r.nombre === f.rama && r.clase === 'en-main');
  }).map((f) => f.rama);
  assert.deepEqual(malClasificadas, [],
    '🔴 ramas que `main` mergeó, que siguen existiendo y que `for-each-ref --merged` confirma '
    + 'dentro, y que el censo NO llama `en-main`:\n   · ' + malClasificadas.join('\n   · '));
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

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL GUARD QUE SE VIGILA A SÍ MISMO — la sexta vez no llega
//
// Los tres controles que cayeron hoy tenían la misma forma: `> 100`, `>= 5`, `> 10`. Tres cifras
// escritas a mano, cada una justificada con una medición correcta EL DÍA QUE SE ESCRIBIÓ, y las
// tres caducadas por un cambio de política del repositorio que ninguna podía prever.
//
// «No escribas umbrales a mano» como comentario es un recordatorio, y los recordatorios se
// incumplen. Esto lo convierte en mecanismo: cualquier comparación de este fichero contra un
// número literal distinto de 0 lo pone en rojo, con su línea.
//
// EL 0 SE PERMITE, y es la única excepción: `x.length > 0` no afirma una magnitud del árbol, dice
// «hay población o estoy ciego». Es estructural, no una foto. Cualquier otro número SÍ es una foto.
//
// 🔴 AST, NO `grep`. Un guard de texto se caza a sí mismo en el comentario que explica la
// prohibición — este párrafo lleva un `> 100` y un `> 10` escritos, y un `grep` los contaría.
// ═════════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-804 · 🔴 NINGÚN UMBRAL DE ESTE FICHERO ESTÁ ESCRITO A MANO', () => {
  const fuente = fs.readFileSync(YO, 'utf8');
  const arbol = ts.createSourceFile(YO, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const RELACIONALES = new Set([
    ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken,
    ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken,
  ]);

  const escritos = [];
  let comparaciones = 0;
  const recorrer = (nodo) => {
    if (ts.isBinaryExpression(nodo) && RELACIONALES.has(nodo.operatorToken.kind)) {
      comparaciones += 1;
      for (const lado of [nodo.left, nodo.right]) {
        if (!ts.isNumericLiteral(lado) || Number(lado.text) === 0) continue;
        const { line } = arbol.getLineAndCharacterOfPosition(nodo.getStart(arbol));
        escritos.push(`:${line + 1} · ${nodo.getText(arbol).replace(/\s+/g, ' ').slice(0, 90)}`);
      }
    }
    ts.forEachChild(nodo, recorrer);
  };
  recorrer(arbol);

  // 🔴 SUELO DEL PROPIO GUARD: si el recorrido no encuentra NI UNA comparación, no está mirando —
  // y un «cero umbrales a mano» sobre un árbol que no se ha recorrido es el verde más caro que hay.
  assert.ok(comparaciones > 0,
    '🔴 CIEGO: el recorrido AST no ha encontrado ni una comparación relacional en este fichero. '
    + 'Un cero sobre una población vacía no es «está limpio»: es «no he mirado».');

  assert.deepEqual(escritos, [],
    '🔴 UMBRAL ESCRITO A MANO en este fichero:\n   · scrum804-la-rama-viva.test.mjs'
    + escritos.join('\n   · scrum804-la-rama-viva.test.mjs')
    + '\n\n  Un número comparado contra el árbol es una FOTO del árbol el día que se escribió. Los '
    + 'tres que cayeron el 8-sep-2026 (`> 100`, `>= 5`, `> 10`) estaban bien medidos y caducaron '
    + 'igual: el auto-borrado de ramas cambió la población debajo. Derívalo de `git` en la misma '
    + 'pasada — o, si de verdad hace falta una constante, el sitio no es un `assert`.');
});
