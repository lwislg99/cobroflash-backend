// src/modules/jobs/domain/albaranSinPresupuesto.ts — SCRUM-684
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UNA AVERÍA TAMBIÉN SE ENTREGA EN PAPEL
//
// ── LA ESCENA, que es UNA y no dos ──────────────────────────────────────────────────────────
// SCRUM-651 abrió el TRABAJO DIRECTO con estas palabras: «Llaman por una AVERÍA, va un técnico,
// la arregla. **Nadie presupuesta una urgencia**». ALB-02 (SCRUM-607) existe porque el
// profesional **tiene que dejar papel al irse**. Es la misma escena, y hasta hoy el producto
// permitía la primera mitad y prohibía la segunda.
//
// ── POR QUÉ EL GUARD DE SCRUM-257 NO ESTABA MAL, Y AUN ASÍ HAY QUE ACOTARLO ─────────────────
// El guard es del 5-ago y su comentario decía, **con razón entonces**: «la única vía de creación
// de `Job` es `job.service.ts`… no hay endpoint de trabajo manual». Era cierto. El 2-sep,
// SCRUM-651 abrió exactamente ese endpoint — **sin saber de este guard, y sin mencionar el
// albarán ni una vez**. Dos decisiones correctas que nadie reconcilió; el defecto nace de dos
// aciertos.
//
// ── 🔴 LA DISTINCIÓN REAL, MEDIDA: NO ES EL TRABAJO, ES LA LÍNEA ────────────────────────────
// Se buscó qué separa «aquí sigue haciendo falta presupuesto» de «esto es una avería», y **no es
// ninguno de los candidatos obvios**:
//
//   · `tipoOperacion` (SCRUM-66) es agrupación FISCAL —recapitulativa o factura al concluir— y
//     vale `TRABAJO_UNICO` por defecto en los DOS casos. No distingue.
//   · `tipoIntervencion` (SCRUM-651) es nullable y sin default: un trabajo de presupuesto
//     también lo tiene a `null`. No distingue.
//   · `quoteId` a secas ES la pregunta, no la respuesta: acotar por él sería el guard de hoy.
//
// Lo que de verdad depende del presupuesto en este camino es **UNA sola cosa**, y está medida:
// `quoteLineIndex` (SCRUM-367). `contarLineasDePresupuesto` devuelve `undefined` cuando el
// trabajo no tiene presupuesto, y entonces `validarLineas` **conserva el índice sin validarlo** —
// lo dice su propio comentario: «un enlace roto es peor que ningún enlace, porque C6 se lo
// creería y respondería “no queda nada por entregar” sobre una correspondencia que no existe».
//
// Así que el invariante que hay que sostener no es «no hay albarán sin presupuesto». Es:
//
//   🔴 **NINGUNA LÍNEA PUEDE DECIR QUE VIENE DE UN PRESUPUESTO QUE NO EXISTE.**
//
// Un albarán de avería **sin** líneas enlazadas no rompe nada: no hay correspondencia que
// mentir. Uno que trae `quoteLineIndex` sobre un trabajo sin presupuesto sí, y ése sigue siendo
// un 409 con su motivo.
//
// ── Y VA EN LAS DOS PUERTAS, porque hoy sólo estaba en una ──────────────────────────────────
// Medido: el `POST` traía el guard y el `PATCH` **no**. O sea que el agujero que el guard decía
// tapar ya estaba abierto por el otro lado — un albarán anterior al guard se podía parchear con
// cualquier índice y nada lo validaba. Aquí se cierra por los dos.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** El código que ya devolvía el guard. Se conserva: el dashboard y los tests lo conocen. */
// Sin `export` (SCRUM-411): su consumidor real es `veredictoAlbaranSinPresupuesto`, aquí al
// lado. Lo que sale por la API es el VALOR, y eso se prueba por la superficie pública.
const ERROR_SIN_PRESUPUESTO = 'job_without_quote';

/**
 * Las POSICIONES (base 0) de las líneas que dicen venir de un presupuesto.
 *
 * Se mira `quoteLineIndex` con el mismo criterio que `validarLineas`: `undefined`, `null` y `''`
 * son «no viene», y cualquier otra cosa es una afirmación de origen — incluida una basura, que
 * `validarLineas` rechazará después por su cuenta. Aquí no se juzga si el índice es válido: se
 * juzga si **afirma** un origen.
 */
