// src/modules/auth/app/routes/entornoAdmin.routes.ts — SCRUM-360 (H5 · fase 2)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ UN ENDPOINT PROPIO Y NO COLGADO DE `/admin/me`, que era la otra opción
//
// `/admin/me` es la petición que YA se hace en cada arranque, así que colgarlo ahí sale gratis en
// número de peticiones. Se descarta por dos motivos medidos, y el segundo decide:
//
//   1. Es un **GET**, y esto ESCRIBE. Un GET con efecto sobre la base es la clase de cosa que
//      alguien reintenta, precachea o dispara dos veces sin pensarlo.
//   2. 🔴 **`/admin/me` es la puerta de arranque, y su fallo ECHA AL PROFESIONAL A `/login.html`**
//      — medido en `app.js:6-7`: `catch { window.location.href = '/login.html'; return; }`. Una
//      escritura de TELEMETRÍA no puede tener la capacidad de cerrarle la sesión a nadie. Acoplar
//      lo prescindible a lo imprescindible siempre se paga en la dirección mala.
//
// El coste que sí tiene y se acepta: una superficie más que mantener, y una petición más por
// arranque. Va suelta, no bloquea nada, y si falla la app ni se entera.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { Router } from 'express';
import { esEntornoApp, registrarEntornoDeSesion } from '../../domain/entornoApp.service';

const router = Router();

/**
 * POST /admin/entorno — «el último entorno visto» de ESTA sesión.
 *
 * Se monta con `mountAdmin`, así que hereda `requireAuth`, `req.merchantId` y `req.sessionId`.
 * No hace falta declarar rol por encima del default: escribir el entorno de **la propia sesión** no
 * es una capacidad de administración — y restringirlo a admin dejaría sin medir justo a los
 * técnicos, que son quienes más van a obra.
 */
router.post('/', async (req, res) => {
  const entorno = (req.body || {}).entorno;
  // Unión CERRADA: lo que no está en la lista no se normaliza a nada. Convertir un valor
  // desconocido en `desconocido` sería guardar un `null` que parece medido y no lo es.
  if (!esEntornoApp(entorno)) return res.status(400).json({ error: 'invalid_entorno' });

  const r = await registrarEntornoDeSesion((req as { sessionId: number }).sessionId, entorno);
  // 200 incluso cuando no se pudo: el cliente no tiene nada que hacer con ese fallo y reintentar
  // no arregla nada. Lo que se devuelve es QUÉ pasó, para que se pueda mirar desde un test.
  res.json(r);
});

export default router;
