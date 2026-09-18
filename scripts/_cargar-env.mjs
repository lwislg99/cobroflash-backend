// scripts/_cargar-env.mjs — SCRUM-932: de dónde sale el entorno de los scripts del turno.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL HUECO QUE CIERRA, Y NO ES EL QUE PARECÍA
//
// El ticket llegó como «el script pide una clave que no existe» (`DATABASE_URL_TESTS`). Medido
// el 17-sep-2026, el nombre NO era el defecto: esa clave la nombran 12+ ficheros, `ci.yml`
// incluido, o sea que es el nombre canónico del repo y cambiarlo rompería doce sitios.
//
// El defecto es de DÓNDE se esperaba que saliera. `import 'dotenv/config'` lee `.env` **del
// directorio actual**, y `dotenv` no sube por el árbol. Eso funcionaba cuando el equipo eran
// CUATRO árboles fijos con su `.env` cada uno (`cobroflash-backend`, `b1`, `b2`, `b3`: la foto
// del 6-ago-2026 en `docs/RUNBOOKS.md`). Hoy:
//
//   · `b1`, `b2` y `b3` **ya no existen** en el disco;
//   · hay ~95 worktrees efímeros (`wt-*`, `.claude/worktrees/*`), ninguno con `.env`;
//   · el checkout compartido tiene `.env.local` —que `dotenv/config` NO lee— y ningún `.env`.
//
// O sea: **no hay UN solo `.env` en la máquina**, así que ninguna clave, se llame como se llame,
// llega a `process.env`. La norma «toma el turno antes de escribir en staging» se quedó sin
// mecanismo no porque el mecanismo estuviera mal escrito, sino porque el suelo sobre el que se
// apoyaba —un `.env` por árbol— se deshizo debajo cuando el equipo pasó a worktrees de un día.
//
//     🔒 Un mecanismo que depende de un fichero por árbol muere el día que los árboles son
//        efímeros, y muere CALLADO: sigue existiendo, solo que ya no lo encuentra nadie.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE HACE, Y LO QUE NO
//
// Busca el entorno en una lista DECLARADA y en orden, y **dice en qué fichero lo encontró**.
// Eso último no es adorno: el accidente de SCRUM-383 fue un nombre de clave que significaba
// dos bases distintas según el directorio, y lo que lo hizo caro fue que nada te lo recordaba.
// Aquí, quien corre el comando ve siempre de qué fichero salió su entorno.
//
// NO decide a qué base apuntas: eso lo declara quien llama (`turno-staging.mjs --base`).
// NO pisa nada que ya venga en `process.env`: una variable puesta a mano manda siempre.
// NO imprime NUNCA un valor — ni aquí ni en el informe que devuelve (regla 9 / R7). Del informe
// solo salen RUTAS y NOMBRES de clave.
// NO relaja ninguna barrera: la URL que acabe cargando pasa igual por `assertSafeStagingUrl`,
// que es una allowlist de host y falla cerrada. `YAQU_ENV_FILE` dice DÓNDE está el fichero de
// credenciales, no a qué host se puede escribir — no es la vía de escape por entorno que
// `_db-guard.mjs` prohíbe, y por eso puede existir.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';

export const CARGADO = 'cargado';
export const NO_EXISTE = 'no_existe';
export const NO_SE_PUDO_LEER = 'no_se_pudo_leer';
export const NO_SE_PUDO_LOCALIZAR = 'no_se_pudo_localizar';

/**
 * El `.env` del CHECKOUT PRINCIPAL del repositorio, visto desde cualquier worktree.
 *
 * `git rev-parse --git-common-dir` apunta al `.git` del árbol principal también cuando se corre
 * dentro de un worktree — que es justo la propiedad que hace falta: UN fichero de entorno para
 * los ~95 árboles efímeros, en vez de 95 copias de una credencial repartidas por el disco.
 *
 * 🔴 SUELO: si `git` no está o falla, esto devuelve `null` y el llamador lo verá como
 * `no_se_pudo_localizar` en el informe. «No supe mirar» no se puede parecer a «ahí no había
 * nada»: el segundo invita a crear el fichero, el primero a arreglar `git`.
 */
export function envDelCheckoutPrincipal(cwd = process.cwd()) {
  const r = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd, encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  const salida = (r.stdout || '').trim();
  if (!salida) return null;
  // Desde el árbol principal `git` contesta `.git` en relativo; desde un worktree, absoluto.
  const gitDir = path.resolve(cwd, salida);
  return path.join(path.dirname(gitDir), '.env');
}

/**
 * Los ficheros donde se busca el entorno, EN ORDEN y con su porqué. Explícito a propósito: una
 * lista que se derivara del disco derivaría también el despiste que existe para cazar.
 */
