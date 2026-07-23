// tests/_ausencia.mjs — SCRUM-108
//
// Comprobar que algo NO está tiene una patología propia: **su rotura es indistinguible
// de su éxito**. Las dos producen el mismo verde. "La cadena no aparece" se cumple igual
// si el sistema está bien que si el assert dejó de poder coincidir — por un cambio de
// formato, un typo, un campo renombrado o una fixture que dejó de sembrarse.
//
// Y son justo los asserts que más importan: tenancy, PII, tokens que no deben viajar.
// Los que protegen lo que NO debe pasar.
//
// Origen: el canario de tenancy clavado en '9999.00' siguió verde SIN COMPROBAR NADA al
// pasar el formato a coma decimal (SCRUM-86 → SCRUM-108).
import assert from 'node:assert/strict';

/**
 * Afirma que `valor` NO está en `dondeNoDebeEstar`, pero SOLO después de comprobar que SÍ
 * está en `dondeSiDebeEstar`. Si la guarda falla, el canario está roto y hay que
 * arreglarlo — no es un pase.
 *
 * ⚠️ `dondeSiDebeEstar` es OBLIGATORIO a propósito. Si fuera opcional volveríamos a
 * depender de que cada autor se acuerde de escribirlo, que es exactamente el problema que
 * este helper existe para quitar de en medio. Omitirlo revienta con un mensaje explícito,
 * no pasa de largo.
 *
 * @param {string} dondeNoDebeEstar  Texto donde el valor NO puede aparecer (la fuga).
 * @param {string} valor             El canario.
 * @param {string} dondeSiDebeEstar  Texto donde el valor SÍ tiene que aparecer (la guarda).
 * @param {string} mensaje           Qué significa que aparezca donde no debe.
 */
export function assertAusenteConGuarda(dondeNoDebeEstar, valor, dondeSiDebeEstar, mensaje) {
  if (typeof dondeSiDebeEstar !== 'string') {
    throw new TypeError(
      'assertAusenteConGuarda: falta `dondeSiDebeEstar` (3er argumento, OBLIGATORIO).\n' +
      'Sin una guarda de presencia, este assert pasaría en verde el día que el valor deje\n' +
      'de existir por un cambio ajeno, sin comprobar nada. Ver SCRUM-108.',
    );
  }
  if (valor == null || valor === '') {
    throw new TypeError(
      `assertAusenteConGuarda: el valor buscado está vacío (${JSON.stringify(valor)}).\n` +
      'Un canario vacío nunca coincide: el assert pasaría siempre. Revisa la fixture.',
    );
  }

  const v = String(valor);

  // GUARDA primero: si esto falla, el canario dejó de ser capaz de detectar nada.
  assert.ok(
    dondeSiDebeEstar.includes(v),
    `🔴 CANARIO ROTO (no es un pase): "${v}" no aparece donde SÍ debería.\n` +
    `Mientras siga así, la comprobación de ausencia de al lado pasa EN VACÍO y no\n` +
    `verifica nada. Arregla el canario antes de mirar el otro assert. (SCRUM-108)\n` +
    `Contexto: ${mensaje}`,
  );

  assert.ok(!dondeNoDebeEstar.includes(v), mensaje);
}

/**
 * Igual, pero para varios valores contra la misma pareja de textos.
 */
export function assertTodosAusentesConGuarda(dondeNoDebeEstar, valores, dondeSiDebeEstar, mensaje) {
  for (const v of valores) {
    assertAusenteConGuarda(dondeNoDebeEstar, v, dondeSiDebeEstar, mensaje);
  }
}

/**
 * Variante para cuando la guarda es **otro valor en el MISMO sitio**.
 *
 * `assertAusenteConGuarda` sirve cuando el mismo valor debe estar en un sitio y no en
 * otro (el IBAN del merchant A: presente en su página, ausente en la de B). Pero el caso
 * del canario de tenancy es distinto: el nombre del merchant vecino no debería aparecer
 * en NINGUNA parte del paquete, así que no hay "sitio donde sí". Lo que se puede probar
 * es que **el mecanismo sigue vivo**: que los nombres de cliente aparecen ahí cuando son
 * del merchant propio. Si dejaran de aparecer —serializador cambiado, columna quitada,
 * fixture rota—, el canario dejaría de poder detectar una fuga y hay que saberlo.
 *
 * @param {string} donde          Texto a inspeccionar (la salida bajo prueba).
 * @param {string} valorAusente   Lo que NO puede aparecer (el canario ajeno).
 * @param {string} valorTestigo   Algo propio que SÍ tiene que aparecer, por la misma vía.
 * @param {string} mensaje        Qué significa que aparezca lo que no debe.
 */
export function assertAusenteConMecanismoVivo(donde, valorAusente, valorTestigo, mensaje) {
  if (typeof valorTestigo !== 'string' || valorTestigo === '') {
    throw new TypeError(
      'assertAusenteConMecanismoVivo: falta `valorTestigo` (3er argumento, OBLIGATORIO).\n' +
      'Sin él no se sabe si la salida es capaz de mostrar este tipo de dato, y la\n' +
      'comprobación de ausencia podría estar pasando en vacío. Ver SCRUM-108.',
    );
  }
  assert.ok(
    donde.includes(valorTestigo),
    `🔴 CANARIO ROTO (no es un pase): el testigo "${valorTestigo}" NO aparece en la salida.\n` +
    `Si un dato propio de este tipo ya no sale, la comprobación de ausencia de al lado no\n` +
    `puede detectar nada. Arregla esto antes de fiarte del otro assert. (SCRUM-108)\n` +
    `Contexto: ${mensaje}`,
  );
  assertAusente(donde, valorAusente, mensaje);
}

/** Ausencia a secas, con la comprobación de que el valor no está vacío. */
function assertAusente(donde, valor, mensaje) {
  if (valor == null || valor === '') {
    throw new TypeError(`El valor buscado está vacío (${JSON.stringify(valor)}): nunca coincidiría.`);
  }
  assert.ok(!donde.includes(String(valor)), mensaje);
}
