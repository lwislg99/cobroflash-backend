// detalle.mjs <push.json> <fichero con «sha fechaISO» de main en primer padre>
import fs from 'node:fs';
const { runs } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const t = (s) => Date.parse(s);
runs.sort((a, b) => t(a.creado) - t(b.creado));

// 1 · distribucion de dY (nacimiento del run siguiente - muerte de X), sin ventana elegida
const cubos = [[-1e9, -60], [-60, -30], [-30, -15], [-15, -5], [-5, 0], [0, 5], [5, 15], [15, 60], [60, 1e9]];
for (const [nombre, sel] of [['cancelado-0-jobs', (r) => r.fin === 'cancelled' && r.jobs === 0], ['con jobs (control)', (r) => r.jobs > 0 && r.estado === 'completed']]) {
  const c = cubos.map(() => 0);
  let n = 0;
  runs.forEach((X, i) => {
    if (!sel(X) || X.creado < '2026-09-22' || !runs[i + 1]) return;
    const d = (t(runs[i + 1].creado) - t(X.tocado)) / 1000;
    c[cubos.findIndex(([a, b]) => d >= a && d < b)]++;
    n++;
  });
  console.log(`dY «${nombre}» n=${n}: ` + cubos.map(([a, b], k) => `[${a <= -1e9 ? '-inf' : a},${b >= 1e9 ? 'inf' : b})=${c[k]}`).join(' '));
}

// 2 · duracion del run (creado->tocado) de los que SI corrieron, por tramo, y cobertura
const tramos = [['07-09..21-09', '2026-09-07', '2026-09-22'], ['22-09..25-09', '2026-09-22', '2026-09-26'], ['26-09..02-10', '2026-09-26', '2026-10-03'], ['06-10..07-10', '2026-10-06', '2026-10-08']];
console.log('\ntramo\truns\tcon-jobs\t%\tcon-veredicto(success|failure)\t%\tvida-p50-min\tvida-p90-min\tvida-max-min');
for (const [nombre, a, b] of tramos) {
  const l = runs.filter((r) => r.creado >= a && r.creado < b && r.estado === 'completed');
  const cj = l.filter((r) => r.jobs > 0);
  const ver = l.filter((r) => r.fin === 'success' || r.fin === 'failure');
  const v = ver.map((r) => (t(r.tocado) - t(r.creado)) / 60000).sort((x, y) => x - y);
  const p = (q) => (v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))].toFixed(1) : '-');
  console.log([nombre, l.length, cj.length, (100 * cj.length / l.length).toFixed(0), ver.length, (100 * ver.length / l.length).toFixed(0), p(0.5), p(0.9), v.length ? v[v.length - 1].toFixed(1) : '-'].join('\t'));
}

// 3 · commits de main (primer padre) sin run de push
if (process.argv[3]) {
  const lineas = fs.readFileSync(process.argv[3], 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split(' '));
  const porSha = new Map();
  for (const r of runs) { if (!porSha.has(r.sha)) porSha.set(r.sha, []); porSha.get(r.sha).push(r); }
  let con = 0, cero = 0, sin = [];
  for (const [sha, fecha, ...resto] of lineas) {
    const rs = porSha.get(sha);
    if (!rs) { sin.push(`${sha.slice(0, 10)} ${fecha} ${resto.join(' ').slice(0, 90)}`); continue; }
    if (rs.some((r) => r.jobs > 0)) con++; else cero++;
  }
  console.log(`\nCOMMITS de main en primer padre: ${lineas.length} · con run con jobs ${con} · solo runs sin jobs ${cero} · SIN run de push ${sin.length}`);
  for (const s of sin) console.log('  SIN RUN ' + s);
  const shasMain = new Set(lineas.map((l) => l[0]));
  const huerfanos = runs.filter((r) => r.creado >= lineas[lineas.length - 1][1] && !shasMain.has(r.sha));
  console.log(`runs de push cuyo sha NO es un commit de primer padre de la lista: ${huerfanos.length}`);
}