export function candidatosDeEnv(cwd = process.cwd(), env = process.env) {
  const lista = [];

  // ① Declarado a mano. Es la vía para un fichero de credenciales que vive FUERA de los árboles
  // —el caso de esta máquina— sin copiar la credencial a ningún sitio nuevo.
  if (env.YAQU_ENV_FILE) {
    lista.push({ ruta: path.resolve(cwd, env.YAQU_ENV_FILE), porque: 'YAQU_ENV_FILE' });
  }

  // ② Lo que hacía `dotenv/config`, y se conserva EXACTAMENTE: quien hoy tiene su `.env` en el
  // árbol desde el que corre sigue funcionando igual y con la misma precedencia que antes.
  lista.push({ ruta: path.join(cwd, '.env'), porque: '.env de este árbol (como dotenv/config)' });

  // ③ El del checkout principal, para los worktrees efímeros.
  const principal = envDelCheckoutPrincipal(cwd);
  if (principal) {
    lista.push({ ruta: principal, porque: '.env del checkout principal (vale para todo worktree)' });
  } else {
    lista.push({ ruta: null, porque: '.env del checkout principal', estado: NO_SE_PUDO_LOCALIZAR });
  }

  // Un mismo fichero nombrado dos veces se mira una: desde el árbol principal, ② y ③ coinciden.
  const vistas = new Set();
  return lista.filter((c) => {
    if (!c.ruta) return true;
    const clave = path.normalize(c.ruta).toLowerCase();
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

/**
 * Carga el entorno del equipo y devuelve el INFORME de lo que hizo.
 *
 * Precedencia: lo que ya está en `process.env` gana siempre; luego los candidatos en orden. Una
 * clave ya puesta no se pisa nunca — ni por un fichero ni por otro.
 *
 * @returns {{fuentes: Array<{ruta: string|null, porque: string, estado: string, motivo?: string,
 *            clavesEnFichero: number, clavesPuestas: string[]}>,
 *            clavesPuestas: string[], mirados: number}}
 *          De aquí NO sale ningún valor: solo rutas, nombres de clave y cuentas.
 */
export function cargarEnvDelEquipo({ cwd = process.cwd(), env = process.env } = {}) {
  const fuentes = [];
  const puestas = [];

  for (const cand of candidatosDeEnv(cwd, env)) {
    if (cand.estado === NO_SE_PUDO_LOCALIZAR) {
      fuentes.push({
        ruta: null, porque: cand.porque, estado: NO_SE_PUDO_LOCALIZAR,
        motivo: 'no se pudo preguntar a git por el checkout principal',
        clavesEnFichero: 0, clavesPuestas: [],
      });
      continue;
    }

    let texto;
    try {
      texto = fs.readFileSync(cand.ruta, 'utf8');
    } catch (e) {
      // 🔴 ENOENT y «no se pudo leer» son cosas DISTINTAS y no se colapsan. Un `.env` que existe
      // pero no se puede abrir (permisos, es un directorio, disco) leído como «no existe» manda a
      // crear un fichero que ya está, y el informe diría una falsedad tranquilizadora.
      fuentes.push({
        ruta: cand.ruta, porque: cand.porque,
        estado: e && e.code === 'ENOENT' ? NO_EXISTE : NO_SE_PUDO_LEER,
        ...(e && e.code === 'ENOENT' ? {} : { motivo: (e && e.code) || 'error al leer' }),
        clavesEnFichero: 0, clavesPuestas: [],
      });
      continue;
    }

    let mapa;
    try {
      mapa = parse(texto);
    } catch (e) {
      fuentes.push({
        ruta: cand.ruta, porque: cand.porque, estado: NO_SE_PUDO_LEER,
        motivo: `no se pudo interpretar como .env (${(e && e.message) ? 'formato' : 'desconocido'})`,
        clavesEnFichero: 0, clavesPuestas: [],
      });
      continue;
    }

    const puestasAqui = [];
    for (const [clave, valor] of Object.entries(mapa)) {
      if (Object.prototype.hasOwnProperty.call(env, clave) && env[clave] !== undefined) continue;
      env[clave] = valor;
      puestasAqui.push(clave);
      puestas.push(clave);
    }
    fuentes.push({
      ruta: cand.ruta, porque: cand.porque, estado: CARGADO,
      clavesEnFichero: Object.keys(mapa).length, clavesPuestas: puestasAqui,
    });
  }

  return { fuentes, clavesPuestas: puestas, mirados: fuentes.length };
}

/**
 * El informe en texto, para que ningún comando deje al que lo corre adivinando de qué fichero
 * salió su entorno. Declara la POBLACIÓN (cuántos ficheros se miraron), no solo el resultado:
 * «no encontré la clave» sin «y miré en estos tres sitios» no se puede accionar (A3).
 *
 * `conNombres` añade los nombres de las claves puestas — nunca los valores. Se usa en el camino
 * de ERROR, que es donde saber qué tienes es justo lo que falta.
 */
export function resumenDeEnv(informe, { conNombres = false } = {}) {
  const lineas = [`   entorno: ${informe.mirados} fichero(s) mirado(s)`];
  for (const f of informe.fuentes) {
    const donde = f.ruta ?? '(no localizado)';
    if (f.estado === CARGADO) {
      const detalle = conNombres && f.clavesPuestas.length
        ? `  [${f.clavesPuestas.join(', ')}]`
        : '';
      lineas.push(`     ✔ ${donde} — ${f.clavesEnFichero} clave(s), ${f.clavesPuestas.length} puesta(s)${detalle}`);
    } else if (f.estado === NO_EXISTE) {
      lineas.push(`     · ${donde} — no existe`);
    } else {
      lineas.push(`     ⚠ ${donde} — NO SE PUDO LEER (${f.motivo ?? 'sin motivo'}) · ${f.porque}`);
    }
  }
  return lineas.join('\n');
}
