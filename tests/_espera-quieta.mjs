// tests/_espera-quieta.mjs — SCRUM-681
//
// ESPERAR LA CONDICIÓN, NO EL RELOJ. Y un plazo vencido NO produce veredicto.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ UNA ESPERA FIJA ES PEOR QUE UN TOPE QUE SE PASA
//
// Un tope que se pasa produce un ROJO por lentitud, y un rojo se ve. Una espera fija no: cuando
// la máquina va cargada, `setTimeout(1500)` **no ralentiza el test — lo hace comprobar algo que
// todavía no ha ocurrido**. Y si lo que se comprueba es un NEGATIVO —«el bot no respondió otra
// vez», «no duplicó»— el resultado es VERDE. Un verde que no prueba nada, sin que nadie lo sepa.
//
// Los tres asserts de `bot-suite` que colgaban de un `setTimeout(1500)` son exactamente de ese
// tipo: «no debe responder de nuevo», «no duplica», «debe estar MUDO».
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES PROPIEDADES
//
//  1. Se espera a la CONDICIÓN. El plazo es solo el techo, no la medida.
//  2. Un techo vencido **NO produce veredicto**: LANZA diciendo NO MEDIDO. Nunca se sigue como si
//     la condición se hubiera cumplido, que es lo que hacía `waitOutbox` — devolvía en silencio y
//     el assert siguiente corría contra un estado a medias. Medido: **23 llamadas, y ninguna mira
//     lo que devuelve.**
//  3. Una medida cortada no se cuenta como completa: el mensaje dice hasta dónde se miró.

/** El reloj y el sueño entran por parámetro: así esto se prueba entero sin esperar de verdad. */
const RELOJ = { ahora: () => Date.now(), dormir: (ms) => new Promise((r) => setTimeout(r, ms)) };

/** Lo que se lanza cuando el techo vence. Tipado por su nombre para poder distinguirlo. */
export class NoMedido extends Error {
  constructor(mensaje) { super(mensaje); this.name = 'NoMedido'; }
}

/**
 * Espera hasta que `condicion()` sea cierta. Si el techo vence antes, LANZA.
 *
 * @throws {NoMedido} el techo venció y la condición no llegó. NO se devuelve nada: devolver aquí
 *   es exactamente el defecto — quien llama seguiría y comprobaría un estado a medias.
 */
export async function esperarCondicion(condicion, opciones = {}) {
  const { techoMs = 6000, pasoMs = 100, que = 'la condición', ahora = RELOJ.ahora, dormir = RELOJ.dormir } = opciones;
  const t0 = ahora();
  while (!(await condicion())) {
    if (ahora() - t0 >= techoMs) {
      throw new NoMedido(
        `NO MEDIDO · se esperaba «${que}» y el techo de ${techoMs} ms venció sin que llegara.\n`
        + `  Ese número es HASTA DÓNDE SE MIRÓ, no lo que tardó: lo que habría tardado no lo sabe\n`
        + '  nadie, porque se dejó de mirar.\n'
        + '  🔴 Esto NO es «no ha pasado nada»: es que no se ha llegado a comprobar. Seguir aquí\n'
        + '  daría un veredicto sobre un estado a medias — y si lo que se comprueba es un NEGATIVO,\n'
        + '  ese veredicto sería VERDE y no probaría nada.',
      );
    }
    await dormir(pasoMs);
  }
  return ahora() - t0;
}

/**
 * Espera a que algo deje de MOVERSE: `medir()` devuelve el mismo valor durante `quietoMs`.
 *
 * Es la forma correcta de sostener un assert NEGATIVO. No se puede «esperar a que no pase nada»
 * sondeando una condición —no hay condición—, pero sí se puede esperar a que el sistema esté
 * QUIETO, y entonces afirmar sobre él.
 *
 * @throws {NoMedido} el techo venció y seguía moviéndose. Afirmar «no llegó nada más» mientras
 *   todavía están llegando cosas es justamente el verde falso que este módulo existe para impedir.
 */
export async function esperarQuieto(medir, opciones = {}) {
  const {
    quietoMs = 900, techoMs = 6000, pasoMs = 120, que = 'el buzón',
    ahora = RELOJ.ahora, dormir = RELOJ.dormir,
  } = opciones;
  const t0 = ahora();
  let ultimo = await medir();
  let desde = ahora();
  while (ahora() - t0 < techoMs) {
    await dormir(pasoMs);
    const v = await medir();
    if (v !== ultimo) { ultimo = v; desde = ahora(); continue; }
    if (ahora() - desde >= quietoMs) return ahora() - t0;
  }
  throw new NoMedido(
    `NO MEDIDO · «${que}» seguía moviéndose cuando venció el techo de ${techoMs} ms `
    + `(último valor: ${JSON.stringify(ultimo)}).\n`
    + '  🔴 No se puede afirmar que «no llegó nada más» mientras siguen llegando cosas. Antes esto\n'
    + '  era un `setTimeout` fijo: cuando la máquina iba cargada, el assert corría con el sistema\n'
    + '  todavía trabajando y salía VERDE sin haber probado nada.',
  );
}
