// scripts/_ritmo-de-despliegue.mjs — SCRUM-716 (pieza 2 de tres)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿PRODUCCIÓN ESTÁ CONGELADA, O SÓLO VA POR DETRÁS?
//
// El vigía de `_vigilante-de-despliegue.mjs` mira UN instante: sabe decir «hay hueco», no sabe
// decir si el hueco se está cerrando. Y son cosas muy distintas:
//
//   · CONGELADO  — nueve días sin desplegar, treinta healthchecks fallando y la web en pie. Es
//                  el incidente que hizo nacer al vigía.
//   · DESPLIEGA  — se despliega más despacio de lo que se mergea. Molesto, no roto.
//
// Medido el 6-sep-2026, dos lecturas separadas por dos horas:
//
//     20:21 UTC → prod ff4e1c4a · main 388dc045 · hueco  9,5 h ·  8 commits
//     22:12 UTC → prod 50312d32 · main c6c84261 · hueco 10,4 h · 10 commits
//
// **Producción SE MOVIÓ.** El vigía pintó las dos igual —«atrasado»— y eso mandó a buscar un
// healthcheck que no estaba roto, y bloqueó de hecho cinco ramas media jornada. El discriminador
// es barato y está ahí delante: **`prod` distinto entre dos lecturas = despliega; igual = no**.
//
// ── 🔴 POR QUÉ EL TERCER VALOR ES OBLIGATORIO ────────────────────────────────────────────────
//
// Sin lectura anterior NO HAY CONGELADO: hay ignorancia. Es EXACTAMENTE el defecto que cerró
// SCRUM-716 por la otra cara —allí `null` (no se pudo contar) entraba por la misma puerta que `0`
// (no hay hueco) y el vigía decía «al día» sin haber mirado—. Reintroducirlo en la pieza que
// existe para no repetirlo sería el colmo, así que `NO_SE_SABE` es un valor de primera y no un
// respaldo silencioso.
//
// Y hoy **no es un caso raro: es el único que se emitiría**. Medido sobre
// `.github/workflows/vigia-despliegue.yml`: el job corre en `ubuntu-latest` con
// `actions/checkout@v4`, o sea runner y clon NUEVOS cada vez; no tiene `actions/cache`, ni
// `upload-artifact`, ni `download-artifact`; y va con `permissions: contents: read`, así que no
// podría ni escribir en el repositorio. **Entre dos ejecuciones no sobrevive nada.** Esta función
// no arregla eso —es la pieza 2— pero nace sabiéndolo: mientras no exista la pieza 1, lo honrado
// es contestar `NO_SE_SABE`, y no un «congelado» que nadie ha medido.
//
// ── LO QUE ESTA PIEZA NO HACE ────────────────────────────────────────────────────────────────
// 🔴 NO LA LLAMA NADIE. Es deliberado: conectarla al vigía necesita la autorización del fundador
//    sobre `vigilante-de-despliegue.mjs`, que no está dada. Cuando lo esté, conectarla es una
//    línea, y este módulo ya viene con sus casos probados.
// 🔴 NO DECIDE CÓDIGO DE SALIDA. Qué se pone en rojo con cada ritmo es decisión de producto —
//    cambia qué checks bloquean— y no se toma aquí.
// 🔴 NO TIENE RELOJ, NI RED, NI GIT. Misma disciplina que su hermano: se le dan los datos.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Producción se movió entre las dos lecturas: despliega, aunque vaya por detrás. */
export const DESPLIEGA = 'despliega';
/** Producción NO se movió entre las dos lecturas. Con hueco, esto es lo que costó nueve días. */
export const CONGELADO = 'congelado';
/** No hay con qué comparar. **No es congelado**: es que no se sabe. */
export const NO_SE_SABE = 'no-se-sabe';

/**
 * Un sha legible: 7 a 40 hexadecimales. Ni un número del `Date.now()` que publica el fallback de
 * `env.ts`, ni una cadena vacía, ni `undefined`.
 *
 * Se normaliza a minúsculas y sin espacios porque las dos lecturas pueden venir de sitios
 * distintos —una del renglón de constancia, otra de `/version`— y un `\n` de más no es una
 * diferencia de despliegue.
 */
