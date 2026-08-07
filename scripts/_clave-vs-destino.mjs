// scripts/_clave-vs-destino.mjs — SCRUM-383
//
// ¿LO QUE LA CLAVE PROMETE ES A DONDE APUNTA DE VERDAD?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL ACCIDENTE QUE IMPIDE
//
// REGISTRO — medido el 6-ago-2026, ANTES de que este ticket lo arreglara: `DATABASE_URL_STAGING`
// apuntaba a `acela/yaqu_dev_javier` (DEV) en el worktree principal y a `acela/railway` (STAGING)
// en `b1`, `b2` y `b3`. **Un solo nombre de variable, dos bases distintas**, y cuál te tocaba
// dependía de en qué directorio estuvieras parado — algo que ningún comando te recordaba.
//
// ✅ YA NO ES ASÍ. SCRUM-383 le dio nombre propio a cada destino: `_STAGING` y `_DEV` valen lo
// mismo en los cuatro árboles, y la base que cambia por carril se llama `_TESTS` — un nombre que
// es verdad en los cuatro sitios. **No se movió a nadie de base**: el aislamiento por carril es
// deliberado y se conserva. Lo que se arregló fue el NOMBRE, no la fontanería.
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

  // ── LA BASE DE PRUEBAS DEL CARRIL ────────────────────────────────────────────────────────
  //
  // Un TERCER concepto, y hasta SCRUM-383 no tenía nombre. Los seis consumidores de la tanda no
  // quieren «staging» ni «dev»: quieren **la base de pruebas de SU carril**. El reparto por
  // carril es DELIBERADO (23-jul-2026): una base por carril, para aislarlos.
  //
  // ⚠️ Que apunte a bases distintas según el worktree NO es el defecto que este ticket arregla.
  // El defecto era que `DATABASE_URL_STAGING` PROMETÍA staging y en el principal daba dev — un
  // nombre que miente. «La base de pruebas de este carril» es una descripción VERDADERA en los
  // cuatro sitios, y la diferencia decisiva es que ésta **se puede declarar y verificar**: por
  // eso lleva su mapa aquí, y por eso el guard necesita saber en qué worktree está.
  DATABASE_URL_TESTS: {
    host: 'acela.proxy.rlwy.net',
    base: null,                     // no hay UNA base: la decide el worktree (mapa de abajo)
    porWorktree: Object.freeze({
      'cobroflash-backend': 'yaqu_dev_javier',
      'cobroflash-b1': 'railway',
      'cobroflash-b2': 'railway',
      'cobroflash-b3': 'railway',
    }),
    comoSeLlama: 'BASE DE PRUEBAS DEL CARRIL',
  },
});

export const OK = 'cuadra';
export const NO_CUADRA = 'no_cuadra';
export const NO_PUDE_RESOLVER = 'no_pude_resolver';
export const CLAVE_DESCONOCIDA = 'clave_desconocida';
export const WORKTREE_NO_DECLARADO = 'worktree_no_declarado';

/**
 * El nombre canónico del worktree: el último tramo de la raíz del árbol de trabajo.
 *
 * Acepta tanto una ruta como un nombre ya suelto, porque los llamadores tienen una cosa o la
 * otra. Lo que NO hace es adivinar: si el nombre resultante no está en el mapa, quien pregunte
 * recibe `worktree_no_declarado` — nunca un `cuadra` de cortesía.
 */
