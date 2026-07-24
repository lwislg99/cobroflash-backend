// SCRUM-129 (regla nº1 del máster: WhatsApp = Meta Cloud API DIRECTA, JAMÁS n8n/WATI/Zoko — SIN
// gate, corre en `npm test` normal): ningún fichero de código cablea n8n.
//
// Por qué importa: n8n es un intermediario de automatización que se saltaría src/integrations/
// whatsapp.ts —donde viven TODOS los guards de un envío: topes J6, opt-out J3, dry-run, registro
// WA-0b— y ya causó un endpoint muerto que MENTÍA sobre los envíos (`POST /charges/:id/send`,
// retirado en SCRUM-129: sin la URL configurada creaba el Event `type:'sent'` y respondía
// `{ok:true}` sin mandar nada). La regla 1 lo prohíbe; este test es su mecanismo.
//
// QUÉ se busca: el prefijo de env var de n8n (las tres letras N-8-N seguidas de guion bajo) — la
// señal ESTABLE de que n8n está cableado (sus URLs de webhook + su token). Es el análogo al host de
// Meta que vigila el guard hermano de r28 (SCRUM-124): se vigila el MECANISMO (la config que enchufa
// n8n), no la palabra "n8n" en prosa histórica ("ya NO usa n8n" documenta la retirada y debe poder
// escribirse). El módulo `integrations/n8n.ts` se borró en SCRUM-129, así que reimportarlo tampoco
// compilaría. Recorre TODO el repo (no solo src/): el riesgo es cualquier fichero —un script, una
// herramienta— que decida enchufar n8n por su cuenta.
//
// TRAMPA (SCRUM-125): este fichero necesita el literal para saber qué buscar; se excluye a sí mismo
// por RUTA (THIS_FILE), igual que el guard hermano de r28. NO se ofusca el string (partirlo,
// codificarlo): eso rompería que se pueda `grep` a mano igual que hace este test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_FILE = fileURLToPath(import.meta.url);
const repoRoot = path.join(path.dirname(THIS_FILE), '..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.claude', 'storage', '.playwright-mcp']);
const CODE_EXT = new Set(['.ts', '.js', '.mjs', '.cjs']);
const N8N_MARK = 'N8N_'; // prefijo de env var, literal a propósito — ver TRAMPA arriba

function walk(dir, found) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, found);
      continue;
    }
    if (full === THIS_FILE) continue; // el propio guard: contiene el marcador a propósito
    if (!CODE_EXT.has(path.extname(entry.name))) continue;
    if (fs.readFileSync(full, 'utf8').includes(N8N_MARK)) found.push(full);
  }
  return found;
}

test('SCRUM-129 (regla 1): ningún fichero de código cablea n8n', () => {
  const found = walk(repoRoot, []);
  assert.equal(
    found.length,
    0,
    `🔴 REGLA Nº1 VIOLADA: ${found.length} fichero(s) cablean n8n ` +
      `(${found.map((f) => path.relative(repoRoot, f)).join(', ')}). WhatsApp = Meta Cloud API ` +
      `DIRECTA, jamás n8n/WATI/Zoko (regla 1). n8n se saltaría todos los guards de whatsapp.ts ` +
      `(topes J6, opt-out J3, dry-run, registro WA-0b) y ya mintió una vez sobre los envíos. Si de ` +
      `verdad hiciera falta un intermediario, es un cambio de MÁSTER (regla 1), no una env var nueva.`,
  );
});