const ES_SHA = /^[0-9a-f]{7,40}$/;
/**
 * 🔴 Y SE RECHAZA LO QUE SEA TODO DÍGITOS, que es un caso REAL y me cazó mi propio test.
 *
 * `env.ts` publica `RAILWAY_GIT_COMMIT_SHA || String(Date.now())`. Sin la variable, producción
 * publica **`1788742571305`** — trece caracteres que son TODOS hexadecimales válidos, así que
 * `ES_SHA` los daba por bueno. Dos lecturas de ésas darían «despliega» cada vez, porque el reloj
 * siempre avanza: una alarma que dice que todo va bien justo cuando no se sabe qué corre.
 *
 * ⚠️ EL PRECIO, DECLARADO: un sha abreviado que salga todo dígitos también se rechaza. Con 8
 * caracteres eso pasa en torno al 2 % de las veces ((10/16)^8), y entonces esta pieza dirá «no se
 * sabe» pudiendo haber sabido. Se acepta a propósito porque **el error va en la dirección
 * segura**: callar de más, nunca inventar un movimiento que no se ha medido.
 */
const TODO_DIGITOS = /^[0-9]+$/;
function shaLegible(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (!ES_SHA.test(s) || TODO_DIGITOS.test(s)) return null;
  return s;
}

/**
 * ¿Son el mismo commit? `git` abrevia, así que una lectura puede traer 8 caracteres y la otra 40.
 *
 * 🔴 SE COMPARA POR PREFIJO, y se dice el riesgo en vez de esconderlo: dos commits distintos que
 * compartan los primeros 8 hexadecimales se leerían como el mismo, y esta función diría
 * «congelado» habiendo desplegado. Con 8 caracteres eso es improbable, pero **improbable no es
 * imposible**, y el que lea esto tiene que saberlo. La alternativa —exigir la misma longitud—
 * daría `NO_SE_SABE` cada vez que se comparase una constancia (8) con una lectura de `/version`
 * (40), o sea siempre, y eso sí que rompe la pieza.
 */
function mismoCommit(a, b) {
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  return largo.startsWith(corto);
}

/**
 * El ritmo de despliegue a partir de DOS lecturas.
 *
 * @param anterior  `{ versionDeProduccion }` de la lectura previa, o `null` si no la hay
 * @param actual    `{ versionDeProduccion }` de la lectura de ahora
 * @returns `{ ritmo, motivo }` — `motivo` explica SIEMPRE, también cuando se sabe: quien lee un
 *          veredicto de una línea en un log necesita saber sobre qué se decidió.
 */
export function ritmoDeDespliegue(anterior, actual) {
  const noSeSabe = (motivo) => ({ ritmo: NO_SE_SABE, motivo });

  // ── SUELO 1 · sin lectura anterior no hay comparación. Hoy, el caso permanente ──────────
  if (anterior == null) {
    return noSeSabe('no hay lectura anterior con la que comparar. NO es «congelado»: es que '
      + 'nadie ha mirado antes. Hoy en CI es el caso normal, porque el runner arranca limpio.');
  }

  // ── SUELO 2 · una lectura que no se puede leer no es una lectura ────────────────────────
  const antes = shaLegible(anterior && anterior.versionDeProduccion);
  const ahora = shaLegible(actual && actual.versionDeProduccion);
  if (antes === null) {
    return noSeSabe('la lectura anterior no publica un sha legible, así que no hay de dónde '
      + 'partir. Es el fallback de `env.ts`: sin `RAILWAY_GIT_COMMIT_SHA`, producción publica '
      + 'un número y no un commit.');
  }
  if (ahora === null) {
    return noSeSabe('la lectura de ahora no publica un sha legible. Con una sola punta no se '
      + 'compara nada, y decir «congelado» sería inventarse la mitad que falta.');
  }

  // ── EL DISCRIMINADOR, que es toda la pieza ─────────────────────────────────────────────
  if (mismoCommit(antes, ahora)) {
    return {
      ritmo: CONGELADO,
      motivo: `producción sigue en ${antes.slice(0, 8)} entre las dos lecturas: NO se ha movido.`,
    };
  }
  return {
    ritmo: DESPLIEGA,
    motivo: `producción pasó de ${antes.slice(0, 8)} a ${ahora.slice(0, 8)}: SÍ se mueve, `
      + 'aunque vaya por detrás de `main`.',
  };
}
