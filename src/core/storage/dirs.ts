import fs from 'fs';
import path from 'path';

// SCRUM-72 (seguridad/RGPD): los PDFs de FACTURA y de PRESUPUESTO viven FUERA de `public/`
// (mismo patrón que SCRUM-48 con los albaranes). Bajo `public/` los servía el estático —
// tanto el mount /invoices como el general de app.ts — y los números de factura son
// enumerables (2026-CF-001, -002…): cualquiera podía descargar documentos ajenos sin login.
// Llevan NIF del emisor, datos del cliente e importes. Se sirven SOLO por los endpoints
// autenticados GET /admin/invoices/:id/pdf y GET /admin/quotes/:id/pdf (auth + tenancy).
export const invoicesDir = path.join(process.cwd(), 'storage', 'invoices');
export const outboxDir = path.join(process.cwd(), 'public', 'outbox');
// SCRUM-48: los PDFs de albarán viven FUERA de `public/` (llevan nombre del cliente,
// dirección de la obra y firma manuscrita = datos personales). Bajo `public/` los servía
// el estático general (app.ts) aunque no hubiera un mount /albaranes dedicado. Se sirven
// SOLO por GET /admin/albaranes/:id/pdf (auth + tenancy), leyendo de aquí con sendFile.
export const albaranesDir = path.join(process.cwd(), 'storage', 'albaranes');

fs.mkdirSync(invoicesDir, { recursive: true });
fs.mkdirSync(outboxDir, { recursive: true });
fs.mkdirSync(albaranesDir, { recursive: true });
