// scripts/equipo/sesion.mjs — SCRUM-899 · lanzar, parar y ver las sesiones de fondo del equipo
//
// Lo usa el orquestador de fondo para despertar a los carriles. Es la ÚNICA puerta: la regla de
// permiso permanente apunta a la copia INSTALADA de este fichero, no a `claude` a pelo, y lo que
// este fichero no sabe hacer no se puede hacer por ahí.
//
//   node <instalación>/sesion.mjs lanzar   <nombre> <fichero-con-el-prompt>
//   node <instalación>/sesion.mjs relevar  <nombre> <fichero-con-el-encargo>
//   node <instalación>/sesion.mjs contexto <nombre>
//   node <instalación>/sesion.mjs parar    <nombre>
//   node <instalación>/sesion.mjs olvidar  <nombre>
//   node <instalación>/sesion.mjs estado
//
// ── LO QUE SE MIDIÓ EN SCRUM-899 Y ESTE FICHERO CODIFICA (17-sep-2026) ─────────────────────────
//   · `--permission-mode plan` se bloquea esperando un permiso; `auto` contesta sin aprobaciones.
//   · `--resume <id corto>` cae en el SELECTOR interactivo y se queda parada para siempre.
//   · `--resume <sessionId completo>` CON flags arranca una COPIA; SIN flags continúa la misma.
//   · `claude stop/rm` aceptan el id, no el nombre.
//   → Nada interactivo en segundo plano, ids completos, reanudar sin flags, modo `auto`.
//
// ── LO QUE SE MIDIÓ EN SCRUM-954 Y CAMBIA AQUÍ (20-sep-2026, CLI 2.1.278) ──────────────────────
//   · `claude agents --json` sigue listando un trabajo TERMINADO, y lo lista como `working`. El de
//     `sesion-5` (`df2fa38f`) llevaba terminal desde el 18-sep 13:50:15Z y la lista lo daba por vivo
//     dos días después. Con eso el nombre del puesto queda QUEMADO: `lanzar` → YA-VIVA y `relevar`
//     → OCUPADA para siempre, y el relevo de la A19 («parar y volver a lanzar el MISMO nombre») deja
//     de poder hacerse. Es el defecto entero del ticket. → `clasificarAgente`.
//   · El tell es el `pid`, y salió de un CONTROL: una sesión de prueba con su proceso VIVO sale con
//     `pid` y `status`; la muerta sale sin ninguno de los dos y con el último `state` que tuvo.
//   · Lo que el ticket daba por causa —que al reanudar se perdía el `-n`— NO REPRODUCE en 2.1.278:
//     medido, `claude --bg --resume <sid>` sin `-n` contesta «woke session … with its saved options
//     (-n, --permission-mode)» y la sesión conserva su nombre. No se arregla lo que no está roto; lo
//     que sí se hace es ensanchar la regex del `backgrounded`, que era el otro medio defecto.
//   · `lanzar` deja de REANUDAR, y el motivo ya no es el nombre: es la A19. Decisión del orquestador
//     del 20-sep-2026, con su motivo — reanudar dentro de la hora arrastra la conversación entera
//     (el caso medido por el equipo de Javier reanudaba una de 421.718 tokens que acababa de pedir
//     el relevo). Muere con ello la regla de «menos de una hora → reanudar».
//
// ── LO QUE SE MIDIÓ EN SCRUM-990 Y CAMBIA AQUÍ (21-sep-2026, CLI 2.1.278) ──────────────────────
//   · Decisión del fundador (21-sep-2026): TODOS los puestos van con `--model sonnet`, sin excepción.
//     Hasta hoy `argsLanzar` no pasaba modelo: el lanzador de las tandas (`arranque.cmd` →
//     `orquestador-arranque.mjs` → `lanzar`) y todo `relevar` arrancaban con el modelo por DEFECTO.
//   · Por qué se cambia AQUÍ y no en la copia instalada: `arranque.cmd` la reescribe desde
//     `origin/main` en cada tanda, y `puertaDeIntegridad` se niega (ALTERADO) si difiere de main.
//   · El flag es válido con `--bg`: el `state.json` de una sesión lanzada así guarda
//     `respawnFlags: [-n, <nombre>, --permission-mode, auto, --model, sonnet]`. Ese es el orden que
//     usa `argsLanzar`, y esa es la sonda por efecto (`docs/master/SCRUM-990.md`).
//   · `reanudar` NO lleva `--model`: con flags `--resume` arranca una COPIA (SCRUM-899), y la sesión
//     reanudada conserva las opciones con las que se lanzó. Ninguna acción de la CLI reanuda ya.
//
// ── LO QUE NO HACE, Y ES LA MITAD DEL DISEÑO ──────────────────────────────────────────────────
//   · No acepta nombres fuera de la lista blanca: ni `control-*`, ni una sesión del fundador.
//   · No construye NUNCA un modo que se salte permisos, ni recibe flags desde fuera.
//   · No corre desde un árbol de trabajo, ni si su contenido difiere del de `origin/main`.
//     ⚠️ Esto último para una copia DESFASADA o tocada por accidente. No para una reescritura
//     deliberada: quien reescribe el fichero puede quitarle la comprobación. Lo que protege de eso
//     es que la instalación viva fuera del repo y que solo la rellene el instalador desde main.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * EL EQUIPO SALE DE `config.json` (SCRUM-951a): un nombre de sesión admitido es `prefijo` + uno de
 * sus `puestos`. Así dos equipos —el de Luis y el de Javier— nunca comparten nombres, ni en el canal
 * ni en esta lista blanca.
 *
 * Este valor es el equipo de Luis tal y como estaba escrito antes en una regex, y SOLO lo usan las
 * llamadas puras de los tests. La CLI pasa SIEMPRE el equipo validado de su config: una instalación
 * sin equipo declarado no actúa (`puertaDeIntegridad`).
 */
export const EQUIPO_DE_LUIS = Object.freeze({
  prefijo: '',
  puestos: Object.freeze(['orquestador', 'sesion-0', 'sesion-1', 'sesion-2', 'sesion-3', 'sesion-4', 'sesion-5']),
  orquestador: 'orquestador',
});
const PREFIJO = /^[a-z0-9-]{0,16}$/;
const PUESTO = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const RUTA_EN_EL_REPO = 'scripts/equipo/sesion.mjs';
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Más de esto parada → sesión nueva en vez de reanudar: la caché ya está fría. */
export const UNA_HORA_MS = 60 * 60 * 1000;
/** SCRUM-990 · el modelo de TODA sesión de fondo del equipo (fundador, 21-sep-2026). Sin excepción. */
export const MODELO_DEL_EQUIPO = 'sonnet';
/** A19/A25: por encima de esto, AL TERMINAR UNA ENTREGA, se releva (era 300k; bajó el 21-sep-2026, SCRUM-1070b). */
export const UMBRAL_CONTEXTO = 200_000;
/** Lo que se espera a que una sesión escriba su traspaso antes de rendirse. */
export const ESPERA_TRASPASO_MS = 10 * 60 * 1000;
/** SCRUM-1011 · lo que se espera, sondeando el `pid`, antes de declarar que una sesión NO arrancó. */
export const ESPERA_ARRANQUE_MS = 8_000;
/** SCRUM-1026 · a partir de aquí, una sesión bloqueada se marca para que `estado` la grite. */
export const UMBRAL_AVISO_BLOQUEO_MS = 10 * 60 * 1000;
/** Estados de un trabajo de fondo que ya terminó. SCRUM-954. */
export const ESTADOS_TERMINALES = Object.freeze(['done', 'stopped', 'failed', 'cancelled']);
/** El id corto de un trabajo de fondo, tal y como lo imprime `claude --bg` y lo listan los agentes. */
const ID_CORTO = /^[0-9a-f]{8}$/;
/**
 * El id que imprime `claude --bg`. SCRUM-954: antes exigía un « · » DETRÁS del id, que sólo existe
 * cuando la sesión lleva nombre. Con una salida sin nombre no casaba, y entonces una sesión que SÍ
 * había arrancado se declaraba `NO-PUDE-MIRAR`: una operación ejecutada leída como un fallo.
 */
