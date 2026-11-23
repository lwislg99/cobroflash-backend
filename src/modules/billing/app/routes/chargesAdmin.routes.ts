// src/modules/billing/app/routes/chargesAdmin.routes.ts
// C1-4 — confirmación del PRO de un Bizum manual recibido ("Confirmar Bizum
// recibido", N5). El doble toque vive en la UI; aquí se valida tenant + estado
// y se dispara la MISMA cadena post-pago que un PSP (vía /webhooks/psp):
// charge.paid + paid_via='bizum_manual' → invoice.paid → WA/email/recibo.
import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../../../../core/db/prisma';
import { BASE_URL } from '../../../../core/config/env';
import { internalHeaders } from '../../../../core/http/internalAuth';
import { isFlagEnabled } from '../../../../core/flags';
import { resolverFechaDeCobro } from '../../domain/fechaDeCobro'; // SCRUM-397
import { cabeEnColumnaInt } from '../../../../core/validation/enteroDeColumna'; // SCRUM-1456c
import { datosDeCobroPagado } from '../../domain/instanteDeCobro'; // SCRUM-397 (SCRUM-1107: mismo generador)
import { zonaDelMerchant, diaExiste, inicioDelDiaEn } from '../../../../core/zonaDelMerchant'; // SCRUM-1093 (SCRUM-1108b: el día de liberación)
import { envioDelDocumento } from '../../domain/envioDelDocumento'; // SCRUM-885
import { tieneNumeroDeContacto } from '../../../../core/contacto/canalDeWhatsApp';
import { requireRole } from '../../../../core/http/authMiddleware'; // SCRUM-1107 (D2: admin-only)
import { PAID_VIA } from '../../domain/paidVia'; // SCRUM-1107
import { esFilaQueNoCasa } from '../../domain/estadoDelCobro'; // SCRUM-1532b
import {
  calcularSplitRetencion, tieneRetencionDeclarada, retencionPendiente,
  datosParaDeclararRetencion, datosParaMarcarCobrada,
} from '../../domain/retencionGarantia'; // SCRUM-1107
import { apuntarCobroDeFactura, resolverImporteRecibido, aCentimos } from '../../domain/cobrosDeFactura'; // SCRUM-1732
import { formatMoneyEs } from '../../../../core/utils/utils'; // SCRUM-1732: los textos firmados de c.21928

// SCRUM-1732 · TEXTOS FIRMADOS por Javier (regla 39) en SCRUM-1732 c.21928, LITERALES. Solo los de
// los escritores de este PR (3, 5 y 7); los demás son de la UI y van aparte.
export const TEXTO_BIZUM_PARCIAL = (cobrado: string, total: string) => `✓ Bizum confirmado: has recibido ${cobrado} de ${total}.`;
export const TEXTO_GARANTIA_COBRADA = (importe: string, numero: string) => `Garantía cobrada: ${importe} de la factura ${numero}.`;
export const TEXTO_GARANTIA_NO_CUADRA = 'Lo cobrado más lo retenido no suma el total de la factura. Revisa el importe recibido antes de declarar la garantía.';

/**
 * SCRUM-1732 · LA FACTURA DE UN COBRO, con el mismo criterio que `/webhooks/psp` (P0-3): por
 * `chargeId` directo o por el presupuesto ligado al cobro. Regla 2: dentro del merchant.
 */
async function facturaDelCobro(merchantId: number, chargeId: number) {
  const presupuesto = await prisma.quote.findFirst({ where: { chargeId, merchantId }, select: { id: true } });
  return prisma.invoice.findFirst({
    where: { merchantId, OR: [{ chargeId }, ...(presupuesto ? [{ quoteId: presupuesto.id }] : [])] },
    select: { id: true, number: true },
  });
}

