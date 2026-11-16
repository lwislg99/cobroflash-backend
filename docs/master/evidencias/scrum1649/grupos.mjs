// Grupos finales. Entrada: clase.json (local) + lecturas.json (lo leído en Jira por los dos agentes + SCRUM-1511 §2)
import fs from 'node:fs';
const [claseF, lectF, salida] = process.argv.slice(2);
const v = JSON.parse(fs.readFileSync(claseF, 'utf8'));
const L = JSON.parse(fs.readFileSync(lectF, 'utf8'));
const verano = (f) => /-(jul|ago)-/i.test(f || '');
const AF = /asesor ?\+ ?fundador|validad[oa]s? por el fundador/i;
function grupo(r) {
  if (r.nivel === 'sin-respaldo') return '3a sin respaldo (guard)';
  if (r.nivel === 'anclado') {
    const cl = r.pares.map((p) => L.pares[p] || 'SIN-LEER');
    if (cl.includes('F-literal')) return '1a fundador literal (Jira)';
    if (cl.includes('F-transcrito')) return '1b fundador por cuestionario, transcrito';
    if (cl.includes('SESION-DICE')) return '2c sesion dice fundador, sin sus palabras';
    if (cl.includes('DELEGADA')) return '2b delegacion del orquestador';
    if (cl.includes('SIN-LEER')) return '? ancla sin leer';
    return '2d el comentario no es una aprobacion';
  }
  if (r.asesorBloque && AF.test(r.frase)) return 'T2 asesor + fundador';
  const mc = r.microcopy.map((s) => s.split(':')[0]);
  if (mc.includes('F-LOC')) return '1c fundador literal (ficha microcopy con comentario)';
  if (r.asesorBloque) return '2a asesor nombrado en la marca';
  if (mc.includes('DELEGADA')) return '2b delegacion del orquestador';
  const tl = r.tickets.map((t) => L.tickets[t]).filter(Boolean);
  if (tl.includes('F-literal')) return '1a fundador literal (Jira)';
  if (tl.includes('ASESOR-DICE') || tl.includes('ASESOR-APRUEBA')) return '2a asesor/sesion en el ticket';
  if (tl.includes('NADA')) return '3b el ticket citado no dice nada';
  if (verano(r.fechaReclamada)) return '2e verano jul-ago, ticket sin leer';
  if (mc.includes('F-TICKET')) return '? ficha por el fundador sin id de comentario';
  return '? sin leer (solo Jira lo decide)';
}
const out = {};
const det = [];
for (const r of v) { const g = grupo(r); out[g] = (out[g] || 0) + 1; det.push({ donde: r.donde, nivel: r.nivel, grupo: g, fecha: r.fechaReclamada, pares: r.pares, tickets: r.tickets }); }
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).sort()), null, 1), '\ntotal', v.length);
fs.writeFileSync(salida, JSON.stringify(det, null, 1));
