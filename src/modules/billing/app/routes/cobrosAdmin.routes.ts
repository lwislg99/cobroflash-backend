// src/modules/billing/app/routes/cobrosAdmin.routes.ts — SCRUM-285 (B4)
//
// La superficie que le faltaba al motor. `buildCobros` (exports) ya derivaba cobros por merchant,
// pero su única salida era un CSV — y además solo miraba `Charge`, así que se dejaba fuera el
// dinero marcado a mano. Aquí se sirve la población completa, en JSON, para la pantalla.
//
// Se monta con `mountAdmin`, así que hereda `requireAuth` y `req.merchantId` (regla 2).
import { Router } from 'express';
import { requireRole } from '../../../../core/http/authMiddleware';
import { listarCobros } from '../../domain/cobros.service';
import { cubosDeMetodo } from '../../domain/metodoDeCobro';

/**
 * El rótulo del cubo de «no consta», APROBADO por el asesor el 10-ago-2026 (regla 30).
 *
 * NO es «Otro»: «otro» AFIRMA que hubo un método distinto, y aquí no consta ninguno. Viaja desde
 * aquí para que la vista no tenga que conocer ni un texto de esta clasificación.
 */
const ROTULO_SIN_METODO = 'Método no registrado';

const router = Router();

/**
 * GET /admin/cobros — todos los cobros del merchant, las dos poblaciones fundidas.
 *
 * 🔴 ADMIN-ONLY, que es el DEFAULT de S1 («ruta nueva = declara rol mínimo; default Admin-only»)
 * y no una decisión de permisos que me corresponda tomar. Esta pantalla es el dinero entero del
 * negocio —lo cobrado y lo que se debe—, y la casa ya trata el dinero así: los niveles de DINERO
 * de la escalera son admin-only (SCRUM-89) y `case 'export'` se bifurca por rol en el front.
 *
 * Abrirla al Técnico sería una DECISIÓN DE PERMISOS —añadirla a `TECNICO_ALLOWED` con su motivo—
 * y la toma el fundador, no este ticket. Queda reportada.
 */
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const cobros = await listarCobros((req as { merchantId: number }).merchantId);
    // SCRUM-474 fase 2 · LOS CUBOS VIAJAN CON LOS COBROS, y por eso la forma pasa de array a
    // objeto. Las opciones del filtro son el CONJUNTO CERRADO (`PAID_VIA`), no lo que haya en los
    // datos: derivarlas de los cobros le quitaría el filtro de Bizum a quien todavía no ha cobrado
    // por Bizum, y no podría distinguir «no tengo» de «no existe la opción».
    //
    // Censado por AST ANTES de cambiar la forma: el ÚNICO consumidor es `cobrosView.js:428` —los
    // otros tres usos de la ruta son el montaje, un log y una URL de mentira en un doble de red—.
    // Y ese consumidor hace `Array.isArray(r) ? r : []`, así que si alguien no adaptara el front
    // se quedaría con cero cobros: el cambio no puede pasar desapercibido.
    res.json({ cobros, cubos: cubosDeMetodo(ROTULO_SIN_METODO) });
  } catch (err) {
    console.error('[GET /admin/cobros]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
