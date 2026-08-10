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
import { requireRole } from '../../../../core/http/authMiddleware';
import { construirPaquetePrecarga } from '../../domain/precarga.service';

const router = Router();

/**
 * GET /admin/precarga — lo que hay que bajarse al móvil para poder firmar sin red.
 *
 * 🔴 ADMIN-ONLY, que es el DEFAULT de S1 («ruta nueva = declara rol mínimo; default Admin-only»).
 *
 * ⚠️ Y ESO TIENE UN COSTE QUE HAY QUE DECIR, NO ESCONDER: el que baja al sótano puede ser un
 * TÉCNICO, y así no se precarga nada para él. Abrirlo no es cambiar un rol: el paquete de
 * SCRUM-458 filtra por `merchantId` y **no** por `operarioId`, así que un técnico recibiría los
 * albaranes de TODO el merchant — justo el filtro row-level que SCRUM-23/147 construyó. Serían dos
 * decisiones (permiso + alcance del paquete) y las toma el fundador. Queda reportado.
 */
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const paquete = await construirPaquetePrecarga((req as { merchantId: number }).merchantId, new Date());
    res.json(paquete);
  } catch (err) {
    console.error('[GET /admin/precarga]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
