// scripts/qa/sesion-panel.mjs — SCRUM-1222
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 UNA SOLA FORMA DE ENTRAR AL PANEL DE yaqu.app CON LA CUENTA DEMO, Y SÓLO PARA LEER.
//
//   node scripts/qa/sesion-panel.mjs login [correo]     (por defecto demo@yaqu.app)
//   node scripts/qa/sesion-panel.mjs get <ruta>          p. ej. get /admin/jobs
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
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOST = 'yaqu.app';
export const BASE = `https://${HOST}`;
export const RUTA_SECRETO = 'C:/Users/Admin/.yaqu-qa-secret.txt';
export const RUTA_SESION = 'C:/Users/Admin/.yaqu-qa-sesion.txt';
export const RUTA_LOGIN = '/auth/test-login';
export const CORREO_POR_DEFECTO = 'demo@yaqu.app';
const COOKIE = 'pf_session';

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
export async function ejecutar(argv, { fetchFn = globalThis.fetch, rutaSecreto = RUTA_SECRETO, rutaSesion = RUTA_SESION, out = (s) => process.stdout.write(s + '\n'), err = (s) => process.stderr.write(s + '\n') } = {}) {
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
      fs.writeFileSync(rutaSesion, cookie + '\n', { mode: 0o600 });
      out(`sesión abierta como ${correo} en ${BASE} (la cookie queda en ${rutaSesion}; no se imprime)`);
      return 0;
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
        if (cuerpo) err(cuerpo.slice(0, 2000));
        return 1;
      }
      out(`GET ${arg} → ${res.status}`);
      out(cuerpo);
      return 0;
    }
    throw new Rechazo(`orden «${orden ?? ''}» desconocida. Uso: login [correo] · get <ruta>`);
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
