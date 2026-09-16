// src/modules/messaging/app/routes/resendWebhook.routes.ts — SCRUM-475 (fase 2B)
//
// EL RECEPTOR. Aquí es donde un rebote deja de perderse.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTA RUTA CIERRA
//
// Hasta hoy el correo salía, se escribía su fila con `aceptado_sin_confirmacion` y **ahí se
// quedaba para siempre**: `entregado`, `rebotado` y `reclamado` son los tres estados que un envío
// propio NO puede producir. Sin esta ruta el embudo del correo tenía un solo escalón, mientras el
// de WhatsApp tiene cuatro. Por ese canal viaja la factura al cliente final.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL CUERPO CRUDO, Y POR QUÉ EL PARSER VIVE AQUÍ
//
// La firma cubre los BYTES tal y como llegaron. Un `express.json()` parsea y **re-serializa**, y
// con eso la firma deja de casar aunque el aviso sea legítimo. `firmaResend.ts` lo impone en su
// propia firma de función: recibe `Buffer` y nada más, y cualquier otra cosa devuelve
// `cuerpo_no_crudo` en vez de «firma inválida» — que es lo único que hace depurable ese día.
//
// Se exporta el parser desde el router (`rawBody`) y `app.ts` lo monta ANTES del parser global,
// que es como lo hacen los dos webhooks de Stripe. La alternativa —añadir esta URL a la lista del
// `verify` del parser global, como hace WhatsApp— obligaría a tocar el parser por el que pasa TODA
// la aplicación para no ganar nada. El propio `firmaResend.ts` deja esa comparación escrita.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 QUÉ SE CONTESTA, Y POR QUÉ CASI TODO ES 200
//
// Un webhook que devuelve error hace que el proveedor **reintente en bucle**. Así que solo se
// contesta con error lo que un reintento podría arreglar:
//
//   · 401 → `RECHAZADO`. La firma se comprobó y no casa. Reintentar no lo va a arreglar, pero
//     tampoco queremos acusar recibo de algo que no hemos podido creer.
//   · 503 → `NO_SE_PUDO_COMPROBAR`. **Es un fallo NUESTRO** (falta el secreto, llega mal pegado, o
//     alguien metió un parser delante). Un reintento SÍ puede funcionar en cuanto se arregle, así
//     que se pide que lo repitan. Y el log lo dice con su motivo: sin esa separación, el día que el
//     secreto de Railway esté mal pegado se buscará el fallo en el proveedor durante horas.
//   · 200 → todo lo demás, incluido «este aviso no lo entiendo» y «de ese envío no consta nada».
//     Los dos son estados legítimos del mundo, no averías: reintentarlos no cambiaría el resultado.
//
// ⚠️ NO se contesta con el detalle de por qué se rechazó. El detalle va al LOG; al que manda basura
// se le dice «no» y ya — un mensaje de error que explica qué le faltó a la firma es un manual.
import express from 'express';
import { config } from '../../../../core/config/env';
import { verificarFirmaResend } from '../../../../integrations/firmaResend';
import { leerAviso } from '../../domain/avisoDeCorreo';
import { aplicarAvisoDeProveedor } from '../../domain/registroDeEnvios';

/** El parser propio. Se monta desde `app.ts` ANTES del global — ver la cabecera. */
export const rawBody = express.raw({ type: 'application/json' });
export const router = express.Router();

/** Una línea por aviso. Es lo único que queda cuando algo no cuadra. */
function anotar(campos: Record<string, unknown>): void {
  console.log('[correo:webhook]', JSON.stringify(campos));
}

router.post('/', async (req, res) => {
  const veredicto = verificarFirmaResend({
    cabeceras: req.headers as Record<string, unknown>,
    cuerpoCrudo: req.body,
    secreto: config.RESEND_WEBHOOK_SECRET,
  });

  if (!veredicto.ok) {
    // 🔴 LAS DOS CLASES NO SE JUNTAN. `firmaResend.ts` las separa en el TIPO justamente para que
    // aquí no se pierda la que importa, y juntarlas en un 401 genérico sería tirar esa distinción
    // en el último metro.
    anotar({ evento: 'firma_no_aceptada', clase: veredicto.clase, motivo: veredicto.motivo });
    const estado = veredicto.clase === 'NO_SE_PUDO_COMPROBAR' ? 503 : 401;
    return res.status(estado).json({ ok: false });
  }

  const lectura = leerAviso(veredicto.cuerpo);
  if (!lectura.ok) {
    // Firma buena y contenido que no sabemos leer: se acusa recibo (200) y se deja dicho. No es un
    // ataque —la firma es nuestra— y reintentarlo daría exactamente lo mismo.
    anotar({ evento: 'aviso_no_legible', motivo: lectura.motivo, avisoId: veredicto.id });
    return res.json({ ok: true, aplicado: false, motivo: lectura.motivo });
  }

  const resultado = await aplicarAvisoDeProveedor({
    idProveedor: lectura.idProveedor,
    estado: lectura.estado,
    motivo: motivoDelAviso(veredicto.cuerpo),
  });

  anotar({
    evento: 'aviso_aplicado', tipo: lectura.evento, estado: lectura.estado,
    ...(resultado.aplicado
      ? { fila: resultado.id, antes: resultado.antes, despues: resultado.despues }
      : { aplicado: false, motivo: resultado.motivo }),
  });

  // 200 también cuando no consta el envío: el aviso se recibió y se entendió. Ver
  // `aplicarAvisoDeProveedor` — no hay backfill, y una fila fabricada aquí sería peor que ninguna.
  return res.json({ ok: true, aplicado: resultado.aplicado });
});

/**
 * El motivo que el proveedor dé para un rebote, si lo da. `null` si no consta.
 *
 * ⚠️ NO se inventa uno cuando falta: un «rebotado: error desconocido» parece información y no lo
 * es. Y lo que salga de aquí lo enmascara el repositorio antes de guardarlo, porque estos mensajes
 * suelen traer la dirección dentro.
 */
function motivoDelAviso(cuerpo: unknown): string | null {
  const c = cuerpo as Record<string, unknown> | null;
  const datos = (c?.data ?? null) as Record<string, unknown> | null;
  for (const candidato of [datos?.reason, datos?.message, datos?.error]) {
    if (typeof candidato === 'string' && candidato.trim()) return candidato.trim();
  }
  const rebote = (datos?.bounce ?? null) as Record<string, unknown> | null;
  const deRebote = rebote?.message ?? rebote?.reason;
  return typeof deRebote === 'string' && deRebote.trim() ? deRebote.trim() : null;
}
