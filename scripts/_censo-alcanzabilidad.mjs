// scripts/_censo-alcanzabilidad.mjs — SCRUM-753
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA DERIVACIÓN, EN UN SOLO SITIO. La usan el CLI (`censo-alcanzabilidad.mjs`) y su guard
// (`tests/scrum753-censo-de-alcanzabilidad.test.mjs`). Si cada uno tuviera su copia, el día que
// divergieran el censo diría una cosa y su guard confirmaría otra.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴🔴 EL CENSO DECIDE QUÉ **NO** ASIGNAR, NO QUÉ ASIGNAR.
//
// Ninguna de sus señales distingue «se construyó» de «se construyó LO QUE PEDÍAS». La
// alcanzabilidad contesta si unos commits están dentro de la historia de `main`; no lee el
// alcance del ticket, no compara contra el encargo y no sabe qué querías. Medido el 5-sep-2026:
// un ticket salió ENTERO de fachada y estaba PARCIAL, y otro salió entero **con el alcance
// invertido** — construido, mergeado, y haciendo lo contrario de lo pedido.
//
// Así que la única lectura que sostiene este instrumento es la NEGATIVA:
//
//   · «DENTRO» ⇒ **no lo asignes sin mirar antes qué hay ahí.** No dice que esté hecho.
//   · «FUERA»  ⇒ hay trabajo vivo que nadie ha mergeado. Tampoco dice que sirva.
//   · «NO_MEDIBLE» ⇒ no se ha podido medir. **No es «no está».**
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴🔴 Y LO QUE ESTE INSTRUMENTO **ES**: NO PUEDE VER LO ASIGNABLE.
//
// La población se DERIVA de dos fuentes del árbol: ramas remotas ya traídas y ficheros de
// `docs/master/`. Un ticket **sin rama y sin entrada no entra en la población** — no hay nada a
// lo que preguntarle.
//
// Y lo asignable es EXACTAMENTE lo que no tiene evidencia. O sea: **el conjunto que este censo
// no puede enumerar es, punto por punto, el conjunto para el que se repartiría trabajo.** Eso no
// es una precaución de uso que se escribe por prudencia: es la forma del instrumento. Un censo
// que enumera lo que tiene huella sólo puede hablar de lo ya empezado.
//
// Por eso el CLI acepta NÚMEROS SUELTOS además de barrer la población: a un ticket que le
// nombres se le puede contestar `NO_MEDIBLE · sin rama ni entrada`, que es una respuesta. A los
// que no nombres no se les puede contestar nada, porque no se sabe que existen.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⛔ ESTO PROPONE, NUNCA ACTÚA. No cierra tickets, no toca el tablero y no borra ramas.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// ── DE DÓNDE SALE EL TICKET, CON LOS NÚMEROS DELANTE ─────────────────────────────────────────
//   · 4-sep-2026: un barrido que comparaba IDENTIFICADORES dio **27 ramas «con trabajo perdido»**.
//     Con el criterio correcto —`merge-base --is-ancestor`— eran **13**, y doce llevaban muertas
//     desde agosto. Que exista una rama con el número no dice que haya trabajo fuera de `main`.
//   · 5-sep-2026: **nueve de once** tickets de producto asignados ya estaban en `main`. Los nueve
//     figuraban en «Tareas por hacer».
//
// ── LO QUE SE DERIVA, Y DE DÓNDE (nada de esto se reimplementa aquí) ─────────────────────────
//   · `agruparRamas`  ← `scripts/_censo-reparto.mjs` (SCRUM-387). Es quien ya sabe que EXISTIR NO
//     ES ESTAR VIVA y quien trata el `null` como INDETERMINADA en vez de como «no». Reescribir
//     esas diez líneas aquí sería la segunda copia de la regla que decide todo el censo.
//   · `numeroDeRama` / `numeroDeEntrada` ← `scripts/censo-tablero-vs-arbol.mjs` (SCRUM-738).
//   · `numeroDelTituloDeEntrada` / `patronTicket` ← `tests/_censo-tickets.mjs` (SCRUM-388).
//
// ⚠️ `patronTicket` estaba SIN exportar y este ticket le ha añadido el `export` en vez de copiar
// la regex de frontera. Es un cambio aditivo y sin efecto sobre el motor; la alternativa era la
// tercera copia de «SCRUM-29 no puede casar dentro de SCRUM-298».
//
// 🔴 EL COSTURÓN, VIGILADO: `agruparRamas` agrupa con `numeroDeClave` (SCRUM-387, SIN anclar) y la
// población se deriva con `numeroDeRama` (SCRUM-738, anclada y con letra de fase). Son DOS reglas
// para la misma pregunta. Medido (árbol `cobroflash-b16`, 6-sep-2026T05:07Z, 492 refs de
// `refs/remotes/origin/`): **0 desacuerdos**. Y como un cero medido caduca, el guard
// `tests/scrum753-…` las reconcilia sobre el árbol vivo en cada tanda: el día que discrepen, rojo.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { agruparRamas } from './_censo-reparto.mjs';
import { numeroDeRama, numeroDeEntrada } from './censo-tablero-vs-arbol.mjs';
import { numeroDelTituloDeEntrada, patronTicket } from '../tests/_censo-tickets.mjs';

