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
    // Línea sangrada justo debajo de una viñeta: es su continuación, va dentro del mismo <li>
    // (SCRUM-1551i). Cada línea pasa por inline() por separado, como antes: sólo cambia dónde va.
    if (inList && /^\s+\S/.test(line)) { out[out.length - 1] = `${out[out.length - 1].slice(0, -'</li>'.length)} ${inline(line.trim())}</li>`; continue; }
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
<link rel="stylesheet" href="/legal-documento.css"/>
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
