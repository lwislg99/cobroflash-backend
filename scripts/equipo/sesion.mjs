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
//   node <instalación>/sesion.mjs estado
//
// ── LO QUE SE MIDIÓ EN SCRUM-899 Y ESTE FICHERO CODIFICA (17-sep-2026) ─────────────────────────
//   · `--permission-mode plan` se bloquea esperando un permiso; `auto` contesta sin aprobaciones.
//   · `--resume <id corto>` cae en el SELECTOR interactivo y se queda parada para siempre.
//   · `--resume <sessionId completo>` CON flags arranca una COPIA; SIN flags continúa la misma.
//   · `claude stop/rm` aceptan el id, no el nombre.
//   → Nada interactivo en segundo plano, ids completos, reanudar sin flags, modo `auto`.
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

export const NOMBRES = /^(orquestador|sesion-[0-5])$/;
export const RUTA_EN_EL_REPO = 'scripts/equipo/sesion.mjs';
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Más de esto parada → sesión nueva en vez de reanudar: la caché ya está fría. */
export const UNA_HORA_MS = 60 * 60 * 1000;
/** A19: por encima de esto, AL TERMINAR UNA ENTREGA, se releva. */
export const UMBRAL_CONTEXTO = 300_000;
/** Lo que se espera a que una sesión escriba su traspaso antes de rendirse. */
export const ESPERA_TRASPASO_MS = 10 * 60 * 1000;

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Decisiones puras
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** @returns {null | {veredicto:'NOMBRE-NO-PERMITIDO', motivo:string}} */
export function validarNombre(nombre) {
  if (typeof nombre === 'string' && NOMBRES.test(nombre)) return null;
  return { veredicto: 'NOMBRE-NO-PERMITIDO', motivo: `«${nombre}» no está en la lista blanca (orquestador, sesion-0…sesion-5)` };
}

/**
 * Los argumentos de `claude` para lanzar. Nunca recibe flags de fuera: solo el nombre (validado),
 * el sessionId (validado) y el texto del prompt, que va como UN argumento y no se interpreta.
 */
export function argsLanzar({ modo, nombre, sessionId, prompt }) {
  if (validarNombre(nombre)) throw new Error('nombre fuera de la lista blanca');
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('prompt vacío');
  if (modo === 'nueva') return ['--bg', '-n', nombre, '--permission-mode', 'auto', prompt];
  if (modo === 'reanudar') {
    // SIN flags: con flags, `--resume` arranca una copia (medido en SCRUM-899, control 3b).
    if (!SESSION_ID.test(sessionId || '')) throw new Error('reanudar exige el sessionId COMPLETO');
    return ['--bg', '--resume', sessionId, prompt];
  }
  throw new Error(`modo desconocido: ${modo}`);
}

/**
 * Qué hacer al lanzar `nombre`.
 *
 * @param {{nombre:string, agentes:object[]|null, registro:object|null, ahora:number}} e
 *   `agentes`: la salida de `claude agents --json`, o `null` si no se pudo leer.
 *   `registro`: `{ [nombre]: { sessionId, ultimaTanda } }`, o `null` si no se pudo leer.
 */