/** LOS TRES ESTADOS. No hay un cuarto, y el tercero NO es «no está». */
export const ESTADOS = {
  DENTRO: 'DENTRO',
  FUERA: 'FUERA',
  NO_MEDIBLE: 'NO_MEDIBLE',
};

/**
 * EL MOTIVO DEL `NO_MEDIBLE`, y va SIEMPRE: cada uno se acciona distinto.
 *
 *   · SIN_RAMA            → hay entrada de máster pero ninguna rama que preguntar. Puede ser una
 *                           rama mergeada Y BORRADA (trabajo dentro, ref desaparecida) o trabajo
 *                           que nunca tuvo rama. Se mira la corroboración antes de concluir nada.
 *   · SIN_RAMA_NI_ENTRADA → el ticket no está en la población derivable. Sólo aparece si lo
 *                           NOMBRAS. Es el estado de todo lo asignable (ver cabecera).
 *   · NUMERO_COMPARTIDO   → su entrada de máster está TITULADA PARA OTRO ticket, así que ni sus
 *                           ramas ni sus commits son atribuibles. Lo detecta SCRUM-388.
 *   · OBJETO_AUSENTE      → hay rama, pero su objeto no está en local: `--is-ancestor` no puede
 *                           contestar. «No lo sé» no se cuenta como «no».
 */
export const MOTIVOS = {
  SIN_RAMA: 'sin rama',
  SIN_RAMA_NI_ENTRADA: 'sin rama ni entrada',
  NUMERO_COMPARTIDO: 'número compartido',
  OBJETO_AUSENTE: 'rama sin objeto en local',
};

