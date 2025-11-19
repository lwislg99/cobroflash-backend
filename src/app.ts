// srcNew/app.ts
import express from 'express';
import path from 'path'; // si no lo usas en ningún sitio, puedes borrar este import

import { invoicesDir, outboxDir } from './core/storage/dirs';
import { jsonError } from './core/http/jsonError';

// Routers (módulos)
import healthRouter from './modules/system/app/routes/health.routes';
import devRouter from './modules/system/app/routes/dev.routes';

import {
  rawBody as stripeRawBody,
  router as stripeWebhookRouter,
} from './modules/billing/app/routes/stripe.routes';
import pspWebhookRouter from './modules/billing/app/routes/psp.routes';
import chargesRouter from './modules/billing/app/routes/charges.routes';
import receiptRouter from './modules/billing/app/routes/receipt.routes';
import payBankRouter from './modules/billing/app/routes/payBank.routes';
import payCardRouter from './modules/billing/app/routes/payCard.routes';

import quotesRouter from './modules/quotes/app/routes/quotes.routes';
import invoiceRouter from './modules/invoicing/app/routes/invoice.routes';

export const app = express();

// Evitar 304 por ETag en HTML que debe refrescar
app.disable('etag');

// ⚠️ Stripe webhook requiere RAW antes de express.json()
app.use('/webhooks/stripe', stripeRawBody, stripeWebhookRouter);

// Parser JSON
app.use(express.json());

// JSON inválido → 400
app.use(jsonError);

// Static públicos
app.use('/invoices', express.static(invoicesDir));
app.use('/outbox', express.static(outboxDir));

// Rutas
app.use('/health', healthRouter);
app.use('/webhooks/psp', pspWebhookRouter);
app.use('/charges', chargesRouter);
app.use('/quote', quotesRouter);
app.use('/invoice', invoiceRouter);
app.use('/recibo', receiptRouter);
app.use('/pay', payBankRouter); // /pay/bank/:id
app.use('/pay', payCardRouter); // /pay/card/:id
app.use('/dev', devRouter);

// Fallback 404 (opcional)
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
