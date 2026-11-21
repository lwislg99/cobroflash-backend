// SCRUM-1787h · sirve la página de pago REAL (`dist/…/payInvoice.routes.js`) con datos de EJEMPLO, para capturas.
// Sin base: `prisma` es un doble en `require.cache`. Uso, desde la raíz del worktree y con `dist/` compilado:
//   node docs/master/evidencias/SCRUM-1787/pago-con-lineas/servir.mjs   → http://127.0.0.1:4787/pay/invoice/ejemplo
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '../../../../..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');

const M = { id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', country: 'ES', logoUrl: null,
  iban: 'ES9121000418450200051332', clabe: null, bizumPhone: null, whatsappPhone: null,
  connectStatus: 'none', stripeAccountId: null, flags: null };
const LINEAS = [
  { concept: 'Mano de obra fontanería', qty: 2, price: 45, tax: 0.21 },
  { concept: 'Grifo monomando con cartucho cerámico y latiguillos de acero inoxidable', qty: 1, price: 60, tax: 0.21 },
  { concept: 'Desplazamiento', qty: 1, price: 15, tax: 0.21 },
];
const cobro = { id: 7, merchantId: 42, receiptToken: 'ejemplo', status: 'pending', amount: 199.65, currency: 'EUR',
  concept: 'Reparación de bajante', payMethods: null, createdAt: new Date(), merchant: M };
const factura = { merchantId: 42, chargeId: 7, number: 'F-2026-0007', total: 199.65, lines: LINEAS };

require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma: {
  charge: { findUnique: async ({ where }) => (where.receiptToken === 'ejemplo' ? cobro : null) },
  invoice: { findFirst: async ({ where }) => (where.chargeId === 7 && where.merchantId === 42 ? factura : null) },
} } };

const express = require_('express');
const app = express();
app.use(express.static(path.join(RAIZ, 'public')));
app.use('/pay', require_('./dist/modules/billing/app/routes/payInvoice.routes.js').default);
http.createServer(app).listen(4787, '127.0.0.1', () => console.log('http://127.0.0.1:4787/pay/invoice/ejemplo'));
