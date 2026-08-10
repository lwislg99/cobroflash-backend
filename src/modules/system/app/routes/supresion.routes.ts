// src/modules/system/app/routes/supresion.routes.ts — SCRUM-244 (RGPD-1) · la superficie.
//
// El art. 17 estaba implementado y **sin alcanzar**: `borrarMerchant` construido, probado y sin un
// solo llamador. Un derecho que solo se puede ejercer corriendo código a mano no está ejercido.
//
// ⚠️ TRAS `MERCHANT_DELETE_ENABLED`, OFF POR DEFECTO. Esto borra datos y es irreversible: se
// construye, no se enciende (mismo criterio que la regla 24). Con el flag apagado la ruta responde
// 404 — no 403: una ruta que no existe todavía no anuncia que existe.
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { isFlagEnabled } from '../../../../core/flags';
import { suprimirMerchant } from '../../domain/supresionMerchant.service';
import { actorDeRequest } from '../../audit.service';

const router = Router();

/**
 * La confirmación fuerte: hay que escribir EL NOMBRE del negocio.
 *
 * ⚠️ Un «¿seguro?» se pulsa sin leer. Escribir el nombre obliga a un acto deliberado y, sobre
 * todo, a MIRAR de quién son los datos que se van — que es el error que de verdad hay que impedir:
 * suprimir el merchant equivocado no se deshace.
 */
function confirmacionValida(escrito: unknown, nombreReal: string | null): boolean {
  if (typeof escrito !== 'string' || !nombreReal) return false;
  return escrito.trim().toLocaleLowerCase('es') === nombreReal.trim().toLocaleLowerCase('es');
}

router.post('/:merchantId', async (req, res) => {
  try {
    if (!isFlagEnabled('MERCHANT_DELETE_ENABLED')) return res.status(404).json({ error: 'not_found' });

    const merchantId = Number(req.params.merchantId);
    if (!Number.isInteger(merchantId) || merchantId <= 0) return res.status(400).json({ error: 'merchant_invalido' });

    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { name: true } });
    if (!merchant) return res.status(404).json({ error: 'not_found' });

    if (!confirmacionValida(req.body?.confirmacion, merchant.name)) {
      return res.status(409).json({ error: 'confirmacion_no_coincide' });
    }

    const r = await suprimirMerchant({ merchantId, actor: actorDeRequest(req as any), db: prisma });
    if (!r.ok) return res.status(500).json({ error: 'no_completado', motivo: r.motivo });
    return res.json({ ok: true, redactados: r.redactados });
  } catch (err) {
    console.error('[POST /admin/supresion/:merchantId]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
