// scripts/_rastro-del-ticket.mjs — SCRUM-804 (la dimensión que le faltaba al censo del tablero)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿DÓNDE ESTÁ EL TRABAJO DE UN TICKET: EN `main`, EN UNA RAMA VIVA, O EN NINGUNA PARTE?
//
// ── EL DEFECTO QUE CIERRA, MEDIDO ANTES DE ESCRIBIR NADA ─────────────────────────────────────
//
// `censo-tablero-vs-arbol.mjs` (SCRUM-738) pregunta «¿hay evidencia que NOMBRE el ticket?» y
// cuenta la EXISTENCIA de una rama como una de sus tres fuentes. Existir no es estar mergeada, así
// que un ticket cuya única evidencia es una rama SIN MERGEAR sale con el veredicto más fuerte que
// da ese censo —`ENTERO`— y se imprime bajo el titular «tienen trabajo suyo en `main`».
//
// Provocado el 8-sep-2026 sobre el árbol vivo, llamando a `censarTicket` de los cuatro casos que
// originaron este ticket:
//
//     SCRUM-819   ENTERO   fuentes: ramas   → scrum-819-el-menu-deja-rastro, …-al-dia
//     SCRUM-816   ENTERO   fuentes: ramas   → scrum-816-lista-de-trabajos
//     SCRUM-820   ENTERO   fuentes: ramas   → scrum-820-estados-en-castellano, …-al-dia
//     SCRUM-821   ENTERO   fuentes: ramas   → scrum-821-la-lista-que-decide-que-se-mira
//
// Ninguno de los cuatro tiene una sola línea en `main`. O sea que el censo no es que «no vea» la
// rama viva: **la presenta como trabajo en main**, que es el falso positivo que su propia cabecera
// llama el más caro — el que propone cerrar algo que nadie ha mergeado.
//
// ── ⛔ AQUÍ NO SE REIMPLEMENTA NADA. La regla ya vive en la casa y se REUSA ────────────────────
//
//   · quién decide si una rama está dentro de `main` → `alcanzabilidadDe` (SCRUM-753), a granel
//     con `--merged`/`--no-merged`: 0,30 s frente a 52,6 s preguntando rama a rama;
//   · quién agrupa las ramas por ticket sin confundir `scrum-2` con `…-rebasada-2` →
//     `agruparRamas` (SCRUM-387), que además ya trata el `null` como INDETERMINADA y no como «no»;
//   · quién congela el sha para que la pregunta no sea móvil → `instantanea` (SCRUM-753);
//   · cuánto trabajo vivo hay en una rama → `adelantoDe` (SCRUM-753).
//
// Escribir aquí otra vez cualquiera de esas cuatro sería la segunda copia de la regla que decide
// todo el censo, que es exactamente el error que SCRUM-804 se documentó a sí mismo en su PASO 0.
//
// ── EL CUARTO VALOR, Y POR QUÉ NO SE PLIEGA A LOS TRES ───────────────────────────────────────
//
// El encargo pide TRES veredictos. Son tres, y son los de abajo. Pero una rama cuyo objeto no está
// en local no contesta ni «dentro» ni «fuera» —está medido y provocado en SCRUM-753—, y meter ese
// caso en cualquiera de los tres sería inventarse una medición. Sale como `INDETERMINADO`, se
// cuenta aparte y NUNCA se suma a la cifra. Hoy son 0; el día que no lo sean, se verá.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';
import { agruparRamas } from './_censo-reparto.mjs';
import { instantanea, alcanzabilidadDe, adelantoDe } from './_censo-alcanzabilidad.mjs';

/**
 * Los tres veredictos del encargo, más el que dice «no lo sé».
 *
 * ⚠️ `EN_MAIN` aquí significa **todas sus ramas son alcanzables desde el sha medido**, no «el
 * ticket está hecho». Es la misma salvedad que lleva el censo de alcanzabilidad y se repite
 * porque es la que más veces se pierde al citar una cifra.
 */
export const RASTRO = Object.freeze({
  EN_MAIN: 'EN MAIN',
  EN_RAMA_VIVA: 'EN RAMA VIVA',
  SIN_RASTRO: 'SIN RASTRO',
  INDETERMINADO: 'INDETERMINADO',
});

/**
 * ¿Por qué NO fiarse de este barrido? Lista de motivos; vacía = se puede leer.
 *
 * 🔴 EL SUELO ES «CERO RAMAS VIVAS», y no «cero ramas». Un árbol donde todas las ramas están
 * mergeadas daría `vivas = 0` con toda legitimidad… y también lo daría un clasificador roto que
 * contesta `true` a todo. Los dos casos se leen igual en la cifra y significan lo contrario, así
 * que el cero se DECLARA sospechoso y quien lo vea decide. En el árbol medido el 8-sep-2026 había
 * **94 ramas vivas sobre 559 refs**: un cero aquí no es el estado normal de esta casa.
 */