function gitDe(raiz) {
  return (...args) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * 🔴 EL `fetch` ES PARTE DEL PROCEDIMIENTO, NO UNA RECOMENDACIÓN EN LA CABECERA.
 *
 * `docs/ERRORES_ASESOR.md` R10 lo dice y aquí se EJECUTA: los worktrees COMPARTEN los refs, así
 * que `refs/remotes/origin/*` se mueve **sin que tú hagas nada** cuando otra sesión trae. Un
 * censo que se limita a recomendar el fetch mide contra lo que dejó el último que pasó por aquí.
 *
 * Es lectura pura: `fetch` no toca el árbol de trabajo ni mueve ninguna rama local.
 */
export function traerRefs(raiz) {
  gitDe(raiz)('fetch', '--quiet', 'origin', '+refs/heads/*:refs/remotes/origin/*');
}

/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * LA INSTANTÁNEA. **SE LEE UNA VEZ Y NO SE VUELVE A LEER.**
 *
 * 🔴 ESTO ES LA CORRECCIÓN DE UN DESAJUSTE MEDIDO Y NO EXPLICADO, y no era inocuo.
 * El 5-sep-2026 `scripts/censo-tablero-vs-arbol.mjs` publicó 454 tickets censados con 453 filas.
 * No se pierde uno entre el recuento y la presentación: **SE GANA UNO ENTRE DOS LECTURAS**.
 *
 * `censar()` llama a `numerosDelArbol()` para construir las filas y, cuando termina, llama a
 * `poblacionDe()` — que vuelve a llamar a `numerosDelArbol()`. Son DOS `for-each-ref` separados
 * por el censo entero (~10 min con 450 tickets) sobre un espacio de refs COMPARTIDO por dieciséis
 * worktrees. Otra sesión hizo `fetch` en medio, apareció una rama, y la segunda lectura contó 454
 * sobre unas filas calculadas con 453.
 *
 * Y ése es el modo de fallo peor: **la respuesta es exacta y la pregunta indeterminada**. Ningún
 * comando falló, ningún número era «erróneo», y el informe salió con aspecto de medición dura.
 *
 * Aquí no puede pasar por construcción: se lee UNA vez, se CONGELA el sha de la referencia, y
 * todo —población, clasificación, corroboración, titular— se calcula contra ESE objeto. Si otra
 * sesión trae algo mientras corremos, este censo sigue describiendo el árbol que midió y lo dice
 * con su sha y su hora. Un censo reproducible vale más que uno recién hecho a medias.
 */
export function instantanea({ raiz = process.cwd(), ref = 'origin/main', traer = true } = {}) {
  const g = gitDe(raiz);
  if (traer) traerRefs(raiz);

  // El sha se congela AQUÍ. A partir de esta línea el nombre `origin/main` no se vuelve a usar:
  // sólo el objeto. Es lo que hace que la pregunta deje de ser móvil (R10).
  const sha = g('rev-parse', `${ref}^{commit}`).trim();

  // UNA sola lectura de refs, con su objeto, para no preguntar dos veces por lo mismo.
  //
  // 🔴 CON EL REFNAME COMPLETO, Y ESTO ES UN DEFECTO CORREGIDO CONTRA UNA RESPUESTA CONOCIDA.
  //
  // La primera versión pedía `%(refname:short)` y filtraba el nombre `HEAD`. **No funcionaba**, y
  // el número era plausible: git abrevia `refs/remotes/origin/HEAD` a `origin` —no a `origin/HEAD`,
  // porque `origin` ya es shorthand suyo—, así que el puntero simbólico se colaba como si fuera una
  // rama llamada `origin`. Medido el 6-sep-2026: `git ls-remote --heads origin` da **491** y este
  // censo decía **492**. Un ref de más que sale siempre DENTRO y engorda el recuento de residuo.
  //
  // Se pide el refname ENTERO y se descarta por identidad exacta. `origin/HEAD` no es una rama de
  // trabajo: es un puntero a `main`.
  const PREFIJO = 'refs/remotes/origin/';
  const ramas = g('for-each-ref', '--format=%(objectname) %(refname)', 'refs/remotes/origin/')
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => {
      const [objeto, refname] = l.split(/\s+/);
      return { objeto, refname, nombre: String(refname).slice(PREFIJO.length) };
    })
    .filter((r) => r.refname !== `${PREFIJO}HEAD`);

  const dirMaster = path.join(raiz, 'docs', 'master');
  const entradas = fs.existsSync(dirMaster) ? fs.readdirSync(dirMaster) : [];

  // El refspec decide si este clon puede ver TODAS las ramas o una sola. Sin él, un clon capado
  // devuelve una lista corta que se lee igual que «no hay ninguna» (SCRUM-388).
  let refspec = '';
  try { refspec = g('config', '--get', 'remote.origin.fetch').trim(); } catch { refspec = ''; }

  return { raiz, ref, sha, ramas, entradas, refspec, hora: new Date().toISOString() };
}

/**
 * LA POBLACIÓN, derivada de LA MISMA instantánea. No toca git: si tocara, volvería a abrir la
 * puerta del 454/453.
 */
