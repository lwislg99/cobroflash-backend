// src/modules/exports/domain/portabilidadRegistro.ts — SCRUM-244 (punto 3, opción C MIXTA)
//
// EL REGISTRO DE QUE SE EJERCIÓ EL DERECHO. Fecha de solicitud y fecha de atención.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ PROBLEMA RESUELVE, Y NO ES «poder exportar»
//
// Exportar ya se puede (`/admin/exports/datos.zip`). Lo que hoy es imposible es **DEMOSTRAR
// que se atendió, y cuándo** — y eso es justamente lo que se incumple: el art. 12.3 del RGPD
// da **un mes desde la recepción de la solicitud**. Sin registro no hay forma de saber si un
// caso lleva tres días o cinco semanas, ni de probar después que se respondió a tiempo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ DOS INSTANTES Y NO UNO (decisión del fundador, 3-ago-2026 — opción C MIXTA)
//
// El profesional **solicita** desde su cuenta —eso arranca el plazo— y el fundador **ejecuta**
// tras revisar. Hay un humano en medio a propósito, así que son dos hechos separados en el
// tiempo, no dos nombres para el mismo. El autoservicio completo espera a que esté resuelto
// qué se conserva y qué se anonimiza: **un botón que borra facturas es peor que no tener botón.**
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ `AuditLog` Y NO UNA TABLA NUEVA
//
// Porque el mecanismo ya existe, ya se usa para lo mismo (`exportacion_fiscal`, `datos_exportados`)
// y **una tabla nueva sería un cambio de schema**, que es el único freno duro del proyecto.
// `AuditLog` ya trae lo que hace falta: `createdAt` (los dos instantes), `entityId` (para
// correlacionar la atención con SU solicitud) y los dos índices que las dos consultas necesitan
// —`[merchantId, action, createdAt]` y `[merchantId, entityType, entityId]`—, así que esto no
// añade ni una migración ni un índice.
//
// LA CORRELACIÓN, que es lo único no obvio: la fila de ATENCIÓN guarda en `entityId` el `id` de
// la fila de SOLICITUD. Así «lo pendiente» es una diferencia de conjuntos entre dos columnas
// indexadas, sin consultar dentro del JSON de `meta` y sin inventar un identificador propio.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ QUÉ PRUEBA CADA FILA Y QUÉ NO — mismo criterio que `exportacion_fiscal`
//
//   `portabilidad_solicitada`  prueba que ALGUIEN CON ACCESO A ESA CUENTA pidió sus datos y
//                              CUÁNDO. Es el hecho que arranca el plazo, y es el que no puede
//                              perderse: por eso es BLOQUEANTE, no fire-and-forget. Una
//                              solicitud que se pierde en silencio deja un plazo corriendo que
//                              nadie sabe que corre.
//   `portabilidad_atendida`    prueba que se marcó como atendida y cuándo. **NO prueba que el
//                              profesional recibiera el fichero** — eso ocurre fuera de aquí.
//                              Quien lea la fila tiene que saber qué está leyendo.
import type { ActorAudit } from '../../system/audit.service';
import { recordAuditOrThrow } from '../../system/audit.service';

export const ACCION_SOLICITADA = 'portabilidad_solicitada' as const;
export const ACCION_ATENDIDA = 'portabilidad_atendida' as const;
export const ENTIDAD = 'portabilidad' as const;

/**
 * El plazo del art. 12.3 es de **UN MES**, no de 30 días, y la diferencia no es pedantería:
 * en un mes de 31 días, contar 30 adelanta el vencimiento un día entero sobre una obligación
 * legal. Se calcula con el calendario y se deja que `Date` resuelva los meses cortos — el
 * 31 de enero + 1 mes cae en el 2 o 3 de marzo, que es más tarde que el 28, o sea el lado
 * seguro: nunca declara vencido algo que no lo está.
 */
export const PLAZO_MESES = 1;

/**
 * ⚠️ `setUTCMonth` y NO `setMonth`, y lo cazó el test al primer intento.
 *
 * `setMonth` trabaja en hora LOCAL. Medido con el proceso en `Europe/Madrid`: una solicitud del
 * 1-mar a las 10:00Z daba límite el 1-abr a las **09:00Z** — el cambio de hora (CET→CEST) cae en
 * medio y **se comía una hora del plazo**, siempre hacia el lado peligroso (vence antes de lo
 * que debe). Y peor que la hora: el resultado dependía del huso del SERVIDOR, así que el mismo
 * caso vencía en dos instantes distintos según dónde corriera el proceso. Un plazo legal no
 * puede depender de eso.
 */
export function fechaLimite(solicitadaEn: Date): Date {
  const limite = new Date(solicitadaEn.getTime());
  limite.setUTCMonth(limite.getUTCMonth() + PLAZO_MESES);
  return limite;
}

