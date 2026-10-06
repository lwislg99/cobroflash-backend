// scripts/vigia-atascados.mjs — el vigía de PR atascados
//
// QUÉ VIGILA: los PR en los que LA AUTOMATIZACIÓN PROMETIÓ ALGO Y NO LO HA CUMPLIDO. No mide
// el paso del tiempo: mide una promesa rota. Es la diferencia entre un vigía que sirve y uno
// que se silencia el primer día.
//
// POR QUÉ HACE FALTA, medido el 9-sep-2026: el PR #1214 estuvo horas parado por conflicto y
// NINGUNA máquina se enteró — lo vio una persona mirando la lista a mano, que es justo el
// trabajo que se venía a eliminar. Y el #1212 lleva desde ayer parado sin que nada lo diga.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ CUENTA COMO ATASCADO, Y POR QUÉ SE DESCARTA LO DEMÁS
//
// Medido el 9-sep sobre los 18 PR abiertos: 14 eran de personas SIN auto-merge armado, con
// edades de 36 h a 858 h (36 días). Contarlos daría catorce líneas en cada pasada, para
// siempre, y un vigía que grita catorce veces se silencia el primer día.
//
//   ✅ auto-merge ARMADO y sigue abierto  → la máquina dijo que lo mergearía y no lo hizo.
//   ✅ abierto por el BOT sin auto-merge  → la máquina lo abrió y falló al armar (caso #1190).
//   ❌ draft                              → declaración explícita de no querer merge.
//   ❌ etiqueta de «no mergear»           → declaración explícita del autor. ETIQUETA, no
//                                           título: un título es texto libre y cambia sin que
//                                           nadie lo note.
//   ❌ PR de persona sin auto-merge       → nadie prometió mergearlo. Es backlog, no atasco,
//                                           y tiene otro dueño.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS CAUSAS, SEPARADAS. Cada una la trajo un PR real que el vigía no sabía nombrar.
//
//   · DIRTY      conflicto real con la base. Necesita a una persona (o al futuro SCRUM-839).
//   · BEHIND     por detrás de main. Se arregla solo con un merge de main.
//   · SIN-CHECKS ningún check ha arrancado sobre el head actual. NO es lo mismo que los otros
//                dos, y es lo que bloqueaba el #1212: medido, CERO ejecuciones de CI para su
//                head `faebb1e6`. La causa está documentada desde el paso 6 — los eventos
//                creados con el `GITHUB_TOKEN` por defecto NO crean ejecuciones — así que un
//                push hecho desde dentro de un workflow con ese token deja el PR sin check
//                obligatorio y el auto-merge esperando para siempre.
//   · ROJO-OBLIGATORIO  la última ejecución de un check OBLIGATORIO está en rojo sobre el head
//                actual. SCRUM-839b, medido el 15-sep-2026: el #1205 tenía `build + tests (con
//                banco desechable)` en FAILURE desde el 8-sep y el vigía lo llamaba ESPERANDO,
//                «esperando a que pase el check obligatorio». No va a pasar sin un push. Y un
//                rojo en un check NO obligatorio no es atasco: el #1248 entró con «guards de
//                navegador» y el meta-guard en rojo. La lista de obligatorios NO se escribe
//                aquí: se lee de las reglas vivas de `main`.
//   · SIN-AUTO-MERGE  lo abrió el bot y no llegó a armar el auto-merge. Medido en el #1190 el
//                15-sep-2026: todos sus checks en verde desde el 8-sep, `abrir-pr-y-armar-automerge`
//                en rojo, y el vigía decía «esperando a que pase el check obligatorio». Nadie lo
//                va a mergear. Sale ahora porque hasta hoy el vigía no reconocía al bot (abajo).
//
// 🔴 `strict_required_status_checks_policy` SE QUEDA EN `false`, Y NO ES UNA PALANCA.
// Gobierna BEHIND, no DIRTY: subirlo no arregla un solo conflicto. Lo que sí haría es obligar
// a cada PR a actualizarse cada vez que `main` se mueve, y con seis sesiones empujando eso
// invalida todos los PR abiertos varias veces al día. Queda escrito aquí porque es aquí donde
// alguien lo va a leer y le va a parecer la solución.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL `unknown` NO ES «LIMPIO». `mergeable_state` se calcula en diferido: medido, llegó
// `unknown` en 3 de 4 PR del bot el 9-sep y en 13 de 16 el 8-sep. Leerlo como «no hay
// conflicto» sería el cero de instrumento ciego. Tras los reintentos, si sigue sin saberse,
// el estado es SIN-ESTADO y se declara como tal.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// UN ATASCO QUE ENVEJECE TAMBIÉN EMPEORA (SCRUM-839b)
//
// Medido el 15-sep-2026 a las 09:55Z: el issue del vigía (#1241) llevaba seis días abierto con
// CERO comentarios. Listaba el #1212 con 144 h, el #1205 con 166 h y el #1228 con 137 h. El
// vigía solo comentaba cuando el CONJUNTO cambiaba, y un atasco que no cambia de tamaño sí
// empeora de edad. Vuelve a avisar al cruzar umbrales, NO en cada pasada:
//
//   24 h   el vigía pasa cada 3 h, un PR sano entra en minutos y el más lento sano que se ha
//          medido (#1214, con conflicto incluido) tardó 1,2 h. A las 24 h lleva ocho pasadas
//          y veinte veces ese caso: ya no se va a desatascar solo.
//   72 h   más que un fin de semana entero (viernes 18:00 → lunes 09:00 son 63 h). El que
//          llega a 72 h ha sobrevivido a uno sin que nadie lo toque.
//   168 h  una semana, y a partir de ahí UNO POR SEMANA.
//
// Techo de ruido por PR: tres avisos en su primera semana y uno por semana después. Y todos los
// PR que crucen en la misma pasada van en UN comentario. Con esto, los tres del #1241 habrían
// avisado tres veces cada uno en su primera semana, en vez de ninguna.
//
// EL RELOJ es el del ÚLTIMO PUSH (fecha del commit de la cabeza), no el de apertura ni
// `updatedAt`: `updatedAt` lo mueve cualquier comentario —incluido el del avisador— y
// reiniciaría la edad sin que el PR se haya movido. Un push nuevo sí la reinicia, y eso es
// correcto: el PR se movió.
//
// QUÉ AVISA AL ENTRAR Y QUÉ SOLO POR EDAD. Medido en el laboratorio del 15-sep-2026 con datos
// reales: el #1259, empujado hacía UN minuto y con siete checks ya arrancados, entraba en el aviso
// como ESPERANDO. La gracia de diez minutos solo cubre «cero checks». Así que:
//   · una causa que SE ARREGLA ESPERANDO (ESPERANDO, BEHIND, SIN-ESTADO) no avisa al entrar ni al
//     cambiar a ella. Avisa al cruzar un umbral de edad, que es lo que la vuelve atasco;
//   · las que NO se arreglan esperando (SIN-CHECKS, DIRTY, CONFLICTO-DISCREPA, ROJO-OBLIGATORIO,
//     ROJO-SIN-LISTA, SIN-AUTO-MERGE) avisan al entrar, UNA vez por causa: hace falta un push o
//     una persona, y esperar a las 24 h solo retrasaría lo que ya se sabe.
// Un ROJO-OBLIGATORIO recién salido puede coincidir con el avisador despertando a Claude. Son
// destinatarios distintos —aquél habla con Claude, éste con una persona—, el avisador tiene tope
// y puerta fiscal y el vigía no puede saber si lo atendió; y como el aviso sale una vez por causa,
// el solape está acotado a un comentario.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// `main` PARADO (SCRUM-1458)
//
// Medido el 6-oct-2026 por la S0: `main` estuvo 88,5 h sin un merge (2-oct 18:22Z → 6-oct 10:50Z),
// y antes 136 h (9-sep → 15-sep). El vigía corrió durante el segundo parón y comentó tres veces
// por cuatro PR; ninguno de esos avisos decía «main está parado», porque el vigía miraba PR y no
// miraba `main`.
//
// POR QUÉ 48 h. Huecos entre commits de `main` (first-parent) desde el 1-sep-2026. Los midió la S0
// sobre 1.287 commits y los recontó la S5 ese mismo día sobre 1.318, con el mismo resultado:
//   ≥ 24 h   5   los dos parones y tres huecos de un día y pico
//   ≥ 36 h   3   los dos parones y un fin de semana (45,2 h)
//   ≥ 48 h   2   sólo los dos parones
// La fila viaja en la misma memoria que los PR, con el «número» 0, y su causa no se arregla
// esperando: avisa al entrar y al cruzar 72 h, 168 h y cada semana, como cualquier otro atasco.
//
// A QUIÉN SE MENCIONA, Y DESDE CUÁNDO (dos decisiones, las dos con su fecha):
//   · 15-sep-2026 (SCRUM-839b): la mención al dueño va en TODO aviso. El issue llevaba seis días
//     con cero comentarios y «escribir en un issue» no era «avisar a alguien».
//   · 6-oct-2026 (SCRUM-1458, decisión del orquestador de Luis): la mención va SÓLO si en esa
//     pasada `main` entra parado o cruza un umbral, o si un PR cruza 72 h o más. El issue llevaba
//     43 comentarios y los 43 mencionaban: una mención que suena siempre no distingue lo grave.
//     Los demás avisos se siguen publicando, sin mención.

