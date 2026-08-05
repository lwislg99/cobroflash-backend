// src/modules/system/merchantAdmin.ts
import { isDemoMerchant } from '../invoicing/domain/emission.service'; // SCRUM-314
// SCRUM-291 (A4) · la decision de si la serie ya empezo es PURA y vive en validacion fiscal,
// no aqui: aqui solo se lee la base y se lanza el error.
import { bloqueoCambioDeSerie, numerosDeLaSerie } from '../../core/validation/fiscalInput';
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

/**
 * SCRUM-291 (A4) · el cambio de serie con facturas ya emitidas. Mismo patrón que `SlugError`:
 * error TIPADO lanzado antes del `update`, para que la ruta lo convierta en un 409 con motivo y
 * no en un 500 — lo que se le niega al profesional es una acción legítima de su negocio, así que
 * tiene derecho a saber exactamente por qué y con qué números.
 */
export class SerieError extends Error {
  constructor(
    public code: 'serie_ya_emitida',
    message: string,
    public detalle: { emitidas: number; ultimo: string; prefijoActual: string },
  ) {
    super(message);
  }
}

// 🔴 MICROCOPY PENDIENTE DE APROBACIÓN DEL FUNDADOR (regla 30). Este texto lo LEE el
// profesional cuando se le impide cambiar su propia serie, así que no se improvisa. Lo que
// tiene que decir está en la entrada `docs/master/SCRUM-291.md`; hasta que se apruebe, el
// mensaje va marcado y un guard impide que se quede así sin darse cuenta.
export const MSG_SERIE_YA_EMITIDA =
  '[PENDIENTE microcopy] No se puede cambiar el prefijo de la serie: ya hay facturas emitidas '
  + 'con ella este año y la numeración tiene que seguir siendo correlativa.';

// 1) Obtener el perfil del merchant (para pintar el formulario del dashboard)
export async function getMerchantProfile(merchantId: number = DEFAULT_MERCHANT_ID) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      // SCRUM-314: se lee para derivar `esCuentaDemo` y NO se devuelve — el front no necesita el
      // email, necesita la respuesta. Una fuente única para «¿es el demo?» (`isDemoMerchant`),
      // en vez de que la interfaz reimplemente el criterio con un `id === 1`.
      email: true,
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
      // A14.3: overrides de flags por merchant (Parte P) — /admin/me y el estado
      // efectivo de publicProfileEnabled los calculan con esto
      flags: true,
    },
  });

  if (!merchant) return merchant;
  // El email sale del objeto: lo único que viaja es el veredicto.
  const { email, ...perfil } = merchant as typeof merchant & { email: string | null };
  return { ...perfil, esCuentaDemo: isDemoMerchant({ id: merchant.id, email }) };
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
  // SCRUM-291 (A4) · LA SERIE NO SE TOCA UNA VEZ EMPEZADA.
  //
  // Hasta aquí el prefijo se validaba solo por charset (`invalidPrefijoSerie`, SCRUM-217) y NADIE
  // miraba si ya había facturas emitidas: un merchant con 40 `2026-CF-001…040` podía pasar a
  // `FAC` y la siguiente salía `2026-FAC-041`. Mismo año, misma serie, dos prefijos — y la
  // correlatividad que la AEAT exige rota, sin vuelta atrás (una factura emitida no se edita).
  //
  // Se BLOQUEA, no se avisa: lo que se impide es irreversible. Mismo patrón que el slug — error
  // tipado antes del `update`, nunca un 500.
  //
  // ⚠️ No toca el camino de emisión (regla 38): decide si se admite un cambio de AJUSTE.
  // `allocateInvoiceNumber` y su cerrojo quedan intactos.
  if (data.invoiceSeriesPrefix !== undefined) {
    const actual = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { invoiceSeriesPrefix: true },
    });
    // Se lee la serie del año EN CURSO, que es la que el cambio partiría. Una serie de un año
    // cerrado ya no admite números nuevos, así que no la afecta.
    const año = new Date().getFullYear();
    const emitidas = await prisma.invoice.findMany({
      where: { merchantId, number: { startsWith: `${año}-` } },
      select: { number: true },
    });
    const veredicto = bloqueoCambioDeSerie({
      prefijoActual: actual?.invoiceSeriesPrefix,
      prefijoNuevo: data.invoiceSeriesPrefix,
      numerosDeLaSerie: numerosDeLaSerie(emitidas.map((f) => f.number), año),
    });
    if (veredicto.bloqueado) {
      throw new SerieError('serie_ya_emitida', MSG_SERIE_YA_EMITIDA, {
        emitidas: veredicto.emitidas,
        ultimo: veredicto.ejemplo,
        prefijoActual: (actual?.invoiceSeriesPrefix ?? '').trim(),
      });
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
