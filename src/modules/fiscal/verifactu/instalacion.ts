// src/modules/fiscal/verifactu/instalacion.ts — SCRUM-524f/524g · LA INSTALACIÓN ES DEL COMERCIO, NO DE YAQU.
//
// Dos campos del bloque `SistemaInformatico` no describen al PRODUCTOR (eso es `productor.ts`)
// sino a CADA facturación que YaQu lleva dentro. Hasta SCRUM-524g iban fijos para todos («1» y
// «S»), y SCRUM-524e midió que los dos están mal para un SaaS:
//
//   · `NumeroInstalacion` — «cada una de esas facturaciones distintas […] debe tener un nº de
//     instalación propio y distinto al resto (pasado, presente o futuro) porque se consideran SIF
//     independientes» (FAQ de desarrolladores de la AEAT v1.3, 4-dic-2025, apdo. 4).
//   · `IndicadorMultiplesOT` — «deberá calcularse de forma independiente por cada usuario del SIF
//     SaaS (no a nivel global del SIF SaaS)»: `N` si el usuario sólo tiene una facturación (misma FAQ).
//
// `TipoUsoPosibleMultiOT` NO está aquí: describe lo que el SISTEMA permite, y sigue en `S`.
//
// Variante B del diseño 524f, elegida por el fundador (SCRUM-524 c.20291) y con su GO (regla 40,
// el comentario siguiente a c.20294): el número se DERIVA del `id`, sin columna y sin ALTER.

/**
 * El número de instalación de un comercio: su `id`. Es el «nº secuencial que no se repita nunca»
 * que recomienda la FAQ, y no se repite porque la secuencia de Postgres no reutiliza valores, ni
 * al borrar la fila (`borradoMerchant.ts`); y es estable porque una clave primaria no se reescribe
 * (la anonimización tampoco la toca). El comercio demo (id=1) declara «1», lo mismo que antes.
 * Lo que esto NO cubre: una base re-numerada (un `pg_dump` normal conserva los ids) cambiaría el
 * número de todos; la variante A (columna) lo cubría, y se descartó porque hoy nada lo necesita.
 */
export function numeroInstalacion(merchantId: number): string {
  return String(merchantId);
}

/**
 * Cuántas facturaciones tiene un usuario de YaQu. En YaQu el usuario del SaaS es la CUENTA, y la
 * cuenta ES el comercio: `Merchant.email` y `TeamMember.email` son `@unique` y cada `TeamMember`
 * cuelga de un solo `merchantId`, así que ningún acceso llega a dos comercios; y un comercio tiene
 * un solo NIF (`taxId`) y una sola serie de facturas. Si eso cambia, este número deja de ser 1 y
 * lo dice `tests/scrum524g-numero-instalacion-por-comercio.test.mjs`, que lee esas cosas del esquema.
 */
export const FACTURACIONES_POR_CUENTA = 1;

/** `IndicadorMultiplesOT`, calculado (anexo 2.6: «deberá obtenerlo automáticamente el sistema»). */
export function indicadorMultiplesOT(facturacionesDelUsuario: number): 'S' | 'N' {
  return facturacionesDelUsuario > 1 ? 'S' : 'N';
}
