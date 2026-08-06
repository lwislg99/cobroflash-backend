// scripts/_clave-vs-destino.mjs — SCRUM-383
//
// ¿LO QUE LA CLAVE PROMETE ES A DONDE APUNTA DE VERDAD?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL ACCIDENTE QUE IMPIDE
//
// Medido el 6-ago-2026: `DATABASE_URL_STAGING` apunta a `acela/yaqu_dev_javier` (DEV) en el
// worktree principal y a `acela/railway` (STAGING) en `b1`, `b2` y `b3`. **Un solo nombre de
// variable, dos bases distintas**, y cuál te toca depende de en qué directorio estés parado —
// algo que ningún comando te recuerda y que no se ve en ninguna parte del proceso.
//
// Las dos viven en el MISMO host (`acela`), así que el guard que ya existía —`_db-guard.mjs`,
// que valida el HOSTNAME— no las separa: para él las dos son «acela» y las dos pasan. Por eso
// aquí se compara host **Y NOMBRE DE BASE**. Sin el nombre de base, este fichero sería decorado.
//
// No arregla la causa (el valor de la clave vive en Railway y esta sesión no tiene acceso). Hace
// otra cosa, que basta: **que el accidente sea imposible aunque la clave siga siendo ambigua.**
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ ESTO NO IMPRIME LA URL, NI EL USUARIO, NI LA CONTRASEÑA
//
// Todo lo que sale de aquí pasa por `describirBD`/`parseBDSegura` (`_db-guard.mjs`), que
// devuelve SOLO host y base. Es la regla R7 y el motivo de SCRUM-226: una credencial se protege
// impidiendo que el error salga, no redactando el mensaje después.
import { parseBDSegura } from './_db-guard.mjs';

/**
 * LO QUE CADA CLAVE PROMETE. Explícito y a mano a propósito: si esto se DERIVARA del entorno,
 * derivaría la mentira que existe para cazar.
 *
 * ⚠️ `base` es obligatorio y no es un detalle: `staging` y `dev` comparten el host `acela`, así
 * que comparar solo el host las daría por iguales — que es exactamente el hueco por el que se
 * coló el problema.
 */
export const DESTINOS_ESPERADOS = Object.freeze({
  DATABASE_URL_STAGING: { host: 'acela.proxy.rlwy.net', base: 'railway', comoSeLlama: 'STAGING' },
  DATABASE_URL_DEV:     { host: 'acela.proxy.rlwy.net', base: 'yaqu_dev_javier', comoSeLlama: 'DESARROLLO' },
  DATABASE_URL:         { host: 'autorack.proxy.rlwy.net', base: null, comoSeLlama: 'PRODUCCIÓN' },
});

export const OK = 'cuadra';
export const NO_CUADRA = 'no_cuadra';
export const NO_PUDE_RESOLVER = 'no_pude_resolver';
export const CLAVE_DESCONOCIDA = 'clave_desconocida';

/**
 * Compara lo prometido con lo real. PURA: no lee el entorno ni se conecta a nada, así que su
 * rojo se puede ejercitar sin base de datos.
 *
 * 🔴 SUELO: si el destino no se puede resolver —clave vacía, URL ilegible— el veredicto es
 * `no_pude_resolver`, NUNCA `cuadra`. «Coincide» y «no supe mirar» son el mismo verde en pantalla
 * y lo contrario en significado; confundirlos aquí dejaría pasar justo la operación que este
 * fichero existe para parar.
 */
export function comprobarClaveVsDestino(clave, url, worktree) {
  const esperado = DESTINOS_ESPERADOS[clave];
  if (!esperado) {
    return {
      veredicto: CLAVE_DESCONOCIDA,
      mensaje:
        `🔴 CLAVE DE BASE DE DATOS NO DECLARADA: «${clave}».\n\n` +
        `  No está en \`DESTINOS_ESPERADOS\` (${Object.keys(DESTINOS_ESPERADOS).join(', ')}), así que\n` +
        '  NADIE puede decir a qué base debería apuntar. Declárala ahí antes de usarla: una clave\n' +
        '  sin destino esperado es una clave contra la que no se puede comprobar nada.',
    };
  }

  const real = parseBDSegura(url);
  if (!real || !real.host || !real.base) {
    return {
      veredicto: NO_PUDE_RESOLVER,
      mensaje:
        `🔴 NO SE PUDO RESOLVER EL DESTINO DE «${clave}»${worktree ? ` (worktree: ${worktree})` : ''}.\n\n` +
        `  Prometía: ${esperado.comoSeLlama} — ${esperado.host}/${esperado.base ?? '(cualquier base)'}\n` +
        '  Apunta a: NO SE SABE (la clave está vacía, o su URL no se puede leer)\n\n' +
        '  No se sigue. «No pude comprobarlo» NO es «cuadra»: si se dejara pasar, la operación\n' +
        '  correría contra una base que nadie ha identificado.',
    };
  }

  const hostOk = real.host === esperado.host;
  const baseOk = esperado.base === null ? true : real.base === esperado.base;
  if (hostOk && baseOk) {
    return {
      veredicto: OK,
      mensaje: `[destino] ${clave} → ${real.host}/${real.base} (${esperado.comoSeLlama}) ✅`,
      real,
    };
  }

  // 🔴 El mensaje dice LAS DOS COSAS y en qué worktree. «No cuadra» a secas obliga a adivinar en
  // qué dirección está el error, y el worktree es justo el contexto invisible: el mismo nombre de
  // clave significa cosas distintas según el directorio, y nada te lo recuerda.
  return {
    veredicto: NO_CUADRA,
    mensaje:
      `🔴 LA CLAVE NO APUNTA A DONDE DICE SU NOMBRE.\n\n` +
      `  Worktree:  ${worktree || '(sin identificar)'}\n` +
      `  Clave:     ${clave}\n` +
      `  Prometía:  ${esperado.comoSeLlama} — ${esperado.host}/${esperado.base ?? '(cualquier base)'}\n` +
      `  Apunta a:  ${real.host}/${real.base}\n\n` +
      '  NO se sigue. Medido el 6-ago-2026: esta misma clave apunta a DEV en el worktree principal\n' +
      '  y a STAGING en b1/b2/b3. Las dos bases viven en el mismo host, así que el guard de\n' +
      '  hostname no las separa y una migración «a staging» puede caer en desarrollo — o al revés.\n\n' +
      '  Qué hacer: NO renombres la comprobación para que pase. O corriges el valor de la clave en\n' +
      '  Railway, o usas el worktree cuyo destino sea el que quieres. El mapa medido de los cuatro\n' +
      '  está en `docs/MIGRATIONS_PENDING.md`.',
    real,
    esperado,
  };
}

/**
 * El enganche para un script que va a tocar esquema. LANZA salvo que cuadre — incluido el caso
 * «no pude resolver», por el suelo de arriba.
 */
export function exigirDestinoCorrecto(clave, url, worktree) {
  const r = comprobarClaveVsDestino(clave, url, worktree);
  if (r.veredicto !== OK) throw new Error(r.mensaje);
  console.log(r.mensaje);
  return r;
}
