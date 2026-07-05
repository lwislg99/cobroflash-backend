import { Router } from 'express';
import { requireRole } from '../../../../core/http/authMiddleware';
import { prisma } from '../../../../core/db/prisma';
import { getEntitlements } from '../../../../core/entitlements';
import {
  listTeamMembers,
  createTeamMember,
  updateTeamMember,
  suspendTeamMember,
  resendInvite,
} from '../../domain/team.service';

const router = Router();

// Todas las rutas de equipo requieren rol admin
router.use(requireRole('admin'));

// GET /admin/team
router.get('/', async (req, res) => {
  try {
    const members = await listTeamMembers(req.merchantId);

    // Incluir el propietario como primer miembro con role=admin/owner
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { name: true, email: true },
    });

    const owner = {
      id: null,
      name: merchant?.name ?? '',
      email: merchant?.email ?? '',
      role: 'admin',
      status: 'active',
      isOwner: true,
      createdAt: null,
    };

    return res.json([owner, ...members.map((m) => ({ ...m, isOwner: false }))]);
  } catch (err) {
    console.error('[GET /admin/team]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/team  — invitar nuevo miembro (límite W3 vía entitlements, regla 34)
router.post('/', async (req, res) => {
  try {
    const name  = String(req.body?.name  || '').trim();
    const email = String(req.body?.email || '').toLowerCase().trim();
    const role  = req.body?.role === 'admin' ? 'admin' : 'tecnico';

    if (!name)  return res.status(400).json({ error: 'name_required' });
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });

    const merchant = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { name: true, plan: true },
    });

    // A10.3 (W3, regla 34): límite de usuarios por plan — 1 Pro/Founding, 5
    // Equipo. Cuenta = owner (1) + miembros no suspendidos. Al tope: mensaje
    // digno con la oferta Equipo (W1: oferta manual, no autoservicio).
    const { maxUsers } = getEntitlements(merchant?.plan);
    const activeMembers = await prisma.teamMember.count({
      where: { merchantId: req.merchantId, status: { not: 'suspended' } },
    });
    if (1 + activeMembers >= maxUsers) {
      return res.status(409).json({
        error: 'user_limit',
        maxUsers,
        message: maxUsers === 1
          ? 'Tu plan incluye 1 usuario. ¿Trabajáis varios? El plan Equipo añade hasta 5 usuarios con aprobaciones y asignación — escríbenos y te lo activamos.'
          : `Has llegado al límite de ${maxUsers} usuarios de tu plan Equipo.`,
      });
    }

    const member = await createTeamMember({
      merchantId: req.merchantId,
      name,
      email,
      role,
      merchantName: merchant?.name ?? 'YaQu',
    });

    return res.status(201).json(member);
  } catch (err: any) {
    console.error('[POST /admin/team]', err);
    if (err.message === 'email_is_owner') {
      return res.status(409).json({ error: 'email_is_owner' });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

// PUT /admin/team/:id — editar nombre/rol
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    const name = req.body?.name ? String(req.body.name).trim() : undefined;
    const role = req.body?.role === 'admin' ? 'admin' : req.body?.role === 'tecnico' ? 'tecnico' : undefined;

    const updated = await updateTeamMember({ id, merchantId: req.merchantId, name, role });
    return res.json(updated);
  } catch (err: any) {
    console.error('[PUT /admin/team/:id]', err);
    if (err.message === 'member_not_found') return res.status(404).json({ error: 'not_found' });
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /admin/team/:id/resend — reenviar invitación
router.post('/:id/resend', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    await resendInvite(id, req.merchantId);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[POST /admin/team/:id/resend]', err);
    if (err.message === 'member_not_found') return res.status(404).json({ error: 'not_found' });
    if (err.message === 'member_suspended') return res.status(409).json({ error: 'member_suspended' });
    return res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /admin/team/:id — suspender miembro
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid_id' });

    // No puede suspenderse a sí mismo
    if (req.teamMemberId === id) {
      return res.status(409).json({ error: 'cannot_suspend_self' });
    }

    await suspendTeamMember(id, req.merchantId);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[DELETE /admin/team/:id]', err);
    if (err.message === 'member_not_found') return res.status(404).json({ error: 'not_found' });
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
