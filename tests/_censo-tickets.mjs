// tests/_censo-tickets.mjs — SCRUM-388
//
// ¿QUÉ HAY EN `main` DE UN TICKET? Tres veredictos: ENTERO · PARCIAL · NADA.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA REGLA VERTEBRAL: **LA EVIDENCIA TIENE QUE NOMBRAR EL TICKET**
//
// Un commit que cite `SCRUM-N`, un `docs/master/SCRUM-N.md`, una rama con N. Y nada más.
//
// «Hay un mecanismo que se parece» NO ES EVIDENCIA, y no es una cautela teórica: es exactamente
// cómo se dio por cerrada A9 (SCRUM-354). Alguien encontró el ciclo de mantenimientos —modelo con
// periodicidad, cron diario, anti-spam, botones— y le pareció el mismo mecanismo. Pero eso es
// **A15/MANT-1**, construido el 6-JULIO, un mes ANTES de que el ticket A9 existiera. Comparten el
// modelo `MaintenancePlan` y no comparten el objeto: A15 propone PRESUPUESTOS al profesional; A9
// pide EMITIR FACTURAS solo, generar trabajos y avisar al cliente. Nada de eso existe.
//
// > **Encontrar un mecanismo que se parece no es encontrar el ticket.** El parecido es la forma
// > que tiene un censo de mentir en la dirección cómoda: la que dice que no hay trabajo pendiente.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ TRES VEREDICTOS Y NO DOS
//
// «Parcial» no es un matiz: es el estado real de A2 (SCRUM-293) y A3 (SCRUM-294) —dominio con
// tests, sin llamadores, sin UI— y aplanarlo miente en las dos direcciones. Como «hecho», esconde
// trabajo pendiente. Como «nada», tira a la basura una entrega medida y declarada.
//
// ⚠️ Y LA SEÑAL DE «PARCIAL» **NO** ES LA FRASE «ENTREGA PARCIAL». Medido el 7-ago-2026: los
// docs de 293, 294 **y 298** llevan los tres esa frase, y 298 está entregado del todo respecto de
// su alcance vigente. Lo que de verdad los separa es si queda **mecanismo construido y sin
// conectar**: 293 y 294 dejan cálculo que no llama nadie, esperando campos de schema; 298 redujo
// el alcance por decisión del fundador y lo que entregó está en uso.
//
//   · PARCIAL → hay código en `main` que todavía no hace nada para el usuario.
//   · ENTERO  → lo entregado está conectado; lo que falta se declaró fuera de alcance con motivo.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Frases con las que una entrega declara que dejó mecanismo sin conectar.
 *
 * ⚠️ Lista CORTA y declarada a propósito. Ampliarla a base de sinónimos la volvería un detector
 * de tono en vez de un detector de hecho, y entonces cualquier entrega prudente saldría PARCIAL.
 * Si una entrega nueva declara su parcialidad con otras palabras, se añaden AQUÍ con su caso.
 */
export const MARCAS_SIN_CONECTAR = [
  'sin llamadores',
  'sin conectar',
  'no lo llama nadie',
  'no la llama nadie',
];

/**
 * Normaliza texto de markdown para buscar frases que CRUZAN LÍNEAS.
 *
 * 🔴 Los dos pasos son obligatorios y el segundo se descubrió midiendo. En `SCRUM-294.md` la frase
 * «sin llamadores» está partida entre dos líneas **de blockquote**, así que colapsar espacios sin
 * más deja `...probado y sin > llamadores` — con el `>` en medio— y el `grep` da CERO sobre un
 * fichero que sí lo dice. Un censo que no sabe leer su propia fuente da el mismo número que un
 * censo vacío.
 */
export function normalizar(texto) {
  return texto.replace(/^\s*>\s?/gm, ' ').replace(/\s+/g, ' ');
}

/**
 * El número, con FRONTERA. `SCRUM-29` no puede casar dentro de `SCRUM-298`, ni al revés: sin
 * frontera, un censo de SCRUM-29 heredaría toda la evidencia del 298 y lo daría por hecho.
 *
 * ⚠️ SCRUM-753 le añadió el `export` y nada más. Es aditivo y no cambia el motor: lo pide
 * `scripts/_censo-alcanzabilidad.mjs`, que reparte commits por ticket y necesita ESTA frontera.
 * La alternativa era la tercera copia de la misma regla, y la copia es cómo una de las dos se
 * queda atrás.
 */