export function decidirLanzar({ nombre, agentes, registro, ahora }) {
  const malo = validarNombre(nombre);
  if (malo) return malo;
  if (!Array.isArray(agentes)) return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer `claude agents --json`' };
  if (!registro || typeof registro !== 'object') return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer el registro de sesiones' };

  const vivas = agentes.filter((a) => a && a.name === nombre);
  if (vivas.length > 1) return { veredicto: 'NO-PUDE-MIRAR', motivo: `${vivas.length} sesiones vivas se llaman «${nombre}»` };
  if (vivas.length === 1) {
    const v = vivas[0];
    // Bloqueada = esperando algo interactivo que nadie va a contestar. Se dice; no se rodea.
    if (v.state === 'blocked' || v.waitingFor) {
      return { veredicto: 'BLOQUEADA', motivo: `«${nombre}» (${v.id}) espera ${v.waitingFor || 'algo interactivo'}`, id: v.id };
    }
    return { veredicto: 'YA-VIVA', motivo: `«${nombre}» ya está en marcha (${v.id})`, id: v.id };
  }

  const previa = registro[nombre];
  if (previa && SESSION_ID.test(previa.sessionId || '') && typeof previa.ultimaTanda === 'number'
      && ahora - previa.ultimaTanda <= UNA_HORA_MS) {
    return { veredicto: 'REANUDAR', sessionId: previa.sessionId };
  }
  return { veredicto: 'NUEVA', motivo: previa ? 'la anterior lleva más de una hora parada' : 'no hay sesión anterior' };
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
 *   · con el traspaso ANTERIOR al último turno de la sesión → aún no lo ha escrito: `ESPERANDO`
 *     mientras quede plazo, y `SIN-TRASPASO` después;
 *   · con la sesión TRABAJANDO → `OCUPADA`, y no para **aunque el traspaso esté fresco**: un
 *     traspaso escrito hace diez minutos no describe lo que está haciendo ahora, y varias sesiones
 *     han entregado con cosas a medio empujar.
 *
 * «Fresco» no es una sensación: es `traspasoMtime > ultimoTurno`, dos números que se comparan. El
 * resultado los devuelve en `comprobado` para que un `SIN-TRASPASO` se pueda discutir sin volver a
 * correrlo.
 */
export function decidirRelevar({ nombre, agentes, traspasoMtime, ultimoTurno, ahora, esperaMs = ESPERA_TRASPASO_MS }) {
  const malo = validarNombre(nombre);
  if (malo) return malo;
  if (!Array.isArray(agentes)) return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer `claude agents --json`' };

  const vivas = agentes.filter((a) => a && a.name === nombre);
  if (vivas.length > 1) return { veredicto: 'NO-PUDE-MIRAR', motivo: `${vivas.length} sesiones vivas se llaman «${nombre}»` };
  // Nadie a quien relevar. No es un error: se lanza y ya está.
  if (vivas.length === 0) return { veredicto: 'LANZAR', motivo: `no hay ninguna sesión «${nombre}» viva` };

  const v = vivas[0];
  const comprobado = { traspasoMtime: traspasoMtime ?? null, ultimoTurno: ultimoTurno ?? null, estado: v.state ?? null };

  if (typeof ultimoTurno !== 'number') {
    return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo fechar el último turno: sin eso «fresco» no significa nada', id: v.id, comprobado };
  }
  if (typeof traspasoMtime !== 'number') {
    return { veredicto: 'SIN-TRASPASO', motivo: 'no hay fichero de traspaso legible: no se para nada', id: v.id, comprobado };
  }
  if (traspasoMtime <= ultimoTurno) {
    const esperando = ahora - ultimoTurno;
    if (esperando < esperaMs) {
      return { veredicto: 'ESPERANDO', motivo: `el traspaso es anterior al último turno; llevan ${Math.round(esperando / 1000)} s`, id: v.id, comprobado };
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
export function decidirParar({ nombre, agentes }) {
  const malo = validarNombre(nombre);
  if (malo) return malo;
  if (!Array.isArray(agentes)) return { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer `claude agents --json`' };
  const vivas = agentes.filter((a) => a && a.name === nombre && a.kind === 'background');
  if (vivas.length === 0) return { veredicto: 'NADA', motivo: `no hay ninguna sesión de fondo «${nombre}»` };
  if (vivas.length > 1) return { veredicto: 'NO-PUDE-MIRAR', motivo: `${vivas.length} sesiones de fondo se llaman «${nombre}»` };
  if (!/^[0-9a-f]{8}$/.test(vivas[0].id || '')) return { veredicto: 'NO-PUDE-MIRAR', motivo: 'la sesión no trae un id legible' };
  return { veredicto: 'PARAR', id: vivas[0].id };
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
  const main = git(config.repo, ['show', `origin/main:${rutaEnElRepo}`], { binario: true });
  if (main.status !== 0) {
    return { ok: false, veredicto: 'NO-PUDE-MIRAR', motivo: `no se pudo leer origin/main:${rutaEnElRepo}` };
  }
  const propio = fs.readFileSync(rutaPropia);
  if (!Buffer.from(main.stdoutBuffer).equals(propio)) {
    return { ok: false, veredicto: 'ALTERADO', motivo: `esta copia no es idéntica a origin/main:${rutaEnElRepo}` };
  }
  return { ok: true, config };
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
 * Dónde escribe su traspaso cada puesto: `project_sN_traspaso.md` en la memoria del proyecto
 * (`config.traspasos`), que es lo que dice la A19. Es el fichero cuya fecha decide si se para o no,
 * así que la ruta se calcula en un solo sitio y se imprime en el resultado.
 */
export function rutaDelTraspaso(config, nombre) {
  const base = (config && config.traspasos) || '';
  const fichero = nombre === 'orquestador' ? 'project_traspaso.md' : `project_s${nombre.slice(-1)}_traspaso.md`;
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
  const { config } = puerta;
  const dir = path.dirname(rutaPropia);
  const [accion, nombre, ficheroPrompt] = process.argv.slice(2);

  if (accion === 'estado') {
    const agentes = leerAgentes(config);
    if (!agentes) salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer `claude agents --json`' });
    salir(0, { veredicto: 'ESTADO', sesiones: agentes.filter((a) => NOMBRES.test(a.name || '')) });
  }

  if (accion === 'contexto') {
    const malo = validarNombre(nombre);
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

    const d = decidirRelevar({ nombre, agentes, traspasoMtime, ultimoTurno, ahora: Date.now() });
    if (d.veredicto !== 'RELEVAR' && d.veredicto !== 'LANZAR') salir(1, d);

    if (d.veredicto === 'RELEVAR') {
      const stop = claude(config, ['stop', d.id]);
      if (stop.status !== 0) salir(2, { veredicto: 'NO-PUDE-PARAR', nombre, id: d.id, stop: stop.status, comprobado: d.comprobado });
    }

    // 🔴 SIEMPRE 'nueva', NUNCA 'reanudar': ese es el punto entero de la A19. Reanudar arrastraría
    // la caché que el relevo viene a soltar.
    const args = argsLanzar({ modo: 'nueva', nombre, prompt: encargo });
    const r = claude(config, args);
    const m = /backgrounded · ([0-9a-f]{8}) · /.exec(r.stdout || '');
    if (r.status !== 0 || !m) salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: 'claude no confirmó la sesión de fondo', salida: (r.stdout || '').slice(-400) });
    const nueva = (leerAgentes(config) || []).find((a) => a.id === m[1]);
    if (!nueva || !SESSION_ID.test(nueva.sessionId || '')) salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: `la sesión ${m[1]} arrancó pero no se lee su sessionId`, id: m[1] });
    const registro = leerRegistro(dir) || {};
    fs.writeFileSync(path.join(dir, 'sesiones.json'), JSON.stringify({ ...registro, [nombre]: { sessionId: nueva.sessionId, ultimaTanda: Date.now() } }, null, 2));
    salir(0, { veredicto: d.veredicto === 'RELEVAR' ? 'RELEVADA' : 'LANZADA', nombre, anterior: d.id ?? null, id: m[1], sessionId: nueva.sessionId, comprobado: d.comprobado ?? null });
  }

  if (accion === 'parar') {
    const d = decidirParar({ nombre, agentes: leerAgentes(config) });
    if (d.veredicto !== 'PARAR') salir(d.veredicto === 'NADA' ? 0 : 1, d);
    const stop = claude(config, ['stop', d.id]);
    const rm = claude(config, ['rm', d.id]);
    salir(stop.status === 0 && rm.status === 0 ? 0 : 2, { veredicto: 'PARADA', nombre, id: d.id, stop: stop.status, rm: rm.status });
  }

  if (accion === 'lanzar') {
    let prompt;
    try { prompt = fs.readFileSync(ficheroPrompt, 'utf8'); } catch { salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo leer el fichero del prompt' }); }
    const registro = leerRegistro(dir);
    const d = decidirLanzar({ nombre, agentes: leerAgentes(config), registro, ahora: Date.now() });
    if (d.veredicto !== 'NUEVA' && d.veredicto !== 'REANUDAR') salir(d.veredicto === 'YA-VIVA' ? 0 : 1, d);
    const args = argsLanzar({ modo: d.veredicto === 'NUEVA' ? 'nueva' : 'reanudar', nombre, sessionId: d.sessionId, prompt });
    const r = claude(config, args);
    const m = /backgrounded · ([0-9a-f]{8}) · /.exec(r.stdout || '');
    if (r.status !== 0 || !m) salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: 'claude no confirmó la sesión de fondo', salida: (r.stdout || '').slice(-400) });
    const nueva = (leerAgentes(config) || []).find((a) => a.id === m[1]);
    if (!nueva || !SESSION_ID.test(nueva.sessionId || '')) salir(2, { veredicto: 'NO-PUDE-MIRAR', motivo: `la sesión ${m[1]} arrancó pero no se lee su sessionId`, id: m[1] });
    const siguiente = { ...(registro || {}), [nombre]: { sessionId: nueva.sessionId, ultimaTanda: Date.now() } };
    fs.writeFileSync(path.join(dir, 'sesiones.json'), JSON.stringify(siguiente, null, 2));
    salir(0, { veredicto: d.veredicto === 'NUEVA' ? 'LANZADA' : 'REANUDADA', nombre, id: m[1], sessionId: nueva.sessionId });
  }

  salir(1, { veredicto: 'ACCION-DESCONOCIDA', motivo: 'uso: sesion.mjs <lanzar nombre fichero-prompt | relevar nombre fichero-encargo | contexto nombre | parar nombre | estado>' });
}