/** Etiqueta con la que un autor declara que su PR no debe mergearse todavía. */
export const ETIQUETA_NO_MERGEAR = 'no-mergear';

/** El bot que abre PR automáticamente. */
export const BOT = 'yaqu-bot[bot]';

/**
 * Las identidades con las que aparece ESE bot según quién pregunte. MEDIDO el 15-sep-2026 en la
 * columna «autor» del propio issue #1241: `gh pr list --json author` devuelve `app/yaqu-bot`; la
 * API REST devuelve `yaqu-bot[bot]`. Comparar solo con la segunda hacía que la rama «lo abrió el
 * bot sin armar» NO casara nunca con los datos que reúne el workflow.
 */
export const IDENTIDADES_BOT = [BOT, 'app/yaqu-bot'];

/**
 * Minutos de gracia tras un push antes de que «cero checks» signifique algo. Los check-runs
 * aparecen cuando el workflow arranca —segundos—, así que diez minutos es holgado: si a los
 * diez no hay ninguno, no va a haberlo.
 */
export const GRACIA_MINUTOS = 10;

/** Umbrales de edad, en horas desde el último push. Por qué éstos: cabecera del fichero. */
export const UMBRALES_HORAS = [24, 72, 168];

/**
 * Las causas que SE ARREGLAN ESPERANDO. Un PR que entra —o cambia— a una de éstas no avisa: avisa
 * al cruzar un umbral de edad. Por qué: cabecera del fichero, «QUÉ AVISA AL ENTRAR».
 */
