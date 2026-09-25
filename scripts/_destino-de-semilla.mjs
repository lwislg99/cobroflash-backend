// scripts/_destino-de-semilla.mjs — SCRUM-1105: el sembrador elige su base por BANDERA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL HUECO QUE CIERRA
//
// Medido el 25-sep-2026: los tres sembradores (`seed-demo`, `seed-video`, `seed-staging`) leían
// SOLO `process.env.DATABASE_URL`, y esa clave no existe en ningún `.env` de la máquina — a
// propósito: en un árbol de trabajo no vive producción (SCRUM-418). Las que sí existen son
// `DATABASE_URL_DEV` y `DATABASE_URL_STAGING`, en el `.env` del checkout principal que ya sabe
// encontrar `_cargar-env.mjs` (SCRUM-932). Resultado: para sembrar, una sesión tenía que COPIAR
// una credencial a `DATABASE_URL` a mano — en la línea de órdenes, a la vista del clasificador,
// que con razón lo bloquea.
//
// 🔒 Lo arregla al revés de «dar acceso»: la credencial ya NO pasa por la mano de nadie. Quien
//    corre el seed nombra el DESTINO (`--dev` / `--staging`); la URL la resuelve este fichero
//    por dentro y no sale de este proceso.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE HACE, Y LO QUE NO
//
// · Solo hay dos banderas, y las dos nombran una clave con destino DECLARADO en
//   `_clave-vs-destino.mjs`. No hay `--prod`, ni `--clave=<lo que sea>`: una bandera genérica
//   convertiría esto en la vía de escape por entorno que `_db-guard.mjs` prohíbe.
// · La URL cargada pasa por `comprobarClaveVsDestino` (host Y NOMBRE DE BASE: dev y staging
//   comparten host, y sin la base un `--staging` podría caer en desarrollo) y por
//   `destinoSembrable` (allowlist; producción no está y no puede estar). Las dos, siempre.
// · La URL se escribe SOLO en el `process.env` de este proceso. Nunca en argv, nunca en disco,
//   nunca en un mensaje: de aquí sale `host/base` y nada más (R7).
// · Con bandera, una `DATABASE_URL` que ya viniera en el entorno SE IGNORA y se dice: la bandera
//   es la decisión explícita y gana a lo heredado.
// · Sin bandera no cambia nada: cada seed sigue con su camino de siempre.
import { cargarEnvDelEquipo, resumenDeEnv } from './_cargar-env.mjs';
import { comprobarClaveVsDestino, OK } from './_clave-vs-destino.mjs';
import { destinoSembrable, parseBDSegura } from './_db-guard.mjs';

/** Las únicas banderas, y la clave que nombra cada una. Explícito a propósito: ver arriba. */
export const BANDERAS_DE_DESTINO = Object.freeze({
  '--dev': 'DATABASE_URL_DEV',
  '--staging': 'DATABASE_URL_STAGING',
});

export const SIN_BANDERA = 'sin_bandera';
export const FIJADO = 'fijado';
export const RECHAZADO = 'rechazado';

/**
 * Resuelve la base de un sembrador a partir de su bandera y la deja en `env.DATABASE_URL`.
 *
 * @returns {{estado: 'sin_bandera'}
 *          | {estado: 'fijado', bandera: string, clave: string, host: string, etiqueta: string, avisos: string[]}
 *          | {estado: 'rechazado', mensaje: string}}
 *          Ningún campo lleva la URL.
 */
export function fijarDestinoPorBandera({
  argv = process.argv.slice(2),
  env = process.env,
  cwd = process.cwd(),
} = {}) {
  const banderas = [...new Set(argv.filter((a) => Object.hasOwn(BANDERAS_DE_DESTINO, a)))];
  if (banderas.length === 0) return { estado: SIN_BANDERA };
  if (banderas.length > 1) {
    return {
      estado: RECHAZADO,
      mensaje: `Has pasado ${banderas.join(' y ')}. Un sembrador escribe en UNA base: elige una.`,
    };
  }

  const [bandera] = banderas;
  const clave = BANDERAS_DE_DESTINO[bandera];
  const informe = cargarEnvDelEquipo({ cwd, env });
  const url = env[clave];
  if (!url) {
    return {
      estado: RECHAZADO,
      mensaje:
        `${bandera} pide ${clave}, y no está en ninguno de los ficheros de entorno mirados:\n\n` +
        resumenDeEnv(informe, { conNombres: true }) + '\n\n' +
        '  No se exporta a mano: la clave vive en el `.env` del checkout principal.',
    };
  }

  // Identidad: ¿la clave apunta a donde promete su nombre? Host Y base.
  const coherencia = comprobarClaveVsDestino(clave, url);
  if (coherencia.veredicto !== OK) {
    // Se dice CUÁL de los dos falló: «no cuadra» a secas obliga a comparar a ojo, y el caso
    // peligroso (dev ↔ staging) es justo el que tiene el host igual y solo cambia la base.
    let cual = '';
    if (coherencia.real && coherencia.esperado) {
      const falla = [];
      if (coherencia.real.host !== coherencia.esperado.host) falla.push('el HOST');
      if (coherencia.esperado.base != null && coherencia.real.base !== coherencia.esperado.base) falla.push('la BASE');
      cual = `Falla: ${falla.join(' y ')}.\n\n`;
    }
    return { estado: RECHAZADO, mensaje: cual + coherencia.mensaje };
  }

  // Permiso: ¿se puede sembrar ahí? Allowlist; producción no está.
  const sembrable = destinoSembrable(url);
  if (!sembrable.ok) {
    return { estado: RECHAZADO, mensaje: `Destino NO sembrable → ${sembrable.etiqueta}\n\n  ${sembrable.motivo}` };
  }

  const avisos = [];
  if (env.DATABASE_URL && env.DATABASE_URL !== url) {
    const heredada = parseBDSegura(env.DATABASE_URL);
    avisos.push(
      `DATABASE_URL del entorno (${heredada ? `${heredada.host}/${heredada.base}` : 'ilegible'}) ` +
      `se IGNORA: manda ${bandera}.`,
    );
  }
  env.DATABASE_URL = url;
  return { estado: FIJADO, bandera, clave, host: coherencia.real.host, etiqueta: sembrable.etiqueta, avisos };
}