export function poblacionDe(inst) {
  const deRamas = new Set();
  for (const r of inst.ramas) { const n = numeroDeRama(r.nombre); if (n) deRamas.add(n); }
  const deEntradas = new Set();
  for (const f of inst.entradas) { const n = numeroDeEntrada(f); if (n) deEntradas.add(n); }
  const numeros = [...new Set([...deRamas, ...deEntradas])].sort((a, b) => a - b);
  return {
    numeros,
    deRamas,
    deEntradas,
    ramasLeidas: inst.ramas.length,
    entradasLeidas: inst.entradas.length,
    ticketsCensados: numeros.length,
    frontera: 'números derivados de ramas de refs/remotes/origin/ YA TRAÍDAS + ficheros de docs/master/',
    ciego: 'los tickets SIN rama y SIN entrada — que son exactamente los asignables',
  };
}

/**
 * EL SUELO. Se comprueba ANTES de informar de nada, y devuelve MOTIVOS, no un booleano.
 *
 * 🔴 «CERO SOBRE POBLACIÓN VACÍA NO ES UN CERO»: si ningún ticket del lote tiene rama, este censo
 * no ha medido alcanzabilidad de nada, y decirlo en voz baja lo convertiría en «no está en main».
 *
 * ⚠️ Devuelve una LISTA, y quien la use mira su `length`. No devuelve `{ ok }`: medido el
 * 6-sep-2026, `scripts/censo-tablero-vs-arbol.mjs:136` comprueba `suelo.ok === false` sobre el
 * array que devuelve `comprobarSuelo`, así que esa mitad de su suelo NUNCA ha podido dispararse.
 * Un suelo que no se ha visto fallar es una decoración; ver el hueco declarado en la entrada.
 */
export function motivosParaNoFiarse(inst, filas) {
  const motivos = [];
  if (!inst.refspec) {
    motivos.push('no hay remoto «origin» configurado: no hay refs de origin que medir');
  } else if (!inst.refspec.includes('refs/heads/*')) {
    motivos.push(`el clon trae UNA sola rama (${inst.refspec}), no todas. No falla: devuelve una `
      + 'lista corta que se lee igual que «no hay ninguna»');
  }
  if (inst.ramas.length === 0) {
    motivos.push('CERO ramas en refs/remotes/origin/: sin ellas `--is-ancestor` no tiene a quién '
      + 'preguntar y TODO saldría NO_MEDIBLE');
  }
  if (filas && filas.length && !filas.some((f) => f.ramas.length > 0)) {
    motivos.push('NINGÚN ticket del lote tiene rama: no se ha medido alcanzabilidad de nada. Eso '
      + 'NO dice «no está en main», dice que no se ha podido mirar');
  }
  return motivos;
}

/**
 * LA CORROBORACIÓN, EN DOS PASADAS SOBRE LA INSTANTÁNEA — no una consulta por ticket.
 *
 * Con 450 tickets, preguntarle a git por cada uno cuesta ~10 minutos (es lo que declara el propio
 * `censo-tablero-vs-arbol.mjs`, y es la razón de que su población viva aparte de su censo). Aquí
 * se leen TODOS los asuntos una vez y se reparten por número: dos llamadas a git en total.
 *
 * ── PARA QUÉ SIRVE, Y ES LA MITAD DEL INSTRUMENTO ────────────────────────────────────────────
 * La alcanzabilidad tiene DOS puntos ciegos y los dos se declaran aquí, sin fingir que se cierran:
 *
 *   ① 🔴 RAMA PARADA SOBRE UN COMMIT VIEJO DE `main` → es ancestro **TRIVIALMENTE** y sale DENTRO
 *      sin contener ni una línea del ticket. Comprobado: `--is-ancestor` da 0 para un commit
 *      cualquiera de la historia. Por eso un DENTRO sin corroboración se marca `sinCorroborar`.
 *   ② 🔴 RAMA MERGEADA Y LUEGO BORRADA → no queda ref que preguntar y el ticket cae en
 *      `NO_MEDIBLE · sin rama`, que se lee peligrosamente parecido a «no hay trabajo». La
 *      corroboración es lo único que distingue ese caso del ticket que nunca empezó.
 *
 * `merges` — merges de la cadena first-parent cuyo ASUNTO nombra una rama del ticket.
 *   Medido sobre `origin/main` = 590e019d (árbol `cobroflash-b16`, 6-sep-2026T05:10:58Z):
 *   **945 de 1025 merges** (unidad: commits de merge) nombran su rama → la señal existe, y le
 *   faltan 80. NO es una prueba: es corroboración, y por eso nunca decide el estado por sí sola.
 *
 * `commits` — commits cuyo ASUNTO nombra `SCRUM-N` con frontera de dígito. Se usa `patronTicket`
 *   del motor de SCRUM-388, no una regex propia: «SCRUM-29» no puede casar dentro de «SCRUM-298».
 *   EN EL ASUNTO y no en el cuerpo, por la misma razón que el motor: una referencia cruzada dice
 *   «esto tiene que ver con aquello», no «aquello se construyó aquí».
 */