/** Días naturales transcurridos. Para informar, nunca para decidir el vencimiento. */
export function diasTranscurridos(solicitadaEn: Date, ahora: Date): number {
  return Math.floor((ahora.getTime() - solicitadaEn.getTime()) / 86_400_000);
}

/** Cliente mínimo que estas funciones necesitan. Inyectable: los tests corren sin BD. */
export interface ClienteRegistro {
  auditLog: {
    findMany: (args: any) => Promise<any[]>;
  };
}

/**
 * Registra la SOLICITUD y devuelve el id de su fila, que es lo que después identifica el caso.
 *
 * `recordAuditOrThrow` y no `recordAudit`: si esto falla, tiene que fallar RUIDOSAMENTE y que
 * el profesional vea el error. Registrar de menos es lo único que este módulo existe para
 * impedir — una solicitud perdida deja un plazo corriendo que nadie sabe que corre.
 */
export async function registrarSolicitud(
  cliente: any,
  params: { merchantId: number; actor: ActorAudit; ip?: string | null },
): Promise<number> {
  const fila = await recordAuditOrThrow(
    {
      merchantId: params.merchantId,
      teamMemberId: params.actor.teamMemberId ?? null,
      action: ACCION_SOLICITADA,
      entityType: ENTIDAD,
      entityId: null, // la solicitud ES esta fila: no apunta a nada, se apunta a ella
      ip: params.ip ?? null,
      meta: { actor: params.actor, plazoMeses: PLAZO_MESES },
    },
    cliente,
  );
  return (fila as any).id;
}

/**
 * Registra la ATENCIÓN, apuntando a la solicitud que cierra.
 *
 * `solicitudId` es OBLIGATORIO y no tiene default: una atención que no dice QUÉ solicitud cierra
 * no sirve para calcular ningún plazo, y sería exactamente la fila que parece cumplimiento sin
 * serlo.
 */
export async function registrarAtencion(
  cliente: any,
  params: { merchantId: number; solicitudId: number; actor: ActorAudit; ip?: string | null },
): Promise<void> {
  await recordAuditOrThrow(
    {
      merchantId: params.merchantId,
      teamMemberId: params.actor.teamMemberId ?? null,
      action: ACCION_ATENDIDA,
      entityType: ENTIDAD,
      entityId: params.solicitudId, // ← LA CORRELACIÓN
      ip: params.ip ?? null,
      meta: { actor: params.actor },
    },
    cliente,
  );
}

export type SolicitudPendiente = {
  solicitudId: number;
  merchantId: number;
  solicitadaEn: Date;
  dias: number;
  limite: Date;
  fueraDePlazo: boolean;
};

/**
 * LA CONSULTA QUE JUSTIFICA TODO ESTO: «¿cuántas solicitudes llevan más de N días sin atender?»
 *
 * Un registro que no puede contestarla no sirve para lo que existe: tener las dos fechas
 * guardadas y no poder cruzarlas es tener el dato y no la respuesta.
 *
 * Dos consultas y una diferencia de conjuntos EN CÓDIGO, a propósito: el volumen de solicitudes
 * de portabilidad es de unas pocas al año, así que una consulta cruzada en SQL crudo aquí sería
 * complejidad comprada sin necesidad — y además esto se prueba con un doble, sin BD.
 *
 * `dias = 0` devuelve TODAS las pendientes, que es lo que hace falta para pintar una bandeja;
 * `dias = 25` da el aviso temprano antes de que venza el mes.
 */
export async function solicitudesPendientes(
  cliente: ClienteRegistro,
  opts: { dias?: number; ahora?: Date; merchantId?: number } = {},
): Promise<SolicitudPendiente[]> {
  const ahora = opts.ahora ?? new Date();
  const dias = opts.dias ?? 0;
  const corte = new Date(ahora.getTime() - dias * 86_400_000);

  const solicitudes = await cliente.auditLog.findMany({
    where: {
      action: ACCION_SOLICITADA,
      createdAt: { lte: corte },
      ...(opts.merchantId != null ? { merchantId: opts.merchantId } : {}),
    },
    select: { id: true, merchantId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  if (solicitudes.length === 0) return [];

  const atendidas = await cliente.auditLog.findMany({
    where: {
      action: ACCION_ATENDIDA,
      entityType: ENTIDAD,
      entityId: { in: solicitudes.map((s: any) => s.id) },
    },
    select: { entityId: true },
  });
  const cerradas = new Set(atendidas.map((a: any) => a.entityId));

  return solicitudes
    .filter((s: any) => !cerradas.has(s.id))
    .map((s: any) => {
      const limite = fechaLimite(s.createdAt);
      return {
        solicitudId: s.id,
        merchantId: s.merchantId,
        solicitadaEn: s.createdAt,
        dias: diasTranscurridos(s.createdAt, ahora),
        limite,
        fueraDePlazo: ahora.getTime() > limite.getTime(),
      };
    });
}
