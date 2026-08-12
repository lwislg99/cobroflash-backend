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
    // 🔴 SCRUM-474 fase 2 · LOS CUBOS NO VIAJAN AQUÍ, y esto es la corrección de un error de
    // diseño: metí un dato CONSTANTE dentro del sobre de un dato VARIABLE. El conjunto cerrado de
    // métodos no cambia entre peticiones —es configuración del producto, no parte de una lista— y
    // por eso se sirve en el ARRANQUE (`/admin/me`), donde ya viajan los rótulos del albarán por
    // el mismo motivo (SCRUM-300).
    //
    // Lo que lo decidió: con los cubos aquí, la barra de filtros solo existía si la respuesta
    // llegaba. Nuestro profesional está en una azotea con una raya de cobertura —el bloque H
    // entero existe por eso—, y una pantalla de DINERO que se queda sin filtros justo cuando la
    // red va mal es lo contrario del producto que decimos ser. Lo cazaron los tres SUELOS de
    // SCRUM-448, que miden la pantalla con la petición en vuelo y tras el fallo.
    //
    // La respuesta se queda como estaba —un array—, así que ningún consumidor cambia de forma.
    res.json(cobros);
  } catch (err) {
    console.error('[GET /admin/cobros]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