export function corroboracionDe(inst) {
  const g = gitDe(inst.raiz);
  const porTicket = new Map();
  const dame = (n) => {
    if (!porTicket.has(n)) porTicket.set(n, { merges: 0, commits: 0 });
    return porTicket.get(n);
  };

  // 🔴 UN ASUNTO SUMA COMO MUCHO UNO POR TICKET, Y ESTO ES UN DEFECTO CORREGIDO, NO UNA CAUTELA.
  //
  // La primera versión sumaba por CADA coincidencia de la regex, así que la unidad de la columna
  // no era «commits»: era «menciones». Medido el 6-sep-2026 sobre `origin/main` = 590e019d:
  // **15 de 3811 asuntos** nombran el MISMO ticket dos veces —«Merge branch 'scrum-581-…' into
  // scrum-581-…», «SCRUM-720d: … de SCRUM-720.md»— y esos quince salían con el doble.
  //
  // En los merges hoy hay 0 casos, así que el número no habría cambiado y el defecto habría
  // esperado tranquilo al primero. Un rótulo que dice «merges» tiene que contar merges.
  const contarUnaVezPorAsunto = (asunto, re, campo, filtro = () => true) => {
    const vistos = new Set();
    for (const m of String(asunto).matchAll(re)) {
      const n = Number(m[1]);
      if (vistos.has(n) || !filtro(n, asunto)) continue;
      vistos.add(n);
      dame(n)[campo] += 1;
    }
  };

  // Se consultan por SHA CONGELADO, no por el nombre del ref: si otra sesión mueve `origin/main`
  // mientras corremos, seguimos midiendo el mismo árbol que la población.
  const merges = g('log', '--merges', '--first-parent', inst.sha, '--pretty=%s').split('\n');
  for (const asunto of merges) {
    // La convención de la casa en el asunto del merge: `… from lwislg99/scrum-<n>[letra]-<slug>`.
    // La LETRA DE FASE cuenta: medido, `scrum-161b-e2e-recibo` es el quinto merge de SCRUM-161, y
    // sin ella el control positivo del ticket habría salido con cuatro en vez de con cinco.
    contarUnaVezPorAsunto(asunto, /scrum-0*(\d+)[a-z]?-/gi, 'merges');
  }

  const asuntos = g('log', inst.sha, '--format=%s').split('\n');
  for (const asunto of asuntos) {
    // 🔴 La frontera la pone el motor oficial, no este fichero: `patronTicket(n)` es quien sabe
    // que el 29 no vive dentro del 298. La regex sólo ENUMERA candidatos.
    contarUnaVezPorAsunto(asunto, /SCRUM-0*(\d+)/gi, 'commits', (n, a) => patronTicket(n).test(a));
  }
  return porTicket;
}

/** El prefijo de las refs que este censo mide. Lo usan la instantánea y los dos clasificadores. */
export const PREFIJO_ORIGIN = 'refs/remotes/origin/';

