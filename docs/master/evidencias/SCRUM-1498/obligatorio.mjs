// obligatorio.mjs <push.json> <push-jobs.json> — por tramo: en cuantos commits el job OBLIGATORIO dio veredicto,
// cuanto dura cada job y cual es el ultimo en acabar (el que retiene el grupo de concurrencia). Sin red.
import fs from 'node:fs';
const { runs } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const jobs = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const OBL = 'build + tests (con banco desechable)';
const t = (s) => Date.parse(s);
const tramos = [['07-09..21-09 (antes de 935b)', '2026-09-07', '2026-09-21T17:33'], ['21-09..25-09', '2026-09-21T17:33', '2026-09-26'], ['26-09..02-10', '2026-09-26', '2026-10-03'], ['06-10..07-10', '2026-10-06', '2026-10-08'], ['ventana de J6 (02-10 01:54Z..07-10 15:44Z)', '2026-10-02T01:54', '2026-10-07T15:44']];
const nombres = new Set();
for (const c of Object.values(jobs)) for (const n of c.nodes) nombres.add(n.name);
console.log('JOBS vistos (control de nombre exacto): ' + [...nombres].map((n) => JSON.stringify(n)).join(' · '));
console.log(`control: el nombre del obligatorio aparece en ${Object.values(jobs).filter((c) => c.nodes.some((n) => n.name === OBL)).length} de ${Object.keys(jobs).length} suites · un nombre inventado en ${Object.values(jobs).filter((c) => c.nodes.some((n) => n.name === 'build + tests (inventado)')).length}`);

for (const [nombre, a, b] of tramos) {
  const l = runs.filter((r) => r.creado >= a && r.creado < b && r.estado === 'completed');
  const c = { success: 0, failure: 0, cancelled: 0, otro: 0, 'sin-job': 0 };
  const dur = {};
  const ultimo = {};
  const vida = [];
  for (const r of l) {
    const ns = r.jobs > 0 ? jobs[r.suite].nodes : [];
    const o = ns.find((n) => n.name === OBL);
    if (!o) c['sin-job']++; else if (o.conclusion === 'SUCCESS') c.success++; else if (o.conclusion === 'FAILURE') c.failure++; else if (o.conclusion === 'CANCELLED') c.cancelled++; else c.otro++;
    let fin = null;
    for (const n of ns) {
      if (!n.startedAt || !n.completedAt) continue;
      (dur[n.name] ||= []).push((t(n.completedAt) - t(n.startedAt)) / 60000);
      if (!fin || t(n.completedAt) > t(fin.completedAt)) fin = n;
    }
    if (fin && (r.fin === 'success' || r.fin === 'failure')) { ultimo[fin.name] = (ultimo[fin.name] || 0) + 1; vida.push((t(fin.completedAt) - t(r.creado)) / 60000); }
  }
  const ver = c.success + c.failure;
  console.log(`\n== ${nombre} · POBLACION ${l.length} runs acabados (uno por push a main)`);
  console.log(`   obligatorio: veredicto ${ver} (${(100 * ver / l.length).toFixed(1)} %) = success ${c.success} + failure ${c.failure} · cancelado a medias ${c.cancelled} · otro ${c.otro} · el job no llego a existir ${c['sin-job']}`);
  const p = (v, q) => { const s = [...v].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1) : '-'; };
  for (const [n, v] of Object.entries(dur).sort()) console.log(`   dura ${JSON.stringify(n)} n=${v.length} p50=${p(v, 0.5)} p90=${p(v, 0.9)} max=${p(v, 1)} min`);
  console.log(`   ultimo job en acabar (runs con success|failure): ${JSON.stringify(ultimo)} · run entero p50=${p(vida, 0.5)} p90=${p(vida, 0.9)} min`);
}
