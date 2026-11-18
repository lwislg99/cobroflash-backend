// src/modules/fiscal/plazos/plazos.routes.ts — SCRUM-1076d · GET y PUT /admin/plazos-fiscales.
//
// ⚠️ NO ESTÁ MONTADO. La línea de `src/app.ts` es de S1 (contenedor del equipo de Luis), y la pide
// el fundador: `mountAdmin(app, '/admin/plazos-fiscales', requireRole('admin'), plazosRouter)`, como
// el 303. El rol va TAMBIÉN aquí, en cada ruta, para que el router no dependa de cómo se monte.
// `req.merchantId` lo pone `requireAuth` (lo pone `mountAdmin`); sin él, 401 y no se lee nada.
import { Router } from 'express';
import { prisma } from '../../../core/db/prisma';
import { requireRole } from '../../../core/http/authMiddleware';
import { leerCalendario, marcarPlazo, type ClienteDePlazos } from './plazos.repo';
import { TEXTOS_PLAZOS } from './textos';
import { CITAS_PLAZOS } from './citas';

// El modelo `FiscalPlazoEstado` entra con este PR: el cliente compartido de un árbol de trabajo
// puede no traerlo aún, así que se pasa por la interfaz mínima del repo, no por el tipo generado.
const db = prisma as unknown as ClienteDePlazos;

export function crearRouterDePlazos(cliente: ClienteDePlazos = db): Router {
  const router = Router();

  router.get('/', requireRole('admin'), async (req, res) => {
    if (typeof req.merchantId !== 'number') return res.status(401).json({ error: 'not_authenticated' });
    try {
      const pedido = Number(req.query.year);
      const ejercicio = Number.isInteger(pedido) && pedido >= 2000 && pedido <= 2100 ? pedido : undefined;
      const cal = await leerCalendario(cliente, { merchantId: req.merchantId, ejercicio });
      return res.json({
        ...cal,
        textos: TEXTOS_PLAZOS,
        modelos: CITAS_PLAZOS.map((c) => ({ modelo: c.modelo, nombre: c.nombre })),
      });
    } catch (err) {
      console.error('[GET /admin/plazos-fiscales]', err);
      return res.status(500).json({ error: 'internal_error', mensaje: TEXTOS_PLAZOS.errorCargar });
    }
  });

  router.put('/:modelo/:ejercicio/:periodo', requireRole('admin'), async (req, res) => {
    if (typeof req.merchantId !== 'number') return res.status(401).json({ error: 'not_authenticated' });
    try {
      const r = await marcarPlazo(cliente, {
        merchantId: req.merchantId,
        modelo: String(req.params.modelo),
        ejercicio: Number(req.params.ejercicio),
        periodo: String(req.params.periodo),
        estado: String(req.body?.estado ?? ''),
        teamMemberId: req.teamMemberId ?? null,
      });
      if (!r.ok) return res.status(400).json({ error: r.error, mensaje: TEXTOS_PLAZOS.errorGuardar });
      return res.json(r);
    } catch (err) {
      console.error('[PUT /admin/plazos-fiscales]', err);
      return res.status(500).json({ error: 'internal_error', mensaje: TEXTOS_PLAZOS.errorGuardar });
    }
  });

  return router;
}

export default crearRouterDePlazos();