/**
 * ¿ES ESTE OBJETO ANCESTRO DEL SHA CONGELADO? true / false / **null cuando no se sabe**.
 *
 * ⚖️ EL ÁRBITRO, rama a rama y con `merge-base --is-ancestor` — el criterio literal del ticket.
 * En producción se usa `alcanzabilidadDe` (abajo), que es el mismo criterio preguntado a granel;
 * éste se queda como referencia EXACTA y el guard de SCRUM-753 reconcilia los dos.
 *
 * El `null` es la mitad que importa: un objeto que no está en local no puede contestar, y contarlo
 * como «no es ancestro» inventaría trabajo vivo que quizá lleve mergeado desde agosto. Es
 * exactamente el defecto del que nació SCRUM-387.
 */
export function esAncestroDe(inst) {
  const g = gitDe(inst.raiz);
  // La firma es `(nombre, objeto)` en los DOS clasificadores a propósito: si cada uno pidiera lo
  // suyo, no serían intercambiables y el guard no podría reconciliarlos pasándoles lo mismo.
  return (nombre, objeto) => {
    if (!objeto) return null;
    try { g('cat-file', '-e', `${objeto}^{commit}`); } catch { return null; }
    try { g('merge-base', '--is-ancestor', objeto, inst.sha); return true; } catch { return false; }
  };
}

/**
 * LO MISMO, PREGUNTADO A GRANEL: dos llamadas a git en vez de dos por rama.
 *
 * `for-each-ref --merged=<commit>` lista las refs cuya punta es alcanzable desde ese commit; es la
 * MISMA relación que `merge-base --is-ancestor`, contestada por el mismo motor de git de una vez.
 *
 * ── POR QUÉ NO SE DEJÓ SÓLO EL ÁRBITRO ───────────────────────────────────────────────────────
 * Medido el 6-sep-2026 sobre 491 refs (árbol `cobroflash-b16`, `origin/main` = 590e019d):
 *   · rama a rama con `merge-base --is-ancestor` .... 52,6 s
 *   · a granel con `--merged` / `--no-merged` ........ 0,30 s
 * Los dos dan **408 dentro · 83 fuera**. La diferencia no es cosmética: con 52 s este censo no
 * cabe en `npm test`, y un control positivo que no se corre no controla nada.
 *
 * 🔴 Y EL TERCER VALOR NO SE DEDUCE, SE PROVOCÓ. Una ref que apunta a un objeto inexistente
 * aparece en el listado plano y **no aparece ni en `--merged` ni en `--no-merged`**, sin que git
 * dé error (comprobado fabricando la ref a mano en un repo de usar y tirar). O sea que «no está en
 * ninguno de los dos conjuntos» ES la respuesta «no se sabe», y no una suposición mía.
 */
export function alcanzabilidadDe(inst) {
  const g = gitDe(inst.raiz);
  const leer = (bandera) => new Set(
    g('for-each-ref', '--format=%(refname)', bandera, PREFIJO_ORIGIN)
      .split('\n').map((s) => s.trim()).filter(Boolean));
  const dentro = leer(`--merged=${inst.sha}`);
  const fuera = leer(`--no-merged=${inst.sha}`);
  return (nombre) => {
    const refname = `${PREFIJO_ORIGIN}${nombre}`;
    if (dentro.has(refname)) return true;
    if (fuera.has(refname)) return false;
    return null;
  };
}

/** Commits que una rama tiene FUERA del sha congelado. Es «cuánto trabajo vivo hay ahí». */
export function adelantoDe(inst) {
  const g = gitDe(inst.raiz);
  return (objeto) => {
    try { return Number(g('rev-list', '--count', `${inst.sha}..${objeto}`).trim()); } catch { return null; }
  };
}

/**
 * EL CENSO: una fila por ticket, con su estado, su motivo y su evidencia.
 *
 * `numeros` son los tickets por los que se pregunta. Si no se pasan, se barre la población
 * derivable — y entonces el instrumento NO puede ver lo asignable (ver cabecera).
 */
