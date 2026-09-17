// scripts/equipo/sesion.mjs — SCRUM-899 · lanzar, parar y ver las sesiones de fondo del equipo
//
// Lo usa el orquestador de fondo para despertar a los carriles. Es la ÚNICA puerta: la regla de
// permiso permanente apunta a la copia INSTALADA de este fichero, no a `claude` a pelo, y lo que
// este fichero no sabe hacer no se puede hacer por ahí.
//
//   node <instalación>/sesion.mjs lanzar <nombre> <fichero-con-el-prompt>
//   node <instalación>/sesion.mjs parar  <nombre>
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

  salir(1, { veredicto: 'ACCION-DESCONOCIDA', motivo: 'uso: sesion.mjs <lanzar nombre fichero-prompt | parar nombre | estado>' });
}
