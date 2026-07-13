import fs from 'fs';
import path from 'path';

export const invoicesDir = path.join(process.cwd(), 'public', 'invoices');
export const outboxDir = path.join(process.cwd(), 'public', 'outbox');
// SCRUM-14: PDFs de albaranes (NO fiscales) separados de /invoices a propósito
export const albaranesDir = path.join(process.cwd(), 'public', 'albaranes');

fs.mkdirSync(invoicesDir, { recursive: true });
fs.mkdirSync(outboxDir, { recursive: true });
fs.mkdirSync(albaranesDir, { recursive: true });
