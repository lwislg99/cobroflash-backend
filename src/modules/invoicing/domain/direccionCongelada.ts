// src/modules/invoicing/domain/direccionCongelada.ts — SCRUM-1787d
//
// La dirección de FACTURACIÓN del cliente, congelada en la factura al emitirla (decisión del
// fundador: SCRUM-1787 c.22305; ALTER aplicado en staging y producción: c.22311).
//
// ── POR QUÉ UN TIPO APARTE Y NO DENTRO DE `ClienteCongelado` ───────────────────────────────────
// `ClienteCongelado` se derrama también en el ALBARÁN (`datosDeAlbaranEmitido`, carril S1), y la
// tabla `albaranes` no tiene estas columnas (c.22311: el albarán sigue sin dirección). Por eso la
// dirección NO viaja en el objeto que devuelve `congelarCliente`: la lee la propia emisión
// (`crearFacturaEmitida`), que sólo crea facturas. Así ni `congelarCliente`, ni el albarán, ni los
// siete llamadores de S1 cambian (decisión del orquestador J a jv-j1gz, 21-nov-2026).
//
// ── EL PRECIO, DECLARADO ───────────────────────────────────────────────────────────────────────
// La lectura va DENTRO de la transacción de emisión, después del cerrojo de serie: +1 viaje dentro
// del cerrojo en cada factura (F1 8 → 9, 7 → 8 dentro; R1 7 → 8). `crearFacturaEmitida` sólo
// conoce la transacción, y sacar la lectura fuera obligaría a tocar los siete llamadores.
//
// ── LECTURA ────────────────────────────────────────────────────────────────────────────────────
// La dirección se lee SIEMPRE de las columnas de la factura (`direccionDeLaFactura`), nunca de la
// ficha viva: una factura anterior a 1787d se queda sin dirección (regla 29).
import type { Prisma } from '@prisma/client';

/** Los cinco, con el nombre EXACTO de la columna de `Invoice`. */
export interface DireccionCongelada {
  customerBillingAddress: string | null;
  customerBillingCity: string | null;
  customerBillingPostalCode: string | null;
  customerBillingProvince: string | null;
  customerBillingCountry: string | null;
}

export const CAMPOS_DIRECCION_CONGELADOS = Object.freeze([
  'customerBillingAddress',
  'customerBillingCity',
  'customerBillingPostalCode',
  'customerBillingProvince',
  'customerBillingCountry',
] as const);

const VACIA: DireccionCongelada = Object.freeze({
  customerBillingAddress: null,
  customerBillingCity: null,
  customerBillingPostalCode: null,
  customerBillingProvince: null,
  customerBillingCountry: null,
});

/**
 * Lee, dentro de la transacción de emisión, la dirección que se congela en la factura.
 *
 * - Una RECTIFICATIVA (`rectifiesId`) hereda la de la factura que rectifica, tal cual: NULL si la
 *   original es anterior a 1787d. No elige destinatario (misma regla que `congelarParaRectificativa`).
 * - Cualquier otra, la de la ficha del cliente en ese instante.
 * - Filtra por `merchantId` (regla 2). Sin fila → los cinco a NULL.
 */
export async function congelarDireccionAlEmitir(
  tx: Prisma.TransactionClient,
  datos: { merchantId: number; customerId: number; rectifiesId?: number | null },
): Promise<DireccionCongelada> {
  if (datos.rectifiesId != null) {
    const original = await tx.invoice.findFirst({
      where: { id: datos.rectifiesId, merchantId: datos.merchantId },
      select: {
        customerBillingAddress: true,
        customerBillingCity: true,
        customerBillingPostalCode: true,
        customerBillingProvince: true,
        customerBillingCountry: true,
      },
    });
    return original ? direccionDeLaFactura(original) : { ...VACIA };
  }
  const ficha = await tx.customer.findFirst({
    where: { id: datos.customerId, merchantId: datos.merchantId },
    select: {
      billingAddress: true,
      billingCity: true,
      billingPostalCode: true,
      billingProvince: true,
      billingCountry: true,
    },
  });
  if (!ficha) return { ...VACIA };
  return {
    customerBillingAddress: ficha.billingAddress ?? null,
    customerBillingCity: ficha.billingCity ?? null,
    customerBillingPostalCode: ficha.billingPostalCode ?? null,
    customerBillingProvince: ficha.billingProvince ?? null,
    customerBillingCountry: ficha.billingCountry ?? null,
  };
}

/** El ÚNICO lector: de la fila de la factura, nunca de la ficha viva. */
export function direccionDeLaFactura(doc: Partial<Record<keyof DireccionCongelada, string | null | undefined>>): DireccionCongelada {
  return {
    customerBillingAddress: doc.customerBillingAddress ?? null,
    customerBillingCity: doc.customerBillingCity ?? null,
    customerBillingPostalCode: doc.customerBillingPostalCode ?? null,
    customerBillingProvince: doc.customerBillingProvince ?? null,
    customerBillingCountry: doc.customerBillingCountry ?? null,
  };
}

/**
 * La dirección en UNA línea para el PDF: «calle, CP ciudad, provincia, país», saltando lo vacío.
 * Cadena vacía si no consta nada: entonces el PDF no pinta la fila.
 */
export function direccionEnUnaLinea(d: DireccionCongelada): string {
  const cpCiudad = [d.customerBillingPostalCode, d.customerBillingCity]
    .map((s) => (s ?? '').trim()).filter(Boolean).join(' ');
  return [d.customerBillingAddress, cpCiudad, d.customerBillingProvince, d.customerBillingCountry]
    .map((s) => (s ?? '').trim()).filter(Boolean).join(', ');
}