export const CAUSAS_QUE_SE_ARREGLAN_ESPERANDO = ['ESPERANDO', 'BEHIND', 'SIN-ESTADO'];
const seArreglaEsperando = (causa) => CAUSAS_QUE_SE_ARREGLAN_ESPERANDO.includes(causa);

/** Horas sin un merge en `main` desde las que el vigía lo dice. Por qué 48: cabecera, «`main` PARADO». */
export const UMBRAL_MAIN_PARADO_HORAS = 48;
/** El «número» con el que la fila de `main` viaja en la memoria del issue. Ningún PR es el #0. */
export const NUMERO_DE_MAIN = 0;
/** La causa de esa fila. NO está entre las que se arreglan esperando: avisa al entrar. */
export const CAUSA_MAIN_PARADO = 'MAIN-PARADO';
/** Edad desde la que un PR que la cruza lleva la mención (decisión del 6-oct-2026: cabecera). */
export const UMBRAL_MENCION_HORAS = 72;
/** Así empieza el renglón de `main` en el aviso. Lo busca el latido para saber que el aviso habla de `main`. */
export const MARCA_DE_MAIN_PARADO = '`main` está PARADO';

/**
 * Conclusiones de un check COMPLETADO que impiden el merge. `cancelled` va dentro: la cancelación
 * por concurrencia deja su check-run en el sha VIEJO, así que en el head actual un `cancelled`
 * que sea la última ejecución es uno que nadie ha relanzado — y bloquea igual.
 */
const CONCLUSIONES_ROJAS = new Set(['failure', 'timed_out', 'action_required', 'startup_failure', 'cancelled']);

/**
 * LA SEGUNDA SONDA, y su control. `git merge-tree --write-tree <base> <cabeza>` sale con 1 si
 * hay conflicto y 0 si no. Es un cálculo PROPIO sobre los commits, sin nada en común con el
 * campo `mergeStateStatus` que calcula GitHub en diferido — que es justo lo que la hace útil.
 *
 * 🔴 SE VALIDA ANTES DE USARLA, y no es ceremonia: una sonda que devuelve 1 siempre marcaría
 * conflicto en todo y parecería que funciona. El control es `main` contra `main`, que TIENE
 * que dar 0. Medido el 9-sep-2026 en los tres sentidos:
 *
 *     main contra main .............. 0   (sin conflicto)
 *     dos ramas que tocan la misma línea .. 1   (conflicto)
 *     dos ramas que tocan ficheros distintos 0  (limpio)
 *
 * @param {(base:string, cabeza:string) => number} correr  devuelve el código de salida
 * @returns {{valida:boolean, motivo:string}}
 */
