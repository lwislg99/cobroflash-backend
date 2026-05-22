// src/core/validation/schemas.ts
import { z } from 'zod';

// ------- QUOTES -------

export const CreateQuoteSchema = z.object({
  merchant_id: z.number().int().positive(),
  customer_id: z.number().int().positive(),
  currency: z.string().length(3),
  lines: z
    .array(
      z.object({
        concept: z.string().min(1),
        qty: z.number().positive(),
        price: z.number().nonnegative(),
        tax: z.number().min(0).max(1).optional(),
      }),
    )
    .min(1),

  // NUEVO — condiciones de pago (código interno, opcional)
  paymentTerms: z
    .enum(['FULL_UPFRONT', 'FIFTY_FIFTY', 'MANUAL'])
    .optional()
    .nullable(),
});


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
  customer: z
    .object({
      name: z.string().min(1),
      phone: z.string().min(5).optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  expires_at: z.string().optional(),
  method_preference: z.enum(['bank', 'card']).optional().default('bank'),
  meta: z.record(z.string(), z.unknown()).optional(),
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
  defaultCurrency: z
    .string()
    .length(3)
    .optional(), // "EUR", "MXN", "BRL", etc.
  invoiceSeriesPrefix: z.string().min(1).max(10).optional(),
  logoUrl: z.string().url().nullable().optional(),
  whatsappPhone: z.string().min(6).max(20).optional(),
  googleReviewUrl: z.string().url().nullable().optional(),
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
});

export const customerUpdateSchema = customerCreateSchema.partial();

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;


