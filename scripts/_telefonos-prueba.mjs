// scripts/_telefonos-prueba.mjs — SCRUM-262: los teléfonos de los DATOS DE PRUEBA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL PROBLEMA, medido antes de escribir esto
//
// Los seeds y las fixtures fabricaban teléfonos como `34600000001` o `34611000002`. **`+34 6XX`
// es rango de móvil español ordinario**: esos números pueden estar asignados a personas reales,
// que no han pedido nada y no saben que existimos. Y no es teórico —lo midió SCRUM-180— ni es
// solo cosa de la suite: hay TRES crons que envían WhatsApp a teléfonos guardados en la BD y
// **ninguno filtra al merchant demo**:
//
//   · sendPendingReminders        (cada hora)    → quote.customer.phone
//   · sendInvoicePaymentReminders (diario 10:00) → customer.phone
//   · runMaintenanceProposals     (diario 10:00) → merchant.whatsappPhone y customer.phone
//
// O sea: un dato de prueba sembrado es un destino real para un proceso automático. Lo único que
// lo frenaba era `demoSendBlocked` (V0-2), una lista blanca — y una lista blanca contradice el
// requisito de producto del máster (J0): se debe poder escribir a cualquier número que el
// profesional introduzca como cliente.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA SALIDA, y por qué es mejor que la lista
//
// Si el número sembrado **no puede pertenecer a nadie**, mandarle un WhatsApp no daña a un
// tercero, y entonces el freno sobra por construcción — no porque nadie pueda entrar en la
// cuenta, que es un argumento que depende de un buzón y de un panel de Railway, sino porque
// **no hay a quién dañar**. Se elimina el riesgo en vez de vigilarlo.
//
// EL RANGO: `34 0XX XXX XXX`. Un número español es `34` + 9 dígitos, y **ningún abonado empieza
// por 0** — ni móvil (6/7) ni fijo (8/9) ni servicios. Así que nada de este rango puede estar
// asignado, ni ahora ni después de una reasignación del plan de numeración.
//
// ⚠️ EL PATRÓN YA ESTABA EN EL REPO, SIN DECLARARSE: `34000000000` aparecía 4 veces. Alguien
// acertó y nadie lo escribió, así que el resto de los seeds siguió usando `34600…`. Esa es la
// diferencia entre que algo funcione y que se pueda razonar sobre ello — por eso esto es una
// constante con su porqué y no un literal repetido. Lo vigila
// `tests/scrum262-telefonos-de-prueba.test.mjs`.
//
// LO QUE ESTO NO ES: no es un freno de envío ni sustituye a ninguno. No impide escribir a un
// número real; hace que los NUESTROS no lo sean. Lo que el profesional introduzca como cliente
// sigue saliendo, que es el requisito.

/** Prefijo imposible de asignar: `34` (España) + `0`, que ningún abonado puede llevar. */
export const PREFIJO_IMPOSIBLE = '340';

/** Longitud total de un número español en E.164 sin `+`: `34` + 9 dígitos. */
const LARGO = 11;

/**
 * Teléfono de prueba número `n`, estable y único.
 * `telefonoDePrueba(1)` → `'34000000001'`.
 */
export function telefonoDePrueba(n) {
  const cuerpo = String(n).padStart(LARGO - PREFIJO_IMPOSIBLE.length, '0');
  if (cuerpo.length !== LARGO - PREFIJO_IMPOSIBLE.length) {
    throw new Error(`telefonoDePrueba: ${n} no cabe en el rango de prueba`);
  }
  return PREFIJO_IMPOSIBLE + cuerpo;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-629 · EL TRAMO NACIONAL SE DESTRUYE, Y EL NÚMERO COMPLETO NO. LOS DOS SON CIERTOS.
//
// MEDIDO, no razonado (barrido de 206 índices + búsqueda binaria de la frontera):
//
//   · `telefonoDePrueba(n)` COMPLETO  → `normalizePhone` lo devuelve INTACTO, para todo `n`
//     que quepa en el rango. Cero destruidos. Aquí no hay defecto.
//   · el TRAMO NACIONAL (los 9 dígitos sin el `34`) → se destruye para `n < 10.000.000`.
//
// POR QUÉ. El tramo de un índice pequeño empieza por `00` (`telefonoDePrueba(1)` → `000000001`),
// y `normalizePhone` trata el `00` como prefijo internacional y lo quita. Quedan 7 dígitos, no
// pasa su propio `^\d{8,15}$`, y devuelve **la cadena vacía**.
//
// 🔴 POR QUÉ ESO ES PEOR QUE UN FALLO. Un test de duplicados escrito con el par natural
// —el mismo número con y sin prefijo— compara `""` contra `""`. **Son iguales, y el test pasa
// sin haber ejercitado una sola línea.** No falla, no avisa, y da confianza. Comprobado
// montándolo y viéndolo en verde.
//
// LA FRONTERA, con número: el último que muere es `n = 9.999.999`; el primero que sobrevive es
// `n = 10.000.000`. No se calculó: se buscó por bisección y se comprobó a los dos lados.
//
// ⚠️ `normalizePhone` NO SE TOCA. Tiene ~40 llamadores y es el número al que se manda el
// WhatsApp; su tratamiento del `00` puede ser correcto para lo suyo. El defecto está aquí: en el
// generador que produce números que ella no puede procesar.
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Primer índice cuyo TRAMO NACIONAL sobrevive a una normalización E.164. MEDIDO por bisección
 * el 4-sep-2026, no deducido: `9.999.999` muere, `10.000.000` sobrevive.
 *
 * El número COMPLETO sobrevive con cualquier índice: esto sólo gobierna el tramo.
 */
export const PRIMER_INDICE_NACIONAL_ESTABLE = 10000000;

/**
 * El TRAMO NACIONAL del teléfono de prueba `n` — los 9 dígitos sin el `34`, que es lo que
 * guardaría un formulario donde el profesional teclea sin prefijo.
 *
 * 🔴 FALLA EN VOZ ALTA en la zona donde el tramo se destruiría, en vez de devolverlo. Ésta es la
 * razón de ser de la función: el `.slice(2)` escrito a mano en un test devuelve callando un
 * número que la normalización convierte en `""`, y ahí es donde nace el falso verde. El suelo
 * vive AQUÍ, en el sitio único, y no copiado en cada test — que es como se propagan estas cosas.
 */
export function tramoNacionalDePrueba(n) {
  if (n < PRIMER_INDICE_NACIONAL_ESTABLE) {
    throw new Error(
      `tramoNacionalDePrueba: el índice ${n} produce el tramo `
      + `«${telefonoDePrueba(n).slice(2)}», que empieza por «00» y una `
      + 'normalización E.164 lo convierte en la CADENA VACÍA — dos vacíos comparan iguales y el '
      + `test pasa sin medir nada. Usa un índice >= ${PRIMER_INDICE_NACIONAL_ESTABLE} `
      + '(p. ej. `tramoNacionalDePrueba(12345678)`). El número COMPLETO sí es válido con '
      + 'cualquier índice: para eso está `telefonoDePrueba(n)`.',
    );
  }
  return telefonoDePrueba(n).slice(2);
}

/**
 * ¿Es un teléfono del rango imposible? Tolera el `+` y los separadores, porque los datos de
 * prueba se escriben a veces con formato sucio a propósito.
 */
export function esTelefonoDePrueba(valor) {
  const limpio = String(valor ?? '').replace(/[\s\-()+]/g, '');
  return new RegExp(`^${PREFIJO_IMPOSIBLE}\\d{${LARGO - PREFIJO_IMPOSIBLE.length}}$`).test(limpio);
}
