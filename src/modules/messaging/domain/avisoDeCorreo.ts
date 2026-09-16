// src/modules/messaging/domain/avisoDeCorreo.ts — SCRUM-475 (fase 2B)
//
// QUÉ DICE UN AVISO DEL PROVEEDOR. Puro: sin BD, sin red, sin Express.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO ES UN MÓDULO Y NO CUATRO LÍNEAS DENTRO DE LA RUTA
//
// La ruta hace tres cosas —recibir, verificar la firma, aplicar— y solo la tercera necesita base de
// datos. Leer el aviso es lo único que tiene DECISIONES dentro (qué evento es, dónde está el
// identificador, qué hacer si no está), así que se saca aquí para poder probarlo con un objeto en
// la mano. Es el mismo reparto que `constanciaCorreo.ts` hace con la respuesta del envío.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL CRITERIO, QUE ES EL DEL TICKET ENTERO: NO SE INVENTA UN ESTADO QUE NO CONSTA
//
// Aquí eso se traduce en tres negativas, y las tres devuelven un motivo con nombre en vez de un
// valor por defecto:
//
//   · evento que no conocemos      → `evento_desconocido`. NO se traduce a un estado «parecido».
//     Si el proveedor estrena `email.opened` mañana, esto tiene que decir «no sé qué es esto» en
//     vez de decidir. Lo fija `estadoDelAviso` en `firmaResend.ts`, que ya devuelve `null`.
//   · aviso sin identificador      → `sin_identificador`. Sin él no hay fila que buscar, y buscarla
//     «por el destinatario y la hora» sería adivinar cuál de sus correos es.
//   · cuerpo que no es un objeto   → `cuerpo_ilegible`. Firma buena y JSON roto no es un ataque
//     (`verificarFirmaResend` ya lo deja pasar con `cuerpo: null`): es el proveedor mandando algo
//     que no esperábamos, y se dice.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ DÓNDE SE BUSCA EL IDENTIFICADOR, Y POR QUÉ EN VARIOS SITIOS
//
// El envío guarda en `provider_id` lo que `idDeLaRespuesta` sacó de la respuesta HTTP, y ese
// ayudante ya mira DOS formas por el mismo motivo que aquí se miran cuatro: **un cliente HTTP
// envuelve el cuerpo y otro no**, y el aviso del webhook no tiene por qué traer el id en el mismo
// sitio que la respuesta del envío. Se prueban las formas conocidas en orden y, si ninguna trae una
// cadena no vacía, **se dice que no consta** en vez de coger el primer campo que suene parecido.
//
// 🔴 Esto NO es una afirmación sobre el contrato del proveedor: es la lista de sitios donde se ha
// mirado. Si un día llega un aviso legítimo y sale `sin_identificador`, el motivo lo nombra y se
// añade la forma que faltaba — que es exactamente lo que no podría hacerse si aquí se hubiera
// puesto un valor por defecto.
import { estadoDelAviso } from '../../../integrations/firmaResend';
import type { EstadoCorreo } from './constanciaCorreo';

/** Los sitios donde se busca el identificador del mensaje, en orden. */
const RUTAS_DEL_ID = [
  (c: Record<string, unknown>) => (c.data as Record<string, unknown> | undefined)?.email_id,
  (c: Record<string, unknown>) => (c.data as Record<string, unknown> | undefined)?.id,
  (c: Record<string, unknown>) => c.email_id,
  (c: Record<string, unknown>) => c.id,
] as const;

/** Los sitios donde se busca el nombre del evento, en orden. */
const RUTAS_DEL_EVENTO = [
  (c: Record<string, unknown>) => c.type,
  (c: Record<string, unknown>) => c.event,
] as const;

export type MotivoIlegible = 'cuerpo_ilegible' | 'evento_desconocido' | 'sin_identificador';

export type LecturaDelAviso =
  | { ok: true; evento: string; idProveedor: string; estado: EstadoCorreo }
  | { ok: false; motivo: MotivoIlegible; detalle: string };

const cadena = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

/**
 * Lee un aviso YA VERIFICADO. No comprueba la firma: eso es de `verificarFirmaResend`, y mezclarlo
 * aquí haría que un cuerpo bien formado pareciera legítimo sin haberlo comprobado nadie.
 */
export function leerAviso(cuerpo: unknown): LecturaDelAviso {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return {
      ok: false,
      motivo: 'cuerpo_ilegible',
      detalle: `el aviso no es un objeto (llegó ${cuerpo === null ? 'null' : typeof cuerpo}). La ` +
        'firma pudo ser buena — eso lo dice el verificador— pero aquí no hay nada que leer.',
    };
  }
  const c = cuerpo as Record<string, unknown>;

  const evento = RUTAS_DEL_EVENTO.map((f) => cadena(f(c))).find(Boolean) ?? '';
  const estado = estadoDelAviso(evento);
  if (!estado) {
    return {
      ok: false,
      motivo: 'evento_desconocido',
      detalle: `«${evento || '(sin tipo)'}» no es un evento conocido. NO se traduce a ningún estado: ` +
        'si el proveedor ha estrenado uno, se añade a `EVENTOS_RESEND` a conciencia — inventarle un ' +
        'estado parecido es exactamente lo que este ticket existe para impedir.',
    };
  }

  const idProveedor = RUTAS_DEL_ID.map((f) => cadena(f(c))).find(Boolean) ?? null;
  if (!idProveedor) {
    return {
      ok: false,
      motivo: 'sin_identificador',
      detalle: 'el aviso no trae identificador del mensaje en ninguna de las formas conocidas ' +
        '(`data.email_id`, `data.id`, `email_id`, `id`). Sin él no hay fila que buscar, y buscarla ' +
        'por destinatario y hora sería adivinar cuál de sus correos es.',
    };
  }

  return { ok: true, evento, idProveedor, estado };
}
