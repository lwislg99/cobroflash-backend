// Clasificación LOCAL (sin Jira) de cada marca con respaldo: qué dice la FUENTE a la que lleva.
import fs from 'node:fs';
import path from 'node:path';
const [raiz, censoF, blameF, salida] = process.argv.slice(2);
const censo = JSON.parse(fs.readFileSync(censoF, 'utf8'));
const blame = new Map(JSON.parse(fs.readFileSync(blameF, 'utf8')).map((x) => [x.donde, x]));
const mcDir = path.join(raiz, 'docs/microcopy');
const mc = fs.readdirSync(mcDir).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => {
  const t = fs.readFileSync(path.join(mcDir, f), 'utf8');
  const cab = t.split('\n').slice(0, 8).join(' ');
  let clase;
  if (/delegaci[oó]n/i.test(cab)) clase = 'DELEGADA';
  else if (/aprobad[oa]s?\*{0,2} por el \*{0,2}asesor/i.test(cab)) clase = 'ASESOR';
  else if (/por el \*{0,2}fundador/i.test(cab) && /comentarios? \d{5}|literal: «/i.test(cab)) clase = 'F-LOC';
  else if (/por el \*{0,2}fundador/i.test(cab)) clase = 'F-TICKET';
  else clase = 'OTRA';
  const tk = (f.match(/SCRUM-(\d+)/) || [])[1];
  return { f, tk, clase, asesorCab: /asesor/i.test(cab) };
});
const porTicket = new Map();
for (const m of mc) if (m.tk) (porTicket.get(m.tk) ?? porTicket.set(m.tk, []).get(m.tk)).push(m);
const MES = '(?:jul|ago|sep|oct|nov)';
const res = [];
for (const x of censo) {
  if (x.nivel === 'sin-respaldo') { res.push({ donde: x.donde, nivel: x.nivel, grupo: '3' }); continue; }
  const b = blame.get(x.donde) || {};
  const tickets = (b.ticketsFrase?.length ? b.ticketsFrase : x.tickets).map((t) => t.replace(/\D/g, ''));
  const fuentesMc = tickets.flatMap((t) => porTicket.get(t) || []);
  const docsMc = (x.docs || []).filter((d) => d.includes('docs/microcopy/')).map((d) => path.basename(d.trim().replace(/[`.,;)]+$/, '')));
  for (const d of docsMc) { const m = mc.find((m) => d.startsWith(m.f.replace(/\.md$/, '')) || m.f === d); if (m && !fuentesMc.includes(m)) fuentesMc.push(m); }
  const fechaRe = new RegExp(`\\b(\\d{1,2})-${MES}-2026`, 'i');
  const fechaReclamada = ((x.frase || '').match(fechaRe) || x.texto?.match(fechaRe) || [null])[0];
  res.push({
    donde: x.donde, nivel: x.nivel, fechaLinea: b.fecha, fechaReclamada, asesorBloque: x.asesor,
    pares: x.pares.map((p) => `${p.ticket}c${p.comentario}`), tickets, docRespaldo: x.docRespaldo,
    microcopy: fuentesMc.map((m) => `${m.clase}:${m.f}`), delegacionBloque: /delegaci[oó]n/i.test(x.texto || ''),
    frase: (x.frase || '').slice(0, 160),
  });
}
fs.writeFileSync(salida, JSON.stringify(res, null, 1));
const c = {};
for (const r of res) {
  if (r.nivel !== 'rastreable') continue;
  const k = [r.asesorBloque ? 'asesor-en-bloque' : '', r.delegacionBloque ? 'deleg-en-bloque' : '', r.microcopy.length ? 'mc:' + [...new Set(r.microcopy.map((s) => s.split(':')[0]))].sort().join('+') : 'sin-microcopy'].filter(Boolean).join(' · ');
  c[k] = (c[k] || 0) + 1;
}
console.log('microcopy clases:', JSON.stringify(mc.reduce((a, m) => ((a[m.clase] = (a[m.clase] || 0) + 1), a), {})));
console.log('RASTREABLE por fuente local:', JSON.stringify(c, null, 1));
const fr = {};
for (const r of res) if (r.nivel === 'rastreable') { const k = r.fechaReclamada ? (/-(jul|ago)-/i.test(r.fechaReclamada) ? 'jul-ago' : /-sep-/i.test(r.fechaReclamada) ? 'sep' : 'oct-nov') : 'sin fecha'; fr[k] = (fr[k] || 0) + 1; }
console.log('RASTREABLE por fecha reclamada:', JSON.stringify(fr));
