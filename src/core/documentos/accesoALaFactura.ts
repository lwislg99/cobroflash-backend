// src/core/documentos/accesoALaFactura.ts — SCRUM-1397
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ¿ES SUYA ESTA FACTURA? La pregunta que la lista, la ficha y el PDF no se hacían.
//
// Hasta aquí un Técnico recibía la fila entera de TODAS las facturas del negocio, y sumándolas
// reconstruía el total cobrado y lo cobrado por cada compañero, exactos (medido por J2i el
// 1-oct-2026, SCRUM-1346) — justo lo que la Parte S1 del máster le niega en Inicio.
//
// LA DECISIÓN (fundador, 1-oct-2026; SCRUM-1346 c.17932 y c.17952, SCRUM-1390 c.17962 y c.17964):
// el Técnico ve una factura si es AUTOR del presupuesto del que nace, si el TRABAJO es suyo, o si
// la tiene ASIGNADA como documento. La UNIÓN de las tres, y con su motivo: «mejor ser más laxo al
// principio y evitar errores». Ante la duda de si una factura es suya, el lado seguro es
// ENSEÑÁRSELA: por eso aquí cada camino que une una factura con una persona SUMA, y ninguno resta.
//
// ── POR QUÉ ES UNA FUNCIÓN Y NO TRES `where` ─────────────────────────────────────────────
//
// Porque tres copias de un criterio de acceso divergen, y la que se queda atrás no da error: da
// acceso (o lo quita). La lista pide el recorte (`whereFacturasVisibles`) y la ficha y el PDF
// preguntan por UNA (`puedeVerLaFactura`), que no es un segundo criterio: es el mismo recorte
// aplicado a un id.
//
// ── POR QUÉ LEE ANTES LOS TRABAJOS, Y NO ES UN SOLO `where` ──────────────────────────────
//
// `Invoice` no tiene relación de Prisma con `Job` ni con `Albaran`: `Job.quoteId`, `Quote.jobId`,
// `Albaran.invoiceId` y `AlbaranLineaFacturada.invoiceId` son columnas sueltas. Un único `where`
// sobre `invoices` no puede llegar al Trabajo. Así que primero se leen los Trabajos de la persona
// (con `whereSuyoElTrabajo`, los tres ejes del Trabajo que la casa ya tiene) y sus albaranes, y
// con esos ids se arma el recorte. Son TRES lecturas previas y no sobran: quitar una deja fuera
// un camino entero —las facturas parciales y las recapitulativas no llevan presupuesto— y el
// operario pierde facturas de su propia obra sin que nada falle.
//
// ⚠️ Los ids viajan en listas `in`. Con miles de Trabajos por persona habría que cambiarlo por
// una subconsulta; hoy no hay ninguna cuenta así.
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { seesAllJobs } from '../http/roleCapabilities';
import { whereSuyoElTrabajo } from '../../modules/jobs/domain/accesoAlTrabajo';

/** Quién pregunta: lo que `requireAuth` deja en la petición. */
export interface QuienPide {
  merchantId: number;
  userRole: string | null | undefined;
  teamMemberId: number | null | undefined;
}

/**
 * El recorte de `invoices` para quien pregunta. **`null` = sin recorte**: quien ve todo el negocio
 * no añade NADA a su consulta, que sale idéntica a la de siempre.
 *
 * Quién ve todo lo decide `seesAllJobs`, la allowlist de la casa: sólo `admin`. Un rol desconocido
 * queda recortado a lo suyo.
 *
 * 🔴 Sin identidad no hay nada suyo: se casa el conjunto vacío. `{ quote: { teamMemberId: null } }`
 * serían «las facturas de la oficina», justo lo contrario.
 */
export async function whereFacturasVisibles(quien: QuienPide): Promise<Prisma.InvoiceWhereInput | null> {
  if (seesAllJobs(quien.userRole)) return null;
  const persona = quien.teamMemberId;
  if (persona == null) return { id: { in: [] } };

  // Sus Trabajos, por los tres ejes del Trabajo (operario, asignado y tabla de asignados).
  const trabajos = await prisma.job.findMany({
    where: { merchantId: quien.merchantId, ...whereSuyoElTrabajo(persona) }, // regla 2
    select: { id: true, quoteId: true },
  });
  const trabajoIds = trabajos.map((t) => t.id);
  const presupuestoIds = trabajos.flatMap((t) => (t.quoteId == null ? [] : [t.quoteId]));

  // Las facturas que salen de los albaranes de esos Trabajos: la recapitulativa marca el albarán
  // entero (`Albaran.invoiceId`); la parcial apunta sus líneas en el libro.
  const albaranes = trabajoIds.length === 0 ? [] : await prisma.albaran.findMany({
    where: { merchantId: quien.merchantId, jobId: { in: trabajoIds } }, // regla 2
    select: { id: true, invoiceId: true },
  });
  const libro = albaranes.length === 0 ? [] : await prisma.albaranLineaFacturada.findMany({
    where: { merchantId: quien.merchantId, albaranId: { in: albaranes.map((a) => a.id) } }, // regla 2
    select: { invoiceId: true },
  });
  const porAlbaran = [...new Set([
    ...albaranes.flatMap((a) => (a.invoiceId == null ? [] : [a.invoiceId])),
    ...libro.map((l) => l.invoiceId),
  ])];

  const suya: Prisma.InvoiceWhereInput[] = [
    // AUTOR del presupuesto del que nace. Vale antes de que exista el Trabajo.
    { quote: { teamMemberId: persona } },
    // ASIGNADA AL DOCUMENTO (`invoice_assignees`). Es el eje que cubre lo que la oficina le
    // encarga sin que sea autor ni haya Trabajo todavía.
    { asignados: { some: { teamMemberId: persona } } },
    // Su TRABAJO, por los tres caminos que llevan de un Trabajo a una factura:
    { quoteId: { in: presupuestoIds } },         // el presupuesto que abrió el Trabajo
    { quote: { jobId: { in: trabajoIds } } },    // un adicional que cuelga del Trabajo
    { id: { in: porAlbaran } },                  // un albarán del Trabajo
  ];
  // La RECTIFICATIVA de una suya también es suya. La que nace de un presupuesto ya entra arriba
  // (copia el `quoteId` de la original); la de una factura de albarán sólo la une `rectifiesId`.
  return { OR: [...suya, { rectifies: { OR: suya } }] };
}

/**
 * ¿Puede ver ESTA factura? El mismo recorte, aplicado a un id — no un segundo criterio.
 *
 * Quien ve todo el negocio recibe `true` SIN consulta: que la factura exista y sea de su merchant
 * lo sigue comprobando la ruta, como siempre. Para el resto, una factura ajena y una que no
 * existe contestan lo mismo.
 */
export async function puedeVerLaFactura(quien: QuienPide, invoiceId: number): Promise<boolean> {
  const recorte = await whereFacturasVisibles(quien);
  if (recorte === null) return true;
  const fila = await prisma.invoice.findFirst({
    where: { id: invoiceId, merchantId: quien.merchantId, AND: [recorte] }, // regla 2
    select: { id: true },
  });
  return fila != null;
}