export function censar(inst, { numeros = null, esAncestro = null, adelanto = null, corroboracion = null } = {}) {
  const poblacion = poblacionDe(inst);
  const preguntados = numeros && numeros.length
    ? [...new Set(numeros.map(Number))].sort((a, b) => a - b)
    : poblacion.numeros;
  const anc = esAncestro || alcanzabilidadDe(inst);
  const ade = adelanto || adelantoDe(inst);
  const corr = corroboracion || corroboracionDe(inst);

  // ── La clasificación de cada rama la hace `agruparRamas` (SCRUM-387), no este fichero ───────
  // Se le entrega la instantánea en su formato de entrada (`<sha> refs/heads/<nombre>`) para no
  // reimplementar ni el parseo ni el reparto true/false/null → en-main/viva/indeterminada.
  //
  // ⚠️ El clasificador se consulta POR NOMBRE DE RAMA, no por sha: `--merged` contesta sobre REFS.
  // `agruparRamas` pasa `(sha, nombre)` y aquí se usa el segundo — el árbitro `esAncestroDe` usa
  // el primero, y por eso el guard los reconcilia en vez de darlos por equivalentes.
  const lineas = inst.ramas.map((r) => `${r.objeto} refs/heads/${r.nombre}`);
  const agrupadas = agruparRamas(lineas, (sha, nombre) => anc(nombre, sha));
  const objetoDe = new Map(inst.ramas.map((r) => [r.nombre, r.objeto]));

  const filas = preguntados.map((n) => {
    const ramas = (agrupadas.porTicket.get(n) || []).map((r) => ({
      nombre: r.nombre,
      clase: r.clase,
      objeto: objetoDe.get(r.nombre) || null,
      adelanto: r.clase === 'viva' ? ade(objetoDe.get(r.nombre)) : 0,
    }));
    const c = corr.get(n) || { merges: 0, commits: 0 };
    const tieneEntrada = poblacion.deEntradas.has(n);

    // ── NÚMERO COMPARTIDO · lo dictamina SCRUM-388, no este fichero ───────────────────────────
    // Si la entrada existe pero su primer título dice OTRO ticket, ni sus ramas ni sus commits son
    // atribuibles. `null` (no hay título) NO acusa: «no lo sé» no es «es de otro».
    let tituloDe = null;
    if (tieneEntrada) {
      try {
        tituloDe = numeroDelTituloDeEntrada(
          fs.readFileSync(path.join(inst.raiz, 'docs', 'master', `SCRUM-${n}.md`), 'utf8'));
      } catch { tituloDe = null; }
    }
    if (tieneEntrada && tituloDe !== null && tituloDe !== n) {
      return fila(n, ESTADOS.NO_MEDIBLE, MOTIVOS.NUMERO_COMPARTIDO, ramas, c, tieneEntrada, {
        porque: `\`docs/master/SCRUM-${n}.md\` existe pero está TITULADO PARA SCRUM-${tituloDe}. `
          + 'Con el número compartido no se puede saber de quién es ni la rama ni el commit.',
      });
    }

    // ── POBLACIÓN VACÍA · el tercer estado, y NO es «no está» ─────────────────────────────────
    if (ramas.length === 0) {
      const motivo = tieneEntrada ? MOTIVOS.SIN_RAMA : MOTIVOS.SIN_RAMA_NI_ENTRADA;
      return fila(n, ESTADOS.NO_MEDIBLE, motivo, ramas, c, tieneEntrada, {
        porque: tieneEntrada
          ? 'hay entrada de máster pero NINGUNA rama que preguntar: la alcanzabilidad no tiene '
            + 'población. Puede ser una rama mergeada Y BORRADA o trabajo que nunca tuvo rama — '
            + 'lo distingue la corroboración, no este estado.'
          : 'este ticket NO está en la población derivable (ni rama ni entrada). Sólo aparece '
            + 'porque lo has NOMBRADO. Es el estado de todo lo que queda por asignar.',
      });
    }

    // Una rama cuyo objeto no está en local no contesta. No saber no es decir que no.
    if (ramas.every((r) => r.clase === 'indeterminada')) {
      return fila(n, ESTADOS.NO_MEDIBLE, MOTIVOS.OBJETO_AUSENTE, ramas, c, tieneEntrada, {
        porque: 'todas sus ramas tienen el objeto ausente en local: `--is-ancestor` no puede '
          + 'contestar. Comprueba el fetch antes de leer esto como una ausencia de trabajo.',
      });
    }

    const vivas = ramas.filter((r) => r.clase === 'viva');
    if (vivas.length) {
      const suma = vivas.reduce((t, r) => t + (r.adelanto || 0), 0);
      return fila(n, ESTADOS.FUERA, null, ramas, c, tieneEntrada, {
        porque: `${vivas.length} rama(s) NO alcanzables desde el sha medido, con ${suma} commit(s) `
          + 'fuera de `main`. Que estén fuera no dice que sirvan: dice que nadie las ha mergeado.',
      });
    }

    // 🔴 DENTRO SIN CORROBORAR: una rama parada sobre un commit viejo de `main` es ancestro
    // trivialmente. El estado sigue siendo DENTRO —es lo que git contesta— pero la fila lo dice.
    const sinCorroborar = c.merges === 0;
    return fila(n, ESTADOS.DENTRO, null, ramas, c, tieneEntrada, {
      sinCorroborar,
      porque: sinCorroborar
        ? 'todas sus ramas son alcanzables desde el sha medido, pero NINGÚN merge de la cadena '
          + 'first-parent nombra una rama suya. Una rama parada sobre un commit viejo de `main` es '
          + 'ancestro trivialmente: esto puede ser trabajo mergeado o una rama que nunca aportó nada.'
        : 'todas sus ramas son alcanzables desde el sha medido, y hay merges que las nombran.',
    });
  });

  return { poblacion, preguntados, filas, agrupadas };
}

