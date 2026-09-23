// docs/master/evidencias/scrum1092/censo-merges.mjs — SCRUM-1092 punto 2 · SOLO LECTURA
//
// Cruza, para cada PR/merge de origin/main cuya rama declara un ticket scrum-N en el NOMBRE, los
// commits EXCLUSIVOS que ese merge aporta (P1..P2) contra el/los ticket(s) que el MENSAJE de cada
// commit menciona. Cuando ninguno coincide con el ticket de la rama, lo marca.
//
// No es un guard: no falla, no entra en CI, no se registra en package.json. Es la evidencia de
// SCRUM-1092 §2, reproducible con:
//   node docs/master/evidencias/scrum1092/censo-merges.mjs
//
// Reusa la MISMA fuente de verdad que scripts/verificacion-s5/enlace-ticket-rama.mjs (git log
// --merges sobre origin/main, extracción de rama por "Merge pull request #N from .../<rama>" o
// "Merge branch/into <rama>") en vez de reinventar un censo nuevo — lo que añade aquí es la
// pregunta que ese instrumento NO hace: si el CONTENIDO (los commits) de la rama pertenece de
// verdad al ticket que su NOMBRE declara.
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
const lineas = (s) => s.split(/\r?\n/).filter(Boolean);

const ticketsDe = (msg) => {
  const out = new Set();
  for (const m of (msg || '').matchAll(/SCRUM[-\s]0*(\d+)/gi)) out.add(Number(m[1]));
  return [...out];
};
// Un segmento como "1086d" es el ticket 1086 con sufijo de sub-parte (letra pegada, sin guion).
// Una rama con VARIOS tickets declarados en el nombre (scrum-1025-1029-slug) los trae TODOS: sólo
// el primer segmento admite sufijo de letra, los siguientes deben ser números puros consecutivos.
const numsDeRama = (rama) => {
  const partes = (rama || '').replace(/^scrum-/i, '').split('-');
  const out = [];
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i];
    if (i === 0) { const m = p.match(/^(\d+)/); if (!m) break; out.push(Number(m[1])); continue; }
    if (/^\d+$/.test(p)) out.push(Number(p)); else break;
  }
  return out;
};

const RAW = git('log', '--first-parent', '--merges', '--format=%H|%P|%cI|%s', 'origin/main');
const merges = [];
for (const l of lineas(RAW)) {
  const [sha, padres, fecha, ...r] = l.split('|');
  const asunto = r.join('|');
  const [p1, p2] = padres.split(' ');
  if (!p1 || !p2) continue;
  let rama = null;
  let m = asunto.match(/Merge pull request #(\d+) from [\w.-]+\/([\w./-]+)/);
  if (m) rama = m[2];
  else {
    m = asunto.match(/Merge branch '([^']+)'/) || asunto.match(/\binto\s+([\w./-]+)/);
    if (m) rama = m[1];
  }
  const ticketsRama = numsDeRama(rama);
  if (!ticketsRama.length) continue; // sin numero en la rama: fuera de alcance de este cruce
  merges.push({ sha, p1, p2, fecha, asunto, rama, ticketsRama });
}
console.log(`merges con rama scrum-N: ${merges.length} de ${lineas(RAW).length} merges first-parent totales`);

const anomalias = [];
let totalCommits = 0, conTicket = 0, sinTicket = 0;
for (const mg of merges) {
  let out;
  try { out = git('log', '--no-merges', '--format=%H|%cI|%s', `${mg.p1}..${mg.p2}`); }
  catch { anomalias.push({ tipo: 'CIEGO', mg }); continue; }
  for (const l of lineas(out)) {
    const i1 = l.indexOf('|'); const sha = l.slice(0, i1);
    const rest = l.slice(i1 + 1); const i2 = rest.indexOf('|');
    const fecha = rest.slice(0, i2); const asunto = rest.slice(i2 + 1);
    totalCommits++;
    const tks = ticketsDe(asunto);
    if (!tks.length) { sinTicket++; continue; }
    conTicket++;
    if (!tks.some((t) => mg.ticketsRama.includes(t))) anomalias.push({ tipo: 'MISMATCH', mg, commit: { sha, fecha, asunto, tks } });
  }
}
console.log(`commits exclusivos analizados: ${totalCommits} · con ticket en mensaje: ${conTicket} · sin ticket: ${sinTicket}`);
const mism = anomalias.filter((a) => a.tipo === 'MISMATCH');
console.log(`MISMATCH candidatos: ${mism.length} · CIEGO: ${anomalias.length - mism.length}`);

console.log('\n=== DETALLE MISMATCH (mas reciente primero) ===');
for (const a of mism) {
  console.log(`\nrama ${a.mg.rama} (ticket ${a.mg.ticketsRama.join('+')}) · merge ${a.mg.sha.slice(0, 10)} ${a.mg.fecha}`);
  console.log(`  commit ${a.commit.sha.slice(0, 10)} ${a.commit.fecha} tickets=${a.commit.tks.join(',')}`);
  console.log(`  msg: ${a.commit.asunto.slice(0, 140)}`);
}

// Agrupado por rama: separa el "un commit suelto" del "carril reusado durante semanas".
const porRama = new Map();
for (const mg of merges) {
  let out; try { out = git('log', '--no-merges', '--format=%s', `${mg.p1}..${mg.p2}`); } catch { continue; }
  let total = 0, foreign = 0;
  for (const s of lineas(out)) {
    const tks = ticketsDe(s); if (!tks.length) continue; total++;
    if (!tks.some((t) => mg.ticketsRama.includes(t))) foreign++;
  }
  if (!porRama.has(mg.rama)) porRama.set(mg.rama, { total: 0, foreign: 0, merges: 0 });
  const st = porRama.get(mg.rama); st.total += total; st.foreign += foreign; st.merges++;
}
const filas = [...porRama.entries()].filter(([, v]) => v.foreign > 0).map(([k, v]) => ({ rama: k, ...v, ratio: v.foreign / v.total }));
filas.sort((a, b) => a.ratio - b.ratio);
console.log('\n=== AGRUPADO POR RAMA (ratio foreign/total, ascendente) ===');
for (const f of filas) console.log(`${(f.ratio * 100).toFixed(0).padStart(3)}%  foreign=${f.foreign}/${f.total}  merges=${f.merges}  ${f.rama}`);
