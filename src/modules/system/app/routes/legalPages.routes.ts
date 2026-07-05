// src/modules/system/app/routes/legalPages.routes.ts — A10.1 (EXT3)
// Páginas legales públicas con plantilla branded y legible (A22.2 reutiliza).
// El contenido viene de docs/legal/*.md — AQUÍ NO SE REDACTA NADA (el texto es
// del fundador/asesor); solo se renderiza. La cabecera interna de revisión
// ("> BORRADOR…") se omite al servir.
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = Router();

const LEGAL_DIR = path.join(process.cwd(), 'docs', 'legal');

// Md → HTML mínimo y seguro para documentos legales (títulos, listas, negrita,
// hr, párrafos). Nada de HTML crudo del archivo: se escapa TODO primero.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function mdToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*>/.test(line)) continue;            // blockquotes internos: fuera
    if (/^---+$/.test(line.trim())) { closeList(); out.push('<hr/>'); continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { closeList(); const l = h[1].length; out.push(`<h${l}>${inline(h[2])}</h${l}>`); continue; }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (!line.trim()) { closeList(); continue; }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('\n');
  function inline(s: string): string {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }
}

export function readLegalDoc(fileBase: string): { html: string; version: string } | null {
  try {
    const file = path.join(LEGAL_DIR, fileBase);
    const md = fs.readFileSync(file, 'utf8');
    // La versión es el hash del CONTENIDO servido: si el asesor toca el texto,
    // las aceptaciones antiguas dejan de valer para el checkout (A10.1).
    const html = mdToHtml(md);
    const version = crypto.createHash('sha256').update(html).digest('hex').slice(0, 12);
    return { html, version };
  } catch {
    return null;
  }
}

function legalShell(title: string, bodyHtml: string, version: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>${esc(title)} — YaQu</title>
<style>
  :root{--brand:#16a34a;--ink:#0f1c17;--body:#3f4a45;--muted:#6b756f;--bg:#f6f7f5;--surface:#fff;--border:#e7e9e5}
  body{margin:0;font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--bg);color:var(--body);line-height:1.65;padding:24px 16px}
  .doc{max-width:720px;margin:0 auto;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px 28px;box-shadow:0 4px 12px -2px rgba(16,24,40,.06)}
  .brand{display:flex;align-items:center;gap:9px;font-weight:800;font-size:18px;color:var(--ink);margin-bottom:20px}
  .brand span{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#22d3ee);display:inline-flex;align-items:center;justify-content:center;color:#052e16;font-size:12px}
  h1{font-size:22px;color:var(--ink);letter-spacing:-.01em;line-height:1.25}
  h2{font-size:16px;color:var(--ink);margin-top:26px}
  h3{font-size:14px;color:var(--ink)}
  ul{padding-left:20px}
  li{margin:4px 0}
  hr{border:none;border-top:1px solid var(--border);margin:22px 0}
  strong{color:var(--ink)}
  .foot{max-width:720px;margin:14px auto 0;font-size:12px;color:var(--muted);text-align:center}
  a{color:#15803d}
  :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.30)}
</style>
</head>
<body>
  <div class="doc">
    <div class="brand"><span>YQ</span>YaQu</div>
    ${bodyHtml}
  </div>
  <div class="foot">Versión del documento: ${esc(version)} · <a href="/">yaqu.app</a></div>
</body>
</html>`;
}

// GET /legal/alcance-beta — el alcance de la oferta founding (regla 25)
router.get('/alcance-beta', (_req, res) => {
  const doc = readLegalDoc('ALCANCE_BETA.md');
  if (!doc) return res.status(404).send('Documento no disponible.');
  res.type('html').send(legalShell('Alcance de la oferta Founding', doc.html, doc.version));
});

export default router;