export function nombreDeWorktree(rutaONombre) {
  if (!rutaONombre || typeof rutaONombre !== 'string') return null;
  const limpio = rutaONombre.trim().replace(/[\\/]+$/, '');
  if (!limpio) return null;
  const tramos = limpio.split(/[\\/]/);
  return tramos[tramos.length - 1] || null;
}

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

  // ── La base esperada puede depender del WORKTREE (DATABASE_URL_TESTS) ──────────────────
  // Se resuelve ANTES de mirar la URL a propósito: si no sabemos en qué carril estamos, no hay
  // nada contra lo que comparar, y eso es un fallo de la DECLARACIÓN, no del valor. Un worktree
  // nuevo tiene que darse de alta aquí; hasta entonces no pasa en verde.
  let baseEsperada = esperado.base;
  if (esperado.porWorktree) {
    const nombre = nombreDeWorktree(worktree);
    baseEsperada = nombre ? esperado.porWorktree[nombre] : undefined;
    if (!baseEsperada) {
      const declarados = Object.keys(esperado.porWorktree);
      return {
        veredicto: WORKTREE_NO_DECLARADO,
        mensaje:
          `🔴 «${clave}» NO SE PUEDE COMPROBAR EN ESTE ÁRBOL DE TRABAJO.\n\n` +
          `  Worktree:   ${nombre ?? '(no se pudo identificar)'}\n` +
          `  Declarados: ${declarados.join(', ')}\n\n` +
          `  Esta clave es «${esperado.comoSeLlama}», y cuál es esa base DEPENDE del carril: por\n` +
          '  eso su destino se declara por worktree y no como un valor único. Si este árbol es\n' +
          '  nuevo, dale de alta su base en `DESTINOS_ESPERADOS.DATABASE_URL_TESTS.porWorktree`\n' +
          '  (`scripts/_clave-vs-destino.mjs`).\n\n' +
          '  NO se sigue: sin saber qué base le toca a este carril, aprobar sería aprobar a ciegas.',
      };
    }
  }

  const real = parseBDSegura(url);
  if (!real || !real.host || !real.base) {
    return {
      veredicto: NO_PUDE_RESOLVER,
      mensaje:
        `🔴 NO SE PUDO RESOLVER EL DESTINO DE «${clave}»${nombreDeWorktree(worktree) ? ` (worktree: ${nombreDeWorktree(worktree)})` : ''}.\n\n` +
        `  Prometía: ${esperado.comoSeLlama} — ${esperado.host}/${baseEsperada ?? '(cualquier base)'}\n` +
        '  Apunta a: NO SE SABE (la clave está vacía, o su URL no se puede leer)\n\n' +
        '  No se sigue. «No pude comprobarlo» NO es «cuadra»: si se dejara pasar, la operación\n' +
        '  correría contra una base que nadie ha identificado.',
    };
  }

  const hostOk = real.host === esperado.host;
  const baseOk = baseEsperada == null ? true : real.base === baseEsperada;
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
  // El worktree se nombra por su NOMBRE, no por su ruta absoluta: la ruta es información del
  // disco de quien lo corre y no añade nada para decidir (mismo criterio que `_identidad-sesion`).
  const porCarril = Boolean(esperado.porWorktree);
  return {
    veredicto: NO_CUADRA,
    mensaje:
      `🔴 LA CLAVE NO APUNTA A DONDE DICE SU NOMBRE.\n\n` +
      `  Worktree:  ${nombreDeWorktree(worktree) ?? '(sin identificar)'}\n` +
      `  Clave:     ${clave}\n` +
      `  Prometía:  ${esperado.comoSeLlama} — ${esperado.host}/${baseEsperada ?? '(cualquier base)'}\n` +
      `  Apunta a:  ${real.host}/${real.base}\n\n` +
      (porCarril
        ? '  NO se sigue. Esta clave designa LA BASE DE PRUEBAS DE ESTE CARRIL, y cuál es depende\n' +
          '  del worktree: el reparto por carril es DELIBERADO (23-jul-2026), para aislarlos. Lo que\n' +
          '  falla aquí no es que los carriles difieran, sino que ESTE apunta a la base de otro.\n\n'
        : '  NO se sigue. Esta clave promete UNA base concreta, la misma en los cuatro árboles.\n\n') +
      '  ⚠️ Y no basta con mirar el host: las bases de pruebas comparten el de `acela`, así que\n' +
      '  `_db-guard.mjs` —que valida el hostname— las da por iguales. Por eso aquí se compara\n' +
      '  también el NOMBRE DE BASE. Sin él, una operación «a staging» puede caer en desarrollo.\n\n' +
      '  REGISTRO (6-ago-2026, antes de SCRUM-383): `DATABASE_URL_STAGING` apuntaba a\n' +
      '  `yaqu_dev_javier` en el árbol principal y a `railway` en b1/b2/b3 — un nombre, dos bases.\n' +
      '  Ese accidente es el que este guard existe para impedir que vuelva.\n\n' +
      '  Qué hacer: NO renombres la comprobación para que pase. Corrige el valor en el `.env` de\n' +
      '  este árbol, o usa el worktree cuyo destino sea el que quieres. El mapa de los cuatro está\n' +
      '  en `docs/MIGRATIONS_PENDING.md`.',
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
