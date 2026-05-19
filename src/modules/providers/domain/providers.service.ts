import { prisma } from '../../../core/db/prisma';

type CreateProviderInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export async function findProviderByName(merchantId: number, name: string) {
  return prisma.provider.findFirst({
    where: {
      merchantId,
      name,
    },
    select: { id: true },
  });
}

export async function listProviders(merchantId: number) {
  return prisma.provider.findMany({
    where: { merchantId },
    orderBy: { id: 'desc' },
  });
}

export async function createProvider(merchantId: number, input: CreateProviderInput) {
  return prisma.provider.create({
    data: {
      merchantId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateProvider(
  merchantId: number,
  id: number,
  data: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    isActive?: boolean;
  },
) {
  const existing = await prisma.provider.findFirst({
    where: { id, merchantId },
  });

  if (!existing) return null;

  return prisma.provider.update({
    where: { id },
    data,
  });
}

export async function deleteProvider(merchantId: number, id: number) {
  const existing = await prisma.provider.findFirst({
    where: { id, merchantId },
  });

  if (!existing) return null;

  const linkedProducts = await prisma.product.count({
    where: {
      merchantId,
      providerId: id,
    },
  });

  if (linkedProducts > 0) {
    throw new Error('provider_in_use');
  }

  await prisma.provider.delete({
    where: { id },
  });

  return { id };
}