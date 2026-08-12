// src/modules/system/invoiceAdmin.ts
import { prisma } from '../../core/db/prisma';
import { Prisma } from '@prisma/client';
import { recalcJobCobradoForInvoice } from '../jobs/domain/job.service'; // SCRUM-28
// SCRUM-441: el conjunto cerrado de métodos se CONSUME desde su dueño. Aquí no se copia ni un valor.
import { campoPaidViaAlMarcar } from '../billing/domain/metodoDeCobro';

// Listado para el BO (con filtros)
export async function listInvoicesAdmin(
  merchantId: number,
  status: string | 'all' = 'all',
  search?: string,
  dateFrom?: Date | null,
  dateTo?: Date | null,
) {
  /**
   * SCRUM-442 · EL LISTADO DE «FACTURAS» ENSEÑA SOLO FACTURAS.
   *
   * Facturas y justificantes viven en la MISMA tabla y se distinguen por `type`
   * (`invoicesAdmin.routes.ts:126` escribe `'F1'`, `:142` escribe `'JUST'`). Este `where` tenía
   * CUATRO criterios —merchant, estado, búsqueda, fechas— y `type` no estaba en ninguno, así que
   * los justificantes salían mezclados: **44 de 55 documentos en producción (10-ago-2026) no eran
   * facturas**. Cuatro de cada cinco.
   *
   * Un justificante de cobro **no es una factura** —vive fuera de toda serie fiscal, V0-0— y el
   * profesional los estaba contando como si lo fueran.
   *
   * ⚠️ ESTO CAMBIA QUÉ SE LISTA, JAMÁS QUÉ SE GUARDA (regla 29). Ni una fila se toca.
   *
   * 🔴 Y NO LOS ESCONDE: su sitio es **Cobros** (diseño §B4). Comprobado ANTES de excluirlos, que
   * era el suelo de este ticket: `cobros.service.ts` lista **la unión** de todo `Charge` MÁS toda
   * `Invoice` con `chargeId: null` —que hoy son todas, porque nadie escribe ese campo— y **no
   * filtra por `type`**. Los 44 siguen alcanzables.
   *
   * Si Cobros listara solo `Charge`, excluirlos aquí los habría borrado del producto: un cobro por
   * transferencia o efectivo **no crea `Charge`** (SCRUM-441). Ese módulo ya lo dice con todas las
   * letras — «una pantalla que lista solo `Charge` no está incompleta: miente por omisión».
   */
  const where: Prisma.InvoiceWhereInput = { merchantId, type: { not: 'JUST' } };

  if (status && status !== 'all') {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { phone: { contains: search, mode: 'insensitive' } } },
      { customer: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as any).gte = dateFrom;
    if (dateTo)   (where.createdAt as any).lte = dateTo;
  }

  return prisma.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      quote: { select: { id: true } },
    },
  });
}

// Detalle de una factura
export async function getInvoiceDetailAdmin(id: number, merchantId?: number) {
  // A21.3: scoping multi-tenant también en la LECTURA (regla 2)
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...(merchantId != null ? { merchantId } : {}) },
    include: {
      merchant: true,
      customer: true,
      quote: true,
      rectifies:   { select: { id: true, number: true } }, // original (si esta es R1)
      rectifiedBy: { select: { id: true, number: true } }, // rectificativa emitida (si existe)
    },
  });
  if (!invoice) return null;

  // SCRUM-97: el objeto Merchant/Customer completo se colaba entero en la respuesta —
  // IBAN/CLABE, ids de Stripe, estado de suscripción, flags internos del merchant; el
  // portalToken del customer (la llave de SU portal público) — a CUALQUIER rol, incluido
  // Técnico (esta ruta no lleva requireRole). Mismo recorte que ya usa
  // getQuoteDetailAdmin (quoteAdmin.ts): allowlist explícita, nunca el objeto Prisma
  // crudo. Ningún consumidor actual (frontend/route) leía los campos recortados.
  return {
    ...invoice,
    merchant: {
      id: invoice.merchant.id,
      name: invoice.merchant.name,
      legalName: invoice.merchant.legalName,
      taxId: invoice.merchant.taxId,
      address: invoice.merchant.address,
      whatsappPhone: invoice.merchant.whatsappPhone,
      defaultCurrency: invoice.merchant.defaultCurrency,
      logoUrl: invoice.merchant.logoUrl,
    },
    customer: {
      id: invoice.customer.id,
      name: invoice.customer.name,
      phone: invoice.customer.phone,
      email: invoice.customer.email,
      notes: invoice.customer.notes,
    },
  };
}

