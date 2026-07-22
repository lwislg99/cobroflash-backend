// SCRUM-87 (🔴 SEGURIDAD/RGPD · fail-closed, SIN gate → corre en `npm test` normal):
// public/invoices/ NUNCA debe contener ficheros. Eran ~100 PDFs de facturas/presupuestos de
// clientes commiteados y servidos SIN AUTH por express.static(public/) → descargables por
// enumeración (yaqu.app/invoices/QUOTE-81.pdf, …). Los PDFs viven ahora en storage/ (privado,
// endpoint auth) y se regeneran on-demand (ensureInvoicePdf). Si alguien vuelve a dejar un
// documento bajo public/invoices/ (o reintroduce el directorio en git), esto falla el build.
//
// Puro (no toca BD ni red) → no lleva el guard `_staging-db.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(testsDir, '..', 'public', 'invoices');

test('SCRUM-87: public/invoices/ no contiene documentos (fuga RGPD cerrada)', () => {
  if (!fs.existsSync(dir)) return; // el directorio no existe → perfecto
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
  assert.equal(
    files.length,
    0,
    `FUGA RGPD: public/invoices/ tiene ${files.length} fichero(s) servidos sin auth por ` +
      `express.static(public/): ${files.slice(0, 5).join(', ')}${files.length > 5 ? '…' : ''}. ` +
      `Ningún documento debe vivir bajo public/ — los PDFs van a storage/ (ver SCRUM-72/87).`,
  );
});
