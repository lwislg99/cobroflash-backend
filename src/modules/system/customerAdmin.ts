import { prisma } from '../../core/db/prisma';
import { Prisma } from '@prisma/client';
import { CustomerCreateInput, CustomerUpdateInput } from '../../core/validation/schemas';

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
  return prisma.customer.create({ data: { ...data, merchantId } });
}

export async function updateCustomer(merchantId: number, id: number, data: CustomerUpdateInput) {
  return prisma.customer.updateMany({ where: { id, merchantId }, data });
}

export async function deleteCustomer(merchantId: number, id: number) {
  return prisma.customer.deleteMany({ where: { id, merchantId } });
}
