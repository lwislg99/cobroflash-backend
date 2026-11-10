// Sonda 2: /legal/alcance-beta servido contra docs/legal/ALCANCE_BETA.md de HEAD, renderizado con una COPIA de
// mdToHtml (legalPages.routes.ts:20-44, sin modificar el original). Uso: node legal.mjs <repo>
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const [repo] = process.argv.slice(2);
const md = execFileSync('git', ['-C', repo, 'show', 'HEAD:docs/legal/ALCANCE_BETA.md']).toString('utf8');
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function mdToHtml(md) {
  const lines = md.split(/\r?\n/); const out = []; let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*>/.test(line)) continue;
    if (/^---+$/.test(line.trim())) { closeList(); out.push('<hr/>'); continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { closeList(); const l = h[1].length; out.push(`<h${l}>${inline(h[2])}</h${l}>`); continue; }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (!line.trim()) { closeList(); continue; }
    closeList(); out.push(`<p>${inline(line)}</p>`);
  }
  closeList(); return out.join('\n');
  function inline(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>'); }
}
const html = mdToHtml(md);
const version = createHash('sha256').update(html).digest('hex').slice(0, 12);
const r = await fetch('https://yaqu.app/legal/alcance-beta', { headers: { 'cache-control': 'no-cache' } });
const servido = await r.text();
const vServida = (servido.match(/Versión del documento: ([0-9a-f]{12})/) || [])[1];
console.log(JSON.stringify({ status: r.status, cf: r.headers.get('cf-cache-status'), version_arbol: version, version_servida: vServida,
  cuerpo_contenido: servido.includes(html), date: r.headers.get('date') }));