export function patronTicket(n) {
  return new RegExp(`SCRUM-${n}(?![0-9])`, 'i');
}

/**
 * 🔴 SCRUM-388 (10-ago-2026) · CUANDO GIT FALLA, EL ROJO TIENE QUE DECIR DÓNDE MIRAR.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * DE DÓNDE SALE ESTO
 *
 * CI se puso rojo con un `status: 128` pelado desde `censarTicket`:
 *
 *     error: Could not read 52a5fcd…
 *     fatal: Failed to traverse parents of commit 6fc018fc…
 *
 * Con eso en el log no se puede diagnosticar nada: no dice **en qué repositorio** murió (aquí
 * conviven el repo real y el sintético del fixture), ni si ese repositorio estaba sano. Costó una
 * sesión entera de mediciones descartar cinco hipótesis —la primera, un clon superficial— cuando
 * los tres SHA del mensaje eran del **fixture** y bastaba con haberlo dicho.
 *
 * ⚠️ ESTO NO RELAJA NADA. Sigue lanzando, el test sigue ROJO y no hay ningún camino nuevo hacia el
 * verde: un test que se declara bueno porque no pudo mirar es justo el defecto que este censo
 * existe para cazar. Lo único que cambia es **qué se lee en el rojo**.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * POR QUÉ AQUÍ Y NO EN LOS CUATRO SITIOS
 *
 * Medido: de las siete llamadas a git de este fichero, tres iban desnudas (`:log`, `:for-each-ref`,
 * `:show`), tres pasaban por el `intentar` de `capacidadDeMedir` y una por el `try` propio del
 * suelo. **Dos tratamientos distintos para la misma operación dejan un hueco con la forma exacta
 * de lo que nadie mira.** Poniéndolo en el helper, la asimetría no se corrige: deja de existir.
 *
 * ⚠️ CÓMO SE DECIDE CUÁNDO DIAGNOSTICAR, Y POR QUÉ NO SE MIRA EL TEXTO DE GIT.
 *
 * `capacidadDeMedir` llama a git **esperando que falle** (un `rev-parse --verify` de un ref que no
 * existe ES la respuesta), así que correr `fsck` en cada uno de esos fallos previstos sería pagar
 * un censo del repositorio por cada pregunta rutinaria. Hacía falta distinguirlos.
 *
 * El primer intento fue una regex sobre el `stderr` («could not read», «failed to traverse»…).
 * **Una prueba de rojo la tumbó en el primer disparo:** reproducido el síntoma exacto de CI, git
 * dijo `fatal: cannot read commit object` —una redacción que la lista no tenía— y el diagnóstico
 * caro NO se disparó. Ampliar la lista habría sido enseñarle al analizador la frase que hoy conozco
 * y dejarlo ciego ante la siguiente versión de git.
 *
 * Así que la diferencia la declara **QUIEN LLAMA**, que es el único que sabe si un fallo es la
 * respuesta esperada: `{ sondeo: true }`. Todo lo demás diagnostica. No hay nada que adivinar y no
 * hay ninguna redacción de git de la que dependa esto.
 */

/** Estado del repositorio, para adjuntar al rojo. Nunca lanza: si no se puede mirar, lo dice. */
function estadoDelRepo(cwd) {
  const sonda = (args) => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch (e) {
      // El `stderr` de la sonda PRIMERO: cuando la que falla es `fsck`, su salida ES el hallazgo
      // («missing commit …»), y quedarse con el `Command failed` de Node tira justo el dato útil.
      const err = String(e?.stderr || '').trim().split('\n').join(' · ');
      return `(no se pudo: ${err || String(e?.message || e).split('\n')[0]})`;
    }
  };
  return [
    `      repositorio: ${cwd}`,
    `      count-objects: ${sonda(['count-objects', '-v']).replace(/\n/g, ' | ')}`,
    `      superficial: ${sonda(['rev-parse', '--is-shallow-repository'])}`,
    `      fsck: ${sonda(['fsck', '--no-progress', '--connectivity-only']) || 'sin hallazgos'}`,
  ].join('\n');
}

/**
 * @param {string[]} args
 * @param {string} cwd
 * @param {{sondeo?: boolean}} opciones  `sondeo: true` = **este fallo puede ser la respuesta**
 *        (lo usa `capacidadDeMedir`). Sin él, un fallo es un accidente y se diagnostica entero.
 */
