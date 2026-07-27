import { Router } from 'express';
import { requireRole } from '../../../../core/http/authMiddleware';
import { isSupportedRole, SUPPORTED_ROLES } from '../../../../core/http/roleCapabilities'; // SCRUM-147
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
    // SCRUM-147: se VALIDA, ya no se coacciona. Antes, cualquier valor distinto de 'admin' se
    // reescribía a 'tecnico' EN SILENCIO: pedir role:'comercial' creaba un técnico sin avisar, y
    // quien lo pidiera creía tener un rol que no existe. Omitirlo sigue siendo válido (default
    // 'tecnico'); mandar uno no soportado ahora es un 400.
    const roleRaw = req.body?.role == null ? 'tecnico' : req.body.role;
    if (!isSupportedRole(roleRaw)) {
      return res.status(400).json({ error: 'invalid_role', message: `Rol no soportado. Válidos: ${SUPPORTED_ROLES.join(', ')}.` });
    }
    const role = roleRaw;

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
    console.error('[POST /admin/team]', err?.message || 'error desconocido'); // SCRUM-105
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
    // SCRUM-147: `undefined` = "no se cambia el rol" (sigue siendo válido). Pero un rol PRESENTE
    // y no soportado ya no se ignora en silencio — se rechaza, en vez de guardar el cambio de
    // nombre y descartar el de rol sin decir nada.
    if (req.body?.role != null && !isSupportedRole(req.body.role)) {
      return res.status(400).json({ error: 'invalid_role', message: `Rol no soportado. Válidos: ${SUPPORTED_ROLES.join(', ')}.` });
    }
    const role = req.body?.role == null ? undefined : (req.body.role as 'admin' | 'tecnico');

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
