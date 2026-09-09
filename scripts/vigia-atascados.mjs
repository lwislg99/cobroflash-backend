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
// LAS TRES CAUSAS, SEPARADAS. Y la tercera no la sabía nombrar hasta hoy.
//
//   · DIRTY      conflicto real con la base. Necesita a una persona (o al futuro SCRUM-839).
//   · BEHIND     por detrás de main. Se arregla solo con un merge de main.
//   · SIN-CHECKS ningún check ha arrancado sobre el head actual. NO es lo mismo que los otros
//                dos, y es lo que bloqueaba el #1212: medido, CERO ejecuciones de CI para su
//                head `faebb1e6`. La causa está documentada desde el paso 6 — los eventos
//                creados con el `GITHUB_TOKEN` por defecto NO crean ejecuciones — así que un
//                push hecho desde dentro de un workflow con ese token deja el PR sin check
//                obligatorio y el auto-merge esperando para siempre.
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

/** Etiqueta con la que un autor declara que su PR no debe mergearse todavía. */
export const ETIQUETA_NO_MERGEAR = 'no-mergear';

/** El bot que abre PR automáticamente. */
export const BOT = 'yaqu-bot[bot]';

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
  if (pr.autor === BOT) return { vigilar: true, porque: 'lo abrió el bot y no llegó a armar el auto-merge' };

  return { vigilar: false, porque: 'de una persona y sin auto-merge: nadie prometió mergearlo (backlog, no atasco)' };
}

/**
 * La causa del atasco, a partir de lo observable. `checks` es el NÚMERO de check-runs sobre
 * el head actual — cero significa que ninguno ha arrancado.
 * @param {{estado?:string, checks?:number}} obs
 */
export function causaDelAtasco(obs = {}) {
  const estado = String(obs.estado || '').toUpperCase();
  const checks = Number(obs.checks);

  // Va primero: sin checks no hay nada que esperar, y el estado del merge es irrelevante
  // porque el auto-merge no va a dispararse nunca. Es la causa, no un síntoma más.
  if (Number.isFinite(checks) && checks === 0) {
    return { causa: 'SIN-CHECKS', detalle: 'ningún check ha arrancado sobre el head actual: el auto-merge no se disparará nunca' };
  }
  if (estado === 'DIRTY') return { causa: 'DIRTY', detalle: 'conflicto real con la base: necesita a una persona' };
  if (estado === 'BEHIND') return { causa: 'BEHIND', detalle: 'por detrás de main: se resuelve con un merge de main' };
  if (estado === 'UNKNOWN' || estado === '') {
    return { causa: 'SIN-ESTADO', detalle: 'GitHub no ha resuelto la mergeabilidad tras reintentar: NO se cuenta como limpio' };
  }
  return { causa: 'ESPERANDO', detalle: `estado ${estado}: esperando a que pase el check obligatorio` };
}

/**
 * ¿Ha EMPEORADO respecto a la pasada anterior? Solo entonces se comenta; si no, se reescribe
 * el cuerpo del issue en silencio. Un aviso por pasada es ruido, y el ruido se silencia.
 * Empeora si: aparece un PR que antes no estaba, o uno cambia de causa (p. ej. BEHIND→DIRTY).
 */
export function haEmpeorado(antes = [], ahora = []) {
  const mapa = new Map(antes.map((p) => [p.numero, p.causa]));
  const nuevos = ahora.filter((p) => !mapa.has(p.numero));
  const cambiados = ahora.filter((p) => mapa.has(p.numero) && mapa.get(p.numero) !== p.causa);
  return {
    empeora: nuevos.length > 0 || cambiados.length > 0,
    nuevos: nuevos.map((p) => p.numero),
    cambiados: cambiados.map((p) => p.numero),
  };
}

/**
 * EL SUELO, POR PASADA. Si la lista real sale vacía hay que poder distinguir «no hay
 * atascados» de «no sé mirar». Se pasa un caso de laboratorio por los mismos clasificadores y
 * se exige que salga marcado. Un instrumento que solo sabe decir «todo bien» no es un
 * instrumento.
 * @returns {{ok:boolean, detalle:string}}
 */
export function sueloDeLaPasada() {
  const cebo = { autor: BOT, draft: false, etiquetas: [], autoMerge: true };
  const visto = esAsuntoDelVigia(cebo);
  const causa = causaDelAtasco({ estado: 'DIRTY', checks: 3 });
  const ok = visto.vigilar === true && causa.causa === 'DIRTY';
  return {
    ok,
    detalle: ok
      ? 'suelo OK: el cebo sintético (bot + auto-merge + DIRTY) sale marcado como atascado'
      : `🔴 SUELO ROTO: el cebo no se reconoce (vigilar=${visto.vigilar}, causa=${causa.causa}). ` +
        'Un cero de esta pasada NO significa que no haya atascados.',
  };
}

/** Horas entre dos instantes ISO, con un decimal. */
export function horasDesde(iso, ahora = Date.now()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round(((ahora - t) / 3600000) * 10) / 10;
}
