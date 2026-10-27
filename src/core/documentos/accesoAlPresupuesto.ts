// src/core/documentos/accesoAlPresupuesto.ts — SCRUM-1403
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ¿ES SUYO ESTE PRESUPUESTO? La hermana de `accesoALaFactura.ts`, con su MISMO criterio.
//
// SCRUM-1397 cerró las tres rutas de factura, y el Técnico siguió sacando lo cobrado por un
// compañero por otra puerta: `GET /admin/quotes?teamMemberId=<id>` le daba la lista de ese
// compañero y la ficha de cada presupuesto, sus facturas con `total` y `status` (medido por J2a el
// 2-oct-2026: 900 de 900).
//
// LA DECISIÓN es la misma y ya vale para los dos documentos (fundador, 1-oct-2026; SCRUM-1346
// c.17952 «1-Para los dos», SCRUM-1390 c.17962 «1-Sí»): el Técnico ve un presupuesto si es su
// AUTOR, si lo tiene ASIGNADO como documento o si el TRABAJO es suyo. La UNIÓN, y con el mismo
// motivo: «mejor ser más laxo al principio y evitar errores» (c.17932). Aquí cada camino SUMA.
//
// ── QUÉ COMPARTE CON LA PUERTA DE LAS FACTURAS, Y POR QUÉ NO ES UNA COPIA ────────────────
//
// Quién ve todo lo dice `seesAllJobs`; qué Trabajos son suyos, `trabajosDeLaPersona` (que pide
// los tres ejes a `whereSuyoElTrabajo`). Ninguna de las dos cosas se reescribe aquí. Lo único
// propio son los caminos que llevan de una persona a un PRESUPUESTO, que no son los de la factura
// porque el modelo es otro.
//
// ── POR QUÉ ENTRAN LAS REVISIONES ────────────────────────────────────────────────────────
//
// «P2004226.1» es otra fila de `quotes`. Al revisar se copian el autor y el Trabajo, pero NO las
// filas de `quote_assignees`: el Técnico que lleva un presupuesto por asignación dejaría de ver
// justo la versión vigente. Así que es suyo todo el grupo {merchant, año de la serie, número} de
// uno suyo (el año, desde SCRUM-1490). Sin número no hay grupo (un `quoteNumber` nulo no es una
// clave: SCRUM-655).
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { seesAllJobs } from '../http/roleCapabilities';
import { trabajosDeLaPersona, type QuienPide } from './accesoALaFactura';
import { anioDeLaSerie, whereDelAnio } from './grupoDelPresupuesto';

/**
 * El recorte de `quotes` para quien pregunta. **`null` = sin recorte**: quien ve todo el negocio
 * no añade NADA a su consulta. Sin identidad no hay nada suyo: se casa el conjunto vacío
 * (`{ teamMemberId: null }` serían «los del propietario», justo lo contrario).
 */
export async function wherePresupuestosVisibles(quien: QuienPide): Promise<Prisma.QuoteWhereInput | null> {
  if (seesAllJobs(quien.userRole)) return null;
  const persona = quien.teamMemberId;
  if (persona == null) return { id: { in: [] } };

  const trabajos = await trabajosDeLaPersona(quien, persona);
  const suyo: Prisma.QuoteWhereInput[] = [
    // AUTOR. Vale desde el borrador, antes de que exista nada más.
    { teamMemberId: persona },
    // ASIGNADO AL DOCUMENTO (`quote_assignees`): lo que la oficina le encarga antes de la
    // aceptación, cuando todavía no hay Trabajo (máster S1: sin este eje no podría abrirlo).
    { asignados: { some: { teamMemberId: persona } } },
    // Su TRABAJO, por los dos caminos que llevan de un Trabajo a un presupuesto:
    { id: { in: trabajos.flatMap((t) => (t.quoteId == null ? [] : [t.quoteId])) } }, // el que lo abrió
    { jobId: { in: trabajos.map((t) => t.id) } },                                      // un adicional
  ];

  // Las demás revisiones de uno suyo. 🔴 El grupo es {merchant, AÑO de la serie, número}
  // (SCRUM-1490): la serie es anual, y quien lleva «el 12» de 2026 no lleva el 12 de 2027.
  const numerados = await prisma.quote.findMany({
    where: { merchantId: quien.merchantId, quoteNumber: { not: null }, OR: suyo }, // regla 2
    select: { quoteNumber: true, seriesYear: true, createdAt: true },
  });
  if (numerados.length === 0) return { OR: suyo };

  // La zona sólo decide el año de una fila anterior a la columna (`anioDeLaSerie`).
  const negocio = await prisma.merchant.findUnique({ where: { id: quien.merchantId }, select: { timezone: true } });
  const porAnio = new Map<number, Set<number>>();
  for (const q of numerados) {
    const anio = anioDeLaSerie(q, negocio);
    if (!porAnio.has(anio)) porAnio.set(anio, new Set());
    porAnio.get(anio)!.add(q.quoteNumber as number);
  }
  const grupos: Prisma.QuoteWhereInput[] = [...porAnio].map(([anio, numeros]) => ({
    quoteNumber: { in: [...numeros] }, ...whereDelAnio(anio, negocio),
  }));
  return { OR: [...suyo, ...grupos] };
}

/**
 * ¿Puede ver ESTE presupuesto? El mismo recorte, aplicado a un id — no un segundo criterio.
 * Quien ve todo el negocio recibe `true` SIN consulta (que exista y sea de su merchant lo sigue
 * comprobando la ruta). Para el resto, uno ajeno y uno que no existe contestan lo mismo.
 */
export async function puedeVerElPresupuesto(quien: QuienPide, quoteId: number): Promise<boolean> {
  const recorte = await wherePresupuestosVisibles(quien);
  if (recorte === null) return true;
  const fila = await prisma.quote.findFirst({
    where: { id: quoteId, merchantId: quien.merchantId, AND: [recorte] }, // regla 2
    select: { id: true },
  });
  return fila != null;
}
