import crypto from 'crypto';
import { prisma } from '../../core/db/prisma';
import { Prisma } from '@prisma/client';
import { CustomerCreateInput, CustomerUpdateInput } from '../../core/validation/schemas';

function generatePortalToken() {
  return crypto.randomBytes(16).toString('hex');
}

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

  return prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' } });
}

export async function getCustomer(merchantId: number, id: number) {
  return prisma.customer.findFirst({ where: { id, merchantId } });
}

export async function createCustomer(merchantId: number, data: CustomerCreateInput) {
  return prisma.customer.create({
    data: { ...data, merchantId, portalToken: generatePortalToken() },
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
