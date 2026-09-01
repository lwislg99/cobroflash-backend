import crypto from 'crypto';
import { prisma } from '../../core/db/prisma';
import { Prisma } from '@prisma/client';
import { CustomerCreateInput, CustomerUpdateInput } from '../../core/validation/schemas';
import { normalizePhone } from '../../core/utils/utils'; // SCRUM-578: la que YA existe, sin tocarla

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
  contactKind: true, // SCRUM-574: forma jurídica (EMPRESA|PERSONA). NO es tipoDestinatario.
  tipoDestinatario: true, // SCRUM-69: para editar en la ficha y para la bandeja de facturación
  billingPeriodicity: true, // SCRUM-171b: periodicidad pactada (solo para AVISAR, ver bandeja)
  recargoEquivalencia: true, // SCRUM-294-a: el dato del cliente; NO cableado al total (regla 38)
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

/**
 * SCRUM-578 (CONT-05, punto b) · LA NORMALIZACIÓN SE APLICA EN SERVIDOR, NO EN LA ETIQUETA.
 *
 * El defecto del ticket lo demuestra: el formulario pedía «Teléfono (E.164 sin +)» y se guardaron
 * `+34 662629419` y `662629419` como dos clientes. Una regla que sólo vive en un rótulo no es una
 * regla — es una instrucción para el humano. Zod tampoco la sostenía (`z.string().min(5)`).
 *
 * Medido antes de tocar: de los tres caminos que escriben `Customer.phone`, sólo
 * `charges.routes.ts:27` normalizaba. Éste —el del panel— no lo hacía.
 *
 * ⚠️ Se usa `normalizePhone` A SECAS, la que ya existe. NO se canoniza el prefijo aquí: eso vive
 * en `identificadoresDuplicados` y es SÓLO PARA COMPARAR. Guardar el número con un prefijo que el
 * profesional no escribió sería inventarle un país a un dato suyo, y además cambiaría a dónde se
 * manda el WhatsApp.
 *
 * `undefined` se respeta: en una actualización parcial significa «no toques este campo», y
 * confundirlo con «bórralo» sería perder el teléfono de un cliente al editarle las notas.
 */
function normalizarIdentificadores<T extends { phone?: string | null }>(data: T): T {
  if (data.phone === undefined) return data;
  const limpio = normalizePhone(data.phone);
  // Si no se puede normalizar, se guarda lo que escribió el profesional: este ticket avisa de
  // duplicados, no valida teléfonos. Rechazar aquí sería un bloqueo que nadie ha decidido.
  return { ...data, phone: limpio || data.phone };
}

export async function createCustomer(merchantId: number, data: CustomerCreateInput) {
  return prisma.customer.create({
    data: { ...normalizarIdentificadores(data), merchantId, portalToken: generatePortalToken() },
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
  // SCRUM-578: la edicion normaliza igual que el alta. Si solo lo hiciera el alta, editar un
  // cliente seria la puerta trasera por la que vuelve a entrar un telefono sin normalizar.
  return prisma.customer.updateMany({ where: { id, merchantId }, data: normalizarIdentificadores(data) });
}

export async function deleteCustomer(merchantId: number, id: number) {
  return prisma.customer.deleteMany({ where: { id, merchantId } });
}
