// scripts/qa/sesion-panel.mjs — SCRUM-1222
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 UNA SOLA FORMA DE ENTRAR AL PANEL DE yaqu.app CON LA CUENTA DEMO, Y SÓLO PARA LEER.
//
//   node scripts/qa/sesion-panel.mjs login [correo]     (por defecto demo@yaqu.app)
//   node scripts/qa/sesion-panel.mjs get <ruta>          p. ej. get /admin/jobs
//   node scripts/qa/sesion-panel.mjs estado [--sin-red]  ¿la sesión guardada sigue viva? (SCRUM-1430)
//
// Por qué existe: con `POST /auth/test-login` encendido en producción (SCRUM-1210), cada sesión
// se montaba su propio `fetch` en un `node -e`, y el clasificador de permisos se lo dejaba pasar a
// unas y se lo negaba a otras. Cuatro copias del mismo criterio. Un fichero único permite UNA regla
// de permiso estrecha sobre él, en vez de abrir `node` entero.
//
// ── LO QUE NO HACE, A PROPÓSITO ─────────────────────────────────────────────────────────────────
//   · NO escribe en producción. Sólo sale GET, salvo el POST del login (que crea la sesión: es
//     inherente a entrar). Cualquier otro método se rechaza ANTES de tocar la red.
//   · NO habla con otro host que `https://yaqu.app`. Una ruta absoluta, un `//otro-host` o una
//     redirección hacia fuera se rechazan: las redirecciones NO se siguen (`redirect: 'manual'`).
//   · NO lee el secreto de una variable, un argumento ni un log: sólo de `RUTA_SECRETO`. Y ni el
//     secreto ni la cookie de sesión se imprimen nunca: la cookie se guarda en `RUTA_SESION`, fuera
//     del repositorio, y `get` la lee de ahí.
//
// ── FAIL-CLOSED (la familia «no pude mirar» = «no hay nada», SCRUM-1157/1153) ───────────────────
//   exit 0  hecho: login con 200 + `pf_session`, o GET con respuesta 2xx
//   exit 1  NO PUDE ENTRAR / la respuesta no es 2xx — se DICE por stderr, con el estado
//   exit 2  CIEGO: sin secreto, o sin sesión guardada — stderr, NADA por stdout
//   exit 3  uso rechazado: método que no es GET, host ajeno, argumentos malos
//   `test-login` responde un 404 idéntico ante cualquier fallo (secreto, correo, ruta apagada):
//   es a propósito en el servidor, así que aquí se dice «no pude entrar» sin adivinar cuál fue.
//
// ── `estado` (SCRUM-1430): la sesión de `test-login` muere a las 24 h y no suena nada ───────────
//   La fila de la base caduca a las 24 h (`auth.routes.ts`), pero la cookie sale con `Max-Age` de
//   30 días (`authMiddleware.ts`): de la cookie NO se puede deducir su vida. Por eso `login` deja
//   al lado (`<sesión>.caducidad.json`) la hora de apertura —la cabecera `Date` del SERVIDOR, no
//   el reloj de esta máquina, que va adelantado— y `estado` contesta en su PRIMERA línea:
//   exit 0  VIVA                — el servidor la acepta (o, con --sin-red, el fichero dice que no ha caducado)
//   exit 1  MUERTA              — el servidor responde 401, o el fichero dice que ya pasó su hora
//   exit 2  NO SE PUEDE SABER   — sin sesión, sin fichero de caducidad, el fichero es de OTRA cookie,
//                                 o la sonda no respondió ni 2xx ni 401. Nunca «viva» por omisión.
//   La sonda es `GET /admin/me` y MANDA sobre el fichero: un logout con esa cookie la mata antes
//   de su hora, y eso sólo lo sabe el servidor.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const HOST = 'yaqu.app';
export const BASE = `https://${HOST}`;
export const RUTA_SECRETO = 'C:/Users/Admin/.yaqu-qa-secret.txt';
export const RUTA_SESION = 'C:/Users/Admin/.yaqu-qa-sesion.txt';
export const RUTA_LOGIN = '/auth/test-login';
export const CORREO_POR_DEFECTO = 'demo@yaqu.app';
export const RUTA_SONDA = '/admin/me';
// Las 24 h de `POST /auth/test-login` (auth.routes.ts). Un test las compara con el servidor: si
// allí cambian y aquí no, cae.
export const VIDA_SESION_MS = 24 * 60 * 60 * 1000;
const COOKIE = 'pf_session';