/** SCRUM-1732 · ¿quien confirma ha DECLARADO una fecha? Si no, la fila sale como `marcado`. */
function hayFechaDeclarada(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

// SCRUM-885 · cuánto se espera, como mucho, a que el WhatsApp de la confirmación deje su fila.
// psp lo lanza sin `await`, así que al volver de psp puede no haber vuelto aún de Meta.
const ESPERA_WHATSAPP_MS = 3_000;
const PASO_ESPERA_MS = 250;

const router = Router();

/**
 * POST /admin/charges/:id/cancel — SCRUM-1532b · CANCELAR UN COBRO.
 *
 * La única transición del máster: `pending → cancelled` (GO del fundador, SCRUM-1532 c.22430).
 * Cancelar desde `failed` o `expired` NO entra: sería cambio de máster. El molde es «Anular factura»
 * (`invoicesAdmin.routes.ts`, `/:id/annul`): sólo administrador, idempotente, sólo desde `pending`, y
 * el estado DENTRO del `where` — entre leer y escribir cabe un pago, y dentro de la misma sentencia no
 * (las dos barreras de `estadoDelCobro.ts`). Si el pago gana la carrera, P2025 y el mismo 409.
 *
 * Lo que NO hace, a propósito:
 *  · no toca la factura: se queda pendiente de cobro (decisión 2 de c.22430);
 *  · no impide que un pago que llegue después lo deje pagado (decisión 1): el dinero es real;
 *  · no deja fila de auditoría TODAVÍA: la clave `cobro_cancelado` está aprobada (c.22435) y la añade
 *    S1 en `audit.service.ts`; la fila entra en 1532c. Lo declara `tests/scrum1532b-cancelar-cobro.test.mjs`.
 *  · no crea un `Event`: el recibo público pinta los tipos de evento, y sería texto sin firma.
 */
router.post('/:id/cancel', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!cabeEnColumnaInt(id)) return res.status(400).json({ error: 'invalid_id' });

    const charge = await prisma.charge.findFirst({
      where: { id, merchantId: req.merchantId },
      select: { status: true },
    });
    if (!charge) return res.status(404).json({ error: 'not_found' });
    if (charge.status === 'cancelled') return res.json({ ok: true, status: 'cancelled', yaEstaba: true });
    if (charge.status !== 'pending') return res.status(409).json({ error: 'charge_not_pending' });

    try {
      await prisma.charge.update({
        where: { id, merchantId: req.merchantId, status: 'pending' },
        data: { status: 'cancelled' },
      });
    } catch (e) {
      if (esFilaQueNoCasa(e)) return res.status(409).json({ error: 'charge_not_pending' });
      throw e;
    }
    return res.json({ ok: true, status: 'cancelled' });
  } catch (err: any) {
    console.error('[POST /admin/charges/:id/cancel]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/:id/confirm-bizum', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!cabeEnColumnaInt(id)) return res.status(400).json({ error: 'invalid_id' });

    // Multi-tenant: el cobro debe ser del merchant de la sesión
    // SCRUM-860 (trinquete del select) + SCRUM-1093: `select`, no `include` — antes bastaba con
    // `include: { merchant: true }` porque nada de `charge` llegaba a una respuesta; pasar
    // `charge.merchant` a `zonaDelMerchant` (SCRUM-1093) hizo que el censo dejara de poder
    // probarlo por sí solo. Solo las columnas que usa este handler: `status`/`amount`/`currency`
    // de `charge`, y `country`/`flags` (isFlagEnabled) + `timezone` (zonaDelMerchant) del merchant.
    const charge = await prisma.charge.findFirst({
      where: { id, merchantId: req.merchantId },
      select: {
        status: true,
        amount: true,
        currency: true,
        merchant: { select: { country: true, flags: true, timezone: true } },
        customer: { select: { name: true } },
      },
    });
    if (!charge) return res.status(404).json({ error: 'not_found' });
    if (charge.status === 'paid') return res.json({ ok: true, status: 'already_paid' });
    if (charge.status !== 'pending') return res.status(409).json({ error: 'charge_not_pending' });

    if (!isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant: charge.merchant })) {
      return res.status(409).json({ error: 'bizum_disabled' });
    }

    // SCRUM-397 · LA FECHA LA DICE QUIEN CONFIRMA, NO EL RELOJ.
    //
    // Éste es el único camino donde una PERSONA marca un cobro, y por tanto el único donde el
    // instante de proceso podía no ser el del dinero: un Bizum recibido el 31 de marzo y
    // confirmado el 2 de abril quedaba fechado en abril — **cruza de trimestre**, y con criterio
    // de caja es el euro declarado en el periodo que no toca.
    //
    // El criterio (futura no, hacia atrás sin límite) y sus dos textos son los APROBADOS el
    // 10-ago-2026 para el mismo problema en facturas: se reutilizan, no se inventan (regla 30).
    // Sin fecha, `ahora` — que no es el defecto: el defecto era no poder cambiarla.
    // SCRUM-1093 · el «hoy» que decide si la fecha es futura es el del MERCHANT. `charge.merchant`
    // ya viaja completo en el `include` de arriba: no hace falta tocar la consulta.
    const fecha = resolverFechaDeCobro(
      (req.body as any)?.paid_at ?? (req.body as any)?.fecha,
      new Date(),
      zonaDelMerchant(charge.merchant),
    );
    if (!fecha.ok) return res.status(400).json({ error: fecha.error, message: fecha.message });

    // SCRUM-1732 · EL IMPORTE LO DICE QUIEN CONFIRMA, como la fecha. Hasta aquí se mandaba siempre
    // `charge.amount` (lo pedido) y no había forma de decir «he recibido 950». Sin declarar, lo pedido.
    const importeRecibido = resolverImporteRecibido((req.body as any)?.importe, charge.amount);
    if (!importeRecibido.ok) return res.status(400).json({ error: importeRecibido.error });
    const fechaOrigen = hayFechaDeclarada((req.body as any)?.paid_at ?? (req.body as any)?.fecha) ? 'declarada' : 'marcado';

    // Misma cadena post-pago que el PSP (P0-3: factura ligada → paid, WA, email)
    await axios.post(`${BASE_URL}/webhooks/psp`, {
      event: 'payment.confirmed',
      charge_id: id,
      method: 'bizum_manual',
      bank_ref: `bizum-manual-${Date.now()}`,
      amount: importeRecibido.importe, // SCRUM-1732: lo que entró, no lo pedido
      fecha_origen: fechaOrigen, // SCRUM-1732: psp lo apunta en invoice_payments
      currency: charge.currency,
      // `ts` ya estaba en el esquema del webhook y no lo leía nadie. Ahora es la fecha del cobro.
      ts: fecha.fecha.toISOString(),
    }, { timeout: 10_000, headers: internalHeaders() });

    // SCRUM-885 · si el documento no ha salido ni por email ni por WhatsApp, el profesional tiene
    // que enterarse AQUÍ, que es donde está mirando. Sólo se leen hechos ya guardados: no se
    // envía nada. Qué se pinta lo decide la regla del dashboard (`avisoDocumentoSinEnviar`).
    const envioDocumento = await envioDelDocumentoDelCobro(req.merchantId!, id);

    // SCRUM-1732 · texto 3 firmado (c.21928), sólo si entró menos de lo pedido; el cobro entero
    // conserva el aviso de siempre, que pinta la UI.
    const parcial = (aCentimos(importeRecibido.importe) ?? 0) < (aCentimos(charge.amount) ?? 0);
    return res.json({
      ok: true, status: 'paid', paid_via: 'bizum_manual', paid_at: fecha.fecha.toISOString(), envioDocumento,
      importe_recibido: importeRecibido.importe,
      ...(parcial ? { message: TEXTO_BIZUM_PARCIAL(formatMoneyEs(importeRecibido.importe, charge.currency), formatMoneyEs(charge.amount, charge.currency)) } : {}),
    });
  } catch (err: any) {
    console.error('[POST /admin/charges/:id/confirm-bizum]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/charges/:id/garantia — SCRUM-1107 · declara sobre un cobro EXISTENTE que un
 * porcentaje quedó retenido por garantía de obra, y cuándo se puede reclamar.
 *
 * NO toca `charge.amount` ni el estado del cobro: es metadata aditiva, no una corrección de lo
 * ya cobrado. `total` lo manda quien llama (no se deriva de `Invoice`: un `Charge` puede saldar
 * más de una factura — `Charge.invoices` — y no hay «la» factura de la que sacarlo aquí).
 *
 * `requireRole('admin')`, mismo criterio que `bulk-tags` (SCRUM-55/1059): dinero retenido de un
 * cliente, sin motivo de campo que lo lleve a `TECNICO_ALLOWED`.
 */
router.post('/:id/garantia', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!cabeEnColumnaInt(id)) return res.status(400).json({ error: 'invalid_id' });

    const charge = await prisma.charge.findFirst({
      where: { id, merchantId: req.merchantId }, // regla 2
      select: { id: true, status: true, amount: true, merchant: { select: { timezone: true } } },
    });
    if (!charge) return res.status(404).json({ error: 'not_found' });
    // SCRUM-1732 · la retención se declara sobre un cobro YA cobrado (antes aceptaba uno `pending`).
    if (charge.status !== 'paid') return res.status(409).json({ error: 'charge_not_paid' });

    const total = Number(req.body?.total);
    const porcentaje = Number(req.body?.porcentaje);
    // SCRUM-1108b: un día suelto (`YYYY-MM-DD`) es un día del MERCHANT, no la medianoche UTC. Con
    // `new Date('2027-09-23')` una zona con desfase negativo (México, Bogotá) leía el día 22, y ese
    // día es el que la ficha pinta en «liberación desde el …». Un instante completo se respeta.
    const crudo = req.body?.liberacion ? String(req.body.liberacion) : '';
    const liberacion = /^\d{4}-\d{2}-\d{2}$/.test(crudo)
      ? (diaExiste(crudo) ? inicioDelDiaEn(crudo, zonaDelMerchant(charge.merchant)) : null)
      : (crudo ? new Date(crudo) : null);
    if (!liberacion || !Number.isFinite(liberacion.getTime())) {
      return res.status(400).json({ error: 'liberacion_invalida' });
    }

    const split = calcularSplitRetencion(total, porcentaje);
    if (!split.ok) return res.status(400).json({ error: split.error });

    // SCRUM-1732 · COBRADO + RETENIDO = TOTAL, en céntimos. «Cobrado» es lo apuntado en
    // `invoice_payments` para este cobro (filas `cobro` que nadie ha anulado); un cobro anterior
    // a la tabla no tiene filas y vale lo que dice su `amount`, como hasta hoy.
    const filas = await prisma.invoicePayment.findMany({
      where: { merchantId: req.merchantId!, chargeId: id, tipo: 'cobro', anuladaPor: null },
      select: { importe: true },
    });
    const cobradoC = filas.length
      ? filas.reduce((a, fila) => a + (aCentimos(fila.importe) ?? 0), 0)
      : (aCentimos(charge.amount) ?? 0);
    if (cobradoC + (aCentimos(split.importeRetenido) ?? NaN) !== aCentimos(total)) {
      return res.status(409).json({ error: 'cobrado_mas_retenido_no_cuadra', message: TEXTO_GARANTIA_NO_CUADRA });
    }

    const actualizado = await prisma.charge.update({
      where: { id },
      data: datosParaDeclararRetencion(split, liberacion),
      select: {
        retencionGarantiaPorcentaje: true, retencionGarantiaImporte: true,
        retencionGarantiaLiberacion: true, retencionGarantiaCobrada: true,
      },
    });
    return res.json({ ok: true, retencion: actualizado, importeRecibido: split.importeRecibido });
  } catch (err) {
    console.error('[POST /admin/charges/:id/garantia]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /admin/charges/:id/garantia/liberar — SCRUM-1107 · registra que la garantía retenida se
 * cobró. El dinero es un `Charge` NUEVO (mismo generador que cualquier otro cobro — SCRUM-397,
 * `datosParaMarcarCobrada`); las dos escrituras van en UNA transacción: nunca queda un cobro de
 * liberación sin que se apague el aviso, ni el aviso apagado sin que exista el cobro.
 *
 * `concept` y `method` los manda quien llama — ningún texto se inventa aquí (regla 39).
 */
router.post('/:id/garantia/liberar', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!cabeEnColumnaInt(id)) return res.status(400).json({ error: 'invalid_id' });

    const original = await prisma.charge.findFirst({
      where: { id, merchantId: req.merchantId }, // regla 2
      select: {
        id: true, customerId: true, currency: true,
        retencionGarantiaPorcentaje: true, retencionGarantiaImporte: true, retencionGarantiaCobrada: true,
      },
    });
    if (!original) return res.status(404).json({ error: 'not_found' });
    if (!tieneRetencionDeclarada(original)) return res.status(409).json({ error: 'sin_retencion_declarada' });
    if (!retencionPendiente(original)) return res.status(409).json({ error: 'ya_cobrada' });

    const importe = req.body?.importe !== undefined ? Number(req.body.importe) : Number(original.retencionGarantiaImporte);
    if (!Number.isFinite(importe) || importe <= 0) return res.status(400).json({ error: 'importe_invalido' });

    const method = String(req.body?.method || '');
    if (!(PAID_VIA as readonly string[]).includes(method)) return res.status(400).json({ error: 'method_invalido' });

    const concept = String(req.body?.concept || '').trim();
    if (!concept) return res.status(400).json({ error: 'concept_requerido' });

    // SCRUM-397 · un solo generador para «pagado + su instante + su evento» — nunca los tres
    // campos a mano (censo `tests/scrum397-instante-de-cobro.test.mjs`, «nadie marca un cobro
    // pagado fuera del generador»).
    // SCRUM-1732 (decisión ④ de c.21928) · LA FECHA LA DICE QUIEN LIBERA, con el patrón de
    // `confirm-bizum`: mismo criterio (futura no, hacia atrás sin límite) y la zona del merchant.
    const merchantZona = await prisma.merchant.findUnique({ where: { id: req.merchantId! }, select: { timezone: true } });
    const fechaDeclarada = (req.body as any)?.paid_at ?? (req.body as any)?.fecha;
    const fecha = resolverFechaDeCobro(fechaDeclarada, new Date(), zonaDelMerchant(merchantZona));
    if (!fecha.ok) return res.status(400).json({ error: fecha.error, message: fecha.message });
    const ahora = fecha.fecha;
    const fechaOrigen = hayFechaDeclarada(fechaDeclarada) ? 'declarada' : 'marcado';
    // SCRUM-1732 · la factura del cobro ORIGINAL: la liberación se apunta contra ella.
    const factura = await facturaDelCobro(req.merchantId!, original.id);

    const [nuevoCharge] = await prisma.$transaction([
      prisma.charge.create({
        data: {
          merchantId: req.merchantId!,
          customerId: original.customerId,
          concept,
          amount: importe,
          currency: original.currency,
          method,
          ...datosDeCobroPagado(ahora, { tipo: 'liberacion_garantia_obra', chargeOriginalId: original.id }),
        },
        select: { id: true },
      }),
      prisma.charge.update({ where: { id: original.id }, data: datosParaMarcarCobrada(ahora) }),
    ]);
    // SCRUM-1732 · fila `liberacion_garantia` con el `invoice_id`: lo que le faltaba (c.21820 ②).
    // Idempotente por el único (invoice_id, charge_id), y el cobro de la liberación es nuevo.
    if (factura) {
      await apuntarCobroDeFactura(prisma, {
        merchantId: req.merchantId!, invoiceId: factura.id, chargeId: nuevoCharge.id,
        importe, fechaCobro: ahora, fechaOrigen, metodo: method, tipo: 'liberacion_garantia',
      });
    }
    return res.json({
      ok: true, chargeLiberacionId: nuevoCharge.id, retencionGarantiaCobrada: ahora.toISOString(),
      ...(factura ? { invoiceId: factura.id, message: TEXTO_GARANTIA_COBRADA(formatMoneyEs(importe, original.currency), factura.number) } : {}),
    });
  } catch (err) {
    console.error('[POST /admin/charges/:id/garantia/liberar]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

async function envioDelDocumentoDelCobro(merchantId: number, chargeId: number) {
  // El contacto se lee aquí, con su `select` y desde el id de la ruta, y no ensanchando el
  // `include` del cobro ni pasándole nada de él: lo leído sin `select` acabaría viajando hasta la
  // respuesta (trinquete de SCRUM-860).
  const customer = (await prisma.charge.findFirst({
    where: { id: chargeId, merchantId }, // regla 2
    select: { customer: { select: { email: true, phone: true, mobile: true } } },
  }))?.customer ?? null;
  const leerEstados = () =>
    prisma.whatsAppMessage.findMany({
      where: { merchantId, relatedType: 'charge', relatedId: chargeId }, // regla 2
      select: { status: true, createdAt: true },
    });

  let estados = await leerEstados();
  // Sólo merece la pena esperar si el aviso depende de ello: cliente sin email y con número.
  const dependeDelWhatsapp = !customer?.email && tieneNumeroDeContacto(customer);
  for (let t = 0; dependeDelWhatsapp && estados.length === 0 && t < ESPERA_WHATSAPP_MS; t += PASO_ESPERA_MS) {
    await new Promise((r) => setTimeout(r, PASO_ESPERA_MS));
    estados = await leerEstados();
  }
  return envioDelDocumento({
    clienteEmail: customer?.email,
    filasWhatsapp: estados,
    enCurso: dependeDelWhatsapp && estados.length === 0,
  });
}

export default router;
