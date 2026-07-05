// src/modules/system/merchantAdmin.ts
import { prisma } from '../../core/db/prisma';

export const DEFAULT_MERCHANT_ID = 1; // de momento trabajamos con el merchant demo

// Datos que vamos a permitir editar desde el panel
export type MerchantProfileInput = {
  name?: string;
  legalName?: string;
  taxId?: string;
  address?: string;
  trade?: string | null;
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
  notifyEmailWeeklyDigest?: boolean;
  brandColor?: string | null;
  brandAccentColor?: string | null;
  approvalThreshold?: number | null;
  // A14.1 (PERFIL-1): página pública /p/:slug
  slug?: string | null;
  profileZones?: string[] | null;
  profileYears?: number | null;
};

// A14.1 — rutas/palabras que un slug JAMÁS puede pisar (master Parte R: "lista
// reservada admin/api/pay/p/login…"). Añadir aquí cualquier ruta pública nueva.
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin', 'api', 'pay', 'p', 'login', 'auth', 'register', 'legal', 'precios',
  'dashboard', 'webhooks', 'webhook', 'health', 'exports', 'informes', 'static',
  'assets', 'public', 'quote', 'invoice', 'q', 'r', 'u', 'demo', 'yaqu', 'app',
  'www', 'mail', 'blog', 'ayuda', 'soporte', 'portal', 'index', 'favicon',
]);

export const SLUG_COOLDOWN_DAYS = 30;

// Error tipado para que la ruta lo traduzca a HTTP (409/400/429) con mensaje humano.
export class SlugError extends Error {
  constructor(public code: 'slug_reserved' | 'slug_taken' | 'slug_cooldown', message: string,
              public nextChangeAt?: Date) {
    super(message);
  }
}

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
      trade: true,
      defaultCurrency: true,
      invoiceSeriesPrefix: true,
      logoUrl: true,
      whatsappPhone: true,
      bizumPhone: true, // C1-4
      connectStatus: true, // C1-1 (solo lectura; lo gobierna el webhook)
      googleReviewUrl: true,
      country: true,
      iban: true,
      clabe: true,
      notifyEmailOnPaid: true,
      notifyEmailOnQuoteAccepted: true,
      notifyEmailWeeklyDigest: true,
      brandColor: true,
      brandAccentColor: true,
      approvalThreshold: true,
      // A14.1 (PERFIL-1)
      slug: true,
      slugChangedAt: true,
      profileZones: true,
      profileYears: true,
    },
  });

  return merchant;
}

// 2) Actualizar el perfil del merchant (cuando guarde el formulario)
export async function updateMerchantProfile(
  merchantId: number = DEFAULT_MERCHANT_ID,
  data: MerchantProfileInput,
) {
  // A14.1 — el slug tiene reglas propias (reservados, unicidad, 1 cambio/30d)
  if (data.slug !== undefined) {
    const current = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { slug: true, slugChangedAt: true },
    });
    const next = data.slug; // ya normalizado (trim+lowercase) por el schema Zod
    if ((current?.slug ?? null) === next) {
      delete data.slug; // sin cambio real → no consume el cooldown
    } else {
      if (next && RESERVED_SLUGS.has(next)) {
        throw new SlugError('slug_reserved', 'Esa dirección no está disponible.');
      }
      if (next) {
        const taken = await prisma.merchant.findUnique({ where: { slug: next }, select: { id: true } });
        if (taken && taken.id !== merchantId) {
          throw new SlugError('slug_taken', 'Esa dirección ya está cogida por otro negocio.');
        }
      }
      if (current?.slugChangedAt) {
        const nextChangeAt = new Date(
          current.slugChangedAt.getTime() + SLUG_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
        );
        if (nextChangeAt.getTime() > Date.now()) {
          throw new SlugError(
            'slug_cooldown',
            'La dirección solo se puede cambiar una vez cada 30 días.',
            nextChangeAt,
          );
        }
      }
      (data as Record<string, unknown>).slugChangedAt = new Date();
    }
  }
  // profileZones: Json — null se guarda como [] (limpiar chips)
  const { profileZones, ...rest } = data;

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: {
      ...rest,
      ...(profileZones !== undefined ? { profileZones: profileZones ?? [] } : {}),
    },
  });

  return updated;
}
