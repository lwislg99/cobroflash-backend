import crypto from 'crypto';
import { prisma } from '../../core/db/prisma';
import { Prisma } from '@prisma/client';
import { CustomerCreateInput, CustomerUpdateInput } from '../../core/validation/schemas';

function generatePortalToken() {
  return crypto.randomBytes(16).toString('hex');
}

// SCRUM-97: listado/detalle/alta genéricos de cliente NUNCA devuelven portalToken — es
// la llave del portal público de autoservicio (/cliente/:token, historial completo de
// documentos, sin más control) y no hace falta aquí: el flujo legítimo para obtenerlo ya
// existe aparte, GET /admin/customers/:id/portal-url (ensurePortalToken más abajo), que
// sí lo selecciona a propósito. Todo lo demás del modelo se mantiene (nada lo necesitaba
// recortado; solo el token).
const CUSTOMER_SELECT_NO_TOKEN = {
  id: true, merchantId: true, name: true, phone: true, email: true, notes: true,
  legalName: true, taxId: true, waOptOut: true, createdAt: true, updatedAt: true,
  tipoDestinatario: true, // SCRUM-69: para editar en la ficha y para la bandeja de facturación
  billingPeriodicity: true, // SCRUM-171b: periodicidad pactada (solo para AVISAR, ver bandeja)
} as const;

export async function listCustomers(merchantId: number, search?: string) {
  const where: Prisma.CustomerWhereInput = { merchantId };

  if (search) {
    where.AND = [{
      OR: [
        { name:  { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }];
  }

  return prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, select: CUSTOMER_SELECT_NO_TOKEN });
}

export async function getCustomer(merchantId: number, id: number) {
  return prisma.customer.findFirst({ where: { id, merchantId }, select: CUSTOMER_SELECT_NO_TOKEN });
}

export async function createCustomer(merchantId: number, data: CustomerCreateInput) {
  return prisma.customer.create({
    data: { ...data, merchantId, portalToken: generatePortalToken() },
    select: CUSTOMER_SELECT_NO_TOKEN,
  });
}

export async function ensurePortalToken(merchantId: number, customerId: number): Promise<string> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, merchantId } });
  if (!customer) throw new Error('customer_not_found');
  if (customer.portalToken) return customer.portalToken;
  const token = generatePortalToken();
  await prisma.customer.update({ where: { id: customerId }, data: { portalToken: token } });
  return token;
}

export async function updateCustomer(merchantId: number, id: number, data: CustomerUpdateInput) {
  return prisma.customer.updateMany({ where: { id, merchantId }, data });
}

export async function deleteCustomer(merchantId: number, id: number) {
  return prisma.customer.deleteMany({ where: { id, merchantId } });
}
