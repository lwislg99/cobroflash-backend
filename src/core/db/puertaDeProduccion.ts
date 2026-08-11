// src/core/db/puertaDeProduccion.ts — SCRUM-418
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA PUERTA ESTÁ EN EL PUNTO DE CONEXIÓN, NO EN EL ARRANQUE DE UN ÁRBOL
//
// Censo del 11-ago-2026 sobre los **199 worktrees** del repo: **12** llevan fichero de entorno y
// **11 apuntan a producción** — uno de ellos el checkout principal, que además va más de mil
// commits por detrás de `main`. Un árbol de hace semanas conectado a la base real.
//
// El comprobador que ya existía (`scripts/comprobar-claves-bd.mjs`) está bien hecho y tiene suelo
// propio, pero **solo mira el árbol desde el que se lanza**: en un worktree limpio dice «no se leyó
// ni una sola cadena» —correcto— y es ciego a los once que sí la tienen, porque nadie lo ejecuta
// dentro de ellos. Un paso manual no es una barrera (SCRUM-395).
//
// Por eso esto vive donde se ABRE la conexión: no hay forma de conectar sin pasar por aquí.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SOLO EL HOST DISTINGUE. NI EL NOMBRE DE LA BASE, NI EL DE LA VARIABLE
//
// `current_database()` devuelve **`railway` en producción Y en staging**, y el entorno de Railway
// donde vive staging **se llama «production»**: el nombre miente en las dos direcciones. Decidir
// por el nombre de la base o por el de la variable de entorno es decidir por una etiqueta que ya
// sabemos que no discrimina.
//
//   `autorack…` = PRODUCCIÓN · `acela…` = staging/dev
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// FAIL-CLOSED, y aquí importa más que en ningún otro guard
//
// Si el host no se puede leer, **no se conecta**. «Apunta bien» y «no supe mirar» no pueden dar el
// mismo verde: el segundo te deja escribiendo en producción creyendo que estás en local.

/** El fragmento de host que identifica a producción. Es lo ÚNICO que la distingue. */
export const HOST_DE_PRODUCCION = 'autorack';

/**
 * La variable que hay que poner —solo en Railway producción— para que la puerta abra.
 *
 * No se llama `NODE_ENV` ni nada que ya exista por otro motivo: tiene que ser una variable que
 * **nadie tenga por accidente**, y cuya única razón de existir sea declarar «sé que esto es la
 * base real».
 */
export const VARIABLE_DE_PRODUCCION = 'YAQU_DESTINO_PRODUCCION';

export type VeredictoPuerta =
  | { abre: true; host: string; destino: 'produccion' | 'otro' }
  | { abre: false; host: string | null; motivo: 'host_ilegible' | 'produccion_sin_declarar'; mensaje: string };

/**
 * El host de una cadena de conexión, o `null` si no se puede leer.
 *
 * ⚠️ NUNCA devuelve ni registra la cadena: una credencial se protege impidiendo que el error la
 * saque, no redactando el mensaje después (SCRUM-226/R7).
 */
export function hostDe(url: unknown): string | null {
  if (typeof url !== 'string' || url.trim() === '') return null;
  try {
    const u = new URL(url);
    return u.hostname || null;
  } catch {
    return null;
  }
}

/**
 * ¿Se puede abrir esta conexión?
 *
 * @param url  la cadena de conexión (no se guarda ni se imprime)
 * @param env  el entorno, por parámetro para poder probarlo sin tocar el proceso
 */
export function evaluarPuerta(url: unknown, env: Record<string, string | undefined>): VeredictoPuerta {
  const host = hostDe(url);

  if (host === null) {
    return {
      abre: false, host: null, motivo: 'host_ilegible',
      mensaje:
        '🔴 NO SE PUEDE LEER EL HOST DE LA BASE DE DATOS, así que no se abre la conexión.\n\n' +
        '  «Apunta bien» y «no supe mirar» no pueden dar el mismo verde: el segundo te deja\n' +
        '  escribiendo en producción creyendo que estás en local. Revisa que `DATABASE_URL` esté\n' +
        '  puesta y sea una URL válida. (No se imprime su valor, a propósito.)',
    };
  }

  const esProduccion = host.includes(HOST_DE_PRODUCCION);
  if (!esProduccion) return { abre: true, host, destino: 'otro' };

  if (env[VARIABLE_DE_PRODUCCION]) return { abre: true, host, destino: 'produccion' };

  return {
    abre: false, host, motivo: 'produccion_sin_declarar',
    mensaje:
      `🔴 ESTA CONEXIÓN VA A PRODUCCIÓN Y NADIE LO HA DECLARADO. Host: «${host}».\n\n` +
      `  Para conectar a producción hace falta la variable «${VARIABLE_DE_PRODUCCION}», y solo está\n` +
      '  puesta en Railway producción. Si estás en un árbol de trabajo, tu `.env` apunta a la base\n' +
      '  REAL: cámbialo a staging o dev antes de seguir.\n\n' +
      '  Censo del 11-ago-2026: de 199 worktrees, 12 tenían fichero de entorno y **11 apuntaban a\n' +
      '  producción** — uno el checkout principal. Esto existe por eso.\n\n' +
      '  ⚠️ El nombre de la base NO sirve para saber dónde estás: `current_database()` devuelve\n' +
      '  «railway» en producción Y en staging, y el entorno de Railway donde vive staging se llama\n' +
      '  «production». Solo el host distingue: «autorack…» es producción, «acela…» no.',
  };
}

/** Lanza si la puerta no abre. Se llama ANTES de construir el cliente. */
export function exigirDestinoDeclarado(
  url: unknown = process.env.DATABASE_URL,
  env: Record<string, string | undefined> = process.env,
): void {
  const v = evaluarPuerta(url, env);
  if (!v.abre) throw new Error(v.mensaje);
}
