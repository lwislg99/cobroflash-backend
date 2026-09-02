// scripts/_vigilante-de-despliegue.mjs — SCRUM-677
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿ESTÁ PRODUCCIÓN CORRIENDO LO QUE HAY EN `main`?
//
// ── LO QUE PASÓ, y por qué esto existe ──────────────────────────────────────────────────────
// Producción estuvo NUEVE DÍAS sin desplegar. Treinta despliegues seguidos fallaron el
// healthcheck porque se mergeó esquema sin aplicar su `ALTER` y `schemaDrift` se negó a arrancar
// —correctamente—. Nadie se enteró: cuando un despliegue falla, Railway **mantiene vivo el
// anterior**. La web funcionaba. No hubo caída, ni alerta, ni error.
//
// 🔴 EL SÍNTOMA ERA «NO CAMBIA NADA», que es indistinguible de un día sin cambios visibles. Lo
// destapó el fundador preguntando, no un mecanismo. Esto es el mecanismo.
//
// ── LO QUE SE MIDIÓ ANTES DE ESCRIBIR NADA, y es lo que hace esto posible ───────────────────
// `src/core/config/env.ts` pone `BUILD_ID = process.env.RAILWAY_GIT_COMMIT_SHA` y `GET /version`
// lo publica. Ese endpoint es **público y declarado** (`publicAccessDeclarations.ts`: «build id,
// sin caché, sin PII»). O sea que **el commit activo en producción se puede saber SIN
// credenciales, sin token de Railway y sin tocar ninguna base.** Comprobado en vivo el
// 2-sep-2026: devolvió un sha40 que estaba en la historia de `main`.
//
// Por eso este vigilante NO necesita nada del fundador para funcionar. Si hubiera hecho falta un
// token, habría habido que parar y preguntar.
//
// ── TODO LO DE AQUÍ ES PURO ────────────────────────────────────────────────────────────────
// No hay red, ni git, ni reloj de pared: entran datos, sale un veredicto. Es lo que permite
// EJERCITAR el rojo — y un vigilante que nadie ha visto saltar es exactamente el instrumento en
// el que no se puede confiar. Hoy hemos tenido treinta oportunidades de verlo saltar y no saltó
// ninguna, porque no existía.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Al día, o por detrás pero dentro del margen. */
export const AL_DIA = 'al-dia';
/** Por detrás MÁS del margen. Éste es el hallazgo. */
export const ATRASADO = 'atrasado';
/** No se pudo saber. **NO es «al día»**, y por eso tiene veredicto propio. */
export const NO_SUPE_MIRAR = 'no-supe-mirar';

export const SALIDA_ATRASADO = 1;
export const SALIDA_NO_SUPE_MIRAR = 2;

/**
 * 🔴 EL MARGEN, CON SU MOTIVO MEDIDO — no con una intuición.
 *
 * Medido sobre los 1.832 commits de `main` de los últimos 30 días: el hueco entre commits
 * consecutivos tiene **mediana 0,0 h y p99 5,5 h**. O sea que, en marcha normal, un commit que
 * lleva más de 6 h en `main` sin llegar a producción **no es «un rato tranquilo»**: es que el
 * despliegue no está pasando.
 *
 * Y el otro extremo lo da el incidente: nueve días = 216 h. Seis horas es 1/36 de lo que costó
 * enterarse preguntando.
 *
 * ⚠️ ES UNA PROPUESTA. El número lo decide el fundador; aquí está su motivo para poder discutirlo
 * con un dato delante en vez de con una corazonada.
 */
export const MARGEN_HORAS_PROPUESTO = 6;

/** Un sha de git de verdad: 40 hex. Ni más ni menos. */
const ES_SHA40 = /^[0-9a-f]{40}$/;

/**
 * El veredicto.
 *
 * @param datos.versionDeProduccion  lo que devolvió `GET /version`, TAL CUAL (o null si no se pudo leer)
 * @param datos.shaDeMain            el HEAD de `origin/main`
 * @param datos.conoceElCommit       ¿este repo tiene ese objeto? (`git cat-file -e`)
 * @param datos.estaEnMain           ¿está en la historia de `main`? (`git merge-base --is-ancestor`)
 * @param datos.commitsPorDelante    cuántos commits tiene `main` que producción no
 * @param datos.epochDelPrimeroSinDesplegar  el `%ct` del commit MÁS ANTIGUO que main tiene y prod no
 * @param datos.ahoraEpoch           el ahora, INYECTADO (nada de reloj de pared)
 * @param datos.margenHoras          el margen a aplicar
 */
