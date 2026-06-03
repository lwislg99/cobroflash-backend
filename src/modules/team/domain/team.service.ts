import { prisma } from '../../../core/db/prisma';
import { inviteTeamMember } from '../../auth/domain/auth.service';

export async function listTeamMembers(merchantId: number) {
  const members = await prisma.teamMember.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
  return members;
}

export async function createTeamMember(params: {
  merchantId: number;
  name: string;
  email: string;
  role: 'admin' | 'tecnico';
  merchantName: string;
}) {
  const { merchantId, name, email, role, merchantName } = params;

  // Comprobar que el email no pertenece ya al merchant owner
  const owner = await prisma.merchant.findFirst({
    where: { id: merchantId, email },
  });
  if (owner) throw new Error('email_is_owner');

  // Upsert: si ya existe en este merchant (suspendido o invited), reactivar
  const existing = await prisma.teamMember.findFirst({
    where: { merchantId, email },
  });

  let member;
  if (existing) {
    member = await prisma.teamMember.update({
      where: { id: existing.id },
      data: { name, role, status: 'invited' },
    });
  } else {
    member = await prisma.teamMember.create({
      data: { merchantId, name, email, role, status: 'invited' },
    });
  }

  await inviteTeamMember({ merchantId, teamMemberId: member.id, memberName: name, memberEmail: email, merchantName });

  return member;
}

export async function updateTeamMember(params: {
  id: number;
  merchantId: number;
  name?: string;
  role?: 'admin' | 'tecnico';
}) {
  const { id, merchantId, ...data } = params;

  const member = await prisma.teamMember.findFirst({ where: { id, merchantId } });
  if (!member) throw new Error('member_not_found');

  return prisma.teamMember.update({
    where: { id },
    data,
  });
}

export async function suspendTeamMember(id: number, merchantId: number) {
  const member = await prisma.teamMember.findFirst({ where: { id, merchantId } });
  if (!member) throw new Error('member_not_found');

  // Invalidar todas sus sesiones activas
  await prisma.authSession.deleteMany({ where: { teamMemberId: id, type: 'session' } });

  return prisma.teamMember.update({
    where: { id },
    data: { status: 'suspended' },
  });
}

export async function resendInvite(id: number, merchantId: number) {
  const member = await prisma.teamMember.findFirst({ where: { id, merchantId } });
  if (!member) throw new Error('member_not_found');
  if (member.status === 'suspended') throw new Error('member_suspended');

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { name: true },
  });

  await inviteTeamMember({
    merchantId,
    teamMemberId: member.id,
    memberName: member.name,
    memberEmail: member.email,
    merchantName: merchant?.name ?? 'YaQu',
  });

  return { ok: true };
}
