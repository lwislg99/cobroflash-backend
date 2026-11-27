// src/modules/system/app/routes/planAdmin.routes.ts — SCRUM-1818 (S1)
//
// POR QUÉ EXISTE. En el estreno del 20-nov-2026, activar el plan Equipo del piloto exigió editar a
// mano la celda `merchants.plan` en Railway. Los valores son estrictos (los de `entitlements.ts`), y
// un nombre mal escrito no falla: `getEntitlements` lo trata como trial, así que la cuenta se queda
// en 1 usuario sin que nada lo diga en pantalla.
//
// QUÉ HACE: `PUT /admin/plataforma/merchants/:id/plan` con `{ plan }`. Escribe SOLO la columna
// `plan` de ese comercio. No toca Stripe, ni `planExpiresAt`, ni flags: la oferta Equipo sigue
// siendo manual (W1) y esto sólo quita el paso de Railway.
//
// LA PUERTA es la de `GET /admin/metrics/platform-funnel` (SCRUM-1317 + SCRUM-102), copiada:
// `requireRole('admin')` delante y, detrás, `isVerifiedPlatformOwner` del merchant de la SESIÓN
// (correo en OWNER_EMAILS + `isPlatformOwner` en la base). Hacen falta las dos: la de dueño mira
// el merchant, no quién llama, y sin la de rol un operario de la cuenta dueña pasaría.
//
// Es la única ruta de /admin que escribe en OTRO merchant que el de la sesión: no filtra por
// `req.merchantId` porque su trabajo es justo ése. Por eso la puerta va antes de leer nada del
// comercio objetivo, y el valor se valida antes de escribir.
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { requireRole } from '../../../../core/http/authMiddleware';
import { isVerifiedPlatformOwner } from '../../../../core/config/env';
import { PLANES_CONOCIDOS } from '../../../../core/entitlements';

const router = Router();

/**
 * ¿Es `valor` un plan que existe? Exacto: sin `trim` ni minúsculas, y sólo cadenas. `includes`
 * sobre la lista (no `in` ni `obj[valor]`), así que `__proto__` o `constructor` no casan por
 * herencia. Lo que no casa se RECHAZA: aquí no hay «cae a trial».
 */
export function esPlanConocido(valor: unknown): valor is string {
  return typeof valor === 'string' && PLANES_CONOCIDOS.includes(valor);
}

/** Id de comercio: entero positivo escrito en decimal, sin nada más. */
function idDeComercio(crudo: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(crudo)) return null;
  const id = Number(crudo);
  return Number.isSafeInteger(id) ? id : null;
}

router.put('/merchants/:id/plan', requireRole('admin'), async (req, res) => {
  try {
    const yo = await prisma.merchant.findUnique({
      where: { id: req.merchantId },
      select: { email: true, isPlatformOwner: true },
    });
    if (!isVerifiedPlatformOwner(yo)) return res.status(403).json({ error: 'forbidden' });

    const id = idDeComercio(String(req.params.id));
    if (id === null) return res.status(400).json({ error: 'invalid_id' });

    const plan = (req.body ?? {}).plan;
    if (!esPlanConocido(plan)) {
      return res.status(400).json({ error: 'plan_desconocido', planes: [...PLANES_CONOCIDOS] });
    }

    const objetivo = await prisma.merchant.findUnique({ where: { id }, select: { id: true, plan: true } });
    if (!objetivo) return res.status(404).json({ error: 'merchant_not_found' });

    await prisma.merchant.update({ where: { id }, data: { plan } });
    // Sin correos ni nombres: ids y planes bastan para reconstruir quién cambió qué.
    console.info(`[plan-admin] merchant ${req.merchantId} cambió el plan del merchant ${id}: ${objetivo.plan} → ${plan}`);
    return res.json({ id, plan, antes: objetivo.plan });
  } catch (err) {
    console.error('[PUT /admin/plataforma/merchants/:id/plan]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
