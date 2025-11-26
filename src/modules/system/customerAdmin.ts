import { prisma } from '../../core/db/prisma';
import { Prisma } from '@prisma/client';
import {
  CustomerCreateInput,
  CustomerUpdateInput,
} from '../../core/validation/schemas';

export async function listCustomers(search?: string) {
  const where: Prisma.CustomerWhereInput | undefined = search
    ? {
        OR: [
          { name:  { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : undefined;

  return prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCustomer(id: number) {
  return prisma.customer.findUnique({ where: { id } });
}

export async function createCustomer(data: CustomerCreateInput) {
  return prisma.customer.create({ data });
}

export async function updateCustomer(id: number, data: CustomerUpdateInput) {
  return prisma.customer.update({ where: { id }, data });
}

export async function deleteCustomer(id: number) {
  return prisma.customer.delete({ where: { id } });
}
