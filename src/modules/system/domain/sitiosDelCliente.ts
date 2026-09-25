// src/modules/system/domain/sitiosDelCliente.ts — SCRUM-1014 (CRM)
//
// LA AGENDA DE «SITIOS» DEL CLIENTE — varias direcciones de obra guardadas, cada una con su
// contacto propio (el portero, el inquilino), sin crear un cliente entero por cada uno. Tabla
// nueva `CustomerSite` (`prisma/schema.prisma`), ALTER pendiente de aplicar en las tres bases
// (`docs/MIGRATIONS_PENDING.md`, SCRUM-1014).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 NO PRECARGA NADA, Y ESO NO LO DECIDE ESTE FICHERO
//
// El fundador cerró P2/DOC-12 (SCRUM-602) el 24-ago-2026: la dirección de obra pertenece al
// DOCUMENTO (`Quote`/`Invoice.shippingAddress`), no al cliente, y NUNCA se prerrellena sola. Este
// módulo sólo guarda y lista la agenda — ninguna función de aquí escribe en `shippingAddress`.
// Copiar el texto de un sitio al documento es una acción del PROFESIONAL, no de este código
// (com. 16921 de Jira, delegación del fundador).
//
// TENENCIA (regla 2) en las tres funciones: el cliente y el sitio tienen que ser del MISMO
// merchant que pide la operación — sin eso, un id ajeno colaría un sitio en una ficha que no es
// suya, o vería/editaría el sitio de otro inquilino.
import { prisma } from '../../../core/db/prisma';
import type { CustomerSiteCreateInput, CustomerSiteUpdateInput } from '../../../core/validation/schemas';

/** `null` si el cliente no es de este merchant — la ruta responde 404, igual que `listarNotas`. */
export async function listarSitios(merchantId: number, customerId: number) {
  const cliente = await prisma.customer.findFirst({ where: { id: customerId, merchantId }, select: { id: true } });
  if (!cliente) return null;

  return prisma.customerSite.findMany({
    where: { merchantId, customerId },
    // Orden estable, igual que `listarNotas`: `id` desempata un `createdAt` coincidente.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    // SCRUM-860: lista blanca explícita — sin ella, una columna que se añada mañana a
    // `CustomerSite` saldría sola por esta respuesta, sin que nadie lo decidiera. `merchantId`
    // fuera: es el dato del INQUILINO, no algo que la ficha de un cliente necesite enseñar.
    select: {
      id: true, customerId: true, name: true, address: true, city: true, postalCode: true,
      province: true, country: true, contactName: true, phone: true, createdAt: true, updatedAt: true,
    },
  });
}

/** `null` si el cliente no es de este merchant. */
export async function crearSitio(merchantId: number, customerId: number, datos: CustomerSiteCreateInput) {
  const cliente = await prisma.customer.findFirst({ where: { id: customerId, merchantId }, select: { id: true } });
  if (!cliente) return null;

  return prisma.customerSite.create({
    data: { merchantId, customerId, ...datos },
  });
}

/** `null` si el sitio no existe, no es de este cliente o no es de este merchant. */
export async function actualizarSitio(
  merchantId: number,
  customerId: number,
  siteId: number,
  datos: CustomerSiteUpdateInput,
) {
  const existe = await prisma.customerSite.findFirst({
    where: { id: siteId, customerId, merchantId },
    select: { id: true },
  });
  if (!existe) return null;

  return prisma.customerSite.update({ where: { id: siteId }, data: datos });
}

/** `false` si el sitio no existe, no es de este cliente o no es de este merchant. */
export async function borrarSitio(merchantId: number, customerId: number, siteId: number): Promise<boolean> {
  const r = await prisma.customerSite.deleteMany({ where: { id: siteId, customerId, merchantId } });
  return r.count > 0;
}