function git(args, cwd, { sondeo = false } = {}) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const stderr = String(e?.stderr || '').trim();
    const partes = [
      `[censo] \`git ${args.join(' ')}\` falló en ${cwd}`,
      stderr ? `      stderr: ${stderr.split('\n').join('\n              ')}` : '      (sin stderr)',
    ];
    if (!sondeo) {
      partes.push('      🔴 esto NO era un sondeo: el repositorio falló donde se contaba con él.');
      partes.push(estadoDelRepo(cwd));
    }
    // Se relanza SIEMPRE: quien capturaba antes sigue capturando, y quien no, sigue en rojo.
    const err = new Error(partes.join('\n'));
    err.cause = e;
    err.status = e?.status;
    throw err;
  }
}

/**
 * Censa un ticket contra `main`. Devuelve el veredicto y **las fuentes**, para que quien lea el
 * informe pueda ir a comprobarlo — un veredicto sin su evidencia es una opinión.
 *
 * @param {number|string} numero  el N de SCRUM-N
 * @param {object} opciones  `{ raiz, ref }` — `ref` es contra qué se mide (por defecto `origin/main`)
 */
/**
 * SCRUM-738 · el número que el CONTENIDO de una entrada dice ser: su primer título `# SCRUM-<n>`.
 *
 * Devuelve `null` si no hay título — y entonces NO se acusa de colisión: «no lo sé» no es «es de
 * otro». Las entradas de esta casa empiezan por un aviso en blockquote más de una vez, así que se
 * recorren las líneas en vez de mirar sólo la primera.
 */
export function numeroDelTituloDeEntrada(contenido) {
  for (const linea of String(contenido ?? '').split(/\r?\n/)) {
    const m = /^#\s+SCRUM-0*(\d+)\b/.exec(linea);
    if (m) return Number(m[1]);
  }
  return null;
}