export function validarSonda(correr) {
  try {
    const mismo = correr('HEAD', 'HEAD');
    if (mismo !== 0) {
      return { valida: false, motivo: `la sonda da ${mismo} comparando algo consigo mismo: no vale` };
    }
    return { valida: true, motivo: 'sonda validada: comparar algo consigo mismo da 0' };
  } catch (e) {
    return { valida: false, motivo: 'la sonda no se pudo ejecutar' };
  }
}

/**
 * ¿Es este PR asunto del vigía? Devuelve el motivo del descarte para que la pasada pueda
 * declararlo en vez de callárselo.
 * @param {{autor?:string, draft?:boolean, etiquetas?:string[], autoMerge?:boolean}} pr
 */
export function esAsuntoDelVigia(pr = {}) {
  if (pr.draft) return { vigilar: false, porque: 'draft: el autor dice que aún no' };

  const etiquetas = (pr.etiquetas || []).map((e) => String(e).toLowerCase());
  if (etiquetas.includes(ETIQUETA_NO_MERGEAR)) {
    return { vigilar: false, porque: `etiqueta «${ETIQUETA_NO_MERGEAR}»: el autor dice que no` };
  }

  if (pr.autoMerge) return { vigilar: true, porque: 'auto-merge armado: la máquina prometió mergearlo' };
  if (IDENTIDADES_BOT.includes(pr.autor)) return { vigilar: true, porque: 'lo abrió el bot y no llegó a armar el auto-merge' };

  return { vigilar: false, porque: 'de una persona y sin auto-merge: nadie prometió mergearlo (backlog, no atasco)' };
}

/**
 * La lista de checks OBLIGATORIOS, DERIVADA de `GET /repos/…/rules/branches/main`. No se escribe
 * a mano: el día que se añada uno al ruleset, el vigía lo sabrá sin que nadie toque esto.
 *
 * SUELO: devuelve `null` —no `[]`— si la respuesta no es una lista, si no trae la regla de checks
 * obligatorios o si la trae vacía. `main` exige al menos uno; una lista vacía no significa «nada
 * es obligatorio», significa «no he podido leerla», y esas dos cosas no pueden dar lo mismo.
 */
export function checksObligatoriosDeReglas(reglas) {
  if (!Array.isArray(reglas)) return null;
  const nombres = reglas
    .filter((r) => r && r.type === 'required_status_checks')
    .flatMap((r) => ((r.parameters && r.parameters.required_status_checks) || []).map((c) => c && c.context))
    .filter(Boolean);
  return nombres.length ? [...new Set(nombres)] : null;
}

/**
 * De cada check, su ÚLTIMA ejecución sobre ese commit. Un check relanzado deja la ejecución
 * vieja en la lista; mirar la primera que aparezca daría por rojo un fallo ya arreglado, o por
 * verde uno que ha vuelto a caer. Los id de check-run crecen, así que manda el mayor.
 */
export function ultimaEjecucionPorCheck(checkRuns) {
  const ultima = new Map();
  for (const c of checkRuns || []) {
    if (!c || !c.name) continue;
    const previa = ultima.get(c.name);
    if (!previa || Number(c.id) > Number(previa.id)) ultima.set(c.name, c);
  }
  return [...ultima.values()];
}

/** Nombres de los checks cuya ÚLTIMA ejecución está completada en rojo. */
export function checksEnRojo(checkRuns) {
  return ultimaEjecucionPorCheck(checkRuns)
    .filter((c) => c.status === 'completed' && CONCLUSIONES_ROJAS.has(String(c.conclusion || '').toLowerCase()))
    .map((c) => c.name);
}

/**
 * La causa del atasco, a partir de lo observable. `checks` es el NÚMERO de check-runs sobre
 * el head actual — cero significa que ninguno ha arrancado.
 * @param {{estado?:string, checks?:number, minutosDesdePush?:number, sondaConflicto?:boolean|null,
 *          checkRuns?:object[], obligatorios?:string[]|null}} obs
 */