const BACKGROUNDED = /backgrounded · ([0-9a-f]{8})(?: · |\s|$)/;

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Decisiones puras
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * El equipo de un config, validado. Todo se DECLARA: un `prefijo` vacío es el equipo de Luis, y uno
 * ausente es un config sin terminar — si se aceptaran igual, «vacío» y «olvidado» se leerían igual.
 *
 * @returns {{ok:true, equipo:{prefijo:string, puestos:string[], orquestador:string}} | {ok:false, veredicto:'NO-PUDE-MIRAR', motivo:string}}
 */
export function validarEquipo(config) {
  const no = (motivo) => ({ ok: false, veredicto: 'NO-PUDE-MIRAR', motivo: `config.json: ${motivo}` });
  if (!config || typeof config !== 'object') return no('no es un objeto');
  const { prefijo, puestos, orquestador } = config;
  if (typeof prefijo !== 'string') return no('falta `prefijo` (vacío "" para el equipo sin prefijo, pero declarado)');
  if (!PREFIJO.test(prefijo)) return no(`prefijo «${prefijo}» inválido: minúsculas, números y guiones, hasta 16`);
  if (!Array.isArray(puestos) || puestos.length === 0) return no('falta `puestos`, o está vacío');
  for (const p of puestos) {
    if (typeof p !== 'string' || !PUESTO.test(p)) return no(`puesto «${p}» inválido: minúsculas, números y guiones`);
  }
  if (new Set(puestos).size !== puestos.length) return no('hay puestos repetidos');
  if (typeof orquestador !== 'string' || !puestos.includes(orquestador)) return no(`el orquestador «${orquestador}» no es uno de los puestos`);
  return { ok: true, equipo: { prefijo, puestos: [...puestos], orquestador } };
}

/** @returns {null | {veredicto:'NOMBRE-NO-PERMITIDO', motivo:string}} */
export function validarNombre(nombre, equipo = EQUIPO_DE_LUIS) {
  if (typeof nombre === 'string' && equipo.puestos.some((p) => equipo.prefijo + p === nombre)) return null;
  const lista = equipo.puestos.map((p) => equipo.prefijo + p).join(', ');
  return { veredicto: 'NOMBRE-NO-PERMITIDO', motivo: `«${nombre}» no está en la lista blanca del equipo (${lista})` };
}

/**
 * Los argumentos de `claude` para lanzar. Nunca recibe flags de fuera: solo el nombre (validado),
 * el sessionId (validado) y el texto del prompt, que va como UN argumento y no se interpreta.
 */
export function argsLanzar({ modo, nombre, sessionId, prompt, equipo }) {
  if (validarNombre(nombre, equipo)) throw new Error('nombre fuera de la lista blanca');
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('prompt vacío');
  if (modo === 'nueva') return ['--bg', '-n', nombre, '--permission-mode', 'auto', '--model', MODELO_DEL_EQUIPO, prompt];
  if (modo === 'reanudar') {
    // SIN flags: con flags, `--resume` arranca una copia (medido en SCRUM-899, control 3b).
    if (!SESSION_ID.test(sessionId || '')) throw new Error('reanudar exige el sessionId COMPLETO');
    return ['--bg', '--resume', sessionId, prompt];
  }
  throw new Error(`modo desconocido: ${modo}`);
}

/**
 * ¿Esa entrada de `claude agents --json` es una sesión VIVA?
 *
 * 🔴 MEDIDO EL 20-sep-2026, y es el defecto entero de SCRUM-954: la lista enseña trabajos que ya
 * terminaron, y los enseña como `state: "working"`.
 *
 *     df2fa38f · name "sesion-5" · lista: state "working", SIN pid, SIN status
 *                                 state.json: state "done", firstTerminalAt 2026-09-18T13:50:15.562Z
 *
 * El tell es el `pid`, y no es una teoría: salió de un CONTROL. Una sesión de prueba con su proceso
 * VIVO sale en la lista con `pid` y `status` y con su `state` de verdad; la muerta sale sin ninguno
 * de los dos y con el último `state` que tuvo en vida. Cuando el proceso ya no está, el `state` de
 * la lista no describe nada.
 *
 * Dos sondas, y la segunda no está para distinguir —una sesión viva también escribe `done` entre
 * turno y turno— sino para que una carpeta de trabajo BORRADA o ilegible no se pueda leer como
 * «muerta»:
 *   · la lista (`pid`), que es quien decide, y
 *   · el `state.json` del trabajo, que es quien puede VETAR el veredicto.
 *
 * 🔴 FALLA CERRADO. Declarar MUERTA a una viva significa lanzar una segunda sesión encima de alguien
 * que está entregando, o borrarle su trabajo. Por eso sólo se declara muerta cuando las DOS sondas
 * lo dicen, y cualquier duda sale como `NO-PUDE-MIRAR`, que los tres que deciden tratan como VIVA.
 *
 * @param {object} agente una entrada de `claude agents --json`
 * @param {{leido:boolean, terminal?:boolean, cuando?:string|null, motivo?:string}|null} job
 *   lo que dice su `state.json`, o `{leido:false}` si no se pudo mirar
 * @returns {{estado:'VIVA'|'MUERTA'|'NO-PUDE-MIRAR', motivo:string}}
 */
export function clasificarAgente(agente, job) {
  if (!agente || typeof agente !== 'object') return { estado: 'NO-PUDE-MIRAR', motivo: 'la entrada no es un objeto' };
  if (typeof agente.pid === 'number' && agente.pid > 0) return { estado: 'VIVA', motivo: `tiene proceso (pid ${agente.pid})` };
  if (!job || job.leido !== true) {
    return { estado: 'NO-PUDE-MIRAR', motivo: `sin pid, y su state.json no se pudo leer${job && job.motivo ? `: ${job.motivo}` : ''}` };
  }
  if (job.terminal === true) {
    return { estado: 'MUERTA', motivo: `sin pid, y su state.json dice que terminó${job.cuando ? ` (${job.cuando})` : ''}` };
  }
  return { estado: 'NO-PUDE-MIRAR', motivo: 'sin pid, pero su state.json no dice que haya terminado' };
}

/**
 * Las entradas que se llaman `nombre`, separadas en las que CUENTAN (vivas, o que no se puede jurar
 * que no lo estén) y los RESTOS (muertas de las dos sondas). El criterio vive en un solo sitio a
 * propósito: repetirlo en las tres decisiones es la forma de que se separen sin que nadie lo note.
 */
