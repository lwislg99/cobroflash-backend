// src/modules/system/merchantAdmin.ts
import { prisma } from '../../core/db/prisma';

export const DEFAULT_MERCHANT_ID = 1; // de momento trabajamos con el merchant demo

// Datos que vamos a permitir editar desde el panel
export type MerchantProfileInput = {
  name?: string;
  legalName?: string;
  taxId?: string;
  address?: string;
  defaultCurrency?: string;
  invoiceSeriesPrefix?: string;
  logoUrl?: string | null;
  whatsappPhone?: string | null;
  googleReviewUrl?: string | null;
  country?: string;
  iban?: string | null;
  clabe?: string | null;
  notifyEmailOnPaid?: boolean;
  notifyEmailOnQuoteAccepted?: boolean;
};

// 1) Obtener el perfil del merchant (para pintar el formulario del dashboard)
export async function getMerchantProfile(merchantId: number = DEFAULT_MERCHANT_ID) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      name: true,
      legalName: true,
      taxId: true,
      address: true,
      defaultCurrency: true,
      invoiceSeriesPrefix: true,
      logoUrl: true,
      whatsappPhone: true,
      googleReviewUrl: true,
      country: true,
      iban: true,
      clabe: true,
      notifyEmailOnPaid: true,
      notifyEmailOnQuoteAccepted: true,
    },
  });

  return merchant;
}

// 2) Actualizar el perfil del merchant (cuando guarde el formulario)
export async function updateMerchantProfile(
  merchantId: number = DEFAULT_MERCHANT_ID,
  data: MerchantProfileInput,
) {
  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data,
  });

  return updated;
}
