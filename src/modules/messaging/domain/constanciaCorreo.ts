// src/modules/messaging/domain/constanciaCorreo.ts — SCRUM-475.
//
// QUÉ PASÓ CON ESTE CORREO. Puro: sin BD, sin red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, MEDIDO (no contado)
//
//   · **6 de 6** llamadas al proveedor **descartan lo que contesta** — `await axios.post(…)` como
//     sentencia suelta. El identificador del mensaje llega y se tira.
//   · **4 de 7** llamadores **se tragan el fallo**, y uno es MUDO del todo:
//     `sendMerchantPaymentEmail(…).catch(() => {})` — el correo que le dice al PROFESIONAL que le
//     han pagado. Si falla, no queda ni una línea de log.
//   · Los dos que SÍ avisan (`invoicesAdmin`, `quotesAdmin`) son trabajo de SCRUM-126 y contestan
//     `200 + sent:false`. El usuario se entera **y no queda constancia de nada**.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CRITERIO QUE DECIDE ESTE FICHERO: NO SE INVENTA UN ESTADO QUE NO CONSTA
//
// El embudo de WhatsApp (`WhatsAppMessage`: `queued→sent→delivered→read`) avanza porque un webhook
// de Meta lo empuja. Mientras el proveedor de correo no diga que entregó, el estado es
// **`enviado_sin_confirmacion`**, y eso NO es un hueco: es el dato. Igual que el cubo sin-método y
// que el `cobros.csv` que sale vacío cuando no consta la fecha.
//
// 🔴 `entregado` SOLO puede venir de un aviso del proveedor. Ninguna otra entrada lo produce, y hay
// test que lo fija: si alguien hace que un envío aceptado se marque «entregado», cae.
//
// ⚠️ LO QUE ESTE MÓDULO NO HACE, y por qué: **no persiste**. La constancia necesita una tabla
// propia —el embudo tiene que AVANZAR cuando llega el rebote, y hay que encontrar la fila por el id
// del proveedor—, y `prisma/schema.prisma` es del fundador. El diff está preparado en
// `docs/master/SCRUM-475.md` y **no se ha aplicado**. Hasta entonces esto decide el estado; nadie
// lo guarda todavía.

/** Los estados del embudo. Cerrado a propósito: inventar uno es el defecto que esto cierra. */
export const ESTADOS_CORREO = [
  'aceptado_sin_confirmacion', // el proveedor lo aceptó y dio identificador. NO es «entregado».
  'aceptado_sin_identificador', // lo aceptó y no dio nada con qué seguirlo. Se dice, no se supone.
  'fallo_envio',               // no salió, y sabemos por qué.
  'entregado',                 // SOLO desde un aviso del proveedor.
  'rebotado',                  // idem. El mínimo irrenunciable: esto no se pierde en silencio.
  'reclamado',                 // marcado como spam por el destinatario.
] as const;

export type EstadoCorreo = (typeof ESTADOS_CORREO)[number];

export type Constancia = {
  estado: EstadoCorreo;
  /** El id del proveedor, si lo dio. `null` = no consta, y se guarda como tal. */
  idProveedor: string | null;
  /** Motivo legible cuando el estado es de fallo. `null` si no aplica. */
  motivo: string | null;
};

/**
 * Qué consta tras INTENTAR un envío. `respuesta` es lo que devolvió el proveedor tal cual.
 *
 * ⚠️ No se asume la forma de esa respuesta. Si trae un `id` utilizable, se guarda; si no, el
 * estado lo dice (`aceptado_sin_identificador`) en vez de fabricar uno. Eso también protege del
 * caso en el que el proveedor cambie su contrato: el día que deje de mandar `id`, esto se ve en el
 * estado en vez de quedarse en un `undefined` guardado como si fuera un identificador.
 */
export function constanciaDeEnvio(respuesta: unknown): Constancia {
  const id = idDeLaRespuesta(respuesta);
  return {
    estado: id ? 'aceptado_sin_confirmacion' : 'aceptado_sin_identificador',
    idProveedor: id,
    motivo: null,
  };
}

/** Qué consta cuando el envío revienta. El motivo NO puede perderse: es todo lo que se sabe. */
export function constanciaDeFallo(error: unknown): Constancia {
  const e = error as { message?: unknown; code?: unknown } | null | undefined;
  const motivo = [e?.code, e?.message].filter((x) => typeof x === 'string' && x).join(': ');
  return {
    estado: 'fallo_envio',
    idProveedor: null,
    // «error desconocido» es peor que nada porque parece información: se dice que no consta.
    motivo: motivo || 'sin detalle del proveedor',
  };
}

/**
 * El identificador del mensaje, si la respuesta trae uno utilizable.
 *
 * Se busca en `data.id` y en `id` porque un cliente HTTP envuelve el cuerpo y otro no; y se exige
 * que sea una cadena NO vacía. Cualquier otra cosa devuelve `null` — «no consta».
 */
export function idDeLaRespuesta(respuesta: unknown): string | null {
  const r = respuesta as { id?: unknown; data?: { id?: unknown } } | null | undefined;
  for (const candidato of [r?.data?.id, r?.id]) {
    if (typeof candidato === 'string' && candidato.trim()) return candidato.trim();
  }
  return null;
}

/**
 * Cómo AVANZA el embudo cuando llega un aviso del proveedor.
 *
 * ⚠️ Un aviso NO puede retroceder el estado: si ya consta un rebote, un `delivered` que llega
 * tarde no lo borra. El orden es el del embudo de WhatsApp, y los finales de fallo mandan porque
 * son los que alguien tiene que mirar.
 */
const RANGO: Record<EstadoCorreo, number> = {
  aceptado_sin_identificador: 0,
  aceptado_sin_confirmacion: 1,
  entregado: 2,
  reclamado: 3,
  rebotado: 4,
  fallo_envio: 4,
};

export function avanzar(actual: EstadoCorreo, aviso: EstadoCorreo): EstadoCorreo {
  return RANGO[aviso] >= RANGO[actual] ? aviso : actual;
}
