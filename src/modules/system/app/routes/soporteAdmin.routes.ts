// src/modules/system/app/routes/soporteAdmin.routes.ts — SCRUM-406
//
// «ESCRÍBENOS»: LA RUTA QUE HACE QUE EL MENSAJE LLEGUE A ALGUIEN.
//
// La medición del 10-ago (`docs/master/SCRUM-406.md`) encontró que el producto **no tenía el otro
// extremo**: 24 modelos y ninguno de soporte, ningún destinatario interno en todo `src/`, y un
// `mailto:` que se lleva el hilo fuera del producto. El botón ya no faltaba —desde SCRUM-416 el «?»
// está en las 25 cabeceras de modal—; faltaba dónde aterrizar.
//
// Se monta con `mountAdmin`, así que hereda `requireAuth`, `req.merchantId` y `req.sessionId`. Sin
// rol por encima del default, y por el mismo motivo que `POST /admin/entorno`: **pedir ayuda no es
// una capacidad de administración**, y dejarlo admin-only silenciaría justo al operario que está en
// la obra, que es quien más lo necesita.
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { enviarCorreo } from '../../../../integrations/enviarCorreo';
// SCRUM-508: la clase de correo sale del vocabulario cerrado, no de un literal a mano.
import { CLASES_DE_CORREO } from '../../../messaging/domain/registroDeEnvios';
import { construirCorreoSoporte, exigirMensaje } from '../../domain/soporte';
import { sendFailureBody, sendSuccessBody } from '../../../../lib/sendOutcome';

const router = Router();

router.post('/', async (req, res) => {
  const v = exigirMensaje((req.body || {}).mensaje);
  if (!v.ok) return res.status(400).json({ error: v.error });

  const merchantId = (req as unknown as { merchantId: number }).merchantId;
  const sessionId = (req as unknown as { sessionId: number }).sessionId;

  // El contexto se LEE de donde ya vive; no se recoge nada nuevo. `instaladaPwa` lo escribe
  // `POST /admin/entorno` desde SCRUM-360 (H5 fase 2).
  const [merchant, sesion] = await Promise.all([
    prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { name: true, legalName: true, email: true },
    }),
    // `findFirst` con merchantId Y NO `findUnique` por id (regla 2). El id ya sale de la cookie,
    // así que nadie puede nombrar una sesión ajena — pero el trinquete de SCRUM-348 solo admite
    // CINCO lecturas que dependan de la procedencia del id, y **el trinquete solo baja**: no se
    // sube el tope para colar la sexta. Aquí el filtro existe, así que se pone.
    prisma.authSession.findFirst({
      where: { id: sessionId, merchantId },
      select: { instaladaPwa: true, teamMemberId: true },
    }),
  ]);

  const correo = construirCorreoSoporte(v.mensaje, {
    merchantId,
    merchantEmail: merchant?.email ?? null,
    merchantNombre: merchant?.legalName || merchant?.name || null,
    teamMemberId: sesion?.teamMemberId ?? null,
    pantalla: typeof (req.body || {}).pantalla === 'string' ? (req.body as { pantalla: string }).pantalla : null,
    instaladaPwa: sesion?.instaladaPwa ?? null,
  });

  // SCRUM-508 · deja fila. El destinatario es soporte (la casa), no un cliente: `customerId` va
  // nulo, y no hay documento al que atarlo. El `merchantId` es de QUIÉN escribió, que es lo que hay
  // que poder consultar después.
  const r = await enviarCorreo({ ...correo, registro: { merchantId, kind: CLASES_DE_CORREO.soporte } });

  // 🔴 EL SUELO DEL TICKET. `sent` es la única verdad sobre si salió (SCRUM-126), y aquí no se
  // adorna: si el correo no ha salido, el profesional lo lee y se va con el texto en la mano. Decir
  // «Lo hemos recibido» sin haberlo recibido es peor que el `mailto:` que esto sustituye.
  if (!r.enviado) return res.json(sendFailureBody('email_send_failed', { motivo: r.motivo }));
  return res.json(sendSuccessBody());
});

export default router;
