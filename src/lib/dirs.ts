import fs from 'fs';
import path from 'path';

export const invoicesDir = path.join(process.cwd(), 'public', 'invoices');
export const outboxDir = path.join(process.cwd(), 'public', 'outbox');

fs.mkdirSync(invoicesDir, { recursive: true });
fs.mkdirSync(outboxDir, { recursive: true });
