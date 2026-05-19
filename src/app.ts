// src/app.ts
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

import customersAdminRouter from './modules/system/app/routes/customersAdmin.routes';
import quotesAdminRouter from './modules/system/app/routes/quotesAdmin.routes';

import { merchantProfileUpdateSchema } from './core/validation/schemas';
import {
  getMerchantProfile,
  updateMerchantProfile,
} from './modules/system/merchantAdmin';

import invoicesAdminRouter from './modules/system/app/routes/invoicesAdmin.routes';

import productsAdminRouter from './modules/products/app/routes/products.routes';
import providersAdminRouter from './modules/providers/app/routes/providers.routes';


import { quoteDecisionLandingRouter } from './modules/system/app/routes/quoteDecisionLanding.routes';



export const app = express();


app.use('/pay', quoteDecisionLandingRouter);


// Evitar 304 por ETag en HTML que debe refrescar
app.disable('etag');

// ⚠️ Stripe webhook requiere RAW antes de express.json()
app.use('/webhooks/stripe', stripeRawBody, stripeWebhookRouter);

// Parser JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JSON inválido → 400
app.use(jsonError);

// Static públicos
app.use('/invoices', express.static(invoicesDir));
app.use('/outbox', express.static(outboxDir));

// Static de la app (HTML, JS, CSS simple)
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));


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



app.use('/admin/customers', customersAdminRouter);
app.use('/admin/quotes', quotesAdminRouter);
app.use('/admin/invoices', invoicesAdminRouter);

app.use('/admin/products', productsAdminRouter);
app.use('/admin/providers', providersAdminRouter);




// =========================
// Admin – Perfil de merchant
// =========================

app.get('/admin/merchant', async (req, res, next) => {
  try {
    const merchant = await getMerchantProfile();

    if (!merchant) {
      return res.status(404).json({ error: 'merchant_not_found' });
    }

    return res.json(merchant);
  } catch (err) {
    return next(err);
  }
});

app.put('/admin/merchant', async (req, res, next) => {
  try {
    const parsed = merchantProfileUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_error',
        details: parsed.error.flatten(),
      });
    }

    const updated = await updateMerchantProfile(undefined, parsed.data);

    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

// Fallback 404 (opcional)
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
