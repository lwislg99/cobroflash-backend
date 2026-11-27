// Banco de captura de SCRUM-1807g: la ruta REAL de la firma, con Prisma de mentira. Datos de EJEMPLO.
// Uso: node servir-firma.mjs <raiz-del-worktree> <puerto>
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const [raiz, puerto] = process.argv.slice(2);
const req = createRequire(path.join(raiz, 'package.json'));
const express = req('express');
const dist = (p) => pathToFileURL(path.join(raiz, 'dist', p)).href;
const { prisma } = await import(dist('core/db/prisma.js'));
const { quoteDecisionLandingRouter } = await import(dist('modules/system/app/routes/quoteDecisionLanding.routes.js'));
const { calcTotal } = await import(dist('core/utils/utils.js'));

const cab = (concept, extra = {}) => ({ concept, tax: 0, apartado: true, ...extra });
const LINEAS = {
  mixto: [
    cab('Baño', { agrupado: true }),
    { concept: 'Plato de ducha de resina 120×80', qty: 1, price: 320, tax: 0.21 },
    { concept: 'Mampara corredera', qty: 1, price: 180.5, tax: 0.21 },
    { concept: 'Mano de obra fontanería', qty: 6, price: 38, tax: 0.21 },
    cab('Cocina'),
    { concept: 'Grifo monomando', qty: 2, price: 45, tax: 0.1 },
    { concept: 'Instalación', qty: 1, price: 9999.99, tax: 0.21 },
  ],
};
prisma.quote.findUnique = async () => ({
  id: 9, quoteNumber: 1, currency: 'EUR', total: calcTotal(LINEAS.mixto), status: 'sent',
  createdAt: new Date('2026-11-20T10:00:00Z'), validUntil: null, paymentTerms: 'FULL', customBillingPlan: null,
  discountGlobalAmount: null, acceptedAt: null, rejectedAt: null,
  merchant: { id: 77, email: 'obra@ejemplo.es', flags: null, name: 'Reformas Ejemplo', legalName: null, logoUrl: null,
    address: null, country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: null, timezone: 'Europe/Madrid' },
  customer: { name: 'Cliente' }, lines: LINEAS.mixto, tiers: null,
});
prisma.quote.count = async () => 0;
prisma.quote.update = async () => ({});
prisma.quoteView = { create: async () => ({}) };

const app = express();
app.use('/fonts', express.static(path.join(raiz, 'public', 'fonts')));
app.use('/pay', quoteDecisionLandingRouter);
app.listen(Number(puerto), '127.0.0.1', () => console.log(`listo en ${puerto}`));
