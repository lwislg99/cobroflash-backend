// CENSO DEL PATRÓN GEMELO en src/ · sólo lee · uso: node censo-gemelos.mjs <repo> [ref] [--lineas <clave>]
// Método: para cada familia, `git grep -n -E` sobre <ref>:src de (a) el helper y (b) la forma cruda.
// Se descartan las líneas que son sólo comentario. NO entiende sintaxis: es texto.
import { execFileSync } from 'node:child_process';
const [repo, ref = 'origin/main', ...resto] = process.argv.slice(2);
const ver = resto[0] === '--lineas' ? resto[1] : null;
const sha = execFileSync('git', ['-C', repo, 'rev-parse', ref], { encoding: 'utf8' }).trim();
function grep(patron) {
  let out = '';
  try { out = execFileSync('git', ['-C', repo, 'grep', '-n', '-E', patron, sha, '--', 'src'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { if (e.status !== 1) throw e; }
  return out.split('\n').filter(Boolean).map((l) => {
    const m = l.match(/^[0-9a-f]+:([^:]+):(\d+):(.*)$/);
    return { f: m[1], n: Number(m[2]), t: m[3] };
  }).filter((x) => !/^\s*(\/\/|\*|\/\*)/.test(x.t));
}
const F = {
  'dinero.helper': 'formatMoneyEs\\(|formatImporteEs\\(|fmtImporte\\(',
  'dinero.crudo': 'toFixed\\(2\\)',
  'dinero.crudoEnTexto': '\\$\\{[^}]*toFixed\\(2\\)[^}]*\\}',
  'linea.helper': 'lineasQueSuman\\(|precioConDto\\(|calcTotal\\(|calcVatBreakdown\\(',
  'linea.crudo': '(qty|cantidad)[^;*\\n]{0,12}\\*[^;\\n]{0,24}(price|precio)|(price|precio)[^;*\\n]{0,12}\\*[^;\\n]{0,24}(qty|cantidad)',
  'numero.helper': 'displayQuoteNumber\\(|numeroConRevision\\(|displayInvoiceNumber\\(',
  'numero.crudo': '#\\$\\{[^}]*(\\.id|Id|quoteNumber)[^}]*\\}',
  'aceptado.helper': 'presupuestoAceptado\\(',
  'aceptado.crudo': "status\\s*[!=]==\\s*'accepted'",
  'modo.helper': 'getEmissionMode\\(|esJustificante|isJustificante|documentoEsJustificante',
  'fecha.crudo': 'toLocaleDateString\\(',
  'fecha.helper': 'formatFecha[A-Za-z]*\\(|fechaEs[A-Za-z]*\\(|fmtFecha[A-Za-z]*\\(|formatDateEs\\(|fechaLarga\\(|fechaCorta\\(',
  'telefono.helper': 'normalizePhone\\(',
  'escape.helper': '\\besc\\(|escapeHtml\\(|escaparHtml\\(',
  'id.helper': 'cabeEnColumnaInt\\(',
  'id.crudo': 'Number\\.isInteger\\(|Number\\.isNaN\\((id|[a-zA-Z]*Id)\\)|isNaN\\((id|[a-zA-Z]*Id)\\)',
};
console.log('medido contra', ref, '=', sha);
if (ver) { for (const x of grep(F[ver])) console.log(`${x.f}:${x.n}: ${x.t.trim().slice(0, 170)}`); process.exit(0); }
for (const [k, p] of Object.entries(F)) {
  const r = grep(p);
  console.log(k.padEnd(22), String(r.length).padStart(4), 'líneas ·', String(new Set(r.map((x) => x.f)).size).padStart(3), 'ficheros');
}
