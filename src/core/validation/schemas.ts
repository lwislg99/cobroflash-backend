// src/core/validation/schemas.ts
import { z } from 'zod';

// ------- QUOTES -------

const QuoteLineSchema = z.object({
  concept: z.string().min(1),
  qty: z.number().positive(),
  price: z.number().nonnegative(),
  tax: z.number().min(0).max(1).optional().default(0),
});

const QuoteTierSchema = z.object({
  id: z.enum(['good', 'better', 'best']),
  label: z.string().min(1),
  description: z.string().optional(),
  lines: z.array(QuoteLineSchema).min(1),
  recommended: z.boolean().optional().default(false),
  total: z.number().optional(), // calculado en backend, puede venir del cliente
});

export const CreateQuoteSchema = z.object({
  merchant_id: z.number().int().positive(),
  customer_id: z.number().int().positive(),
  currency: z.string().length(3),
  // Modo clásico: array de líneas
  lines: z.array(QuoteLineSchema).min(1).optional(),
  // Modo Good/Better/Best: exactamente 3 tiers
  tiers: z.array(QuoteTierSchema).length(3).optional(),
  paymentTerms: z.enum(['FULL_UPFRONT', 'FIFTY_FIFTY', 'MANUAL']).optional().nullable(),
  // V0-3: telemetría quote_created_via (VOZ-1 enviará 'voice')
  created_via: z.enum(['text', 'voice']).optional(),
  // A2.1: métodos de pago habilitados para este presupuesto (selector al crear).
  // Omitido = todos los que el merchant tenga disponibles.
  payMethods: z.array(z.enum(['card', 'bizum', 'transfer'])).min(1).optional(),
});

export type QuoteTier = z.infer<typeof QuoteTierSchema>;


// imports arriba ya tendrán algo como: import { z } from "zod";

export const AcceptQuoteSchema = z.object({
  // Desde dónde ha venido la decisión del cliente
  channel: z.enum(['whatsapp', 'web', 'other']).optional(),

  // Comentario libre del cliente (o que le pasemos desde el flujo)
  comment: z.string().max(500).optional(),

  // Texto tipo "50% al aceptar, 50% al finalizar"
  // Guardamos el código interno
  paymentTerms: z
    .enum(['FULL_UPFRONT', 'FIFTY_FIFTY', 'MANUAL'])
    .optional()
    .nullable(),

  // Cualquier extra (ip, userAgent, etc.)
  evidence: z.any().optional(),
});


export const RejectQuoteSchema = z.object({
  channel: z.enum(['whatsapp', 'web', 'other']).optional(),

  // Motivo del rechazo (en WhatsApp será lo que nos escriba)
  reason: z.string().min(1).max(500),

  // Comentario adicional (podemos duplicar reason aquí si queremos)
  comment: z.string().max(500).optional(),

  evidence: z.any().optional(),
});


// ------- CHARGES -------

export const CreateChargeSchema = z.object({
  merchant_id: z.number().int().positive(),
  concept: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  // Cliente existente (preferido): evita duplicar clientes al crear el cobro.
  customer_id: z.number().int().positive().optional(),
  customer: z
    .object({
      name: z.string().min(1),
      phone: z.string().min(5).optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  expires_at: z.string().optional(),
  method_preference: z.enum(['bank', 'card', 'mp']).optional().default('bank'),
  meta: z.record(z.string(), z.unknown()).optional(),
  // A2.1: métodos habilitados para este cobro (heredados del quote al facturar;
  // omitido = todos los que el merchant tenga disponibles)
  pay_methods: z.array(z.enum(['card', 'bizum', 'transfer'])).min(1).optional(),
});

export const IssueInvoiceSchema = z.object({
  charge_id: z.number().int().positive(),
});

// ------- PSP WEBHOOK -------

export const PSPWebhookSchema = z.object({
  event: z.enum(['payment.confirmed', 'payment.failed', 'payment.expired']),
  charge_id: z.union([z.string(), z.number()]),
  method: z.string().optional(),
  bank_ref: z.string().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  ts: z.string().optional(),
});

// ------- MERCHANT PROFILE -------

export const merchantProfileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  legalName: z.string().min(1).optional(),
  taxId: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  trade: z
    .enum([
      'electricista', 'fontanero', 'reformista', 'pintor',
      'cerrajero', 'climatizacion', 'otro',
    ])
    .nullable()
    .optional(),
  defaultCurrency: z
    .string()
    .length(3)
    .optional(), // "EUR", "MXN", "BRL", etc.
  invoiceSeriesPrefix: z.string().min(1).max(10).optional(),
  logoUrl: z.string().url().nullable().optional(),
  whatsappPhone: z.string().min(6).max(20).optional(),
  // C1-4: móvil para Bizum manual (default en UI: whatsappPhone)
  bizumPhone: z.string().min(6).max(20).nullable().optional(),
  googleReviewUrl: z.string().url().nullable().optional(),
  country: z.string().length(2).optional(),
  iban: z.string().min(10).max(34).nullable().optional(),
  clabe: z.string().length(18).nullable().optional(),
  notifyEmailOnPaid:          z.boolean().optional(),
  notifyEmailOnQuoteAccepted: z.boolean().optional(),
  notifyEmailWeeklyDigest:    z.boolean().optional(),
  // Enterprise
  brandColor:        z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  brandAccentColor:  z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  approvalThreshold: z.number().min(0).nullable().optional(),
});

export type MerchantProfileUpdateInput = z.infer<
  typeof merchantProfileUpdateSchema
>;

// ------- CUSTOMERS (NUEVO) -------

export const customerCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5).optional(),
  email: z.string().email().optional(),
  notes: z.string().max(1000).optional(),
  // J3: baja de WhatsApp (manual desde la ficha hasta WA-0b/BOT-1)
  waOptOut: z.boolean().optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial();

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;