/** El fichero de caducidad vive AL LADO de la sesión, fuera del repositorio como ella. */
export const rutaCaducidadDe = (rutaSesion) => `${rutaSesion}.caducidad.json`;

/** Huella de la cookie: ata el fichero de caducidad a ESTA cookie sin guardarla dos veces. */
const huellaDe = (cookie) => crypto.createHash('sha256').update(cookie).digest('hex').slice(0, 16);

/** La hora de la cabecera `Date` de una respuesta, o null si no viene o no se entiende. */
function horaDelServidor(res) {
  const ms = Date.parse(res.headers.get('date') || '');
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Lo que el fichero de caducidad sabe de la cookie guardada. `{ caducaMs, correo }` sólo si el
 * fichero existe, se entiende y es de ESTA cookie; si no, `{ motivo }` — nunca una hora supuesta.
 */
export function leerCaducidad(rutaCaducidad, cookie) {
  let crudo;
  try { crudo = fs.readFileSync(rutaCaducidad, 'utf8'); } catch {
    return { motivo: `no hay fichero de caducidad (${rutaCaducidad}): la sesión no la abrió un \`login\` que lo escriba` };
  }
  let d;
  try { d = JSON.parse(crudo); } catch { return { motivo: `el fichero de caducidad (${rutaCaducidad}) no se entiende` }; }
  const caducaMs = Date.parse(d && d.caducaEn);
  if (!d || !Number.isFinite(caducaMs)) return { motivo: `el fichero de caducidad (${rutaCaducidad}) no lleva una hora válida` };
  if (d.huella !== huellaDe(cookie)) return { motivo: 'el fichero de caducidad es de OTRA cookie: la sesión guardada la escribió otra mano después' };
  return { caducaMs, correo: String(d.correo || '') };
}

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
function duracion(ms) {
  const min = Math.floor(Math.abs(ms) / 60000);
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export class Rechazo extends Error {}

/** Resuelve `ruta` contra BASE y GRITA si el resultado no es `https://yaqu.app`. */
export function urlDelPanel(ruta) {
  const r = String(ruta ?? '');
  if (!r.startsWith('/') || r.startsWith('//')) {
    throw new Rechazo(`ruta «${r}»: tiene que empezar por UNA «/» (una ruta de ${HOST}, nunca una URL ni «//host»)`);
  }
  const u = new URL(r, BASE);
  if (u.protocol !== 'https:' || u.host !== HOST) throw new Rechazo(`🔴 HOST AJENO: «${u.href}» no es ${BASE}. Este instrumento sólo habla con ${HOST}.`);
  return u;
}

/** El único punto de salida a la red. Sólo GET, salvo el POST del login. */
export async function peticion(fetchFn, metodo, ruta, { cookie = null, cuerpo = null } = {}) {
  const m = String(metodo).toUpperCase();
  if (!(m === 'GET' || (m === 'POST' && ruta === RUTA_LOGIN))) {
    throw new Rechazo(`🔴 SOLO LECTURA: ${m} ${ruta} rechazado. Este instrumento sólo hace GET (y el POST de ${RUTA_LOGIN}).`);
  }
  const u = urlDelPanel(ruta);
  const headers = { accept: 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (cuerpo) headers['content-type'] = 'application/json';
  return fetchFn(u.href, { method: m, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined, redirect: 'manual' });
}

function leerFichero(ruta) {
  try { return fs.readFileSync(ruta, 'utf8').trim(); } catch { return ''; }
}

/** La cookie `pf_session=…` de la respuesta, o null. */
export function cookieDeSesion(res) {
  const lista = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  for (const c of lista) {
    const m = String(c).match(new RegExp(`(?:^|\\s|,)${COOKIE}=([^;,\\s]+)`));
    if (m && m[1]) return `${COOKIE}=${m[1]}`;
  }
  return null;
}

/**
 * La herramienta entera. La CLI la llama con las rutas fijas y el `fetch` real; los tests, con
 * rutas temporales y un `fetch` falso. Devuelve el código de salida; escribe por `out`/`err`.
 */
export async function ejecutar(argv, { fetchFn = globalThis.fetch, rutaSecreto = RUTA_SECRETO, rutaSesion = RUTA_SESION, rutaCaducidad = rutaCaducidadDe(rutaSesion), ahora = Date.now, out =(s) => process.stdout.write(s + '\n'), err = (s) => process.stderr.write(s + '\n') } = {}) {
  const [orden, arg] = argv;
  try {
    if (orden === 'login') {
      const correo = String(arg || CORREO_POR_DEFECTO).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+$/.test(correo)) throw new Rechazo(`correo «${correo}» no válido`);
      const secreto = leerFichero(rutaSecreto);
      if (!secreto) {
        err(`CIEGO — no hay secreto legible en ${rutaSecreto}. No se intenta entrar: el instrumento NO afirma nada.`);
        return 2;
      }
      const res = await peticion(fetchFn, 'POST', RUTA_LOGIN, { cuerpo: { email: correo, secret: secreto } });
      const cookie = res.status === 200 ? cookieDeSesion(res) : null;
      if (!cookie) {
        err(`NO PUDE ENTRAR como ${correo} en ${BASE}: ${RUTA_LOGIN} respondió ${res.status}` +
          (res.status === 200 ? ' pero SIN cookie de sesión' : '') +
          '. (El servidor responde un 404 idéntico si la ruta está apagada, el secreto no casa o el correo no está admitido: no se puede saber cuál desde fuera.)');
        return 1;
      }
      // Primero se retira la caducidad de la sesión ANTERIOR: si la escritura de abajo fallara,
      // la cookie nueva quedaría sin fichero («no se puede saber») y no con la hora de otra.
      fs.rmSync(rutaCaducidad, { force: true });
      fs.writeFileSync(rutaSesion, cookie + '\n', { mode: 0o600 });
      const abiertaMs = horaDelServidor(res);
      if (abiertaMs === null) {
        out(`sesión abierta como ${correo} en ${BASE} (la cookie queda en ${rutaSesion}; no se imprime)`);
        err('⚠️ la respuesta no trae cabecera `Date`: NO se guarda la caducidad, y `estado --sin-red` dirá «no se puede saber».');
        return 0;
      }
      const caducaMs = abiertaMs + VIDA_SESION_MS;
      fs.writeFileSync(rutaCaducidad, JSON.stringify({
        correo, abiertaEn: iso(abiertaMs), caducaEn: iso(caducaMs), huella: huellaDe(cookie),
        fuente: 'cabecera Date del servidor + 24 h (auth.routes.ts, test-login)',
      }, null, 2) + '\n', { mode: 0o600 });
      out(`sesión abierta como ${correo} en ${BASE} (la cookie queda en ${rutaSesion}; no se imprime)`);
      out(`caduca el ${iso(caducaMs)} (24 h desde la hora del servidor) · antes de medir: node scripts/qa/sesion-panel.mjs estado`);
      return 0;
    }
    if (orden === 'estado') {
      if (arg !== undefined && arg !== '--sin-red') throw new Rechazo(`estado: argumento «${arg}» desconocido. Uso: estado [--sin-red]`);
      const cookie = leerFichero(rutaSesion);
      if (!cookie) {
        err(`NO SE PUEDE SABER — no hay sesión guardada en ${rutaSesion}. Entra antes con: node scripts/qa/sesion-panel.mjs login`);
        return 2;
      }
      const cad = leerCaducidad(rutaCaducidad, cookie);
      const quien = cad.correo ? ` (${cad.correo})` : '';
      // Un diagnóstico que no dice la cura deja a la siguiente igual de parada: MUERTA lleva el
      // comando ENTERO. El 2-oct-2026 tres sesiones se quedaron paradas con el camino documentado.
      const cura = `SE RENUEVA con: node scripts/qa/sesion-panel.mjs login ${cad.correo || '<correo de la cuenta>'}  (lee el secreto de ${rutaSecreto}; receta en docs/RUNBOOKS.md R23)`;
      // Lo que el fichero dice a una hora dada. `relojDe` nombra de quién es esa hora.
      const segunFichero = (ms, relojDe) => (cad.motivo
        ? `caducidad no conocida: ${cad.motivo}`
        : ms < cad.caducaMs
          ? `según su fichero caduca el ${iso(cad.caducaMs)}, dentro de ${duracion(cad.caducaMs - ms)} (hora ${relojDe})`
          : `según su fichero caducó el ${iso(cad.caducaMs)}, hace ${duracion(ms - cad.caducaMs)} (hora ${relojDe})`);

      if (arg === '--sin-red') {
        if (cad.motivo) { err(`NO SE PUEDE SABER — ${cad.motivo}. Sin --sin-red se pregunta al servidor.`); return 2; }
        const ms = ahora();
        const frase = segunFichero(ms, 'de ESTA máquina, que puede ir adelantada');
        if (ms >= cad.caducaMs) { err(`MUERTA — la sesión guardada${quien}: ${frase}.`); err(cura); return 1; }
        out(`VIVA — la sesión guardada${quien}: ${frase}. NO se ha preguntado al servidor: un logout con esa cookie la mata antes y aquí no se ve.`);
        return 0;
      }

      let res;
      try { res = await peticion(fetchFn, 'GET', RUTA_SONDA, { cookie }); } catch (e) {
        if (e instanceof Rechazo) throw e;
        err(`NO SE PUEDE SABER — la sonda GET ${RUTA_SONDA} no llegó: ${e && e.message ? e.message : e}. ${segunFichero(ahora(), 'de ESTA máquina')}.`);
        return 2;
      }
      const servidorMs = horaDelServidor(res);
      const frase = servidorMs === null ? segunFichero(ahora(), 'de ESTA máquina') : segunFichero(servidorMs, 'del servidor');
      if (res.status >= 200 && res.status < 300) {
        out(`VIVA — GET ${RUTA_SONDA} → ${res.status}${quien}; ${frase}.`);
        return 0;
      }
      if (res.status === 401) {
        const antes = !cad.motivo && (servidorMs ?? ahora()) < cad.caducaMs
          ? ' 🔴 Ha muerto ANTES de su hora: alguien cerró esa sesión (un `POST /auth/logout` con esta cookie la mata para todos).' : '';
        err(`MUERTA — GET ${RUTA_SONDA} → 401${quien}; ${frase}.${antes}`);
        err(cura);
        return 1;
      }
      err(`NO SE PUEDE SABER — GET ${RUTA_SONDA} → ${res.status}: ni 2xx ni 401, el servidor no ha dicho si la sesión vale. ${frase}.`);
      return 2;
    }
    if (orden === 'get') {
      if (!arg) throw new Rechazo('falta la ruta: get /admin/…');
      urlDelPanel(arg); // grita por el host ANTES de mirar si hay sesión
      const cookie = leerFichero(rutaSesion);
      if (!cookie) {
        err(`CIEGO — no hay sesión guardada en ${rutaSesion}. Entra antes con: node scripts/qa/sesion-panel.mjs login`);
        return 2;
      }
      const res = await peticion(fetchFn, 'GET', arg, { cookie });
      const cuerpo = await res.text();
      if (res.status < 200 || res.status >= 300) {
        const donde = res.headers.get('location');
        err(`GET ${arg} → ${res.status}${donde ? ` (redirige a ${donde}, NO se sigue)` : ''}${res.status === 401 ? ': la sesión caducó o no vale, repite el login' : ''}. NO es «no hay nada».`);
        if (res.status === 401) {
          const cad = leerCaducidad(rutaCaducidad, cookie);
          err(cad.motivo ? `(caducidad no conocida: ${cad.motivo})` : `(su fichero de caducidad dice ${iso(cad.caducaMs)}; la próxima vez, antes de medir: node scripts/qa/sesion-panel.mjs estado)`);
        }
        if (cuerpo) err(cuerpo.slice(0, 2000));
        return 1;
      }
      out(`GET ${arg} → ${res.status}`);
      out(cuerpo);
      return 0;
    }
    throw new Rechazo(`orden «${orden ?? ''}» desconocida. Uso: login [correo] · get <ruta> · estado [--sin-red]`);
  } catch (e) {
    if (e instanceof Rechazo) { err(e.message); return 3; }
    err(`NO PUDE MIRAR: ${e && e.message ? e.message : e}`);
    return 1;
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await ejecutar(process.argv.slice(2));
}