export function causaDelAtasco(obs = {}) {
  const estado = String(obs.estado || '').toUpperCase();
  const checks = Number(obs.checks);
  const minutos = Number(obs.minutosDesdePush);
  const sonda = obs.sondaConflicto; // true | false | null (no se pudo medir)

  // ── LA GRACIA DEL PUSH RECIÉN HECHO ─────────────────────────────────────────────────────
  // Cero checks NO significa nada durante los primeros minutos: los check-runs aparecen
  // cuando el workflow arranca, no cuando se empuja. Sin esta ventana, cada push nuevo sale
  // como atascado durante un rato y el vigía se vuelve ruido — que es como se silencia.
  // La ventana es GENEROSA a propósito: si a los diez minutos no ha aparecido ningún check,
  // no va a aparecer.
  if (Number.isFinite(checks) && checks === 0 && Number.isFinite(minutos) && minutos < GRACIA_MINUTOS) {
    return {
      causa: 'RECIEN-EMPUJADO',
      detalle: `empujado hace ${minutos} min: los checks aún pueden estar arrancando (gracia ${GRACIA_MINUTOS} min)`,
    };
  }

  // Va primero: sin checks no hay nada que esperar, y el estado del merge es irrelevante
  // porque el auto-merge no va a dispararse nunca. Es la causa, no un síntoma más.
  if (Number.isFinite(checks) && checks === 0) {
    return { causa: 'SIN-CHECKS', detalle: 'ningún check ha arrancado sobre el head actual: el auto-merge no se disparará nunca' };
  }

  // ── LAS DOS SONDAS DEL CONFLICTO ────────────────────────────────────────────────────────
  // `mergeStateStatus` es un campo que calcula GitHub en diferido; `git merge-tree` es un
  // cálculo propio sobre los mismos commits. No comparten código, así que cuando coinciden
  // el dato vale el doble — y cuando NO coinciden, la discrepancia ES el dato y se dice.
  // Elegir una en silencio sería justo el «de acuerdo dentro del error» que estas dos sondas
  // existen para romper.
  if (sonda === true && estado !== 'DIRTY') {
    return {
      causa: 'CONFLICTO-DISCREPA',
      detalle: `git merge-tree dice CONFLICTO y mergeStateStatus dice ${estado || '(vacío)'}: `
             + 'hay conflicto, pero el campo aún no lo refleja o miente. Se trata como conflicto',
    };
  }
  if (sonda === false && estado === 'DIRTY') {
    return {
      causa: 'CONFLICTO-DISCREPA',
      detalle: 'mergeStateStatus dice DIRTY y git merge-tree dice LIMPIO: una de las dos está '
             + 'desfasada. No se decide en silencio',
    };
  }
  if (estado === 'DIRTY') {
    return {
      causa: 'DIRTY',
      detalle: sonda === true
        ? 'conflicto real con la base, CONFIRMADO por las dos sondas: necesita a una persona'
        : 'conflicto real con la base (segunda sonda no disponible): necesita a una persona',
    };
  }

  // ── EL ROJO EN EL CHECK OBLIGATORIO (SCRUM-839b) ────────────────────────────────────────
  // Va DETRÁS del conflicto a propósito: resolver un conflicto es un push, y un push relanza
  // CI, así que el rojo de antes deja de ser el de ahora. Y va DELANTE de BEHIND y de
  // SIN-ESTADO: que la mergeabilidad no se sepa no cambia que el obligatorio esté en rojo.
  // Solo actúa si llegan datos de checks; sin ellos el clasificador no inventa un rojo.
  if (Array.isArray(obs.checkRuns)) {
    const rojos = checksEnRojo(obs.checkRuns);
    if (rojos.length) {
      if (!Array.isArray(obs.obligatorios) || obs.obligatorios.length === 0) {
        return {
          causa: 'ROJO-SIN-LISTA',
          detalle: `en rojo: ${rojos.join(', ')} — y no se pudo leer qué checks son obligatorios, `
                 + 'así que NO se puede afirmar que esté esperando',
        };
      }
      const bloquean = rojos.filter((n) => obs.obligatorios.includes(n));
      if (bloquean.length) {
        return {
          causa: 'ROJO-OBLIGATORIO',
          detalle: `el check obligatorio «${bloquean.join('», «')}» está en rojo sobre el head actual: `
                 + 'el auto-merge no se disparará sin un push nuevo',
        };
      }
    }
  }

  // ── EL BOT LO ABRIÓ Y NO ARMÓ EL AUTO-MERGE (SCRUM-839b) ────────────────────────────────
  // Solo con el dato EXPLÍCITO (`autoMerge === false`): sin él no se inventa. Va detrás del rojo
  // porque con un obligatorio en rojo primero hace falta un push; y delante de BEHIND, SIN-ESTADO
  // y ESPERANDO porque, sin auto-merge, ninguna de esas esperas termina en un merge.
  if (obs.autoMerge === false) {
    return { causa: 'SIN-AUTO-MERGE', detalle: 'nadie armó el auto-merge: aunque todo pase a verde, nadie lo va a mergear' };
  }

  if (estado === 'BEHIND') return { causa: 'BEHIND', detalle: 'por detrás de main: se resuelve con un merge de main' };
  if (estado === 'UNKNOWN' || estado === '') {
    return { causa: 'SIN-ESTADO', detalle: 'GitHub no ha resuelto la mergeabilidad tras reintentar: NO se cuenta como limpio' };
  }
  return { causa: 'ESPERANDO', detalle: `estado ${estado}: esperando a que pase el check obligatorio` };
}