function fila(numero, estado, motivo, ramas, corroboracion, tieneEntrada, extra = {}) {
  return {
    numero,
    ticket: `SCRUM-${numero}`,
    estado,
    motivo,
    ramas,
    corroboracion,
    tieneEntrada,
    sinCorroborar: false,
    ...extra,
  };
}

/** El recuento por estado. Es un OBJETO: nadie lo lee sin pedirlo, y no se pega en un informe. */
export function resumenDe(filas) {
  const r = { DENTRO: 0, FUERA: 0, NO_MEDIBLE: 0, total: filas.length, sinCorroborar: 0, porMotivo: {} };
  for (const f of filas) {
    r[f.estado] += 1;
    if (f.sinCorroborar) r.sinCorroborar += 1;
    if (f.motivo) r.porMotivo[f.motivo] = (r.porMotivo[f.motivo] || 0) + 1;
  }
  return r;
}

/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 EL TITULAR AGREGADO **NO SE IMPRIME SOLO**.
 *
 * «452 de 453 con trabajo en `main`» no significa 452 hechos, y esa frase suelta es la que hace
 * que alguien dé nueve tickets por cerrados. La señal se cumple con CUALQUIER commit que nombre el
 * ticket, y aquí ni siquiera eso: se cumple con que unos objetos sean alcanzables.
 *
 * Por eso el número y su salvedad salen de LA MISMA función y en el MISMO valor de retorno. No es
 * una convención de estilo: es la única forma de que no se puedan separar copiando media línea.
 * Si alguien quiere el número desnudo tiene `resumenDe`, que devuelve un objeto y no una frase que
 * se pueda pegar en un informe.
 *
 * El guard de este ticket inyecta la separación y exige el rojo.
 */
export function titularConSalvedad(resumen) {
  return [
    `${resumen.DENTRO} DENTRO · ${resumen.FUERA} FUERA · ${resumen.NO_MEDIBLE} NO MEDIBLE, `
      + `sobre ${resumen.total} preguntados.`,
    '⚠️ ESTO NO SON TICKETS HECHOS. «DENTRO» dice que unos commits son alcanzables desde el sha '
      + 'medido; no dice que hagan lo que el ticket pedía. Medido el 5-sep-2026: un ticket salió '
      + 'entero de fachada y estaba parcial, y otro entero CON EL ALCANCE INVERTIDO.',
    '⚠️ Y lo que falta aquí no es cero: los tickets sin rama y sin entrada NO ESTÁN EN LA '
      + 'POBLACIÓN, y son exactamente los que quedan por asignar.',
  ].join('\n');
}
