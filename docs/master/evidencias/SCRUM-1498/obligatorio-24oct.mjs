// obligatorio-24oct.mjs <push.json> <push-jobs.json> — re-medición del 24-oct (SCRUM-1498b). Sin red.
// Mismo criterio que obligatorio.mjs (veredicto = el JOB obligatorio acaba en success|failure), con tramos
// por semana desde el 8-oct, y dos controles sembrados: un run fabricado con el obligatorio en SUCCESS
// tiene que contar 1 veredicto (positivo) y uno con un nombre inventado tiene que contar 0. Si el positivo
// no sale, el instrumento dice CIEGO y sale 2.
// Además ①: de los runs cancelados con 0 jobs, cuántos nacieron con otro run de main todavía corriendo.
import fs from 'node:fs';
const { runs } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const jobs = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const OBL = 'build + tests (con banco desechable)';
const t = (s) => Date.parse(s);

function veredicto(r, js) {
  const ns = r.jobs > 0 && js[r.suite] ? js[r.suite].nodes : [];
  const o = ns.find((n) => n.name === OBL);
  return o && (o.conclusion === 'SUCCESS' || o.conclusion === 'FAILURE') ? 1 : 0;
}

// Controles sembrados (no se toman del árbol).
const sembradoBueno = { suite: 'S+', jobs: 1 };
const sembradoMalo = { suite: 'S-', jobs: 1 };
const jsSembrado = { 'S+': { nodes: [{ name: OBL, conclusion: 'SUCCESS' }] }, 'S-': { nodes: [{ name: 'build + tests (inventado)', conclusion: 'SUCCESS' }] } };
const pos = veredicto(sembradoBueno, jsSembrado);
const cero = veredicto(sembradoMalo, jsSembrado);
console.log(`control sembrado: positivo=${pos} (tiene que ser 1) · nombre inventado=${cero} (tiene que ser 0)`);
if (pos !== 1 || cero !== 0) { console.log('CIEGO: el criterio no distingue los controles'); process.exit(2); }
const conNombre = Object.values(jobs).filter((c) => c.nodes.some((n) => n.name === OBL)).length;
console.log(`el nombre exacto del obligatorio aparece en ${conNombre} de ${Object.keys(jobs).length} suites con jobs`);
if (conNombre === 0) { console.log('CIEGO: el nombre del obligatorio no aparece en ninguna suite'); process.exit(2); }

const tramos = [
  ['08-10..14-10', '2026-10-08', '2026-10-15'],
  ['15-10..21-10', '2026-10-15', '2026-10-22'],
  ['22-10..24-10 10:47Z', '2026-10-22', '2026-10-25'],
  ['TODO 08-10..24-10', '2026-10-08', '2026-10-25'],
];
const p = (v, q) => { const s = [...v].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1) : '-'; };
for (const [nombre, a, b] of tramos) {
  const l = runs.filter((r) => r.creado >= a && r.creado < b && r.estado === 'completed');
  const enCurso = runs.filter((r) => r.creado >= a && r.creado < b && r.estado !== 'completed').length;
  let ver = 0; let sinJob = 0;
  const dur = {}; const ultimo = {}; const vida = [];
  for (const r of l) {
    ver += veredicto(r, jobs);
    if (!(r.jobs > 0)) { sinJob++; continue; }
    const ns = jobs[r.suite]?.nodes || [];
    let fin = null;
    for (const n of ns) {
      if (!n.startedAt || !n.completedAt) continue;
      (dur[n.name] ||= []).push((t(n.completedAt) - t(n.startedAt)) / 60000);
      if (!fin || t(n.completedAt) > t(fin.completedAt)) fin = n;
    }
    if (fin && (r.fin === 'success' || r.fin === 'failure')) { ultimo[fin.name] = (ultimo[fin.name] || 0) + 1; vida.push((t(fin.completedAt) - t(r.creado)) / 60000); }
  }
  console.log(`\n== ${nombre} · POBLACION ${l.length} runs acabados (+${enCurso} sin acabar, fuera)`);
  console.log(`   obligatorio con veredicto: ${ver} de ${l.length} (${(100 * ver / l.length).toFixed(1)} %) · runs sin ningún job: ${sinJob}`);
  for (const [n, v] of Object.entries(dur).sort()) console.log(`   dura ${JSON.stringify(n)} n=${v.length} p50=${p(v, 0.5)} p90=${p(v, 0.9)} max=${p(v, 1)} min`);
  console.log(`   último job en acabar: ${JSON.stringify(ultimo)} · run entero p50=${p(vida, 0.5)} p90=${p(vida, 0.9)} max=${p(vida, 1)} min`);
}

// ① mecanismo: cancelado sin jobs ⇒ ¿había otro run de main corriendo cuando nació?
const acabados = runs.filter((r) => r.estado === 'completed');
const sust = acabados.filter((r) => r.fin === 'cancelled' && !(r.jobs > 0));
const conJobs = acabados.filter((r) => r.jobs > 0);
let encaja = 0; const raros = [];
for (const r of sust) {
  const otro = conJobs.some((o) => o.id !== r.id && t(o.creado) <= t(r.creado) && t(o.tocado) >= t(r.creado));
  if (otro) encaja++; else raros.push(r.id);
}
console.log(`\n① cancelados con 0 jobs: ${sust.length} · nacieron con otro run de main corriendo: ${encaja} · no encajan: ${raros.length}${raros.length ? ' → ' + raros.join(',') : ''}`);
const otrasConclusiones = {};
for (const r of acabados) otrasConclusiones[`${r.fin}/${r.jobs > 0 ? 'con-jobs' : 'sin-jobs'}`] = (otrasConclusiones[`${r.fin}/${r.jobs > 0 ? 'con-jobs' : 'sin-jobs'}`] || 0) + 1;
console.log(`   reparto de conclusiones (población ${acabados.length}): ${JSON.stringify(otrasConclusiones)}`);

// El meta-guard contra su techo (timeout-minutes: 30), antes y después de SCRUM-935d/935e (merges del 23-oct).
const META = (r) => (jobs[r.suite]?.nodes || []).find((j) => j.name.startsWith('meta-guard'));
for (const [n, a, b] of [['08-10..23-10 13:04Z (antes de 935d)', '2026-10-08', '2026-10-23T13:05'], ['23-10 13:39Z.. (después de 935e)', '2026-10-23T13:39', '2026-10-25']]) {
  const mg = acabados.filter((r) => r.creado >= a && r.creado < b && r.jobs > 0).map(META).filter((j) => j && j.completedAt);
  const d = mg.map((j) => (t(j.completedAt) - t(j.startedAt)) / 60000);
  const c = {}; for (const j of mg) c[j.conclusion] = (c[j.conclusion] || 0) + 1;
  console.log(`meta-guard ${n}: n=${d.length} p50=${p(d, 0.5)} max=${p(d, 1)} · >=29.9 min: ${d.filter((x) => x >= 29.9).length} · ${JSON.stringify(c)}`);
}
