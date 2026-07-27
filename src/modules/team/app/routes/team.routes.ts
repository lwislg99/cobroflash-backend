import { Router } from 'express';
import { requireRole } from '../../../../core/http/authMiddleware';
import { prisma } from '../../../../core/db/prisma';
import { getEntitlements } from '../../../../core/entitlements';
import {
  createTeamMember,
  updateTeamMember,
  suspendTeamMember,
  resendInvite,
} from '../../domain/team.service';
import { getTeamOverview } from '../../domain/teamOverview.service'; // SCRUM-136 (hub Equipo)

const router = Router();

// Todas las rutas de equipo requieren rol admin.
// ⚠️ SCRUM-136: este gate está DUPLICADO — `app.ts` ya monta este router con
// `mountAdmin(app, '/admin/team', requireRole('admin'), teamRouter)`. Se descubrió al
// verificar el test EN ROJO: quitar solo uno de los dos deja la ruta igual de cerrada, así
// que el test no distingue cuál actúa (hubo que quitar los dos para verlo fallar). No se
// retira ninguno: la redundancia es barata y sobrevive a que alguien reorganice `app.ts`.
// Si algún día quitas uno, comprueba que el OTRO sigue en pie antes de fiarte del verde.
router.use(requireRole('admin'));

// GET /admin/team — SCRUM-136: el roster AHORA llega con su resumen (presupuestos del mes,
// trabajos abiertos, pendiente). Se enriquece esta ruta en vez de abrir un /admin/team/overview
// porque ya es admin-only y ya es "el equipo": una ruta nueva sería superficie que declarar en
// el ratchet (SCRUM-113) para exactamente el mismo dato, y dos peticiones donde basta una.
//
// COMPATIBILIDAD: la respuesta sigue siendo un ARRAY con los mismos campos por miembro
// (id/name/email/role/status/isOwner/createdAt) y el propietario el primero — solo se AÑADE
// `resumen`. El array suelto se conserva a propósito: envolverlo en un objeto rompería a
// cualquier consumidor que haga `members.length` (teamView lo hacía).
router.get('/', async (req, res) => {
  try {
    const { miembros } = await getTeamOverview(req.merchantId);
    return res.json(miembros);
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
