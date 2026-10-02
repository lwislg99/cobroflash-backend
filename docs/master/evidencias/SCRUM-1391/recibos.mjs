// recibos.mjs — SCRUM-1391 · la distancia de `staging-gated` a sus plazos, leída de los RECIBOS que la
// tanda gateada deja en `.claude/evidencia-tanda.json` (el mapa `margenes`, SCRUM-265). No lanza nada
// ni toca ninguna base: sólo lee lo que quedó escrito en los árboles de esta máquina.
//   node docs/master/evidencias/SCRUM-1391/recibos.mjs <carpeta que contiene los árboles cobroflash*>
import fs from 'node:fs';
import path from 'node:path';

const BASE = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(BASE)) { console.error('uso: node recibos.mjs <carpeta que contiene los árboles>'); process.exit(2); }
const arboles = fs.readdirSync(BASE).filter((d) => d.startsWith('cobroflash'));
const filas = [];
for (const d of arboles) {
  const f = path.join(BASE, d, '.claude', 'evidencia-tanda.json');
  if (!fs.existsSync(f)) continue;
  try {
    const r = JSON.parse(fs.readFileSync(f, 'utf8'));
    filas.push({ d, t: r.terminadaEn, autotest: r.autotest, total: r.total, fail: r.fail, hijos: r.hijos, m: r.margenes });
  } catch (e) { filas.push({ d, ilegible: String(e.message).slice(0, 60) }); }
}
console.log('POBLACION: ' + arboles.length + ' árboles cobroflash* · ' + filas.length + ' con recibo');
filas.sort((a, b) => String(a.t).localeCompare(String(b.t)));
for (const x of filas) {
  if (x.ilegible) { console.log(x.d + ' · ILEGIBLE ' + x.ilegible); continue; }
  const pct = (k) => (x.m && x.m[k] ? Math.round(100 * x.m[k].durMs / x.m[k].limiteMs) + ' % de ' + Math.round(x.m[k].limiteMs / 60000) + ' min' : 'sin margen escrito');
  const nulos = x.hijos ? Object.entries(x.hijos).filter(([, v]) => v === null).map(([k]) => k) : ['(el recibo no trae hijos)'];
  console.log(String(x.t).slice(0, 16) + 'Z · ' + x.d + ' · autotest ' + x.autotest + ' · total ' + x.total + ' · fail ' + x.fail
    + ' · qa ' + pct('qa') + ' · bot ' + pct('bot') + ' · a55 ' + pct('a55') + ' · hijos que no terminaron: ' + (nulos.join(', ') || 'ninguno'));
}
console.log('EXIT=0');