/**
 * ¿Este barrido NO HA MIRADO? Es distinto de «ha mirado y no ha encontrado nada vivo».
 *
 * 🔴 ESTA SEPARACIÓN LA IMPUSO UN GUARD, Y ERA MÍA LA CULPA. La primera versión trataba
 * `vivas === 0` como motivo para tumbar el CLI, y `tests/scrum775-suelo-que-no-dispara.test.mjs`
 * salió rojo: su fixture es un repo SANO de cuatro ramas **todas mergeadas**, así que mi suelo
 * sacaba el CLI con 2 sobre un árbol correcto. Es literalmente lo que ese ticket vigila —«un suelo
 * que salta siempre se desactiva»— cometido por el suelo nuevo.
 *
 * Ciego es sólo **no tener población**: cero ramas remotas. Cero ramas VIVAS es un estado legítimo
 * (un repo recién ordenado, una fixture) y a la vez sospechoso en ESTA casa, donde hay 94. Así que
 * se DICE siempre, en voz alta, y no se convierte en un exit 2 que apagaría el instrumento entero
 * en cuanto alguien lo corra fuera del repo grande.
 *
 * ⚠️ El suelo del encargo —«cero ramas vivas está ciego»— sigue existiendo y se cumple donde
 * significa algo: sobre el ÁRBOL DE VERDAD, en `tests/scrum804-la-rama-viva.test.mjs`, que exige
 * `vivas > 0` **y** `enMain > 0`. Un instrumento que sólo sabe decir una de las dos no ha
 * clasificado nada, y eso no se puede comprobar sobre una fixture de cuatro ramas.
 */
export function esCiego(resumen) {
  return !resumen || resumen.total === 0;
}

export function motivosParaNoFiarse(resumen) {
  const motivos = [];
  if (esCiego(resumen)) {
    motivos.push('CERO ramas remotas leídas: sin población no hay nada que clasificar, y un censo '
      + 'sin ramas no dice «todo está mergeado», dice que no ha mirado.');
    return motivos;
  }
  if (resumen.vivas === 0) {
    motivos.push('CERO ramas VIVAS sobre ' + resumen.total + ' ramas. Puede ser cierto, pero es '
      + 'indistinguible de un clasificador que contesta «dentro» a todo — que es el modo de fallo '
      + 'que haría desaparecer la cifra entera de este censo. Compruébalo antes de citarlo.');
  }
  if (resumen.indeterminadas > 0) {
    motivos.push(resumen.indeterminadas + ' rama(s) con el objeto ausente en local: no contestan '
      + 'ni dentro ni fuera. NO se cuentan como mergeadas. Un `git fetch` suele resolverlo.');
  }
  return motivos;
}

/**
 * LAS RAMAS QUE ESTUVIERON Y YA NO ESTÁN — recuperadas de los MERGES de `main`.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SCRUM-830 · POR QUÉ ESTA SEGUNDA FUENTE, Y POR QUÉ NO CADUCA
 *
 * El 8-sep-2026 se activó «Automatically delete head branches»: al mergear un PR, GitHub borra su
 * rama. Este censo leía SÓLO `refs/remotes/origin/`, así que de un día para otro un ticket
 * entregado y mergeado pasó a `SIN RASTRO` — que es el veredicto de «no lo veo», no el de «está
 * dentro». El instrumento no se rompió: **midió correctamente un mundo que dejó de existir.**
 *
 * Este fichero YA declaraba el hueco al pie —«una rama mergeada Y BORRADA deja el ticket sin rama
 * y su trabajo dentro de `main`»—. Era la excepción; la automatización la volvió el caso normal.
 *
 * **La segunda fuente es el historial de `main`**, elegida por la misma razón por la que
 * `_suelo-contra-main.mjs` (SCRUM-810) deriva de main: **main sólo crece**. Una rama borrada
 * desaparece de `ls-remote`, pero su nombre queda escrito para siempre en el asunto del commit de
 * merge que la trajo. Medido el 8-sep-2026: **105 refs vivas y 1.009 ramas recuperadas** de 1.660
 * merges. Mañana habrá más, nunca menos, y nadie tiene que acordarse de un número.
 *
 * ⚠️ SE CLASIFICAN `en-main` POR CONSTRUCCIÓN, no preguntándole a `alcanzabilidadDe`: ese
 * clasificador va a granel por REFNAME (`--merged`/`--no-merged` sobre `refs/remotes/origin/`), así
 * que a una rama que ya no existe le contesta `null` —indeterminada—, y eso sería falso: el commit
 * que la trajo ES un commit de `main` (comprobado con `git merge-base --is-ancestor`).
 *
 * ⚠️ LO QUE ESTA FUENTE NO VE, escrito aquí y no descubierto en un rojo raro:
 *   · un merge en fast-forward no deja commit de merge, así que su rama no consta;
 *   · un asunto de merge reescrito a mano tampoco;
 *   · y no sabe de ramas borradas SIN mergear — pero ésas no llegan aquí, porque sólo se leen
 *     merges que están en `main`.
 * Por eso es una fuente ADICIONAL y no un sustituto: las refs vivas siguen siendo las únicas que
 * dicen qué hay SIN mergear, que es la pregunta que este censo vino a contestar.
 *
 * @returns {Map<string,string>} nombre de rama → sha del merge que la trajo. Sólo las que ya NO
 *   existen como ref: de una viva sabe más `alcanzabilidadDe`, y se deja que la clasifique él.
 */