// Cambiar estado (pending/paid/expired) manteniendo paidAt coherente.
// A21.3: SIEMPRE con merchantId (regla 2 multi-tenant — un id ajeno = null) y
// "deshacer pago" (→pending) SOLO pre-SIF: justificantes (J-…) o tipo JUST;
// una factura F1 real jamás se des-paga a mano — para eso está la R1 (regla 29).
export class UnpayNotAllowedError extends Error {}

/**
 * SCRUM-153 / SCRUM-496 · EL ESTADO DEL QUE NO SE SALE, con nombre y en UN solo sitio.
 *
 * La Parte L declara `pending -> annulled` y **no declara ninguna transicion que salga de
 * `annulled`**. Vivia como literal suelto dentro de la guarda de abajo, asi que la puerta masiva no
 * podia reutilizarlo sin copiarlo — y copiarlo es como dos puertas acaban discrepando sobre el
 * mismo documento.
 */
export const ESTADO_ANULADA = 'annulled';

/**
 * Estados desde los que un marcado MASIVO no puede llevar a `paid`.
 *
 * `paid` porque ya lo esta; `annulled` porque **no se sale de ahi**. Es el conjunto que el `where`
 * del lote consume: la regla vive aqui, al lado de la guarda de una sola factura, y no en el filtro
 * de una consulta donde nadie la lee.
 */
export const NO_SE_MARCAN_PAGADAS_EN_LOTE = ['paid', ESTADO_ANULADA] as const;

/**
 * SCRUM-502 · ¿Puede una PASARELA marcar cobrado este documento?
 *
 * Lo unico que se prohibe aqui es la ANULADA, y por eso no reusa
 * `NO_SE_MARCAN_PAGADAS_EN_LOTE`: ese conjunto excluye tambien `paid`, y para una pasarela volver a
 * escribir `paid` sobre una ya pagada es IDEMPOTENTE y pasa de verdad —los webhooks se reintentan—.
 * Excluirla cambiaria el comportamiento del cobro, y el GO era solo la guarda de anulada.
 *
 * PURA a proposito: se ejercita con filas de verdad, sin base de datos ni webhook, que es la unica
 * forma de que el rojo hable del HECHO y no de la forma del `where`.
 *
 * 🔴 Las tres puertas de pasarela llamaban a `update` sin mirar el estado. La diferencia con
 * `bulk-paid` no es de grado: alli alguien pulsa un boton, aqui **se dispara solo** con lo que
 * llegue por la red. Y el enlace sobrevive a la anulacion — anular escribe SOLO `status`
 * (`invoicesAdmin.routes.ts`), asi que `chargeId` y `quoteId` siguen apuntando.
 */
export function puedeCobrarPorPasarela(documento: { status: string }): boolean {
  return documento.status !== ESTADO_ANULADA;
}

/**
 * ¿Puede este documento pasar a `paid` por el marcado masivo? PURA: se prueba con filas de verdad,
 * sin base de datos, que es la unica forma de que el rojo hable del HECHO y no de la forma del
 * filtro. Un test atado a `notIn` seguiria verde si alguien cambiara el filtro por otro equivalente
 * y roto.
 */
export function puedeMarcarsePagadaEnLote(documento: { status: string }): boolean {
  return !(NO_SE_MARCAN_PAGADAS_EN_LOTE as readonly string[]).includes(documento.status);
}

