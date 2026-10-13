// latencia.mjs <push.json> <push-jobs.json> — «push -> primer veredicto del OBLIGATORIO que lo cubre» (main es lineal:
// el veredicto de un commit posterior cubre el estado de los anteriores; es la metrica de SCRUM-935 c.16149 punto 4).
// Y el tamano del grupo que cubre cada veredicto (atribucion). Sin red.
import fs from 'node:fs';
const { runs } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const jobs = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const OBL = 'build + tests (con banco desechable)';
const t = (s) => Date.parse(s);
runs.sort((a, b) => t(a.creado) - t(b.creado));
const veredicto = (r) => {
  if (!(r.jobs > 0)) return null;
  const o = jobs[r.suite].nodes.find((n) => n.name === OBL);
  return o && (o.conclusion === 'SUCCESS' || o.conclusion === 'FAILURE') ? { fin: t(o.completedAt), c: o.conclusion } : null;
};
const tramos = [['07-09..21-09 (antes de 935b)', '2026-09-07', '2026-09-21T17:33'], ['26-09..02-10', '2026-09-26', '2026-10-03'], ['ventana de J6 (02-10 01:54Z..07-10 15:44Z)', '2026-10-02T01:54', '2026-10-07T15:44']];
const p = (v, q) => { const s = [...v].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
for (const [nombre, a, b] of tramos) {
  const l = runs.filter((r) => r.creado >= a && r.creado < b);
  const lat = [], grupos = [];
  let sinCubrir = 0, racha = 0, rojosTrasGrupo = [];
  for (let i = 0; i < l.length; i++) {
    let j = i, v = null;
    while (j < l.length && !(v = veredicto(l[j]))) j++;
    if (!v) { sinCubrir++; continue; }
    lat.push((v.fin - t(l[i].creado)) / 60000);
  }
  for (const r of l) {
    racha++;
    const v = veredicto(r);
    if (v) { grupos.push(racha); if (v.c === 'FAILURE') rojosTrasGrupo.push(racha); racha = 0; }
  }
  const h = (n) => grupos.filter((g) => g === n).length;
  console.log(`\n== ${nombre} · POBLACION ${l.length} pushes · veredictos del obligatorio ${grupos.length} · sin cubrir al final de la ventana ${sinCubrir}`);
  console.log(`   latencia push->veredicto que lo cubre (min): p50 ${p(lat, 0.5).toFixed(1)} · p90 ${p(lat, 0.9).toFixed(1)} · max ${p(lat, 1).toFixed(1)}`);
  console.log(`   commits que cubre cada veredicto: 1=${h(1)} 2=${h(2)} 3=${h(3)} 4=${h(4)} >=5=${grupos.filter((g) => g >= 5).length} · max ${Math.max(...grupos)} · media ${(grupos.reduce((s, x) => s + x, 0) / grupos.length).toFixed(2)}`);
  console.log(`   veredictos ROJOS: ${rojosTrasGrupo.length} · commits bajo cada rojo: ${JSON.stringify(rojosTrasGrupo)}`);
}
