// src/modules/quotes/domain/versionMasReciente.ts — SCRUM-1302 · EL ENLACE DE UNA REVISIÓN ANTIGUA.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ¿ESTE PRESUPUESTO TIENE UNA VERSIÓN MÁS RECIENTE? Si la tiene, su enlace ya no deja aceptar.
//
// Conducta firmada por el orquestador por delegación del fundador (SCRUM-1302, c.19454 y c.19475):
// el enlace de la versión anterior deja de valer al CREAR la revisión, y el panel se lo avisa al
// profesional antes de crearla. Ficha: `docs/microcopy/2026-10-13-SCRUM-1302-enlace-de-revision-antigua.md`.
//
// Vive aquí, y no en la página, porque la misma pregunta la tiene que hacer el `POST` que registra la
// decisión del cliente (de S1): dos sitios que deciden lo mismo con dos criterios acaban discrepando.
//
// 🔴 LA CONDICIÓN ES LA MISMA QUE LA DEL AVISO DEL PANEL (`quoteRevisiones.js`, `ESTADOS_CON_ENLACE_VIVO`):
// el enlace sólo «muere» si su presupuesto está en `draft`, `sent` o `expired`. `expired` entra por
// c.19636: el aviso va ANTES que el de caducado (punto 5), y sin él eso sólo valía para las vencidas
// que el cron aún no había barrido. Una versión ya aceptada o rechazada sigue con su página de
// siempre: es historia cierta (punto 6 de la conducta). Si una mitad cambia, la otra; lo ata
// `tests/scrum1302p-el-aviso-antes-de-crear-la-revision.test.mjs`.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { prisma } from '../../../core/db/prisma';
import { whereDelGrupo, anioDeLaSerie } from '../../../core/documentos/grupoDelPresupuesto';

const ESTADOS_CON_ENLACE_VIVO: readonly string[] = ['draft', 'sent', 'expired'];

type PresupuestoDelEnlace = {
  merchantId: number;
  quoteNumber: number | null;
  revision: number;
  status: string;
  seriesYear?: number | null;
  createdAt?: Date | string | null;
};

/**
 * `true` si en su grupo ({negocio, año de la serie, número}: `whereDelGrupo`) hay otra fila con una
 * revisión MAYOR, en el estado que sea. Sin número no hay grupo (`quoteAdmin.ts`): no hay de qué
 * ser la versión antigua.
 *
 * ⚠️ Si la consulta falla, LANZA: «no he podido mirar» no es «no hay otra», y contestar `false`
 * volvería a pintar el formulario que esto existe para quitar.
 */
export async function tieneVersionMasReciente(
  q: PresupuestoDelEnlace,
  merchant?: { timezone?: string | null } | null,
): Promise<boolean> {
  if (!ESTADOS_CON_ENLACE_VIVO.includes(q.status)) return false;
  if (q.quoteNumber == null) return false;
  const masNuevas = await prisma.quote.count({
    where: {
      ...whereDelGrupo({ merchantId: q.merchantId, quoteNumber: q.quoteNumber, anio: anioDeLaSerie(q, merchant) }, merchant),
      revision: { gt: q.revision },
    },
  });
  return masNuevas > 0;
}

/**
 * T3, literal firmado (c.19454, con la enmienda «La que estás viendo»). Vive aquí y no en la página
 * porque lo dicen DOS sitios: la página del enlace viejo y el `message` del `POST` que lo rechaza.
 * `{negocio}` es el nombre fiscal, o el comercial, o «el profesional», como en la página del rechazo.
 * ⚠️ Sin escapar: quien lo pinte en HTML lo escapa (la página lo hace con `escapandoLoInterpolado`).
 */
export function fraseDeLaVersionAntigua(negocio: string): string {
  return `La que estás viendo ya no se puede aceptar. Abre el enlace de la versión nueva que te haya enviado ${negocio}, o pídesela.`;
}

/**
 * SCRUM-1302r · el `message` del `POST /quote/:token/decision` sobre una versión no vigente: T2 y T3
 * seguidos (propuesta de S4 en c.19451, firmada en c.19454 punto 6 y c.19636 punto 3).
 */
export function mensajeDeVersionMasReciente(
  quoteHasNewer: string,
  merchant?: { legalName?: string | null; name?: string | null } | null,
): string {
  const negocio = merchant?.legalName || merchant?.name || 'el profesional';
  return `${quoteHasNewer} ${fraseDeLaVersionAntigua(negocio)}`;
}

/** El código del 409 de una versión no vigente: la página lo trata como el de «ya decidido» (recarga). */
export const ERROR_VERSION_NO_VIGENTE = 'quote_has_newer_version';
