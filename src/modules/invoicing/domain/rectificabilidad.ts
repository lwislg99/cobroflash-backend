// src/modules/invoicing/domain/rectificabilidad.ts — SCRUM-308
//
// ¿SE PUEDE RECTIFICAR ESTA FACTURA? Solo eso, y en funciones puras: la decisión se prueba sin
// levantar la app, y la ruta se limita a preguntar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// `POST /:id/rectify` comprobaba tres cosas —que la original no fuera ya una R1, que no tuviera
// ya rectificativa, y que no fuera un justificante— y **no miraba el `status`**. Así que se podía
// emitir una rectificativa **sobre una factura ANULADA**: un documento que corrige algo que ya se
// declaró sin efecto. SCRUM-308 lo caracterizó (el test decía «HOY se emite, y NO está
// bendecido») y dejó el bloqueo para este ticket.
//
// Y con la regla 29 delante, el coste es asimétrico y no se recupera: **una factura emitida no se
// borra**. Si se emite de más, se queda — y corregirla exige otra rectificativa, que es
// exactamente el documento que sobraba.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ ES UNA LISTA BLANCA, Y ÉSE ES EL SUELO DEL TICKET
//
// La forma fácil sería `if (status === 'annulled') bloquear`. **No se hace**, porque falla hacia
// el lado permisivo: un `status` nulo, ilegible, o uno NUEVO que alguien añada mañana pasarían la
// comprobación y emitirían. Aquí solo se rectifica lo que está **explícitamente permitido**;
// cualquier otra cosa —incluido no saber— se bloquea.
//
// Equivocarse hacia lo estricto cuesta un 409 que el profesional entiende y puede consultar.
// Equivocarse hacia lo permisivo emite un documento fiscal que no se deshace.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// REGLA 38 · ESTO NO CAMBIA CÓMO SE EMITE
//
// No toca la numeración, ni el sellado, ni las líneas, ni el orden de la transacción. Es una
// PUERTA que se pregunta **antes** de todo eso — la misma forma que ya tienen los otros tres
// rechazos de la ruta. Autorizado explícitamente: «si el arreglo es AÑADIR una comprobación de
// estado antes de emitir, adelante».

/**
 * Los estados desde los que una factura SÍ puede rectificarse. Lista CERRADA.
 *
 * `pending` y `paid` son los dos estados vivos de una factura (Parte L). `annulled` queda fuera a
 * propósito, y cualquier estado futuro también hasta que alguien lo añada aquí a conciencia:
 * añadir un valor al schema no puede abrir una puerta fiscal sin que nadie lo decida.
 */
export const ESTADOS_RECTIFICABLES = ['pending', 'paid'] as const;
export type EstadoRectificable = (typeof ESTADOS_RECTIFICABLES)[number];

/** Códigos NOMBRADOS. Un 409 sin nombre obliga a quien lo recibe a adivinar qué pasó. */
export const ERROR_RECTIFICAR_ANULADA = 'cannot_rectify_annulled';
export const ERROR_RECTIFICAR_ESTADO_DESCONOCIDO = 'cannot_rectify_unknown_status';

export type VeredictoRectificar =
  | { ok: true; estado: EstadoRectificable }
  | { ok: false; error: string };

/**
 * ¿Se puede rectificar una factura en este `status`?
 *
 * `annulled` tiene su propio código porque es un caso REAL y frecuente que el profesional puede
 * entender —«esta factura ya está anulada»—, mientras que un estado desconocido es un síntoma de
 * otra cosa (dato corrupto, estado nuevo sin declarar) y merece un nombre distinto. Aplanar los
 * dos en un solo error haría que el segundo se leyera como el primero y nadie investigaría.
 */
export function puedeRectificarse(status: unknown): VeredictoRectificar {
  if (status === 'annulled') {
    return { ok: false, error: ERROR_RECTIFICAR_ANULADA };
  }
  if (typeof status === 'string' && (ESTADOS_RECTIFICABLES as readonly string[]).includes(status)) {
    return { ok: true, estado: status as EstadoRectificable };
  }
  // Todo lo demás —null, undefined, un número, una cadena vacía, un estado nuevo— se BLOQUEA.
  // No saber en qué estado está una factura no es permiso para rectificarla.
  return { ok: false, error: ERROR_RECTIFICAR_ESTADO_DESCONOCIDO };
}