export function repartirPorNombre({ nombre, agentes, job, soloFondo = false }) {
  const cuentan = [];
  const restos = [];
  for (const a of agentes) {
    if (!a || a.name !== nombre) continue;
    if (soloFondo && a.kind !== 'background') continue;
    const c = clasificarAgente(a, typeof job === 'function' ? job(a.id) : null);
    (c.estado === 'MUERTA' ? restos : cuentan).push({ agente: a, motivo: c.motivo, estado: c.estado });
  }
  return { cuentan, restos };
}

/** Los restos, tal y como se cuentan en un veredicto: id y por qué se les da por muertos. */
function comoRestos(restos) {
  return restos.length
    ? { restos: restos.map((r) => ({ id: r.agente.id ?? null, motivo: r.motivo })) }
    : {};
}

/** Una ruta comparable entre las dos formas en que Windows la escribe (`D:\x` y `d:/x`). */
function rutaComparable(r) {
  return String(r).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * Las sesiones que hacen que YA HAYA un equipo vivo en `repo`. SCRUM-959b.
 *
 * Cuenta una sesión si (a) SE ARRANCÓ en el repo o bajo él (`cwd`; los worktrees de
 * `.claude/worktrees/` cuelgan de él), (b) no es un resto muerto (mismo criterio que `lanzar`: el
 * `pid`, y ante la duda cuenta como viva), y (c) si es un chat INTERACTIVO, está TRABAJANDO
 * (`status: busy` o `state: working`). Un chat abierto y parado NO es un equipo: el fundador los deja
 * abiertos días, y si contaran, la tanda no arrancaría nunca. Una sesión de FONDO viva cuenta esté
 * trabajando o esperando: las lanza el equipo, y un equipo entero esperando a un CI sigue siendo un equipo.
 *
 * ⚠️ LO QUE NO SEPARA, dicho: un orquestador interactivo PARADO y sin ninguna sesión de fondo viva
 * no cuenta, así que en ese caso se lanzaría otro. `agents --json` no da la última actividad, y
 * `statusUpdatedAt` del fichero de sesión tampoco (sólo cambia cuando cambia el estado: el de una
 * sesión que lleva 40 min `busy` seguía en el instante en que arrancó). Se
 * declara y no se inventa un umbral. Y el orquestador y los puestos no se distinguen por nombre
 * a propósito: mañana serán otros.
 */
export function equipoVivo({ agentes, repo, job }) {
  const raiz = rutaComparable(repo);
  const vivos = [];
  for (const a of agentes) {
    if (!a || typeof a !== 'object' || typeof a.cwd !== 'string') continue;
    const cwd = rutaComparable(a.cwd);
    if (cwd !== raiz && !cwd.startsWith(raiz + '/')) continue;
    const c = clasificarAgente(a, typeof job === 'function' ? job(a.id) : null);
    if (c.estado === 'MUERTA') continue;
    if (a.kind === 'interactive' && a.status !== 'busy' && a.state !== 'working') continue;
    vivos.push({ id: a.id ?? null, nombre: a.name ?? null, kind: a.kind ?? null, porque: c.motivo });
  }
  return vivos;
}

/**
 * Qué hacer al lanzar `nombre`.
 *
 * @param {{nombre:string, agentes:object[]|null, registro:object|null, ahora:number}} e
 *   `agentes`: la salida de `claude agents --json`, o `null` si no se pudo leer.
 *   `registro`: `{ [nombre]: { sessionId, ultimaTanda } }`, o `null` si no se pudo leer.
 *   `job`: `(id) => {leido, terminal, cuando}`, lo que dice el `state.json` de ese trabajo. Si no se
 *   pasa, TODA entrada con ese nombre cuenta como viva — que es el comportamiento de antes de
 *   SCRUM-954, y es el que falla cerrado.
 *
 * 🔴 NUNCA devuelve REANUDAR, y eso es una decisión, no un descuido (orquestador, 20-sep-2026):
 * reanudar dentro de la hora arrastra la conversación entera, que es lo contrario de lo que pide la
 * A19. `relevar` ya lanzaba siempre nueva; ahora `lanzar` también.
 */
export function decidirLanzar({ nombre, agentes, registro, ahora, equipo, job, repo }) {
  const malo = validarNombre(nombre, equipo);
  if (malo) return malo;
  if (!Array.isArray(agentes)) return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer `claude agents --json`' };
  if (!registro || typeof registro !== 'object') return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer el registro de sesiones' };

  const { cuentan, restos } = repartirPorNombre({ nombre, agentes, job });
  if (cuentan.length > 1) return { veredicto: 'NO-PUDE-MIRAR', motivo: `${cuentan.length} sesiones vivas se llaman «${nombre}»` };
  if (cuentan.length === 1) {
    const v = cuentan[0].agente;
    // Bloqueada = esperando algo interactivo que nadie va a contestar. Se dice; no se rodea.
    if (v.state === 'blocked' || v.waitingFor) {
      return { veredicto: 'BLOQUEADA', motivo: `«${nombre}» (${v.id}) espera ${v.waitingFor || 'algo interactivo'}`, id: v.id };
    }
    return { veredicto: 'YA-VIVA', motivo: `«${nombre}» ya está en marcha (${v.id})`, id: v.id };
  }

  // 🔴 SCRUM-959b · «ya vivo» por NOMBRE no basta para el ORQUESTADOR. El equipo de un día puede
  // estar levantado a mano con otros nombres (el del 21-sep eran `s<n>-21` y el orquestador
  // `cobroflash-backend-90`), y entonces la tanda de las 13:05 lanzaba un SEGUNDO orquestador encima.
  // Para él —y sólo para él: los puestos SÍ se lanzan cuando faltan— se mira si hay ALGO vivo en el
  // repo, con las pruebas que da `agents --json` y ninguna sobre cómo se llame.
  const orquestador = (equipo || EQUIPO_DE_LUIS);
  if (nombre === orquestador.prefijo + orquestador.orquestador) {
    if (typeof repo !== 'string' || !repo) {
      return { veredicto: 'NO-PUDE-MIRAR', motivo: 'sin la ruta del repo no se sabe si ya hay un equipo vivo: no se lanza otro orquestador a ciegas' };
    }
    const vivos = equipoVivo({ agentes, repo, job });
    if (vivos.length) {
      return {
        veredicto: 'YA-VIVA',
        motivo: `hay ${vivos.length} sesión(es) vivas en el repo (${vivos.map((v) => v.nombre ?? v.id ?? '?').join(', ')}): un orquestador nuevo encima duplicaría el equipo`,
        equipo: vivos,
        ...comoRestos(restos),
      };
    }
  }

  const previa = registro[nombre];
  return {
    veredicto: 'NUEVA',
    motivo: previa
      ? 'hubo una sesión anterior con este nombre: se lanza NUEVA, nunca se reanuda (A19)'
      : 'no hay sesión anterior',
    ...comoRestos(restos),
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// `contexto` — cuánto ocupa una sesión, para saber cuándo relevarla (A19)
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * El contexto del ÚLTIMO turno, leído del jsonl de la sesión.
 *
 * «Contexto» es lo que se le MANDÓ al modelo en ese turno:
 *
 *     input_tokens + cache_read_input_tokens + cache_creation_input_tokens
 *
 * `output_tokens` NO entra: es lo que contestó, y no ocupa sitio en el turno siguiente. Sumarlo
 * infla la cuenta y adelanta relevos que no tocaban.
 *
 * Se coge el ÚLTIMO, no el mayor: el contexto BAJA cuando la conversación se compacta, y un
 * máximo histórico se quedaría alto para siempre relevando sesiones que acaban de aligerarse.
 *
 * 🔴 Devuelve `null` —no 0— si no hay ni un turno con uso. Un 0 se leería como «sesión vacía, no
 * hay que relevarla», que es la conclusión CONTRARIA a «no he podido mirar». Es exactamente el
 * error que tuvo `guards-entrada.mjs` con el color (SCRUM-928), y no se repite aquí.
 */
export function contextoDelJsonl(texto) {
  let tokens = null;
  let turnos = 0;
  let cuando = null;
  for (const linea of String(texto || '').split('\n')) {
    if (!linea.trim()) continue;
    let o;
    // Una sesión VIVA está escribiendo su jsonl mientras lo leemos: la última línea puede estar a
    // medias. Eso no invalida las demás.
    try { o = JSON.parse(linea); } catch { continue; }
    if (o.type !== 'assistant') continue;
    const u = o.message && o.message.usage;
    if (!u) continue;
    const suma = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    if (suma <= 0) continue;
    tokens = suma;
    turnos += 1;
    if (o.timestamp) cuando = o.timestamp;
  }
  return tokens === null ? null : { tokens, turnos, cuando };
}

/**
 * Dónde está el jsonl de una sesión. Se busca por `sessionId` en TODAS las carpetas de proyecto.
 *
 * 🔴 Y esto es lo único no evidente del subcomando. MEDIDO el 17-sep-2026 sobre las seis sesiones
 * de la tanda: una sesión de FONDO tiene su `cwd` en el scratchpad de quien la lanzó, así que su
 * jsonl vive en `~/.claude/projects/C--Users-…-scratchpad-prompts/<sessionId>.jsonl` y **NO** en la
 * carpeta del repositorio. Buscar por la ruta del repo —que es lo que hace cualquiera— no encuentra
 * ninguna de las seis: encuentra las de la tanda MUERTA, con sus 600-900k, y deja creer que el
 * equipo sigue ahí. Un cero por mirar en el sitio equivocado es peor que un cero.
 */
export function buscarJsonl({ sessionId, carpetas, existe }) {
  if (!SESSION_ID.test(sessionId || '')) return null;
  for (const c of carpetas || []) {
    const ruta = path.join(c, `${sessionId}.jsonl`);
    if (existe(ruta)) return ruta;
  }
  return null;
}

/**
 * ¿Toca relevar? Los tres casos son los de la A19 («El PUESTO es fijo; la SESIÓN se releva»), y no
 * se amplían: el cuarto caso que a uno se le ocurra es una sesión parada a mitad de una entrega.
 */
export function decidirRelevo({ contexto, ultimaActividad, ahora, tandaNueva = false, umbral = UMBRAL_CONTEXTO }) {
  if (tandaNueva) return { veredicto: 'RELEVAR', motivo: 'empieza la tanda del día siguiente' };
  // SUELO: sin lectura no se dice «sigue». Un instrumento que no pudo mirar no da verde.
  if (!contexto) return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer el contexto de la sesión' };
  if (typeof ultimaActividad === 'number' && ahora - ultimaActividad > UNA_HORA_MS) {
    return { veredicto: 'RELEVAR', motivo: 'lleva más de 1 h parada: la caché de prompt ya está fría', tokens: contexto.tokens };
  }
  if (contexto.tokens > umbral) {
    return { veredicto: 'RELEVAR', motivo: `el contexto va por ${Math.round(contexto.tokens / 1000)}k, por encima de ${Math.round(umbral / 1000)}k`, tokens: contexto.tokens };
  }
  return { veredicto: 'SEGUIR', motivo: `${Math.round(contexto.tokens / 1000)}k, por debajo de ${Math.round(umbral / 1000)}k`, tokens: contexto.tokens };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// `relevar` — parar una sesión y levantar otra en su puesto
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ UN SCRIPT DE NODE NO PUEDE MANDAR UN `SendMessage`, así que este subcomando **no pide** el
 * traspaso: lo pide el orquestador por el canal y el script COMPRUEBA que está escrito antes de
 * parar nada. Eso no es una limitación que haya que rodear — mantiene la conversación en el canal,
 * donde se puede leer.
 *
 *     el orquestador pide → la sesión escribe y contesta «traspaso listo» → `relevar` comprueba,
 *     para y lanza
 *
 * 🔴 **Es cobarde por defecto, y a propósito.** Un script que mata sesiones se niega ante la duda:
 *   · sin traspaso legible → `SIN-TRASPASO`, y no para;
 *   · con el traspaso demasiado LEJOS del último turno → `ESPERANDO` mientras quede plazo, y
 *     `SIN-TRASPASO` después;
 *   · con la sesión TRABAJANDO → `OCUPADA`, y no para **aunque el traspaso esté fresco**: un
 *     traspaso escrito hace diez minutos no describe lo que está haciendo ahora, y varias sesiones
 *     han entregado con cosas a medio empujar.
 *
 * 🔴 SCRUM-1007 · «Fresco» YA NO es `traspasoMtime > ultimoTurno`. El propio protocolo de arriba
 * dice que la sesión ESCRIBE el traspaso y LUEGO contesta «traspaso listo» — y esa respuesta ES
 * un turno, posterior al fichero por diseño. Con la comparación estricta, el camino feliz nunca
 * podía dar `RELEVAR`: medido en un relevo real, 14,4 s de diferencia (`ultimoTurno` = la propia
 * respuesta) bastaban para `ESPERANDO` y, pasados los 10 min, `SIN-TRASPASO` para siempre.
 *
 * El dato que de verdad importa no es «¿quién fue primero?», es «¿describe este traspaso el
 * ÚLTIMO turno de la sesión?» — y eso es una VENTANA, no un orden: `traspasoMtime` cuenta si está
 * a menos de `esperaMs` del último turno, **en cualquier dirección** (escrito un poco antes de la
 * respuesta de confirmación, o reescrito después). Un traspaso de hace HORAS frente a un último
 * turno RECIENTE (la sesión siguió trabajando después de escribirlo) sigue cayendo fuera de la
 * ventana y sigue dando `SIN-TRASPASO`: eso es justo lo que había que seguir cazando.
 */
export function decidirRelevar({ nombre, agentes, traspasoMtime, ultimoTurno, ahora, esperaMs = ESPERA_TRASPASO_MS, equipo, job }) {
  const malo = validarNombre(nombre, equipo);
  if (malo) return malo;
  if (!Array.isArray(agentes)) return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer `claude agents --json`' };

  const { cuentan, restos } = repartirPorNombre({ nombre, agentes, job });
  if (cuentan.length > 1) return { veredicto: 'NO-PUDE-MIRAR', motivo: `${cuentan.length} sesiones vivas se llaman «${nombre}»` };
  // Nadie a quien relevar. No es un error: se lanza y ya está. SCRUM-954: un resto de un trabajo
  // terminado ya NO cuenta como «alguien», que es lo que dejaba el puesto bloqueado para siempre.
  if (cuentan.length === 0) return { veredicto: 'LANZAR', motivo: `no hay ninguna sesión «${nombre}» viva`, ...comoRestos(restos) };

  const v = cuentan[0].agente;
  const comprobado = { traspasoMtime: traspasoMtime ?? null, ultimoTurno: ultimoTurno ?? null, estado: v.state ?? null };

  if (typeof ultimoTurno !== 'number') {
    return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo fechar el último turno: sin eso «fresco» no significa nada', id: v.id, comprobado };
  }
  if (typeof traspasoMtime !== 'number') {
    return { veredicto: 'SIN-TRASPASO', motivo: 'no hay fichero de traspaso legible: no se para nada', id: v.id, comprobado };
  }
  // SCRUM-1007: ventana simétrica en vez de «estrictamente posterior». `ultimoTurno - traspasoMtime`
  // negativo (traspaso reescrito DESPUÉS del último turno leído) siempre cuenta como fresco.
  if (ultimoTurno - traspasoMtime >= esperaMs) {
    const esperando = ahora - ultimoTurno;
    if (esperando < esperaMs) {
      return { veredicto: 'ESPERANDO', motivo: `el traspaso está a más de ${Math.round(esperaMs / 1000)} s del último turno; llevan ${Math.round(esperando / 1000)} s`, id: v.id, comprobado };
    }
    return { veredicto: 'SIN-TRASPASO', motivo: `el traspaso no se ha reescrito en ${Math.round(esperaMs / 1000)} s: no se para nada`, id: v.id, comprobado };
  }
  // Con el traspaso fresco, sigue mandando el estado: no se para a quien está trabajando.
  if (v.state === 'working' || v.state === 'busy') {
    return { veredicto: 'OCUPADA', motivo: `«${nombre}» está trabajando: no se para a mitad, aunque el traspaso esté fresco`, id: v.id, comprobado };
  }
  if (v.state === 'blocked' || v.waitingFor) {
    return { veredicto: 'BLOQUEADA', motivo: `«${nombre}» (${v.id}) espera ${v.waitingFor || 'algo interactivo'}`, id: v.id, comprobado };
  }
  return { veredicto: 'RELEVAR', id: v.id, comprobado };
}

/** Qué hacer al parar `nombre`: siempre por id, y solo si el nombre casa. */
export function decidirParar({ nombre, agentes, equipo, job }) {
  const malo = validarNombre(nombre, equipo);
  if (malo) return malo;
  if (!Array.isArray(agentes)) return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer `claude agents --json`' };
  const { cuentan, restos } = repartirPorNombre({ nombre, agentes, job, soloFondo: true });
  // Parar un resto no hace nada (ya terminó) y deja creer que se hizo algo: se dice que hay resto y
  // se manda a `olvidar`, que es quien lo quita de la lista.
  if (cuentan.length === 0) return { veredicto: 'NADA', motivo: `no hay ninguna sesión de fondo «${nombre}» viva`, ...comoRestos(restos) };
  if (cuentan.length > 1) return { veredicto: 'NO-PUDE-MIRAR', motivo: `${cuentan.length} sesiones de fondo se llaman «${nombre}»` };
  if (!ID_CORTO.test(cuentan[0].agente.id || '')) return { veredicto: 'NO-PUDE-MIRAR', motivo: 'la sesión no trae un id legible' };
  return { veredicto: 'PARAR', id: cuentan[0].agente.id };
}

/**
 * Qué hacer al OLVIDAR `nombre`: quitar de `claude agents` los restos de trabajos ya terminados que
 * siguen ocupando ese nombre. SCRUM-954, punto 3 del ticket — hasta hoy había que salir de esta
 * puerta y escribir `claude rm <id>` a mano, que además está denegado en el settings del fundador.
 *
 * 🔴 Es un acto IRREVERSIBLE (borra la conversación del trabajo), así que:
 *   · no toca nada que no esté MUERTO por las DOS sondas — una duda es `NO-PUDE-MIRAR`, no un «bueno»;
 *   · si hay una viva con ese nombre, se niega entera, sin borrar los restos de al lado;
 *   · y no es la acción principal de nada: `lanzar` y `relevar` ya no la necesitan, porque con
 *     `clasificarAgente` un resto dejó de estorbarles. `olvidar` es sólo para que la lista no mienta.
 */
export function decidirOlvidar({ nombre, agentes, equipo, job }) {
  const malo = validarNombre(nombre, equipo);
  if (malo) return malo;
  if (!Array.isArray(agentes)) return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer `claude agents --json`' };
  const { cuentan, restos } = repartirPorNombre({ nombre, agentes, job, soloFondo: true });
  if (cuentan.length) {
    return {
      veredicto: 'ESTA-VIVA',
      motivo: `«${nombre}» tiene ${cuentan.length} sesión(es) que no se pueden dar por muertas: no se borra nada`,
      ...comoRestos(restos),
    };
  }
  if (restos.length === 0) return { veredicto: 'NADA', motivo: `no hay ningún resto de «${nombre}» en la lista` };
  const ids = restos.map((r) => r.agente.id).filter((id) => ID_CORTO.test(id || ''));
  if (ids.length !== restos.length) {
    return { veredicto: 'NO-PUDE-MIRAR', motivo: 'algún resto no trae un id legible: no se borra nada', ...comoRestos(restos) };
  }
  return { veredicto: 'OLVIDAR', ids, ...comoRestos(restos) };
}

/**
 * SCRUM-1011 · ¿la entrada recién lanzada VIVE? El tell es el mismo de SCRUM-954: el `pid`. Que
 * `claude` haya impreso «backgrounded» solo dice que ACEPTÓ el encargo, no que el proceso exista.
 * Medido el 21-sep-2026: 4 de 4 sesiones nuevas se registraban en `claude agents --json`, con
 * `pid=NINGUNO`, sin `status` y sin un solo turno en su `jsonl` — `lanzar` las daba igual por
 * LANZADA, con exit 0 y sin una línea de error. Un lanzador que miente así es peor que uno que
 * falla: el orquestador reparte trabajo a un puesto vacío y se entera cuando alguien pregunta.
 *
 * @param {object|undefined} agente la entrada de `claude agents --json` para el id recién lanzado
 * @returns {{ok:true}|{ok:false, motivo:string}}
 */
export function comprobarQueArranco(agente) {
  if (agente && typeof agente.pid === 'number' && agente.pid > 0) return { ok: true };
  return {
    ok: false,
    motivo: agente
      ? `se registró (id ${agente.id ?? '?'}) pero sin \`pid\`: no llegó a tener proceso`
      : 'no aparece en `claude agents --json`: no llegó a registrarse',
  };
}

/**
 * SCRUM-1026 · Las sesiones de fondo BLOQUEADAS, separadas de las que trabajan, para que `estado`
 * lo GRITE en vez de que el orquestador tenga que leer `waitingFor` fila a fila — que es como se
 * perdieron los dos casos medidos: uno ~30 min sin que nada avisara, otro justo al ir a entregar.
 *
 * No hay una marca de CUÁNDO empezó el bloqueo (nadie la escribe), así que «cuánto lleva así» usa
 * el proxy que el propio ticket describe («detecté porque su contexto llevaba 20 min sin
 * moverse»): el tiempo desde el ÚLTIMO turno con uso. `sinActividadMs` es una función porque leer
 * el jsonl de cada sesión es I/O — aquí se decide solo QUÉ hacer con el número.
 *
 * @param {{agentes:object[], sinActividadMs?:(agente:object)=>number|null}} e
 */
export function sesionesBloqueadas({ agentes, sinActividadMs }) {
  const bloqueadas = [];
  for (const a of agentes || []) {
    if (!a || a.kind !== 'background') continue;
    if (a.state !== 'blocked' && !a.waitingFor) continue;
    const ms = typeof sinActividadMs === 'function' ? sinActividadMs(a) : null;
    bloqueadas.push({
      id: a.id ?? null,
      nombre: a.name ?? null,
      waitingFor: a.waitingFor || 'algo interactivo',
      sinActividadMs: typeof ms === 'number' ? ms : null,
      avisar: typeof ms === 'number' && ms >= UMBRAL_AVISO_BLOQUEO_MS,
    });
  }
  return bloqueadas;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// La puerta: ¿esta copia puede actuar?
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Falla CERRADO. Tres condiciones, en orden:
 *   1 · el fichero NO está dentro de un árbol de git (no se ejecuta desde un worktree);
 *   2 · hay `config.json` junto a él, con la ruta del repositorio;
 *   3 · su contenido es IDÉNTICO, byte a byte, al de `origin/main:<ruta en el repo>`.
 */
export function puertaDeIntegridad({ rutaPropia, rutaEnElRepo = RUTA_EN_EL_REPO, git = gitReal }) {
  const dir = path.dirname(rutaPropia);
  const dentro = git(dir, ['rev-parse', '--is-inside-work-tree']);
  if (dentro.status === 0 && dentro.stdout.trim() === 'true') {
    return { ok: false, veredicto: 'DESDE-UN-ARBOL', motivo: `${dir} está dentro de un árbol de git: solo actúa la copia instalada` };
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
  } catch {
    return { ok: false, veredicto: 'NO-PUDE-MIRAR', motivo: 'no hay config.json legible junto a la instalación' };
  }
  if (!config || typeof config.repo !== 'string' || !config.repo) {
    return { ok: false, veredicto: 'NO-PUDE-MIRAR', motivo: 'config.json no trae la ruta del repositorio' };
  }
  // SCRUM-951a (A2): sin la carpeta de los traspasos, su ruta salía RELATIVA y `relevar` decía
  // SIN-TRASPASO para siempre — un «no» seguro que se lee igual que «la sesión no lo ha escrito».
  if (typeof config.traspasos !== 'string' || !config.traspasos) {
    return { ok: false, veredicto: 'NO-PUDE-MIRAR', motivo: 'config.json no trae la carpeta de los traspasos (`traspasos`)' };
  }
  const e = validarEquipo(config);
  if (!e.ok) return { ok: false, veredicto: e.veredicto, motivo: e.motivo };
  const main = git(config.repo, ['show', `origin/main:${rutaEnElRepo}`], { binario: true });
  if (main.status !== 0) {
    return { ok: false, veredicto: 'NO-PUDE-MIRAR', motivo: `no se pudo leer origin/main:${rutaEnElRepo}` };
  }
  const propio = fs.readFileSync(rutaPropia);
  if (!Buffer.from(main.stdoutBuffer).equals(propio)) {
    return { ok: false, veredicto: 'ALTERADO', motivo: `esta copia no es idéntica a origin/main:${rutaEnElRepo}` };
  }
  return { ok: true, config, equipo: e.equipo };
}

function gitReal(cwd, args, { binario = false } = {}) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: binario ? 'buffer' : 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.error) return { status: null, stdout: '', stdoutBuffer: Buffer.alloc(0) };
  return binario
    ? { status: r.status, stdout: '', stdoutBuffer: r.stdout }
    : { status: r.status, stdout: r.stdout || '', stdoutBuffer: Buffer.alloc(0) };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// CLI
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** `config.claude`: la ruta del binario, o `[orden, ...argumentos previos]` (así lo dobla el test). */
function claude(config, args) {
  const [orden, ...previos] = Array.isArray(config.claude) ? config.claude : [config.claude || 'claude'];
  return spawnSync(orden, [...previos, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function leerAgentes(config) {
  const r = claude(config, ['agents', '--json']);
  if (r.error || r.status !== 0) return null;
  try { const a = JSON.parse(r.stdout); return Array.isArray(a) ? a : null; } catch { return null; }
}

/** Espera bloqueante síncrona: este script no tiene un `main` async (todo va por `spawnSync`). */
function esperarMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * SCRUM-1011 · Tras lanzar, sondea el `pid` hasta `ESPERA_ARRANQUE_MS` antes de rendirse. Convierte
 * el fallo MUDO medido en el ticket (LANZADA, exit 0, sin proceso) en un veredicto legible.
 */
function confirmarArranque(config, id, { esperaMs = ESPERA_ARRANQUE_MS, pasoMs = 1_000 } = {}) {
  let transcurrido = 0;
  for (;;) {
    const agente = (leerAgentes(config) || []).find((a) => a.id === id);
    const c = comprobarQueArranco(agente);
    if (c.ok) return { ok: true, agente };
    if (transcurrido >= esperaMs) return { ok: false, motivo: c.motivo };
    esperarMs(pasoMs);
    transcurrido += pasoMs;
  }
}

/**
 * SCRUM-1026 · Milisegundos desde el último turno CON USO de `agente`, o `null` si no se puede
 * saber (sin `sessionId` legible, o sin jsonl encontrado: el mismo suelo que `leerContexto`).
 */
function sinActividadDelAgente(config, agente, ahora) {
  if (!agente || !SESSION_ID.test(agente.sessionId || '')) return null;
  const carpetas = carpetasDeProyecto(config);
  if (!carpetas) return null;
  const ruta = buscarJsonl({ sessionId: agente.sessionId, carpetas, existe: (p) => fs.existsSync(p) });
  if (!ruta) return null;
  let ctx;
  try { ctx = contextoDelJsonl(fs.readFileSync(ruta, 'utf8')); } catch { ctx = null; }
  if (!ctx || !ctx.cuando) return null;
  return ahora - Date.parse(ctx.cuando);
}

/**
 * Lo que dice el `state.json` del trabajo de fondo `id` (SCRUM-954). Es la sonda que puede VETAR un
 * veredicto de muerte, así que su suelo es lo único que importa: si no se puede leer, `leido:false`,
 * y `clasificarAgente` deja la entrada como `NO-PUDE-MIRAR` — o sea, viva.
 */
function estadoDeJob(config, id) {
  if (!ID_CORTO.test(id || '')) return { leido: false, motivo: 'la entrada no trae un id corto legible' };
  const raiz = config.jobs || path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'jobs');
  const ruta = path.join(raiz, id, 'state.json');
  let j;
  try { j = JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return { leido: false, motivo: `no se pudo leer ${ruta}` }; }
  if (!j || typeof j !== 'object') return { leido: false, motivo: `${ruta} no es un objeto` };
  const cuando = typeof j.firstTerminalAt === 'string' && j.firstTerminalAt ? j.firstTerminalAt : null;
  return { leido: true, terminal: cuando !== null || ESTADOS_TERMINALES.includes(j.state), cuando, estado: j.state ?? null };
}

function leerRegistro(dir) {
  const f = path.join(dir, 'sesiones.json');
  if (!fs.existsSync(f)) return {};
  try { const r = JSON.parse(fs.readFileSync(f, 'utf8')); return r && typeof r === 'object' ? r : null; } catch { return null; }
}

function salir(codigo, veredicto) {
  process.stdout.write(JSON.stringify(veredicto) + '\n');
  process.exit(codigo);
}

/** Las carpetas de proyecto de Claude Code. Ver `buscarJsonl`: el jsonl NO está en la del repo. */
function carpetasDeProyecto(config) {
  const raiz = config.proyectos || path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'projects');
  try {
    return fs.readdirSync(raiz, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(raiz, e.name));
  } catch {
    return null;
  }
}

/**
 * Dónde escribe su traspaso cada puesto, en la memoria del proyecto (`config.traspasos`), que es lo
 * que dice la A19. Es el fichero cuya fecha decide si se para o no, así que la ruta se calcula en un
 * solo sitio y se imprime en el resultado.
 *
 *   `sesion-N`       → `project_sN_traspaso.md`
 *   cualquier otro   → `project_<puesto>_traspaso.md`  (el orquestador: `project_orquestador_traspaso.md`)
 *
 * SIN el prefijo del equipo: la memoria es de cada máquina, y el nombre del fichero es el del puesto.
 * SCRUM-951a (A3): el orquestador se buscaba en `project_traspaso.md`, que no existe; su traspaso de
 * verdad se llama `project_orquestador_traspaso.md` (medido el 18-sep-2026).
 */
export function rutaDelTraspaso(config, nombre) {
  const base = (config && config.traspasos) || '';
  const prefijo = (config && config.prefijo) || '';
  const puesto = prefijo && nombre.startsWith(prefijo) ? nombre.slice(prefijo.length) : nombre;
  const n = /^sesion-(\d+)$/.exec(puesto);
  const fichero = n ? `project_s${n[1]}_traspaso.md` : `project_${puesto}_traspaso.md`;
  return path.join(base, fichero);
}

/** El contexto de una sesión viva, con todo lo que hizo falta para leerlo. */
function leerContexto(config, nombre, agentes) {
  if (!Array.isArray(agentes)) return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer `claude agents --json`' };
  const vivas = agentes.filter((a) => a && a.name === nombre);
  if (vivas.length === 0) return { veredicto: 'NO-VIVA', motivo: `no hay ninguna sesión «${nombre}» viva` };
  if (vivas.length > 1) return { veredicto: 'NO-PUDE-MIRAR', motivo: `${vivas.length} sesiones vivas se llaman «${nombre}»` };

  const carpetas = carpetasDeProyecto(config);
  if (!carpetas) return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo listar ~/.claude/projects' };

  const ruta = buscarJsonl({ sessionId: vivas[0].sessionId, carpetas, existe: (p) => fs.existsSync(p) });
  if (!ruta) return { veredicto: 'NO-PUDE-MIRAR', motivo: `no se encontró el jsonl de ${vivas[0].sessionId} en ninguna carpeta de proyecto`, id: vivas[0].id };

  let ctx;
  try { ctx = contextoDelJsonl(fs.readFileSync(ruta, 'utf8')); } catch { ctx = null; }
  if (!ctx) return { veredicto: 'NO-PUDE-MIRAR', motivo: `el jsonl no trae ningún turno con uso: ${ruta}`, id: vivas[0].id };
  return { veredicto: 'CONTEXTO', nombre, id: vivas[0].id, jsonl: ruta, ...ctx, agente: vivas[0] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rutaPropia = fileURLToPath(import.meta.url);
  const puerta = puertaDeIntegridad({ rutaPropia });
  if (!puerta.ok) salir(2, puerta);
  const { config, equipo } = puerta;
  const dir = path.dirname(rutaPropia);
  const [accion, nombre, ficheroPrompt] = process.argv.slice(2);

  if (accion === 'estado') {
    const agentes = leerAgentes(config);
    if (!agentes) salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer `claude agents --json`' });
    const job = (id) => estadoDeJob(config, id);
    const resumen = (a) => {
      const c = clasificarAgente(a, job(a.id));
      return { id: a.id ?? null, nombre: a.name ?? null, cwd: a.cwd ?? null, kind: a.kind ?? null,
        state: a.state ?? null, pid: a.pid ?? null, clasificacion: c.estado, porque: c.motivo };
    };
    // SCRUM-954, punto 2 del ticket: una sesión de fondo SIN nombre —o con uno que no es de este
    // equipo— desaparecía del radar entera, porque este filtro sólo dejaba pasar la lista blanca.
    // Ahora sale en `otras`, por id y ruta, y los trabajos ya terminados que siguen ocupando un
    // nombre del equipo salen en `restos`, que es lo que `olvidar` limpia.
    // SCRUM-1026: `bloqueadas` separa las que esperan algo interactivo de las que trabajan — hoy
    // hay que leer `waitingFor` fila a fila, y en un vistazo rápido se parecen.
    const ahora = Date.now();
    salir(0, {
      veredicto: 'ESTADO',
      sesiones: agentes.filter((a) => validarNombre(a.name, equipo) === null),
      bloqueadas: sesionesBloqueadas({ agentes, sinActividadMs: (a) => sinActividadDelAgente(config, a, ahora) }),
      restos: agentes.filter((a) => a.kind === 'background' && validarNombre(a.name, equipo) === null
        && clasificarAgente(a, job(a.id)).estado === 'MUERTA').map(resumen),
      otras: agentes.filter((a) => a.kind === 'background' && validarNombre(a.name, equipo) !== null).map(resumen),
    });
  }

  if (accion === 'contexto') {
    const malo = validarNombre(nombre, equipo);
    if (malo) salir(1, malo);
    const c = leerContexto(config, nombre, leerAgentes(config));
    if (c.veredicto !== 'CONTEXTO') salir(2, c);
    const relevo = decidirRelevo({
      contexto: { tokens: c.tokens, turnos: c.turnos, cuando: c.cuando },
      ultimaActividad: c.cuando ? Date.parse(c.cuando) : undefined,
      ahora: Date.now(),
    });
    salir(0, { veredicto: 'CONTEXTO', nombre, id: c.id, tokens: c.tokens, turnos: c.turnos, cuando: c.cuando, jsonl: c.jsonl, relevo });
  }

  if (accion === 'relevar') {
    const malo = validarNombre(nombre, equipo);
    if (malo) salir(1, malo);
    // El encargo viene en un fichero, igual que el prompt de `lanzar`: por la línea de órdenes
    // viajaría troceado por el shell, y es justo lo que NO puede faltar (una sesión sin encargo
    // gasta contexto preguntando qué hacer).
    let encargo;
    try { encargo = fs.readFileSync(ficheroPrompt, 'utf8'); } catch { salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer el fichero del encargo' }); }
    if (!encargo.trim()) salir(1, { veredicto: 'SIN-ENCARGO', motivo: 'el fichero del encargo está vacío: una sesión sin encargo no se lanza' });

    const agentes = leerAgentes(config);
    const c = leerContexto(config, nombre, agentes);
    // Para fechar el último turno hace falta el jsonl. Sin eso, «fresco» no significa nada.
    const ultimoTurno = c.veredicto === 'CONTEXTO' && c.cuando ? Date.parse(c.cuando) : undefined;

    const traspaso = rutaDelTraspaso(config, nombre);
    let traspasoMtime;
    try { traspasoMtime = fs.statSync(traspaso).mtimeMs; } catch { traspasoMtime = undefined; }

    const d = decidirRelevar({ nombre, agentes, traspasoMtime, ultimoTurno, ahora: Date.now(), equipo, job: (id) => estadoDeJob(config, id) });
    if (d.veredicto !== 'RELEVAR' && d.veredicto !== 'LANZAR') salir(1, d);

    if (d.veredicto === 'RELEVAR') {
      const stop = claude(config, ['stop', d.id]);
      if (stop.status !== 0) salir(2, { veredicto: 'NO-PUDE-PARAR', nombre, id: d.id, stop: stop.status, comprobado: d.comprobado });
    }

    // 🔴 SIEMPRE 'nueva', NUNCA 'reanudar': ese es el punto entero de la A19. Reanudar arrastraría
    // la caché que el relevo viene a soltar.
    const args = argsLanzar({ modo: 'nueva', nombre, prompt: encargo, equipo });
    const r = claude(config, args);
    const m = BACKGROUNDED.exec(r.stdout || '');
    if (r.status !== 0 || !m) salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: 'claude no confirmó la sesión de fondo', salida: (r.stdout || '').slice(-400) });
    // SCRUM-1011: el mismo defecto que `lanzar` — «backgrounded» solo dice que `claude` aceptó el
    // encargo, no que el proceso exista. Se sondea el `pid` antes de dar RELEVADA/LANZADA por buena.
    const confirmacion = confirmarArranque(config, m[1]);
    if (!confirmacion.ok) {
      salir(2, {
        veredicto: 'NO-ARRANCO', nombre, id: m[1],
        motivo: `${confirmacion.motivo}. Puede ser un límite de sesiones de fondo concurrentes en `
          + 'esta máquina (SIN CONFIRMAR, SCRUM-1011): parar una sesión existente y reintentar es el '
          + 'control que falta correr.',
      });
    }
    const nueva = confirmacion.agente;
    if (!SESSION_ID.test(nueva.sessionId || '')) salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: `la sesión ${m[1]} arrancó pero no se lee su sessionId`, id: m[1] });
    const registro = leerRegistro(dir) || {};
    fs.writeFileSync(path.join(dir, 'sesiones.json'), JSON.stringify({ ...registro, [nombre]: { sessionId: nueva.sessionId, ultimaTanda: Date.now() } }, null, 2));
    salir(0, { veredicto: d.veredicto === 'RELEVAR' ? 'RELEVADA' : 'LANZADA', nombre, anterior: d.id ?? null, id: m[1], sessionId: nueva.sessionId, comprobado: d.comprobado ?? null });
  }

  if (accion === 'parar') {
    const d = decidirParar({ nombre, agentes: leerAgentes(config), equipo, job: (id) => estadoDeJob(config, id) });
    if (d.veredicto !== 'PARAR') salir(d.veredicto === 'NADA' ? 0 : 1, d);
    const stop = claude(config, ['stop', d.id]);
    const rm = claude(config, ['rm', d.id]);
    salir(stop.status === 0 && rm.status === 0 ? 0 : 2, { veredicto: 'PARADA', nombre, id: d.id, stop: stop.status, rm: rm.status });
  }

  if (accion === 'olvidar') {
    const d = decidirOlvidar({ nombre, agentes: leerAgentes(config), equipo, job: (id) => estadoDeJob(config, id) });
    if (d.veredicto !== 'OLVIDAR') salir(d.veredicto === 'NADA' ? 0 : 1, d);
    const borrados = [];
    for (const id of d.ids) {
      const rm = claude(config, ['rm', id]);
      borrados.push({ id, rm: rm.status });
    }
    salir(borrados.every((b) => b.rm === 0) ? 0 : 2, { veredicto: 'OLVIDADOS', nombre, borrados, restos: d.restos });
  }

  if (accion === 'lanzar') {
    let prompt;
    try { prompt = fs.readFileSync(ficheroPrompt, 'utf8'); } catch { salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer el fichero del prompt' }); }
    const registro = leerRegistro(dir);
    const d = decidirLanzar({ nombre, agentes: leerAgentes(config), registro, ahora: Date.now(), equipo, repo: config.repo, job: (id) => estadoDeJob(config, id) });
    if (d.veredicto !== 'NUEVA') salir(d.veredicto === 'YA-VIVA' ? 0 : 1, d);
    const args = argsLanzar({ modo: 'nueva', nombre, prompt, equipo });
    const r = claude(config, args);
    const m = BACKGROUNDED.exec(r.stdout || '');
    if (r.status !== 0 || !m) salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: 'claude no confirmó la sesión de fondo', salida: (r.stdout || '').slice(-400) });
    // 🔴 SCRUM-1011 · medido 4 de 4: «backgrounded» solo dice que `claude` aceptó el encargo, no
    // que el proceso exista. Sondea el `pid` (el tell de SCRUM-954) antes de dar LANZADA por buena;
    // sin esto, el orquestador se cree que tiene un puesto trabajando y reparte trabajo a nadie.
    const confirmacion = confirmarArranque(config, m[1]);
    if (!confirmacion.ok) {
      salir(2, {
        veredicto: 'NO-ARRANCO', nombre, id: m[1],
        motivo: `${confirmacion.motivo}. Puede ser un límite de sesiones de fondo concurrentes en `
          + 'esta máquina (SIN CONFIRMAR, SCRUM-1011): parar una sesión existente y reintentar es el '
          + 'control que falta correr.',
      });
    }
    const nueva = confirmacion.agente;
    if (!SESSION_ID.test(nueva.sessionId || '')) salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: `la sesión ${m[1]} arrancó pero no se lee su sessionId`, id: m[1] });
    const siguiente = { ...(registro || {}), [nombre]: { sessionId: nueva.sessionId, ultimaTanda: Date.now() } };
    fs.writeFileSync(path.join(dir, 'sesiones.json'), JSON.stringify(siguiente, null, 2));
    salir(0, { veredicto: 'LANZADA', nombre, id: m[1], sessionId: nueva.sessionId, ...(d.restos ? { restos: d.restos } : {}) });
  }

  salir(1, {
    veredicto: 'ACCION-DESCONOCIDA',
    motivo: 'uso: sesion.mjs <lanzar nombre fichero-prompt | relevar nombre fichero-encargo | contexto nombre | parar nombre | olvidar nombre | estado>',
    // SCRUM-954, punto 3 del ticket: hasta hoy, cuando un nombre se quedaba ocupado por un trabajo
    // ya terminado, la única salida era `claude rm <id>` a mano — fuera de esta puerta y denegado en
    // el settings del fundador. Ahora se dice aquí y lo hace `olvidar`.
    ayuda: '`estado` enseña en `restos` los trabajos terminados que siguen ocupando un nombre, y en '
      + '`otras` las sesiones de fondo que no son de este equipo. `olvidar <nombre>` quita los restos.',
  });
}
