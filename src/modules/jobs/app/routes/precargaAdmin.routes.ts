// src/modules/jobs/app/routes/precargaAdmin.routes.ts — SCRUM-460 (H1 · fase 3)
//
// La superficie del paquete de SCRUM-458. Aquel ticket construyó el productor y lo dejó **sin
// nadie que pudiera llamarlo** —el trinquete de SCRUM-411 subió de 7 a 8 para dejar constancia—.
// Esto es lo que lo devuelve a 7.
//
// Se monta con `mountAdmin`, así que hereda `requireAuth` y `req.merchantId` (regla 2). El
// aislamiento por merchant ya tiene test propio en SCRUM-458 y **no se relaja**: es lo peor que
// puede fallar aquí, porque el móvil de la furgoneta se comparte.
import { Router } from 'express';
import { seesAllJobs } from '../../../../core/http/roleCapabilities';
import { construirPaquetePrecarga } from '../../domain/precarga.service';

const router = Router();

/**
 * GET /admin/precarga — lo que hay que bajarse al móvil para poder firmar sin red.
 *
 * 🔴 SCRUM-464 · YA NO ES ADMIN-ONLY, y era lo que dejaba H1 resolviendo el problema para la
 * persona equivocada: **el que baja al sótano es el operario**. El rol decide QUÉ paquete toca, no
 * si hay paquete.
 *
 * ⚠️ EL ROL SE PREGUNTA CON `seesAllJobs`, la allowlist de la casa, y **nunca** con
 * `role !== 'tecnico'`: un rol desconocido tiene que caer del lado RESTRINGIDO. Es la lección de
 * SCRUM-147, donde una denylist de tres líneas dejaba ver todos los Trabajos a cualquier rol nuevo.
 */
router.get('/', async (req, res) => {
  const r = req as { merchantId: number; userRole: 'admin' | 'tecnico'; teamMemberId: number | null };
  try {
    const todoElMerchant = seesAllJobs(r.userRole);

    // 🔴 FAIL-CLOSED, aunque hoy sea imposible. Medido: `requireAuth` pone `userRole = 'admin'`
    // cuando no hay `teamMember`, así que un no-admin SIEMPRE trae `teamMemberId`. Pero si esa
    // invariante se rompiera algún día, `soloDelTecnico = null` significaría **el merchant entero**
    // — el fallo se abriría hacia el lado malo y en silencio. Aquí se cierra en alto.
    if (!todoElMerchant && r.teamMemberId == null) {
      return res.status(403).json({ error: 'rol_sin_operario' });
    }

    const paquete = await construirPaquetePrecarga(
      r.merchantId, new Date(), undefined, todoElMerchant ? null : r.teamMemberId,
    );
    return res.json(paquete);
  } catch (err) {
    console.error('[GET /admin/precarga]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