export function ramasMergeadasYBorradas({ raiz, sha, vivas = new Set() }) {
  // Anclado al PRINCIPIO del asunto, que es donde git las escribe:
  //   «Merge pull request #1164 from lwislg99/scrum-821-la-lista-que-decide-al-dia»
  //   «Merge remote-tracking branch 'origin/scrum-728c-adoptar-el-candidato'»
  const DE_PR = /^Merge pull request #\d+ from [^/\s]+\/(\S+)/;
  const DE_REMOTA = /^Merge remote-tracking branch '(?:refs\/remotes\/)?origin\/(\S+?)'/;

  const encontradas = new Map();
  let salida;
  try {
    salida = execFileSync('git', ['log', sha, '--merges', '--format=%H%x09%s'],
      { cwd: raiz, encoding: 'utf8', maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    // Sin historial se sigue con la fuente viva: esto AÑADE población, no la sustituye. Y no se
    // calla: el suelo mira este número, así que un cero aquí se ve.
    return encontradas;
  }
  for (const linea of salida.split('\n')) {
    const corte = linea.indexOf('\t');
    if (corte === -1) continue;
    const shaMerge = linea.slice(0, corte);
    const asunto = linea.slice(corte + 1);
    const m = DE_PR.exec(asunto) || DE_REMOTA.exec(asunto);
    if (!m) continue;
    const nombre = m[1];
    if (nombre === 'main' || vivas.has(nombre) || encontradas.has(nombre)) continue;
    encontradas.set(nombre, shaMerge);
  }
  return encontradas;
}

/**
 * EL RASTRO DE CADA TICKET, derivado de las ramas del remoto y del sha congelado de `main`.
 *
 * @param {object}  o
 * @param {string}  o.raiz  árbol de trabajo
 * @param {boolean} o.traer si trae refs antes de medir. `true` en el CLI —los worktrees comparten
 *   el espacio de refs y se mueve sin que tú hagas nada (R10)—; `false` en la tanda, que no puede
 *   depender de la red, y entonces se declara que se mide contra el último `fetch`.
 *
 * Devuelve `{ inst, porTicket, resumen, suelo }`. `porTicket` es `Map<numero, { rastro, ramas }>`,
 * y `ramas` lleva por cada una su clase y su `adelanto` (commits que tiene fuera del sha medido:
 * el TAMAÑO del trabajo vivo, que es lo que distingue una rama abandonada de una entrega entera).
 */
export function rastroDeLosTickets({ raiz = process.cwd(), traer = true } = {}) {
  const inst = instantanea({ raiz, traer });
  // 🔴 `incapaz` —y no un `sha` a `null` mirado de reojo— es como SCRUM-753 declara que no ha
  // podido resolver `origin/main`. Sin sha no hay contra qué medir alcanzabilidad, y seguir
  // devolvería «ninguna rama viva», que es la mentira cómoda: la que dice que no queda nada fuera.
  if (inst.incapaz) {
    return {
      inst,
      porTicket: new Map(),
      resumen: { total: 0, enMain: 0, vivas: 0, indeterminadas: 0 },
      suelo: ['la instantánea NO pudo medir: ' + inst.incapaz],
    };
  }

  const anc = alcanzabilidadDe(inst);
  const ade = adelantoDe(inst);

  // LA FECHA de cada rama. Una llamada más a git, y aquí y no dentro de `instantanea`: ese fichero
  // está congelado por el guard de SCRUM-753 y lo que necesito es aditivo y sólo mío. El encargo
  // pide sha, TAMAÑO y FECHA — sin la fecha no se distingue una rama de anteayer de una de julio,
  // y ésa es media decisión de si hay que repartir el ticket o rescatar la rama.
  const fechaDe = new Map();
  try {
    for (const l of execFileSync('git',
      ['for-each-ref', '--format=%(refname) %(committerdate:short)', 'refs/remotes/origin/'],
      { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\n')) {
      const [refname, fecha] = l.trim().split(/\s+/);
      if (refname && fecha) fechaDe.set(refname.replace(/^refs\/remotes\/origin\//, ''), fecha);
    }
  } catch { /* sin fechas se sigue: es dato de presentación, no el veredicto. Sale `null`. */ }
  // `agruparRamas` quiere la forma `<sha> refs/heads/<nombre>`, que es la de `ls-remote`. La
  // instantánea ya trae `{objeto, nombre}`, así que se le entrega en su formato de entrada en vez
  // de reimplementar el parseo.
  // SCRUM-830 · la segunda fuente: las que se mergearon y GitHub borró. Ver
  // `ramasMergeadasYBorradas` para el porqué y para lo que no ve.
  const vivas = new Set(inst.ramas.map((r) => r.nombre));
  const borradas = ramasMergeadasYBorradas({ raiz, sha: inst.sha, vivas });

  const agrupadas = agruparRamas(
    [
      ...inst.ramas.map((r) => `${r.objeto} refs/heads/${r.nombre}`),
      ...[...borradas].map(([nombre, shaMerge]) => `${shaMerge} refs/heads/${nombre}`),
    ],
    // Las vivas las clasifica el de a granel, que sabe más de ellas. Las borradas son `en-main`
    // POR CONSTRUCCIÓN —su commit de merge es un commit de main— y preguntárselo a `anc` daría
    // `null`, porque él busca por refname y esa ref ya no existe.
    (sha, nombre) => (borradas.has(nombre) ? true : anc(nombre, sha)),
  );
  const objetoDe = new Map([
    ...inst.ramas.map((r) => [r.nombre, r.objeto]),
    ...borradas,
  ]);

  const porTicket = new Map();
  for (const [numero, ramas] of agrupadas.porTicket) {
    const detalle = ramas.map((r) => ({
      nombre: r.nombre,
      clase: r.clase,
      // El adelanto sólo se pregunta de las vivas: de una mergeada es 0 por definición, y de una
      // indeterminada no se puede preguntar sin el objeto.
      adelanto: r.clase === 'viva' ? ade(objetoDe.get(r.nombre)) : 0,
      sha: objetoDe.get(r.nombre) || null,
      fecha: fechaDe.get(r.nombre) || null,
    }));
    // 🔴 BASTA UNA VIVA. Un ticket con dos ramas —una mergeada y otra no— tiene trabajo sin
    // mergear, y llamarlo EN MAIN por la que sí entró es el mismo falso positivo con otra cara.
    // Pasa de verdad: los `-al-dia` de 819 y 820 conviven con la original.
    const rastro = detalle.some((r) => r.clase === 'viva') ? RASTRO.EN_RAMA_VIVA
      : detalle.some((r) => r.clase === 'en-main') ? RASTRO.EN_MAIN
        : RASTRO.INDETERMINADO;
    porTicket.set(numero, { rastro, ramas: detalle });
  }

  const resumen = {
    total: agrupadas.total,
    enMain: agrupadas.enMain,
    vivas: agrupadas.vivas,
    indeterminadas: agrupadas.indeterminadas,
    // SCRUM-830 · las dos poblaciones, por separado y nombradas. Juntarlas en un solo `total`
    // dejaría de distinguir «hay pocas refs porque se borran al mergear» de «no he podido leer
    // las refs», que es justo la confusión que este ticket vino a deshacer.
    refsVivas: inst.ramas.length,
    mergeadasYBorradas: borradas.size,
  };
  return { inst, porTicket, resumen, suelo: motivosParaNoFiarse(resumen) };
}

/**
 * El rastro de UN ticket. `SIN RASTRO` es la respuesta cuando no hay NINGUNA rama con su número —
 * y ojo: eso no dice «no hay trabajo». Una rama mergeada Y BORRADA deja el ticket sin rama y su
 * trabajo dentro de `main` (medido en SCRUM-637 con `scrum-653-dos-firmas`). Por eso este dato se
 * lee JUNTO a las otras fuentes del censo (commits y entrada de máster), nunca solo.
 */
export function rastroDe(porTicket, numero) {
  const r = porTicket.get(Number(numero));
  return r ? r.rastro : RASTRO.SIN_RASTRO;
}
