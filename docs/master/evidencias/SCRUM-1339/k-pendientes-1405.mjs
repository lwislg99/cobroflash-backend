// docs/master/evidencias/SCRUM-1339/k-pendientes-1405.mjs — SCRUM-1339k
// Relee las pasadas de la cobaya de SCRUM-1405 (Linux, CI) que ya están en el repo: cuánto quedó
// pendiente al salir en cada celda con sonda. No baja nada. Uso: node k-pendientes-1405.mjs docs/master/evidencias/SCRUM-1405
import fs from 'node:fs';
import path from 'node:path';
const DIR = process.argv[2];
const filas = [];
for (const run of fs.readdirSync(DIR).filter((d) => d.startsWith('run-'))) {
  for (const f of fs.readdirSync(path.join(DIR, run)).filter((x) => /^cobaya-pasadas-.*\.tsv$/.test(x))) {
    const [cab, ...ls] = fs.readFileSync(path.join(DIR, run, f), 'utf8').trim().split('\n').map((l) => l.split('\t'));
    for (const l of ls) filas.push({ run, f, ...Object.fromEntries(cab.map((c, i) => [c, l[i]])) });
  }
}
console.log('POBLACIÓN: filas', filas.length, '· con sonda (sondas != -):', filas.filter((x) => x.sondas !== '-').length);
const conSonda = filas.filter((x) => x.sondas !== '-');
const porCelda = {};
for (const x of conSonda) (porCelda[x.celda + ' [' + x.flag + ',' + x.modo + ',casos ' + x.casos + '×' + x.copias + ',bloq ' + x.bloqueante + ']'] ??= []).push(x);
for (const [c, l] of Object.entries(porCelda)) {
  const p = l.map((x) => Number(x.pendientes_max)).sort((a, b) => a - b);
  const pos = p.filter((v) => v > 0);
  const aus = l.filter((x) => Number(x.ausentes) > 0).length;
  const tot = [...new Set(l.map((x) => x.total_max))].slice(0, 4).join('/');
  console.log(`${c} · pasadas ${l.length} · con ausentes ${aus} · con pendientes ${pos.length} · pend mín>0 ${pos[0] ?? '-'} · mediana ${pos[Math.floor(pos.length / 2)] ?? '-'} · máx ${p.at(-1)} · total_max ${tot}`);
  // histograma en cubos de 8 KiB
  const h = {};
  for (const v of pos) { const k = Math.floor(v / 8192) * 8; h[k] = (h[k] || 0) + 1; }
  if (pos.length) console.log('     cubos de 8 KiB (inicio en KiB: n): ' + Object.entries(h).map(([k, n]) => `${k}:${n}`).join(' '));
}
const todos = conSonda.map((x) => Number(x.pendientes_max));
console.log('MÁXIMO global de pendientes_max:', Math.max(...todos), '· por encima de 65.536:', todos.filter((v) => v > 65536).length, '· entre 60.000 y 65.536:', todos.filter((v) => v >= 60000 && v <= 65536).length);
// relación pendientes ↔ ausentes: bytes por caso ausente
const rel = conSonda.filter((x) => Number(x.ausentes) > 0 && Number(x.sondas) === 1).map((x) => ({ a: Number(x.ausentes), p: Number(x.pendientes_max) }));
console.log('pasadas con UNA sonda y ausentes:', rel.length, '· B pendientes por caso ausente (mín/mediana/máx):', (() => { const r = rel.map((x) => x.p / x.a).sort((a, b) => a - b); return r.length ? [r[0], r[Math.floor(r.length / 2)], r.at(-1)].map((v) => v.toFixed(0)).join(' / ') : '-'; })());