/**
 * El umbral de edad más alto que ha cruzado un atasco: 0, 24, 72, 168 y después múltiplos de
 * 168. Edad desconocida o negativa → 0: no saber cuánto lleva no es saber que lleva mucho.
 */
export function umbralDeEdad(horas) {
  const h = Number(horas);
  if (horas === null || horas === undefined || !Number.isFinite(h) || h < UMBRALES_HORAS[0]) return 0;
  if (h < UMBRALES_HORAS[1]) return UMBRALES_HORAS[0];
  if (h < UMBRALES_HORAS[2]) return UMBRALES_HORAS[1];
  return UMBRALES_HORAS[2] * Math.floor(h / UMBRALES_HORAS[2]);
}

/**
 * ¿Ha EMPEORADO respecto a la pasada anterior? Solo entonces se comenta; si no, se reescribe
 * el cuerpo del issue en silencio. Un aviso por pasada es ruido, y el ruido se silencia.
 * Empeora si:
 *   · entra un PR con una causa que NO se arregla esperando, o que entra ya con edad (umbral > 0);
 *   · uno cambia A una causa que no se arregla esperando (BEHIND→DIRTY, ESPERANDO→ROJO-OBLIGATORIO);
 *   · uno CRUZA un umbral de edad que en la pasada anterior no había cruzado.
 * Bajar de umbral —un push nuevo reinicia el reloj— no es empeorar, y pasar a esperar tampoco.
 */
export function haEmpeorado(antes = [], ahora = []) {
  const previo = new Map(antes.map((p) => [p.numero, p]));
  const nuevos = ahora
    .filter((p) => !previo.has(p.numero))
    .filter((p) => !seArreglaEsperando(p.causa) || Number(p.umbral || 0) > 0);
  const cambiados = ahora
    .filter((p) => previo.has(p.numero) && previo.get(p.numero).causa !== p.causa)
    .filter((p) => !seArreglaEsperando(p.causa));
  const envejecidos = ahora
    .filter((p) => previo.has(p.numero) && Number(p.umbral || 0) > Number(previo.get(p.numero).umbral || 0))
    .map((p) => ({ numero: p.numero, umbral: Number(p.umbral) }));
  return {
    empeora: nuevos.length > 0 || cambiados.length > 0 || envejecidos.length > 0,
    nuevos: nuevos.map((p) => p.numero),
    cambiados: cambiados.map((p) => p.numero),
    envejecidos,
  };
}

/**
 * (SCRUM-1458) ¿Está `main` parado? `fecha` es la del último commit de `origin/main` (ISO).
 * Tres respuestas, y la primera no es ninguna de las otras dos: una fecha que no se deja leer NO
 * es «`main` al día».
 * @param {{fecha?:string|null, ahora?:number}} e
 * @returns {{leido:false} | {leido:true, parado:boolean, horas:number, fecha:string, fila?:object}}
 */