export function veredictoDeDespliegue(datos) {
  const {
    versionDeProduccion, shaDeMain, conoceElCommit, estaEnMain,
    commitsPorDelante, epochDelPrimeroSinDesplegar, ahoraEpoch,
    margenHoras = MARGEN_HORAS_PROPUESTO,
  } = datos || {};

  const ciego = (motivo, detalle) => ({
    veredicto: NO_SUPE_MIRAR, salida: SALIDA_NO_SUPE_MIRAR, horas: null,
    titulo: '⚠️ NO SUPE MIRAR: ' + motivo,
    detalle: detalle + '\n   Esto NO es «producción está al día»: es que no se ha podido comprobar.'
      + '\n   Un vigilante que confunde las dos cosas es peor que ninguno.',
  });

  // ── SUELO 1 · sin lectura no hay veredicto ──────────────────────────────────────────────
  if (versionDeProduccion == null || String(versionDeProduccion).trim() === '') {
    return ciego('no se pudo leer `/version` de producción.',
      '   Sin esa lectura no hay nada que comparar.');
  }
  const version = String(versionDeProduccion).trim();

  // ── SUELO 2 · 🔴 EL FALLBACK DE `env.ts`, QUE ES UN CASO REAL Y NO UNA HIPÓTESIS ────────
  // `BUILD_ID = process.env.RAILWAY_GIT_COMMIT_SHA || String(Date.now())`. Si la variable no
  // llega, producción publica un NÚMERO y no un sha. Comparar eso contra `main` daría «no está
  // en la historia» y se leería como «producción va atrasadísima», cuando lo que pasa es que
  // no sabemos qué está corriendo. Son cosas distintas y se dicen distinto.
  if (!ES_SHA40.test(version)) {
    return ciego('producción no publica un sha de commit.',
      '   `/version` devolvió algo que no es un sha40. `env.ts` cae a `Date.now()` cuando\n'
      + '   `RAILWAY_GIT_COMMIT_SHA` no llega al proceso, así que lo más probable es eso.\n'
      + '   Mientras siga así, NO SE PUEDE saber qué commit está corriendo.');
  }

  // ── SUELO 3 · un commit que este repo no conoce ────────────────────────────────────────
  if (conoceElCommit === false) {
    return ciego('el commit de producción no existe en este repositorio.',
      '   Producción dice estar en ' + version.slice(0, 8) + ' y aquí no está ese objeto.\n'
      + '   Puede ser un `git fetch` que falta, o un despliegue desde otro sitio. No se adivina.');
  }

  // ── Producción corriendo algo que NO está en `main`: eso no es «atraso» ────────────────
  if (estaEnMain === false) {
    return {
      veredicto: ATRASADO, salida: SALIDA_ATRASADO, horas: null,
      titulo: '🔴 PRODUCCIÓN CORRE UN COMMIT QUE NO ESTÁ EN `main`',
      detalle: '   activo en producción: ' + version.slice(0, 8) + '\n'
        + '   `main`:               ' + String(shaDeMain || '?').slice(0, 8) + '\n'
        + '   No es un retraso: es una historia distinta. O se desplegó a mano desde otra rama,\n'
        + '   o `main` se reescribió. Las dos cosas hay que mirarlas a mano.',
    };
  }

  // ── 🔴 LA MAGNITUD, Y ES LO QUE HACE QUE ESTO NO DÉ FALSOS POSITIVOS ───────────────────
  //
  // Lo que NO se mide es «horas desde el último commit en `main`». Con esa magnitud, un sábado
  // tranquilo cantaría sin que hubiera pasado nada.
  //
  // Lo que se mide es el HUECO: si el sha de producción y el HEAD de `main` son IGUALES, verde
  // **dé la hora que dé**. Nueve días de silencio con producción al día no son un fallo: son un
  // puente. El reloj sólo corre cuando hay hueco — y entonces cuenta desde que se abrió.
  if (!commitsPorDelante) {
    return {
      veredicto: AL_DIA, salida: 0, horas: 0,
      titulo: 'producción dice ' + version.slice(0, 8) + ' · `main` está en '
        + String(shaDeMain || '?').slice(0, 8) + ' · sin hueco',
      detalle: '',
    };
  }

  // ── El dato que importa: cuánto lleva SIN LLEGAR el commit más antiguo que falta ────────
  if (!Number.isFinite(epochDelPrimeroSinDesplegar) || !Number.isFinite(ahoraEpoch)) {
    return ciego('no se pudo fechar el commit más antiguo sin desplegar.',
      '   Hay ' + commitsPorDelante + ' commit(s) por delante y no se sabe desde cuándo.');
  }
  const horas = (ahoraEpoch - epochDelPrimeroSinDesplegar) / 3600;

  if (horas <= margenHoras) {
    return {
      veredicto: AL_DIA, salida: 0, horas,
      // 🔴 OBSERVA, NO AFIRMA. «producción está desplegada» es una afirmación en presente sobre
      // el mecanismo, y no dice nada sobre si lo está — es el defecto nº 14, que nos ha mordido
      // esta semana. Lo que se escribe son las TRES lecturas y el hueco entre ellas.
      titulo: 'producción dice ' + version.slice(0, 8) + ' · `main` está en '
        + String(shaDeMain || '?').slice(0, 8) + ' · ' + horas.toFixed(1) + ' h de hueco (margen '
        + margenHoras + ' h)',
      detalle: '   ' + commitsPorDelante + ' commit(s) sin llegar. Un despliegue en curso se lee así.',
    };
  }

  return {
    veredicto: ATRASADO, salida: SALIDA_ATRASADO, horas,
    titulo: '🔴 producción dice ' + version.slice(0, 8) + ' · `main` está en '
      + String(shaDeMain || '?').slice(0, 8) + ' · ' + horas.toFixed(1) + ' h de hueco (margen '
      + margenHoras + ' h)',
    detalle: '   commits de `main` que producción no dice tener: ' + commitsPorDelante + '\n'
      + '   el más antiguo lleva ' + horas.toFixed(1) + ' h sin llegar.\n\n'
      + '   ⚠️ LA WEB PUEDE ESTAR FUNCIONANDO PERFECTAMENTE Y AUN ASÍ SER ESTO. Cuando un\n'
      + '   despliegue falla el healthcheck, Railway mantiene vivo el anterior: no hay caída,\n'
      + '   no hay alerta, y el síntoma es «no cambia nada». Así se perdieron nueve días.\n'
      + '   Primer sitio donde mirar: los logs de arranque. Si es `schemaDrift`, dirá qué\n'
      + '   tabla y qué columna faltan, y entonces falta un `ALTER` en producción.',
  };
}
