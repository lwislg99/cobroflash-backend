import express from 'express';
import path from 'path';
import { invoicesDir, outboxDir } from './lib/dirs';
import { jsonError } from './middlewares/jsonError';
import { config } from './config/env';

// Routers
import healthRouter from './routes/health';
import { rawBody as stripeRawBody, router as stripeWebhookRouter } from './routes/stripe';
import pspWebhookRouter from './routes/psp';
import chargesRouter from './routes/charges';
import quotesRouter from './routes/quotes';
import invoiceRouter from './routes/invoice';
import receiptRouter from './routes/receipt';
import payBankRouter from './routes/payBank';
import payCardRouter from './routes/payCard';
import devRouter from './routes/dev';

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