export function filaDeMain({ fecha, ahora = Date.now() } = {}) {
  const t = typeof fecha === 'string' && fecha.trim() ? new Date(fecha.trim()).getTime() : NaN;
  if (!Number.isFinite(t) || !Number.isFinite(ahora)) return { leido: false };
  const horas = horasDesde(fecha.trim(), ahora);
  const dia = new Date(t).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
  // Se compara sin redondear: `horas` lleva un decimal y 47,96 h se leería como 48.
  if (ahora - t < UMBRAL_MAIN_PARADO_HORAS * 3600000) return { leido: true, parado: false, horas, fecha: dia };
  return {
    leido: true, parado: true, horas, fecha: dia,
    fila: {
      numero: NUMERO_DE_MAIN, causa: CAUSA_MAIN_PARADO, horas, sinPush: horas, umbral: umbralDeEdad(horas),
      detalle: `\`main\` lleva ${horas} h sin un merge (el último, el ${dia}): se avisa desde las ${UMBRAL_MAIN_PARADO_HORAS} h`,
    },
  };
}

/**
 * (SCRUM-1458) ¿Lleva este aviso la mención al dueño? Sólo si `main` entra parado o cruza un
 * umbral, o si un PR cruza 72 h o más. `r` es lo que devuelve `haEmpeorado`; `filas`, la lista de
 * ahora (de ahí sale el umbral de los que entran).
 *
 * Un PR que ENTRA ya con 72 h o más cuenta como que las cruza: es la primera vez que el vigía lo
 * dice, y sin mención no volvería a sonar hasta las 168 h. Es lectura de la S5, no texto de la
 * decisión, que sólo dice «cruza».
 * @returns {{mencion:boolean, porMain:boolean, prs:number[]}}
 */
export function llevaMencion(r = {}, filas = []) {
  const umbralDe = new Map(filas.map((f) => [f.numero, Number(f.umbral || 0)]));
  const nuevos = r.nuevos || [];
  const envejecidos = r.envejecidos || [];
  const porMain = nuevos.includes(NUMERO_DE_MAIN) || envejecidos.some((e) => e.numero === NUMERO_DE_MAIN);
  const prs = [
    ...nuevos.filter((n) => n !== NUMERO_DE_MAIN && umbralDe.get(n) >= UMBRAL_MENCION_HORAS),
    ...envejecidos.filter((e) => e.numero !== NUMERO_DE_MAIN && Number(e.umbral) >= UMBRAL_MENCION_HORAS).map((e) => e.numero),
  ];
  return { mencion: porMain || prs.length > 0, porMain, prs };
}

/**
 * EL SUELO, POR PASADA. Si la lista real sale vacía hay que poder distinguir «no hay
 * atascados» de «no sé mirar». Se pasan casos de laboratorio por los mismos clasificadores y
 * se exige que salgan marcados. Un instrumento que solo sabe decir «todo bien» no es un
 * instrumento. Son cuatro cebos porque son cuatro ausencias distintas: un cero de conflictos, un
 * cero de rojos, un cero de avisos por edad y un «`main` no está parado» tienen que poder
 * distinguirse cada uno de no saber mirar.
 * @returns {{ok:boolean, detalle:string}}
 */
export function sueloDeLaPasada() {
  const cebo = { autor: BOT, draft: false, etiquetas: [], autoMerge: true };
  const visto = esAsuntoDelVigia(cebo);
  const causa = causaDelAtasco({ estado: 'DIRTY', checks: 3 });
  const rojo = causaDelAtasco({
    estado: 'BLOCKED', checks: 1, obligatorios: ['cebo obligatorio'],
    checkRuns: [{ id: 1, name: 'cebo obligatorio', status: 'completed', conclusion: 'failure' }],
  });
  const edad = haEmpeorado(
    [{ numero: 1, causa: 'DIRTY', umbral: 0 }],
    [{ numero: 1, causa: 'DIRTY', umbral: umbralDeEdad(80) }],
  );
  // El cebo de `main`, en los dos sentidos y con un reloj fijo: 50 h es parado, 47 h no.
  const reloj = Date.UTC(2026, 9, 4, 20, 22);
  const hace = (h) => new Date(reloj - h * 3600000).toISOString();
  const parado = filaDeMain({ fecha: hace(50), ahora: reloj });
  const sano = filaDeMain({ fecha: hace(47), ahora: reloj });
  const main = parado.parado === true && parado.fila.causa === CAUSA_MAIN_PARADO && sano.leido === true && sano.parado === false;
  const ok = visto.vigilar === true && causa.causa === 'DIRTY'
    && rojo.causa === 'ROJO-OBLIGATORIO' && edad.empeora === true && main;
  return {
    ok,
    detalle: ok
      ? 'suelo OK: los cuatro cebos sintéticos salen marcados (bot + auto-merge + DIRTY · obligatorio en rojo · atasco que cruza 72 h · `main` de 50 h parado y de 47 h no)'
      : `🔴 SUELO ROTO: algún cebo no se reconoce (vigilar=${visto.vigilar}, conflicto=${causa.causa}, `
        + `rojo=${rojo.causa}, edad=${edad.empeora}, main=${main}). `
        + 'Un cero de esta pasada NO significa que no haya atascados.',
  };
}

