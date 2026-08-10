// src/modules/system/domain/avisoPuerta.service.ts — SCRUM-390 · el paso del cron que avisa.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ASÍ Y NO DE OTRA FORMA — decisión del fundador, 10-ago-2026
//
//   · **NO al log solo.** Con el backup se aprendió que algo que solo escribe en un log es algo
//     que nadie ejecuta. Un aviso que nadie lee es prosa otra vez, que es el defecto del ticket.
//   · **NO al arranque.** Un `exit(1)` por esto tiraría el servicio. La puerta AVISA, no frena.
//   · **WhatsApp** porque ya está construido (regla 36: cero dependencias nuevas) y es el canal
//     que el fundador lee.
//
// ⚠️ EL PASO NO PUEDE TUMBAR EL CRON. Si el aviso falla, el cron sigue y el fallo se registra:
// **un vigilante que rompe lo que vigila es peor que no tenerlo.** De ahí que todo vaya dentro de
// un `try` y que la función devuelva un resultado en vez de lanzar.
//
// ⚠️ EL AVISO VA SOLO AL FUNDADOR. Ni un merchant recibe nada — es un mensaje interno (regla 28).
// El número sale de `ALERTA_FUNDADOR_TELEFONO` (Railway); aquí no se escribe ninguno, y sin esa
// variable el paso no manda nada y lo dice.
import { prisma } from '../../../core/db/prisma';
import { sendWhatsAppText } from '../../../integrations/whatsapp';
import {
  evaluarPuerta, debeAvisar, mensajeParaElFundador, CUENTAS_DE_PRUEBA_DECLARADAS,
} from './puertaClienteReal';

/** Las cláusulas que dependían de que no hubiera cliente real. Se NOMBRAN en el aviso. */
export const CLAUSULAS_DEPENDIENTES = Object.freeze([
  'docs/YAQU_MASTER.md — la regla fechada de los datos de producción',
  'docs/MIGRATIONS_PENDING.md — el backfill que se dejó caer por ella',
  'SCRUM-402 — el rótulo de Bizum necesita microcopy aprobada ANTES de encender la bandera',
]);

export interface ResultadoAviso {
  abierta: boolean;
  avisado: boolean;
  motivo: string;
  /** Lo que impidió avisar, si algo lo impidió. NUNCA se lanza: se devuelve. */
  fallo?: string;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Mira la puerta y, si toca, avisa al fundador. **No lanza nunca.**
 *
 * `db` y `enviar` entran por parámetro para poder probarlo sin base y sin mandar WhatsApps.
 */
export async function avisarSiEntroClienteReal(opciones: {
  db?: any;
  enviar?: typeof sendWhatsAppText;
  telefono?: string;
  ahora?: Date;
} = {}): Promise<ResultadoAviso> {
  const db = opciones.db ?? prisma;
  const enviar = opciones.enviar ?? sendWhatsAppText;
  const telefono = opciones.telefono ?? (process.env.ALERTA_FUNDADOR_TELEFONO || '').replace(/\D/g, '');
  const ahora = opciones.ahora ?? new Date();

  try {
    const [total, conSuscripcion, primero] = await Promise.all([
      db.merchant.count(),
      db.merchant.count({ where: { stripeSubscriptionId: { not: null } } }),
      db.merchant.findFirst({
        where: { stripeSubscriptionId: { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    const v = evaluarPuerta({ total, conSuscripcion }, [...CLAUSULAS_DEPENDIENTES], CUENTAS_DE_PRUEBA_DECLARADAS);
    // La fecha de apertura se DERIVA del dato que la abre. Si la abrió el conteo (un merchant de
    // más sin suscripción), no hay fecha y la cadencia lo trata como «no se sabe» → avisa.
    const diasDesdeApertura = primero?.createdAt
      ? Math.floor((ahora.getTime() - new Date(primero.createdAt).getTime()) / DIA_MS)
      : null;

    const decision = debeAvisar(v, { diasDesdeApertura });
    if (!decision.avisa) return { abierta: v.abierta, avisado: false, motivo: decision.motivo };

    if (!telefono) {
      return {
        abierta: true, avisado: false, motivo: decision.motivo,
        fallo: 'sin ALERTA_FUNDADOR_TELEFONO: la puerta está abierta y no hay a quién avisar',
      };
    }

    await enviar({ to: telefono, text: mensajeParaElFundador(v) });
    return { abierta: true, avisado: true, motivo: decision.motivo };
  } catch (err: any) {
    // El cron sigue. Siempre.
    return { abierta: false, avisado: false, motivo: 'no se pudo evaluar', fallo: String(err?.message ?? err) };
  }
}