// Sin `export` (SCRUM-411): sólo lo usa el veredicto de abajo. Sus bordes —el índice 0, la
// basura, el campo vacío— se ejercitan A TRAVÉS de él, que es donde de verdad deciden.
function lineasQueAfirmanOrigen(lineas: unknown): number[] {
  if (!Array.isArray(lineas)) return [];
  const out: number[] = [];
  for (let i = 0; i < lineas.length; i++) {
    const v = (lineas[i] as any)?.quoteLineIndex;
    if (v !== undefined && v !== null && v !== '') out.push(i);
  }
  return out;
}

/**
 * ¿Puede este albarán existir sobre este trabajo?
 *
 * @param tienePresupuesto  `Job.quoteId != null`. Se pasa YA RESUELTO —un booleano— y no el job
 *   entero: así esto es puro y su rojo se puede ejercitar sin base de datos, que es lo que hace
 *   que alguien lo ejercite.
 * @param lineas  lo que llega en el `body` (o lo que ya tiene el albarán al parchearlo).
 */
export function veredictoAlbaranSinPresupuesto(
  tienePresupuesto: boolean,
  lineas: unknown,
): { ok: true } | { ok: false; error: string; message: string } {
  if (tienePresupuesto) return { ok: true };

  const afirman = lineasQueAfirmanOrigen(lineas);
  if (afirman.length === 0) return { ok: true };

  // El mensaje NOMBRA qué líneas y por qué. Sin él, el dashboard enseñaría el código crudo —
  // `apiRequest` cae al identificador cuando no hay texto (SCRUM-275).
  const cuales = afirman.map((i) => i + 1).join(', ');
  return {
    ok: false,
    error: ERROR_SIN_PRESUPUESTO,
    message: afirman.length === 1
      ? `La línea ${cuales} dice venir de un presupuesto y este trabajo no tiene ninguno.`
      : `Las líneas ${cuales} dicen venir de un presupuesto y este trabajo no tiene ninguno.`,
  };
}

/**
 * ✅ MICROCOPY APROBADA POR EL ASESOR el 4-sep-2026, **provisional** a la espera del fundador. El
 * registro vive en `docs/master/SCRUM-684.md` y **no** en `docs/microcopy/`, que es el registro del
 * FUNDADOR y `constaAprobado()` lo barre (SCRUM-726).
 *
 * 🔴 EL TEXTO VIEJO NO SE PODÍA REUTILIZAR, y es el motivo de que hubiera que firmar uno nuevo:
 * decía «Este trabajo no tiene presupuesto; **no se puede crear un albarán**», cierto con el guard
 * de brocha gorda y **falso** desde que se acota — sí se puede, salvo para la línea que afirma un
 * origen que no existe. **Un mensaje aprobado que ha dejado de ser verdad es peor que uno con
 * marcador.**
 *
 * NOMBRA LA LÍNEA PRIMERO porque es lo que el profesional necesita para arreglarlo.
 *
 * 📏 LA CAJA, medida en navegador real con el CSS de verdad — `.modal-overlay > .modal >
 * .alert.error`, que es donde `jobDetailView.js` pinta este 409 (líneas 1471 y 2523):
 *
 *     929 px → caja 472,0 px · útil 444,0 px → **1 línea**
 *     390 px → caja 342,0 px · útil 314,0 px → **2 líneas**
 *
 * El peor caso es el plural con dos números (78 caracteres) y sigue en **2 líneas** en los dos
 * tamaños. La condición del asesor —que quepa en dos— se cumple con holgura.
 *
 * Cuántas ranuras esperan la firma del FUNDADOR. Se queda aunque llegue a 0: el día que este
 * rechazo gane un segundo texto, ése nace sin firma y este número tiene que subir.
 */
// Sin `export` (SCRUM-411): nadie lo importa — su guard lo lee del FUENTE, que es donde vive la
// declaración. Un export que sólo existe para que un test lo lea es un export huérfano.
const SIN_APROBAR = 1;
