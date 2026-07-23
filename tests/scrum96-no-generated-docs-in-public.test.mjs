// SCRUM-96 (🔴 SEGURIDAD/RGPD · fail-closed, SIN gate → corre en `npm test` normal):
// Guard B de la auditoría SCRUM-88 (docs/AUDITORIA_SUPERFICIE_PUBLICA.md §8). SCRUM-87 solo
// vigilaba public/invoices/ — esta vez apareció public/outbox/ (los .eml de fallback: email
// completo + PDF adjunto en base64, nombre enumerable) sirviéndose igual de sin auth por
// express.static(public/). En vez de perseguir directorio por directorio, este test recorre
// TODO `public/` y falla si aparece cualquier fichero con pinta de documento/backup generado
// en runtime, sea cual sea la subcarpeta — mata la clase entera, no solo la instancia de hoy.
//
// Puro (no toca BD ni red) → no lleva el guard `_staging-db.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(testsDir, '..', 'public');

// Extensiones de documento/exportación/backup: nunca son activos estáticos del frontend
// (iconos, manifest, css/js/html propios), siempre son datos generados o exportados.
const FORBIDDEN_EXT = new Set(['.pdf', '.eml', '.csv', '.zip', '.bak', '.sql']);

function isForbidden(fileName) {
  if (/^\.env(\..*)?$/i.test(fileName)) return true;
  return FORBIDDEN_EXT.has(path.extname(fileName).toLowerCase());
}

function walk(dir, found) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full, found); continue; }
    if (isForbidden(entry.name)) found.push(full);
  }
  return found;
}

test('SCRUM-96: public/ nunca sirve documentos generados en runtime (cualquier subcarpeta)', () => {
  if (!fs.existsSync(publicDir)) return; // el directorio no existe → perfecto
  const found = walk(publicDir, []);
  assert.equal(
    found.length,
    0,
    `FUGA RGPD: ${found.length} documento(s) servido(s) sin auth por express.static(public/): ` +
      `${found.slice(0, 5).map((f) => path.relative(publicDir, f)).join(', ')}` +
      `${found.length > 5 ? '…' : ''}. Ningún documento generado en runtime debe vivir bajo ` +
      `public/ — usa storage/ (fuera del árbol servido; ver SCRUM-72/87/96).`,
  );
});
