// src/modules/invoicing/domain/facturaDesdeParte.ts — SCRUM-1780c (J1)
//
// FACTURA DESDE EL PARTE DE TRABAJO FIRMADO. Gemela de `POST /admin/albaranes/:id/convertir-en-factura`
// (`albaranes.routes.ts`), con lo que el fundador decidió para el parte:
//   · GO de la ruta y del origen `C7-parte` (regla 40): SCRUM-1780 c.22237 ①.
//   · La factura nace SIN cobro; el Charge nace al enviarla (c.22237 ②). Aquí no se crea ninguno.
//   · Enlace parte → factura en `ParteTrabajo.invoiceId` (ALTER aditivo, c.22237 ③ y c.22242).
//   · Basta el estado `firmado` (c.22237 ④).
//   · Solo admin; concepto del parte TAL CUAL; se factura aunque el trabajo tenga un presupuesto
//     ya facturado; al anular la factura, el parte se queda `facturado` (c.22244 ①-④).
//
// 🔴 LA RUTA NO SE MONTA AQUÍ. `partes.routes.ts` es del carril S1 (equipo de Luis): las tres líneas
// del montaje están literales en SCRUM-1780 c.22242. Hasta que S1 las escriba, `facturarParte` no
// tiene llamador en `src/` y su test la prueba montada en un router DE PRUEBA, no en el de verdad.
//
// ⛔ NINGÚN TEXTO DE USUARIO (regla 39): los errores salen por CÓDIGO, sin `message`.
import { prisma } from '../../../core/db/prisma';
import { cabeEnColumnaInt } from '../../../core/validation/enteroDeColumna';
import { exigirTiposDeIvaEmitibles, esErrorTipoIvaNoEmitible, ERROR_TIPO_IVA_NO_EMITIBLE } from '../../../core/validation/tiposIvaEmitibles';
import { actorDeRequest, type ActorAudit } from '../../system/audit.service';
import { emitInvoice } from './invoicing.service';
import { congelarCliente } from './clienteCongelado';
import { congelarEmisorDesdeFicha } from './emisorCongelado';
import { isReceiptNumber } from './invoiceNumber.service';
import { getEmissionMode } from './emission.service';
import { calcVatBreakdown } from './vat.service';
import { sellarTrasEmision, SELLADO_HECHO } from './selladoEstado';
import { exigirLineasFacturables, esErrorSinLineas, ERROR_SIN_LINEAS } from './lineasFacturables';

/** Los códigos de error de la ruta (diseño de SCRUM-1780 c.22242), más los dos portones que ya existían. */
export const ERRORES_FACTURA_DESDE_PARTE = [
  'invalid_id', 'not_found',
  'parte_no_firmado', 'parte_ya_facturado', 'parte_sin_cliente', 'parte_sin_precio', 'facturacion_no_disponible',
  ERROR_SIN_LINEAS, ERROR_TIPO_IVA_NO_EMITIBLE,
] as const;
export type ErrorFacturaDesdeParte = (typeof ERRORES_FACTURA_DESDE_PARTE)[number];

export type ResultadoFacturarParte =
  | { ok: true; factura: { id: number; number: string; total: string; currency: string }; veriFactu: boolean }
  | { ok: false; status: 400 | 404 | 409; error: ErrorFacturaDesdeParte };

/** La reclamación del parte dentro de la tx no tocó exactamente una fila: otro lo facturó antes. */
const YA_FACTURADO_EN_LA_TX = 'parte_ya_facturado_en_la_tx';

interface LineaDelParte {
  descripcion?: unknown;
  unds?: unknown;
  precioUnitario?: unknown;
  tipoIva?: unknown;
}

const esNumero = (v: unknown): boolean =>
  v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

/**
 * Las líneas del parte, a líneas de factura `{concept, qty, price, tax}` (`tax` en FRACCIÓN, como
 * `Invoice.lines`; el parte guarda `tipoIva` en PORCENTAJE). El concepto es la descripción del parte
 * TAL CUAL (c.22244 ②). `null` si alguna línea no trae precio o IVA: el parte no se factura a medias.
 */
export function lineasDelParteParaFactura(lineas: unknown):
  Array<{ concept: string; qty: number; price: number; tax: number }> | null {
  const filas = (Array.isArray(lineas) ? lineas : []) as LineaDelParte[];
  if (filas.some((l) => !esNumero(l?.precioUnitario) || !esNumero(l?.tipoIva))) return null;
  return filas.map((l) => ({
    concept: String(l.descripcion ?? ''),
    qty: Number(l.unds),
    price: Number(l.precioUnitario),
    tax: Number(l.tipoIva) / 100,
  }));
}