export async function updateInvoiceStatusAdmin(
  id: number,
  status: string,
  merchantId?: number,
  /**
   * CÓMO dice el profesional que entró el dinero, al marcarla a mano. **Opcional a propósito**:
   * sin él, esta función se comporta EXACTAMENTE como antes — marcar cobrada sin indicar método
   * sigue funcionando igual, y esa es la mitad del contrato de este cambio.
   *
   * 🔴 Solo se escribe lo que el profesional declara EN ESE MOMENTO. Nunca se deduce, nunca se
   * copia de `Charge.method`, y las filas históricas no se tocan.
   */
  paidVia?: unknown,
) {
  const existing = await prisma.invoice.findFirst({
    where: { id, ...(merchantId != null ? { merchantId } : {}) },
  });
  if (!existing) return null;

  // SCRUM-153 · UNA FACTURA ANULADA NO VUELVE. Encontrado al pintar el estado `annulled` en las
  // vistas: no había ninguna guarda sobre el estado ORIGEN, así que un `PATCH status:'paid'`
  // sobre una anulada la resucitaba como pagada — un documento fiscal dado de baja ante la AEAT
  // (con su registro de anulación sellado y encadenado) reapareciendo como cobrado, y sin que
  // nada lo delatara.
  //
  // No es una regla nueva: la Parte L declara `pending → annulled` y **no declara ninguna
  // transición que salga de `annulled`**. Esto solo hace cumplir lo que ya estaba escrito
  // (regla 27: los estados son cerrados; lo que no está declarado no existe).
  //
  // Va ANTES de la guarda de des-pagar porque es más fuerte: aquella depende del tipo de
  // documento, esta no admite excepción — ni siquiera para un justificante `J-`, porque anular
  // un justificante también deja su registro.
  // ⚠️ EL LITERAL SE QUEDA AQUI A PROPOSITO. El guard de SCRUM-153
  // (`scrum153b-annulled-vistas`) comprueba esta linea POR SU TEXTO, y es de otro carril (regla 9):
  // cambiarla por la constante lo puso en rojo sin que el HECHO cambiara ni un apice. Que el
  // literal y `ESTADO_ANULADA` no puedan separarse lo garantiza un test de SCRUM-496, que compara
  // los dos — asi la fuente sigue siendo una sola sin romper el guard ajeno.
  if (existing.status === 'annulled' && status !== 'annulled') {
    throw new UnpayNotAllowedError(
      'Esta factura está ANULADA y su anulación ya está registrada: no puede volver a otro ' +
        'estado. Si la operación existió y hay que cobrarla, emite una factura nueva.',
    );
  }

  if (status === 'pending' && existing.status === 'paid') {
    const isReceipt = existing.type === 'JUST' || /^J-/i.test(existing.number || '');
    if (!isReceipt) {
      throw new UnpayNotAllowedError(
        'Una factura emitida no se des-paga: emite una rectificativa (R1).',
      );
    }
  }

  // Idempotencia: si ya está en ese estado, devolver sin tocar (ni re-auditar)
  if (existing.status === status) return { ...existing, __unchanged: true } as any;

  let paidAt = existing.paidAt;

  if (status === 'paid' && !existing.paidAt) {
    paidAt = new Date();
  } else if (status === 'pending') {
    paidAt = null;
  }
  // para 'expired' dejamos paidAt como esté

  // SCRUM-441 · EL MÉTODO SIGUE A `paidAt`, y no se inventa.
  //
  // · Se escribe SOLO al pasar a `paid` y SOLO si el profesional lo declaró aquí y ahora. Si no
  //   dijo nada, el campo NO se toca: marcar cobrada sin indicar método funciona exactamente igual
  //   que siempre, y un `undefined` en `data` de Prisma es «no toques esta columna».
  // · Al deshacer el pago se BORRA, en el mismo gesto en que `paidAt` se pone a `null`: si ya no
  //   está cobrada, «cómo se cobró» dejó de ser cierto. No es política nueva — es la que ya tiene
  //   la fecha, aplicada al campo que la acompaña.
  // · Un valor que el conjunto cerrado no reconoce se descarta y la columna se queda como estaba.
  //   Fallar cerrado: escribir basura en la pantalla del dinero es peor que no escribir nada.
  // La decisión vive en el dominio del método y es PURA, así que se prueba entera sin base de
  // datos. Un objeto VACÍO significa «no toques la columna», que es el caso de siempre.
  const campoMetodo = campoPaidViaAlMarcar(status, paidVia);

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status,
      paidAt,
      ...campoMetodo,
    },
  });
  // SCRUM-28 (COBROS-2): el cobro MANUAL (Bizum/transferencia) también materializa
  // Job.totalCobrado. Reutiliza el núcleo de SCRUM-13 (suma Invoices paid, idempotente).
  // Fire-and-forget: un fallo aquí JAMÁS rompe el marcar-pagado (marca paid, permisos y
  // audit quedan intactos). Sin await, con .catch() como en los webhooks.
  recalcJobCobradoForInvoice(existing.id).catch((e) =>
    console.error('[invoiceAdmin] SCRUM-28 recalc totalCobrado:', e?.message || e),
  );
  return updated;
}

// Helpers específicos (por si quieres seguir usándolos)
export async function markInvoicePaidAdmin(id: number, merchantId?: number) {
  return updateInvoiceStatusAdmin(id, 'paid', merchantId);
}

export async function markInvoicePendingAdmin(id: number, merchantId?: number) {
  return updateInvoiceStatusAdmin(id, 'pending', merchantId);
}