export function censarTicket(numero, { raiz = process.cwd(), ref = 'origin/main' } = {}) {
  const n = String(numero).trim();
  if (!/^\d+$/.test(n)) throw new Error(`[censo] número de ticket inválido: «${numero}»`);
  const patron = patronTicket(n);

  // 🔴 LA CAPACIDAD SE MIDE ANTES DE CONSULTAR NADA. Antes se consultaba a lo bruto y `git log
  // origin/main` REVENTABA en CI con status 128 — y eso fue SUERTE: si git hubiera devuelto vacío,
  // el censo habría dicho «no encuentro evidencia» sobre un mundo que no llegó a mirar.
  const capacidad = capacidadDeMedir({ raiz, ref });
  const noMedibles = [
    ...(capacidad.commits.puede ? [] : [{ fuente: 'commits', motivo: capacidad.commits.motivo }]),
    ...(capacidad.doc.puede ? [] : [{ fuente: 'docs/master', motivo: capacidad.doc.motivo }]),
    ...(capacidad.ramas.puede ? [] : [{ fuente: 'ramas', motivo: capacidad.ramas.motivo }]),
  ];

  // ── FUENTE 1 · commits del historial que NOMBRAN el ticket EN SU ASUNTO ─────────────────
  //
  // 🔴 EN EL ASUNTO, y no en el cuerpo. Medido: `58d7753 docs(master): SCRUM-8 …` menciona otro
  // ticket dentro de su cuerpo, y aceptarlo hacía que **SCRUM-2 saliera ENTERO con evidencia que
  // no era suya**. Una referencia cruzada dice «esto tiene que ver con aquello», no «aquello se
  // construyó aquí» — y atribuir trabajo ajeno es el mismo error que dio A9 por cerrada, solo que
  // entrando por la otra puerta.
  //
  // La convención de la casa pone el ticket en el asunto (`feat(x): … (SCRUM-N)`), así que esto no
  // pierde entregas de verdad. Y si alguna citara solo en el cuerpo, sale de aquí como no vista:
  // este censo se equivoca hacia «falta trabajo», nunca hacia «ya está hecho».
  // `--grep` de git no tiene frontera de palabra portable, así que se filtra después con el
  // patrón propio: pedirle a git `SCRUM-29` devuelve también los del 298.
  const crudo = capacidad.commits.puede ? git(['log', ref, '--format=%h%cs%an%s', `--grep=SCRUM-${n}`, '-i'], raiz) : '';
  const commits = crudo.split('\n').filter(Boolean)
    .map((l) => { const [sha, fecha, autor, asunto] = l.split(''); return { sha, fecha, autor, asunto }; })
    .filter((c) => patron.test(c.asunto));

  // ── FUENTE 2 · la entrada de máster ─────────────────────────────────────────────────────
  const rutaDoc = path.join(raiz, 'docs', 'master', `SCRUM-${n}.md`);
  const doc = fs.existsSync(rutaDoc) ? fs.readFileSync(rutaDoc, 'utf8') : null;

  // ── FUENTE 3 · ramas cuyo NOMBRE lleva el número ────────────────────────────────────────
  // De las refs locales de `origin` (rápido y sin red): refleja el último `fetch`, y eso se
  // declara en vez de fingir que es el remoto en vivo.
  const refs = capacidad.ramas.puede
    ? git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/'], raiz).split('\n').filter(Boolean)
    : [];
  // 🔴 Con la CONVENCIÓN de la casa (`scrum-<n>-<slug>`), no «el número aparece por ahí». Medido:
  // buscar el número suelto atribuía a SCRUM-2 las ramas `…-rebasada-2` y `codeowners-zona-roja-v2`,
  // donde el 2 es un sufijo de reintento o de versión. Cinco ramas ajenas para un solo ticket.
  //
  // 🔴 SCRUM-738 (4-sep-2026) · LA LETRA DE FASE ENTRA, Y ESTABA CIEGO JUSTO DONDE MÁS RAMAS HAY.
  //
  // `^scrum-${n}(-|$)` no veía `scrum-684b-…`, que es la FASE B del MISMO ticket. Medido hoy:
  // **17 ramas de fase en 15 tickets distintos** (`294a`, `294b`, `37b`, `542b`, `604b`, `627b`,
  // `650d`, `652e`, `655c`, `667b`, `670b`, `683b`, `684b`, `710b`, `716c`, `728b`, `728c`). Un
  // censo del tablero que no ve las fases se queda corto en la fuente «ramas» precisamente en los
  // tickets grandes, que son los que más veces se reencargan.
  //
  // ⚠️ NO reabre el defecto que documenta el comentario de arriba: sigue ANCLADO al principio y la
  // letra va PEGADA a los dígitos, así que `^scrum-2[a-z]?(-|$)` sigue sin casar con `scrum-240-…`
  // ni con `…-rebasada-2`. Se admite UNA letra, que es la convención de la casa.
  const ramas = refs.filter((r) => new RegExp(`^scrum-${n}[a-z]?(-|$)`, 'i').test(r.replace(/^origin\//, '')));

  // 🔴 SCRUM-738 (4-sep-2026) · EL FICHERO EXISTE ≠ EL FICHERO ES DE ESTE TICKET.
  //
  // Medido: `censarTicket(684)` daba **ENTERO**, y SCRUM-684 NO está hecho —S1 trabaja su FASE B
  // ahora mismo—. `docs/master/SCRUM-684.md` existe, y su primer título dice **`# SCRUM-683`**: lo
  // explica el propio fichero, «dos sesiones se inventaron el mismo número», y dentro hay trabajo
  // de SCRUM-703 y de SCRUM-683. De 684, ninguno.
  //
  // Es el mismo defecto que este censo ya persigue un nivel más abajo —«encontrar un mecanismo que
  // se parece no es encontrar el ticket»— aplicado al fichero: encontrar un fichero que se LLAMA
  // como el ticket no es encontrar su entrada. Y falla hacia el lado cómodo, el que dice que no
  // queda trabajo.
  //
  // Con el número compartido, las otras fuentes tampoco son fiables (sus ramas y sus commits
  // pueden ser del otro), así que la colisión se DECLARA y `docs/master` deja de contar como
  // fuente. No se adivina cuál de los dos tickets es: se dice que no se puede saber.
  // ⚠️ SE COMPARAN NÚMEROS, y esto me cazó al medirlo: `n` es una CADENA en este fichero
  // (`String(numero).trim()`), así que `714 !== '714'` era siempre cierto y TODOS los tickets
  // salían con colisión. Falló hacia el lado seguro —`NO_MEDIBLE` en vez de `ENTERO`— pero habría
  // dejado el censo inservible. Lo cazó ejecutarlo, no leerlo.
  const tituloDelDoc = doc ? numeroDelTituloDeEntrada(doc) : null;
  const colision = doc && tituloDelDoc !== null && tituloDelDoc !== Number(n)
    ? { fichero: `docs/master/SCRUM-${n}.md`, tituladoPara: tituloDelDoc }
    : null;

  const fuentes = [];
  if (commits.length) fuentes.push('commits');
  if (doc && !colision) fuentes.push('docs/master');
  if (ramas.length) fuentes.push('ramas');


  // ── VEREDICTO ───────────────────────────────────────────────────────────────────────────
  if (fuentes.length === 0) {
    // 🔴 AQUÍ ESTÁ LA DISTINCIÓN QUE COSTÓ UN FALLO EN CI. Si NINGUNA fuente era mirable, esto no
    // es «no hay trabajo»: es «no he podido mirar». Devolver NADA sería inventarse una medición, y
    // encima la cómoda — la que dice que no queda nada por hacer.
    if (noMedibles.length === 3) {
      return {
        ticket: `SCRUM-${n}`, veredicto: 'NO_MEDIBLE', fuentes: [], commits: [], ramas, doc: false,
        marcas: [], noMedibles,
        porque: 'NO SE HA PODIDO MIRAR NINGUNA FUENTE: ' + noMedibles.map((x) => `${x.fuente} (${x.motivo})`).join(' · '),
      };
    }
    return {
      ticket: `SCRUM-${n}`, veredicto: 'NADA', fuentes: [], commits: [], ramas, doc: false,
      marcas: [], noMedibles,
      porque: 'ninguna evidencia NOMBRA el ticket: ni un commit, ni entrada de máster, ni una rama'
        + (noMedibles.length ? ` ⚠️ y ${noMedibles.length} fuente(s) NO se pudieron mirar: ${noMedibles.map((x) => x.fuente).join(', ')}` : ''),
    };
  }

  const textoEvidencia = normalizar(
    [doc || '', ...commits.map((c) => `${c.asunto} ${cuerpoDe(c.sha, raiz)}`)].join('\n'));
  const marcas = MARCAS_SIN_CONECTAR.filter((m) => textoEvidencia.toLowerCase().includes(m));

  // 🔴 SCRUM-738 · con el número COMPARTIDO no se dictamina. Ninguna de sus fuentes es fiable —sus
  // ramas y sus commits pueden ser del otro ticket— y `ENTERO` aquí es el falso positivo más caro
  // que puede dar este censo: el que propone cerrar algo que nadie ha hecho.
  if (colision) {
    return {
      ticket: `SCRUM-${n}`,
      veredicto: 'NO_MEDIBLE',
      fuentes, commits, ramas, doc: !!doc, marcas: [], noMedibles, colision,
      porque: `NÚMERO COMPARTIDO: \`${colision.fichero}\` existe pero está TITULADO PARA `
        + `SCRUM-${colision.tituladoPara}. Con el número compartido, ni sus ramas ni sus commits `
        + 'son atribuibles: no se puede saber qué hay en `main` DE ESTE ticket.',
    };
  }

  return {
    ticket: `SCRUM-${n}`,
    veredicto: marcas.length ? 'PARCIAL' : 'ENTERO',
    fuentes,
    commits,
    ramas,
    doc: !!doc,
    marcas,
    noMedibles,
    colision: null,
    porque: marcas.length
      ? `la entrega declara mecanismo sin conectar (${marcas.map((m) => `«${m}»`).join(', ')})`
      : 'hay evidencia que nombra el ticket y no declara nada sin conectar',
  };
}

const cacheCuerpo = new Map();
function cuerpoDe(sha, raiz) {
  if (!cacheCuerpo.has(sha)) cacheCuerpo.set(sha, git(['show', '-s', '--format=%b', sha], raiz));
  return cacheCuerpo.get(sha);
}

/**
 * ¿PUEDE ESTE ENTORNO MIRAR CADA FUENTE? Una respuesta por fuente, con su motivo.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 «NO HE PODIDO MEDIR» ≠ «NO ENCUENTRO EVIDENCIA»
 *
 * Esta función existe porque el centinela **reventó en CI** y de la peor manera posible: por
 * suerte. `actions/checkout` clona en superficial y sin refs remotos, así que `git log origin/main`
 * murió con `unknown revision` (status 128) y se vio. **Si git hubiera devuelto vacío en vez de
 * error, el centinela habría dicho «la fuente ramas no encuentra evidencia en NINGÚN ticket» — una
 * falsa alarma indistinguible de un hallazgo real.**
 *
 * Y no es hipotético: **la fuente de ramas hace exactamente eso**. Medido el 7-ago-2026 en un clon
 * `--depth 1 --single-branch`: `for-each-ref` **no falla**, devuelve **1 ref de ~90**. No revienta:
 * miente en voz baja. Ésa es la que había que cazar.
 *
 * ⚠️ Se detecta con señales EXACTAS, no con umbrales: `--is-shallow-repository` dice si la historia
 * está cortada, y el refspec de `remote.origin.fetch` dice si el clon trae todas las ramas
 * (`+refs/heads/*:…`) o una sola. Un umbral («si hay menos de N refs…») confundiría un repo nuevo
 * con un clon capado.
 */
export function capacidadDeMedir({ raiz = process.cwd(), ref = 'origin/main' } = {}) {
  const intentar = (fn, cuando) => { try { return fn(); } catch (e) { return cuando(e); } };

  // ── commits: necesita que el ref exista Y la historia completa ──────────────────────────
  let commits = { puede: true, motivo: '' };
  // `sondeo: true` en los tres de aquí: su fallo ES la respuesta que se busca, no un accidente.
  const refOk = intentar(() => { git(['rev-parse', '--verify', `${ref}^{commit}`], raiz, { sondeo: true }); return true; }, () => false);
  if (!refOk) {
    commits = { puede: false, motivo: `el ref «${ref}» no existe aquí (checkout sin refs remotos: es lo que hace \`actions/checkout\` por defecto)` };
  } else if (intentar(() => git(['rev-parse', '--is-shallow-repository'], raiz, { sondeo: true }).trim() === 'true', () => false)) {
    commits = { puede: false, motivo: 'la historia está CORTADA (clon superficial): buscar en ella diría «no hay commits» mirando solo los últimos' };
  }

  // ── docs/master: solo necesita el árbol de trabajo ──────────────────────────────────────
  // Medido: es la única que sobrevive intacta a un checkout superficial (93 entradas leídas).
  let doc = { puede: true, motivo: '' };
  const dir = path.join(raiz, 'docs', 'master');
  const n = intentar(() => fs.readdirSync(dir).filter((f) => /^SCRUM-\d+\.md$/.test(f)).length, () => -1);
  if (n < 0) doc = { puede: false, motivo: `no se puede leer ${dir}` };
  else if (n < 20) doc = { puede: false, motivo: `docs/master/ solo tiene ${n} entradas SCRUM-*.md: el árbol está incompleto` };

  // ── ramas: necesita que el clon traiga TODAS ────────────────────────────────────────────
  let ramas = { puede: true, motivo: '' };
  const refspec = intentar(() => git(['config', '--get', 'remote.origin.fetch'], raiz, { sondeo: true }).trim(), () => '');
  if (!refspec) {
    ramas = { puede: false, motivo: 'no hay remoto «origin» configurado' };
  } else if (!refspec.includes('refs/heads/*')) {
    ramas = {
      puede: false,
      motivo: `el clon trae UNA sola rama (${refspec}), no todas. No falla: devuelve una lista corta que se lee igual que «no hay ninguna»`,
    };
  }

  return { commits, doc, ramas };
}

/**
 * SUELO. Se llama ANTES de creerse ningún veredicto.
 *
 * «No supe mirar» y «no hay nada» son el mismo resultado y significan lo contrario — y ése es
 * literalmente el defecto que este censo existe para cazar, así que aquí sería el colmo.
 */
export function comprobarSuelo({ raiz = process.cwd(), ref = 'origin/main' } = {}) {
  const problemas = [];
  try {
    const n = git(['rev-list', '--count', ref], raiz).trim();
    if (!/^\d+$/.test(n) || Number(n) < 100) problemas.push(`el historial de «${ref}» devolvió ${n} commits`);
  } catch (e) {
    problemas.push(`no se pudo leer el historial de «${ref}»: ${e.message.split('\n')[0]}`);
  }
  const dir = path.join(raiz, 'docs', 'master');
  try {
    const entradas = fs.readdirSync(dir).filter((f) => /^SCRUM-\d+\.md$/.test(f));
    if (entradas.length < 20) problemas.push(`docs/master/ solo tiene ${entradas.length} entradas SCRUM-*.md`);
  } catch (e) {
    problemas.push(`no se pudo leer ${dir}: ${e.message.split('\n')[0]}`);
  }
  return problemas;
}
