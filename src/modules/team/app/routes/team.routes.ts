import { cabeEnColumnaInt } from '../../../../core/validation/enteroDeColumna'; // SCRUM-1379
import { Router } from 'express';
import { requireRole } from '../../../../core/http/authMiddleware';
import { isSupportedRole, SUPPORTED_ROLES } from '../../../../core/http/roleCapabilities'; // SCRUM-147
import { prisma } from '../../../../core/db/prisma';
import { getEntitlements } from '../../../../core/entitlements';
import {
  createTeamMember,
  updateTeamMember,
  suspendTeamMember,
  resendInvite,
} from '../../domain/team.service';
// SCRUM-131: mismo vocabulario de "¿salió el envío?" que los 9 endpoints (SCRUM-126). No es uno
// de ellos (es un email de invitación interno, no un documento a cliente final), pero la forma
// del bug era idéntica y no hay motivo para que el contrato difiera.
import { sendSuccessBody, sendFailureBody } from '../../../../lib/sendOutcome';
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

// SCRUM-1678 · LAS PLAZAS DEL PLAN, EN UN SOLO SITIO. Antes, el límite y su texto vivían SOLO dentro
// del POST, así que el panel se enteraba DESPUÉS de que el admin rellenara el formulario. Ahora el
// recuento, la regla y el literal salen de aquí para las dos rutas: `GET /admin/team/plazas` lo
// enseña ANTES de abrir el formulario y el POST lo sigue haciendo cumplir (la red de siempre). Una
// sola regla: si el panel dedujera el límite de `me.plan`, sería la tabla de entitlements copiada
// en dos sitios, que es lo que divergió en SCRUM-1342.
//
// A10.3 (W3, regla 34): límite de usuarios por plan — 1 Pro/Founding, 5 Equipo. Cuenta = owner (1)
// + miembros no suspendidos. Al tope: mensaje digno con la oferta Equipo (W1: oferta manual, no
// autoservicio). Los literales son los que el POST ya servía: SCRUM-1678 no añade ninguno.
export function mensajeDeLimiteDeUsuarios(maxUsers: number): string {
  return maxUsers === 1
    ? 'Tu plan incluye 1 usuario. ¿Trabajáis varios? El plan Equipo añade hasta 5 usuarios con aprobaciones y asignación — escríbenos y te lo activamos.'
    : `Has llegado al límite de ${maxUsers} usuarios de tu plan Equipo.`;
}

async function plazasDelPlan(req: { merchantId: number }) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: req.merchantId },
    select: { name: true, plan: true },
  });
  const { maxUsers } = getEntitlements(merchant?.plan, { merchantId: req.merchantId }); // SCRUM-1342: si el plan no existe, el aviso dice de quién es
  const activeMembers = await prisma.teamMember.count({
    where: { merchantId: req.merchantId, status: { not: 'suspended' } },
  });
  const usadas = 1 + activeMembers;
  const lleno = usadas >= maxUsers;
  return { merchant, maxUsers, usadas, lleno };
}

// GET /admin/team/plazas — SCRUM-1678: { plazas, usadas, lleno, mensaje }. `mensaje` es el MISMO
// literal del 409 `user_limit` cuando no cabe nadie más, y `null` cuando sí. Ruta aparte y no un
// campo en `GET /admin/team`: ese array tiene otros consumidores y su forma no se toca (SCRUM-136).
router.get('/plazas', async (req, res) => {
  try {
    const { maxUsers, usadas, lleno } = await plazasDelPlan(req);
    return res.json({
      plazas: maxUsers,
      usadas,
      lleno,
      mensaje: lleno ? mensajeDeLimiteDeUsuarios(maxUsers) : null,
    });
  } catch (err) {
    console.error('[GET /admin/team/plazas]', err);
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

    // El límite: misma regla y mismo literal que `GET /admin/team/plazas` (SCRUM-1678, arriba).
    const { merchant, maxUsers, lleno } = await plazasDelPlan(req);
    if (lleno) {
      return res.status(409).json({
        error: 'user_limit',
        maxUsers,
        message: mensajeDeLimiteDeUsuarios(maxUsers),
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
    if (!cabeEnColumnaInt(id)) return res.status(400).json({ error: 'invalid_id' });

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
    if (!cabeEnColumnaInt(id)) return res.status(400).json({ error: 'invalid_id' });

    // SCRUM-131: `sent` es la única verdad sobre si el email salió (contrato de sendOutcome.ts).
    // Antes se respondía `{ok:true}` fijo aunque Resend fallara: el admin leía "invitación
    // reenviada" y el operario no recibía nada. Se mantiene el 200 a propósito — la invitación
    // SÍ se regeneró y sigue válida 7 días; lo que falló es la ENTREGA.
    const { sent, reason } = await resendInvite(id, req.merchantId);
    return res.json(sent ? sendSuccessBody() : sendFailureBody(reason ?? 'email_send_failed'));
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
    if (!cabeEnColumnaInt(id)) return res.status(400).json({ error: 'invalid_id' });

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