/** El dominio: tenancy, portones, emisión y enlace en UNA transacción, y el sellado después. */
export async function facturarParteDeMerchant(args: {
  merchantId: number;
  parteId: unknown;
  actor: ActorAudit;
}): Promise<ResultadoFacturarParte> {
  const { merchantId, actor } = args;
  const parteId = Number(args.parteId);
  if (!cabeEnColumnaInt(parteId)) return { ok: false, status: 400, error: 'invalid_id' };

  // Tenancy (regla 2): 404 y no 403, como el albarán.
  const parte = await prisma.parteTrabajo.findFirst({ where: { id: parteId, merchantId } });
  if (!parte) return { ok: false, status: 404, error: 'not_found' };

  // Solo el estado. El `invoiceId: null` vive en el WHERE de la reclamación, dentro de la tx.
  if (parte.estado === 'facturado') return { ok: false, status: 409, error: 'parte_ya_facturado' };
  if (parte.estado !== 'firmado') return { ok: false, status: 409, error: 'parte_no_firmado' };

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true, email: true, country: true, flags: true, defaultCurrency: true, taxId: true,
      name: true, legalName: true, address: true, logoUrl: true, whatsappPhone: true,
      llevaLibrosPorSii: true,
    },
  });
  if (!merchant) return { ok: false, status: 404, error: 'not_found' };
  // Mismo portón que el albarán (`albaranes.routes.ts`, convertir-en-factura): documento fiscal puro.
  if (getEmissionMode(merchant) === 'receipt') return { ok: false, status: 409, error: 'facturacion_no_disponible' };

  // El cliente es el del PARTE (el que va impreso y sellado), con tenancy.
  const customerId = parte.customerId;
  if (customerId === null || customerId === undefined) return { ok: false, status: 409, error: 'parte_sin_cliente' };
  const cliente = await prisma.customer.findFirst({ where: { id: customerId, merchantId }, select: { id: true } });
  if (!cliente) return { ok: false, status: 409, error: 'parte_sin_cliente' };

  const invoiceLines = lineasDelParteParaFactura(parte.lineas);
  if (!invoiceLines) return { ok: false, status: 409, error: 'parte_sin_precio' };

  try {
    // ANTES de pedir número (SCRUM-246 / SCRUM-771), igual que la gemela.
    exigirLineasFacturables(invoiceLines);
    exigirTiposDeIvaEmitibles(invoiceLines);
  } catch (e) {
    if (esErrorSinLineas(e)) return { ok: false, status: 409, error: ERROR_SIN_LINEAS };
    if (esErrorTipoIvaNoEmitible(e)) return { ok: false, status: 409, error: ERROR_TIPO_IVA_NO_EMITIBLE };
    throw e;
  }

  // SCRUM-624 · el total sale del mismo desglose que se guarda.
  const bd = calcVatBreakdown(invoiceLines);
  const total = (bd.base + bd.cuota).toFixed(2);

  // Congelados FUERA de la tx (SCRUM-729 / SCRUM-665).
  const clienteCongelado = await congelarCliente(prisma, merchantId, customerId);
  const emisorCongelado = congelarEmisorDesdeFicha(merchant);

  let invoice;
  try {
    invoice = await prisma.$transaction(async (tx) => {
      // 1) RECLAMAR el parte ANTES de pedir número. En Postgres la fila queda bloqueada hasta el
      //    commit: una segunda petición simultánea espera, vuelve a evaluar el WHERE, toca 0 filas y
      //    sale sin consumir número de serie. Exactamente 1 fila, o se deshace todo.
      const reclamado = await tx.parteTrabajo.updateMany({
        where: { id: parte.id, merchantId, estado: 'firmado', invoiceId: null },
        data: { estado: 'facturado' },
      });
      if (reclamado.count !== 1) throw new Error(YA_FACTURADO_EN_LA_TX);

      // 2) Emitir. Sin presupuesto (`quoteId: null`): el precio es el que la oficina puso al parte.
      const inv = await emitInvoice(tx, {
        merchantId, customerId, total,
        currency: merchant.defaultCurrency || 'EUR', type: 'F1',
        lines: invoiceLines,
        quoteId: null,
        actor,
        origen: 'C7-parte', // SCRUM-1780c: parte de trabajo firmado → factura
        clienteCongelado,
        emisorCongelado,
      });
      if (isReceiptNumber(inv.number)) throw new Error('facturacion_no_disponible');

      // 3) Enlace parte → factura, en la misma tx.
      await tx.parteTrabajo.updateMany({ where: { id: parte.id, merchantId }, data: { invoiceId: inv.id } });
      return inv;
    });
  } catch (e: any) {
    if (e?.message === YA_FACTURADO_EN_LA_TX) return { ok: false, status: 409, error: 'parte_ya_facturado' };
    if (e?.message === 'facturacion_no_disponible') return { ok: false, status: 409, error: 'facturacion_no_disponible' };
    throw e;
  }

  // Sellado FUERA de la tx, como la gemela (SCRUM-173/205). Un fallo aquí no revierte (regla 29).
  const veriFactu = (await sellarTrasEmision(invoice, merchant, prisma)).estado === SELLADO_HECHO;
  return {
    ok: true,
    factura: { id: invoice.id, number: invoice.number, total: invoice.total.toString(), currency: invoice.currency },
    veriFactu,
  };
}

/**
 * El handler de `POST /admin/partes/:id/facturar`. Lo monta S1 detrás de `requireRole('admin')`
 * (SCRUM-1780 c.22242): aquí no se comprueba el rol, igual que la gemela lo deja en el montaje.
 */
export async function facturarParte(req: any, res: any) {
  try {
    const r = await facturarParteDeMerchant({ merchantId: req.merchantId, parteId: req.params?.id, actor: actorDeRequest(req) });
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    return res.status(201).json({ ok: true, factura: r.factura, veriFactu: r.veriFactu });
  } catch (err: any) {
    console.error('[POST /admin/partes/:id/facturar]', err?.message || err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
