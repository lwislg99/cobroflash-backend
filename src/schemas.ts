import { z } from 'zod';

export const CreateQuoteSchema = z.object({
  merchant_id: z.number().int().positive(),
  customer_id: z.number().int().positive(),
  currency: z.string().length(3),
  lines: z.array(z.object({
    concept: z.string().min(1),
    qty: z.number().positive(),
    price: z.number().nonnegative(),
    tax: z.number().min(0).max(1).optional(),
  })).min(1),
});

export const AcceptQuoteSchema = z.object({
  evidence: z.object({
    wa_user_id: z.string().optional(),
    wamid: z.string().optional(),
    ip: z.string().optional(),
    user_agent: z.string().optional(),
    ts: z.string().optional(),
    note: z.string().optional(),
  }).partial().optional(),
  method_preference: z.enum(['bank', 'card']).optional().default('bank'),
  send: z.boolean().optional().default(true),
  to: z.string().optional(),
});

export const CreateChargeSchema = z.object({
  merchant_id: z.number().int().positive(),
  concept: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(5).optional(),
    email: z.string().email().optional(),
  }).optional(),
  expires_at: z.string().optional(),
  method_preference: z.enum(['bank', 'card']).optional().default('bank'),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const IssueInvoiceSchema = z.object({ charge_id: z.number().int().positive() });

export const PSPWebhookSchema = z.object({
  event: z.enum(['payment.confirmed', 'payment.failed', 'payment.expired']),
  charge_id: z.union([z.string(), z.number()]),
  method: z.string().optional(),
  bank_ref: z.string().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  ts: z.string().optional(),
});
