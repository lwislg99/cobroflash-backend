import fs from 'fs';
import path from 'path';

export const invoicesDir = path.join(process.cwd(), 'public', 'invoices');
export const outboxDir = path.join(process.cwd(), 'public', 'outbox');
// SCRUM-48: los PDFs de albarán viven FUERA de `public/` (llevan nombre del cliente,
// dirección de la obra y firma manuscrita = datos personales). Bajo `public/` los servía
// el estático general (app.ts) aunque no hubiera un mount /albaranes dedicado. Se sirven
// SOLO por GET /admin/albaranes/:id/pdf (auth + tenancy), leyendo de aquí con sendFile.
export const albaranesDir = path.join(process.cwd(), 'storage', 'albaranes');

fs.mkdirSync(invoicesDir, { recursive: true });
fs.mkdirSync(outboxDir, { recursive: true });
fs.mkdirSync(albaranesDir, { recursive: true });