/** Horas entre dos instantes ISO, con un decimal. */
export function horasDesde(iso, ahora = Date.now()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round(((ahora - t) / 3600000) * 10) / 10;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1270 · EL PR MUDO SE AVISA DENTRO DEL PR, Y DICIENDO POR QUÉ
//
// Medido del 22 al 29-sep-2026 (328 PR, 587 cabezas empujadas): 8 cabezas estuvieron ≥1 h sin el
// check obligatorio, 5 ≥3 h y 4 ≥12 h (la peor, #1642, 31,7 h). 6 de las 8 se desatascaron
// mezclando `main`: el silencio suele ser un CONFLICTO. Este vigía ya lo clasificaba, pero lo
// contaba en un issue que nadie lee: avisar donde nadie mira es no avisar.
//
// 🔴 «MUDO» ES «FALTA EL CHECK OBLIGATORIO», no «cero checks». `SIN-CHECKS` exige cero, y el mudo
// de #1943 (`008fbd51`) tenía UNO — `abrir-pr-y-armar-automerge`, que corre en todo push — así que
// con cero no se habría visto. La lista de obligatorios es la de las reglas vivas de `main`.
//
// Una vez por cabeza y tipo: la marca lleva el sha, así que un push nuevo que siga mudo vuelve a
// avisar y la misma cabeza no repite en cada pasada.
export const UMBRAL_AVISO_EN_PR_HORAS = 3;
const CAUSAS_CONFLICTO = ['DIRTY', 'CONFLICTO-DISCREPA'];

/**
 * El aviso que va DENTRO del PR, o `null`. `fila` es la de la pasada (numero, causa, sinPush);
 * `sha` la cabeza. MUDO = falta algún obligatorio sobre la cabeza. Un conflicto cuyo obligatorio
 * SÍ corrió no está mudo (es otro problema, el del verde olvidado) y no se avisa aquí. Sin la
 * lista de obligatorios solo vale `SIN-CHECKS` (cero checks): no se afirma que falte un check
 * que no se sabe cuál es.
 */
export function avisoEnElPR({ fila, sha, checkRuns, obligatorios } = {}) {
  if (!fila || !(Number(fila.sinPush) >= UMBRAL_AVISO_EN_PR_HORAS) || !sha) return null;
  const conflicto = CAUSAS_CONFLICTO.includes(fila.causa);
  const conocidos = Array.isArray(obligatorios) && obligatorios.length > 0 && Array.isArray(checkRuns);
  const faltan = conocidos ? obligatorios.filter((o) => !checkRuns.some((c) => c && c.name === o)) : [];
  const mudo = conocidos ? faltan.length > 0 : fila.causa === 'SIN-CHECKS';
  if (!mudo) return null;
  const tipo = conflicto ? 'conflicto' : 'sin-checks';
  const corto = String(sha).slice(0, 12);
  const que = faltan.length ? `el check obligatorio no ha arrancado sobre \`${corto}\` (${faltan.join(', ')})` : `ningún check ha arrancado sobre \`${corto}\``;
  const porque = conflicto
    ? `**Está en CONFLICTO con \`main\`.** Sin fusión de prueba, los flujos \`pull_request\` no arrancan, así que ${que} y el auto-merge no se disparará. Se arregla mezclando \`main\` en la rama (merge, no rebase), resolviendo y empujando. Cerrar y reabrir el PR no sirve.`
    : `**Sin conflicto a la vista**, y aun así ${que}. Lo más frecuente es que el push no creara ejecuciones: un push nuevo desde el árbol de quien lleva la rama suele relanzarlo.`;
  return {
    numero: fila.numero,
    marca: `<!-- vigia-atascados:pr ${sha}:${tipo} -->`,
    cuerpo: `🔇 **Este PR lleva ${fila.sinPush} h MUDO** — ni verde ni rojo: el check obligatorio no ha corrido sobre su última cabeza.\n\n${porque}\n\nEl vigía de atascados solo avisa; no toca la rama. Se avisa una vez por cabeza.\n\n<!-- vigia-atascados:pr ${sha}:${tipo} -->\n`,
  };
}
