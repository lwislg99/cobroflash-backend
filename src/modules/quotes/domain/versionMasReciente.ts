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
// el enlace sólo «muere» si su presupuesto está en `draft` o `sent`. Una versión ya aceptada o
// rechazada sigue con su página de siempre: es historia cierta (punto 6 de la conducta). Si una
// mitad cambia, la otra; lo ata `tests/scrum1302p-el-enlace-de-una-revision-antigua.test.mjs`.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { prisma } from '../../../core/db/prisma';
import { whereDelGrupo, anioDeLaSerie } from '../../../core/documentos/grupoDelPresupuesto';

const ESTADOS_CON_ENLACE_VIVO: readonly string[] = ['draft', 'sent'];

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
